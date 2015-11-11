'use strict'

var Promise = require('bluebird')
var mongoose = require('mongoose')
var keypather = require('keypather')()
var TaskFatalError = require('ponos').TaskFatalError
var TaskError = require('ponos').TaskError

require('loadenv')({ debugName: 'link:env' })

var NaviEntrySchema = require('models/schemas/navi-entry')
var Runnable = require('runnable')

var superUser = new Runnable(process.env.API_HOST, {
  requestDefaults: {
    headers: {
      'user-agent': 'link'
    }
  },
  userContentDomain: process.env.USER_CONTENT_DOMAIN
})

var loginPromise = null
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
 * @returns {Promise}
 * @private
 */
NaviEntrySchema.statics._getDirectURlObj = function (instance) {
  return getSuperUser()
    .then(function () {
      return Promise.fromCallback(function (callback) {
        instance.fetchDependencies(callback)
      })
    })
    .then(function (dependencies) {
      function processPorts (ports) {
        var newPorts = {}
        if (ports) {
          Object.keys(ports).forEach(function (key) {
            newPorts[key.split('/')[0]] = ports[key][0].HostPort
          })
        }
        return newPorts
      }
      return {
        branch: instance.getBranchName(),
        url: instance.getContainerHostname(),
        dependencies: dependencies,
        dockerHost: keypather.get(instance, 'attrs.container.dockerHost'),
        ports: processPorts(keypather.get(instance, 'attrs.container.ports')),
        running: !!keypather.get(instance, 'attrs.container.Running') // Coerce this value to a boolean.
      }
    })
    .catch(function (err) {
      if (keypather.get(err, 'data.statusCode') === 404) {
        throw new TaskFatalError('_getDirectURLObj', 'Instance not found', {
          err: err
        })
      }
      throw err
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
  return NaviEntrySchema.statics._getDirectURlObj(instance)
    .then(function (directUrlObj) {
      var update = { $set: {} }
      update.$set['directUrls.' + instance.attrs.shortHash] = directUrlObj
      update.$set.lastUpdated = timestamp
      var find = {
        'lastUpdated': { $lt: timestamp }
      }
      find['directUrls.' + instance.attrs.shortHash] = {$exists: true}
      return Promise.fromCallback(function (callback) {
        NaviEntry.findOneAndUpdate(find, update, {upsert: false}, callback)
      })
    })
}

/**
 * Create or update a navi entry document when an instance is created
 * Create a new navi entry document if this is a masterPod instance
 * Update an existing navi entry document if this is not a masterPod instance
 * @param {Object} instance
 * @param {date} timestamp
 * @returns Promise
 */
NaviEntrySchema.statics.handleNewInstance = function (instance, timestamp) {
  if (!instance.masterPod) {
    return NaviEntry.handleInstanceUpdate(instance, timestamp)
  }
  instance = superUser.newInstance(instance, {noStore: true})
  return NaviEntrySchema.statics._getDirectURlObj(instance)
    .then(function (directUrlObj) {
      var directUrls = {}
      directUrls[instance.attrs.shortHash] = directUrlObj
      var naviEntry = new NaviEntry({
        elasticUrl: instance.getElasticHostname(),
        ownerGithubId: instance.attrs.owner.github,
        directUrls: directUrls,
        lastUpdated: timestamp
      })
      return Promise.fromCallback(function (callback) {
        naviEntry.save(callback)
      })
    })
}

/**
 * Handles remove the entry from the navi document
 * If it's a master pod instance we delete the entire navi document
 * @param {Object} instance
 * @returns Promise
 */
NaviEntrySchema.statics.handleInstanceDelete = function (instance) {
  var find = {}
  find['directUrls.' + instance.shortHash] = {$exists: true}
  if (instance.masterPod) {
    return Promise.fromCallback(function (cb) {
      NaviEntry.findOneAndRemove(find, cb)
    })
  } else {
    var update = { $unset: {} }
    update.$unset['directUrls.' + instance.shortHash] = true
    return Promise.fromCallback(function (cb) {
      NaviEntry.findOneAndUpdate(find, update, cb)
    })
      .catch(function (err) {
        throw new TaskFatalError(
          'handleInstanceDelete',
          'Error when trying to findOneAndUpdate',
          {
            err: err,
            find: find,
            update: update
          }
        )
      })
  }
}

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
