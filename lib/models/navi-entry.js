'use strict'

let Promise = require('bluebird')
let mongoose = require('mongoose')
let keypather = require('keypather')()
let TaskFatalError = require('ponos').TaskFatalError
let url = require('url')

require('loadenv')({ debugName: 'link:env' })

let NaviEntrySchema = require('models/schemas/navi-entry')
let Runnable = require('runnable')

let superUser = new Runnable(process.env.API_HOST, {
  requestDefaults: {
    headers: {
      'user-agent': 'link'
    }
  },
  userContentDomain: process.env.USER_CONTENT_DOMAIN
})

let loginPromise = null
function getSuperUser () {
  if (!loginPromise) {
    loginPromise = Promise.fromCallback(function (cb) {
      superUser.githubLogin(process.env.HELLO_RUNNABLE_GITHUB_TOKEN, cb)
    })
  }
  return loginPromise
}

/**
 * (Internal) get the directURLObj that we will use to populate the instance configuration
 * @param instance
 * @param {date} timestamp
 * @returns {Promise}
 * @private
 */
NaviEntrySchema.statics._getDirectURlObj = function (instance, timestamp) {
  return getSuperUser()
    .then(function () {
      return Promise.fromCallback(function (callback) {
        instance.fetchDependencies(callback)
      })
    })
    .catch(function (err) {
      if (keypather.get(err, 'data.statusCode') === 404) {
        throw new TaskFatalError('_getDirectURLObj', 'Instance not found when fetching dependencies from API', {
          err: err
        })
      }
      throw err
    })
    .then(function (dependencies) {
      function processPorts (ports) {
        let newPorts = {}
        if (ports) {
          Object.keys(ports).forEach(function (key) {
            newPorts[key.split('/')[0]] = ports[key][0].HostPort
          })
        }
        return newPorts
      }
      function processDockerHost (dockerHost) {
        if (dockerHost) {
          return url.parse(dockerHost).hostname
        }
        return dockerHost
      }
      return {
        branch: instance.getBranchName(),
        url: instance.getContainerHostname(),
        dependencies: dependencies,
        dockerHost: processDockerHost(keypather.get(instance, 'attrs.container.dockerHost')),
        ports: processPorts(keypather.get(instance, 'attrs.container.ports')),
        running: !!keypather.get(instance, 'attrs.container.inspect.state.Running'), // Coerce this value to a boolean.
        lastUpdated: timestamp,
        masterPod: instance.attrs.masterPod
      }
    })
}

/**
 * Handle when the instance changes in any way
 * @param {Object} instance
 * @param {date} timestamp
 * @returns Promise
 */
NaviEntrySchema.statics.handleInstanceUpdate = function (instance, timestamp) {
  instance = superUser.newInstance(instance)
  return NaviEntrySchema.statics._getDirectURlObj(instance, timestamp)
    .then(function (directUrlObj) {
      // If its a newer change or it doesn't exist!
      let timestampCheck = {}
      timestampCheck['directUrls.' + instance.attrs.shortHash + '.lastUpdated'] = { $lt: timestamp }
      let existsCheck = {}
      existsCheck['directUrls.' + instance.attrs.shortHash + '.lastUpdated'] = { $exists: false }
      let find = {$or: [timestampCheck, existsCheck]}
      let update = {
        $set: {
          elasticUrl: instance.getElasticHostname(),
          ownerGithubId: instance.attrs.owner.github
        }
      }
      update.$set['directUrls.' + instance.attrs.shortHash] = directUrlObj
      return Promise.fromCallback(function (callback) {
        // Upsert the record, so we never lose any data
        NaviEntry.findOneAndUpdate(find, update, { upsert: true }, callback)
      })
    })
}

/**
 * Handles remove the entry from the navi document
 * If it's a master pod instance we delete the entire navi document
 * @param {Object} instance
 * @param {date} timestamp
 * @returns Promise
 */
NaviEntrySchema.statics.handleInstanceDelete = function (instance, timestamp) {
  let find = {}
  find['directUrls.' + instance.shortHash + '.lastUpdated'] = { $lt: timestamp }
  let update = { $unset: {} }
  update.$unset['directUrls.' + instance.shortHash] = true
  return Promise.fromCallback(function (cb) {
    NaviEntry.findOneAndUpdate(find, update, cb)
  })
}

let NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
