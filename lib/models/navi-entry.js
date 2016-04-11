'use strict'

var Promise = require('bluebird')
var mongoose = require('mongoose')
var keypather = require('keypather')()
var TaskFatalError = require('ponos').TaskFatalError
var TaskError = require('ponos').TaskError
var url = require('url')
var logger = require('../logger')

require('loadenv')({ debugName: 'link:env' })

var NaviEntrySchema = require('models/schemas/navi-entry')
var Runnable = require('@runnable/api-client')
var hermesInstance = require('hermes')

var superUser = new Runnable(process.env.API_URL, {
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
      .catch(function (err) {
        throw new TaskError('getSuperUser', 'Unable to login to api', {
          err: err,
          API_HOST: process.env.API_HOST,
          userContentDomain: process.env.USER_CONTENT_DOMAIN
        })
      })
  }
  return loginPromise
}

function getIsolatedShorthash (instance) {
  if (instance.attrs.isolated && !instance.attrs.isIsolationGroupMaster) {
    return instance.attrs.name.slice(0, instance.attrs.name.indexOf('--'))
  }
  return instance.attrs.shortHash
}

var regexForIsolatedNames = /^([A-z0-9]*)(--)(.*)/

/**
 * (Internal) get the directURLObj that we will use to populate the instance configuration
 * @param instance
 * @param {date} timestamp
 * @returns {Promise}
 * @private
 */
NaviEntrySchema.statics._getDirectURlObj = function (instance, timestamp) {
  var log = logger.child({
    timestamp: timestamp,
    instance: instance
  })
  log.info('NaviEntrySchema.statics._getDirectURlObj')
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
            var exposedPort = keypather.get(ports[key], '[0].HostPort')
            var localPort = key.split('/')[0]
            if (exposedPort && localPort) {
              newPorts[localPort] = exposedPort
            }
          })
        }
        if (Object.keys(newPorts).length === 0) {
          log.warn('Instance has no ports')
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
            var newDep = {
              shortHash: dependency.shortHash,
              elasticUrl: dependency.hostname
            }
            if (dependency.isolated && regexForIsolatedNames.test(dependency.name)) {
              var matches = regexForIsolatedNames.exec(dependency.name)
              newDep.isolatedMastersShortHash = matches[1] // First item in the array is the full match
            }
            newDependencies.push(newDep)
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
        masterPod: instance.attrs.masterPod,
        dockRemoved: !!keypather.get(instance, 'contextVersion.attrs.dockRemoved') // Coerce this value to a boolean.
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
      var shortHash = getIsolatedShorthash(instance)
      // If its a newer change or it doesn't exist!
      var timestampCheck = {}
      timestampCheck['directUrls.' + shortHash + '.lastUpdated'] = { $lt: timestamp }
      var existsCheck = {}
      existsCheck['directUrls.' + shortHash + '.lastUpdated'] = { $exists: false }
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
      if (instance.attrs.masterPod) {
        update.$set['ipWhitelist.enabled'] = keypather.get(instance, 'attrs.ipWhitelist.enabled') || false
      }
      update.$set['directUrls.' + shortHash] = directUrlObj
      return Promise.fromCallback(function (callback) {
        // Upsert the record, so we never lose any data
        NaviEntry.findOneAndUpdate(find, update, { upsert: true, new: true }, callback)
      })
        .then(function (updateResults) {
          hermesInstance.publishCacheInvalidated(update.$set.elasticUrl)
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

  return Promise.fromCallback(function (cb) {
    NaviEntry.findOneAndUpdate(find, update, {new: true}, cb)
  })
    .then(function (newRecord) {
      // If we have no more items let's atomically remove it
      if (newRecord && Object.keys(newRecord.directUrls).length === 0) {
        return Promise.fromCallback(function (cb) {
          NaviEntry.findOneAndRemove({
            elasticUrl: newRecord.elasticUrl,
            directUrls: {}
          }, cb)
        }).return(newRecord)
      }
      return newRecord
    })
    .then(function enqueueCacheInvalidationTask (newRecord) {
      var elasticUrl = keypather.get(newRecord, 'elasticUrl')
      if (elasticUrl) {
        hermesInstance.publishCacheInvalidated(elasticUrl)
      }
    })
}

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
