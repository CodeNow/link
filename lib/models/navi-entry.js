'use strict'

var Promise = require('bluebird')
var mongoose = require('mongoose')
var keypather = require('keypather')()
var TaskFatalError = require('ponos').TaskFatalError
var url = require('url')

require('loadenv')({ debugName: 'link:env' })

var NaviEntrySchema = require('models/schemas/navi-entry')
var Runnable = require('runnable')
var hermesInstance = require('../hermes')

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
        var newPorts = {}
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

      function processDependencies (dependencies) {
        var newDependencies = []
        if (dependencies) {
          dependencies.forEach(function (dependency) {
            newDependencies.push({
              shortHash: dependency.shortHash,
              elasticUrl: dependency.hostname
            })
          })
        }
        return newDependencies
      }
      return {
        branch: instance.getBranchName(),
        url: instance.getContainerHostname(),
        dependencies: processDependencies(dependencies),
        dockerHost: processDockerHost(keypather.get(instance, 'attrs.container.dockerHost')),
        ports: processPorts(keypather.get(instance, 'attrs.container.ports')),
        running: !!keypather.get(instance, 'attrs.container.inspect.State.Running'), // Coerce this value to a boolean.
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
      var timestampCheck = {}
      timestampCheck['directUrls.' + instance.attrs.shortHash + '.lastUpdated'] = { $lt: timestamp }
      var existsCheck = {}
      existsCheck['directUrls.' + instance.attrs.shortHash + '.lastUpdated'] = { $exists: false }
      var find = {
        elasticUrl: instance.getElasticHostname(),
        $or: [timestampCheck, existsCheck]
      }
      var update = {
        $set: {
          elasticUrl: instance.getElasticHostname(),
          ownerGithubId: instance.attrs.owner.github
        }
      }
      update.$set['directUrls.' + instance.attrs.shortHash] = directUrlObj
      return Promise.fromCallback(function (callback) {
        // Upsert the record, so we never lose any data
        NaviEntry.findOneAndUpdate(find, update, { upsert: true, new: true }, callback)
      })
      .then(function enqueueCacheInvalidationTask (updateResults) {
        hermesInstance.publish('cache.invalidated', {
          elasticUrl: update.$set.elasticUrl
        })
        return updateResults
      })
        .catch(function (err) {
          // If the error is a duplicate key error that means this is an out of date upsert.
          // (the document exists, but we didn't match due to the $lt timestamp check and tried to make a new one)
          if (err.code === 11000) {
            throw new TaskFatalError('handleInstanceUpdate', 'Attempted to process old job')
          }
          throw err
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
  var find = {}
  find['directUrls.' + instance.shortHash + '.lastUpdated'] = { $lt: timestamp }
  var update = { $unset: {} }
  update.$unset['directUrls.' + instance.shortHash] = true

  var elasticUrl;
  return Promise.fromCallback(function (cb) {
    NaviEntry.findOneAndUpdate(find, update, {new: true}, cb)
  })
    .then(function (newRecord) {
      elasticUrl = keypather.get(newRecord, 'elasticUrl')
      // If we have no more items let's atomically remove it
      if (newRecord && Object.keys(newRecord.directUrls).length === 0) {
        return Promise.fromCallback(function (cb) {
          NaviEntry.findOneAndRemove({
            elasticUrl: newRecord.elasticUrl,
            directUrls: {}
          }, cb)
        })
      }
    })
    .then(function enqueueCacheInvalidationTask () {
      hermesInstance.publish('cache.invalidated', {
        elasticUrl: elasticUrl
      })
    })
}

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
