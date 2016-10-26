'use strict'
require('loadenv')({ debugName: 'link:env' })

const keypather = require('keypather')()
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Runnable = require('@runnable/api-client')
const url = require('url')
const WorkerError = require('error-cat/errors/worker-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const logger = require('../logger')
const NaviEntrySchema = require('models/schemas/navi-entry')
const publisher = require('../publisher')

const superUser = new Runnable(process.env.API_URL, {
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
        throw new WorkerError('Unable to login to api', {
          err: err,
          API_HOST: process.env.API_HOST,
          userContentDomain: process.env.USER_CONTENT_DOMAIN
        })
      })
  }
  return loginPromise
}

//                             ShortHash  -- {{ Figuratively Anything Else }}
const regexForIsolatedNames = /^([A-z0-9]*)--/

/**
 * Extract the parent master shortHash from the instanceName
 * @param  {String} instanceName - name of the isolated container instance
 * @returns {String} shortHash of the Isolation Group Master
 * @throws WorkerStopError when the instance doesn't have the shortHash in the name
 */
NaviEntrySchema.statics._extractIsolatedMasterShortHash = function (instanceName) {
  const matches = regexForIsolatedNames.exec(instanceName)
  if (!matches || !matches.length) {
    // If this happens, we've hit a bug
    throw new WorkerStopError(
      'Tried to process an isolated name that didn\'t work',
      { instanceName: instanceName }
    )
  }
  return matches[1] // 0th item in the array is the full match, we want the 1st ([A-z0-9]*)
}

/**
 * Take an instance model, check if it's isolated (both checks are necessary), then return the
 * shortHash it should use for the NaviEntry.  This is how isolation should be determined for
 * instances
 * @param  {Instance} instance - instance model
 * @returns {String} The shortHash that should be used for isolated container navi-gation
 */
NaviEntrySchema.statics._getIsolatedShortHash = function (instance) {
  if (instance.attrs.isolated && !instance.attrs.isIsolationGroupMaster) {
    return NaviEntry._extractIsolatedMasterShortHash(instance.attrs.name)
  }
  return instance.attrs.shortHash
}

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
        throw new WorkerStopError('Instance not found when fetching dependencies from API', {
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
              newDep.isolatedMastersShortHash = NaviEntrySchema.statics._extractIsolatedMasterShortHash(dependency.name)
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
  var log = logger.child({
    timestamp: timestamp,
    instance: instance,
    method: 'NaviEntrySchema.statics.handleInstanceUpdate'
  })
  log.info('NaviEntrySchema.statics.handleInstanceUpdate called')
  instance = superUser.newInstance(instance)
  return NaviEntrySchema.statics._getDirectURlObj(instance, timestamp)
    .then(function (directUrlObj) {
      var shortHash = NaviEntrySchema.statics._getIsolatedShortHash(instance)
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
          ownerGithubId: instance.attrs.owner.github,
          ownerUsername: instance.attrs.owner.username
        }
      }
      if (instance.attrs.masterPod) {
        update.$set['ipWhitelist.enabled'] = keypather.get(instance, 'attrs.ipWhitelist.enabled') || false
      }
      update.$set['directUrls.' + shortHash] = directUrlObj
      log.info({
        find: find,
        update: update
      }, 'findOneAndUpdate')
      return Promise.fromCallback(function (callback) {
        // Upsert the record, so we never lose any data
        NaviEntry.findOneAndUpdate(find, update, { upsert: true, new: true }, callback)
      })
        .then(function (updateResults) {
          log.info({
            find: find,
            update: update,
            updateResults: updateResults
          }, 'findOneAndUpdate results')
          publisher.publishCacheInvalidated(update.$set.elasticUrl)
          return updateResults
        })
        .catch(function (err) {
          // If the error is a duplicate key error that means this is an out of date upsert.
          // (the document exists, but we didn't match due to the $lt timestamp check and tried to make a new one)
          if (err.code === 11000) {
            throw new WorkerStopError('Attempted to process old job')
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
        publisher.publishCacheInvalidated(elasticUrl)
      }
    })
}

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
