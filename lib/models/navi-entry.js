'use strict'

var Promise = require('bluebird')
var mongoose = require('mongoose')
var keypather = require('keypather')()

var NaviEntrySchema = require('models/schemas/navi-entry')
var Runnable = require('runnable')

var superUser = new Runnable(process.env.API_HOST, {
  requestDefaults: {
    headers: {
      'user-agent': 'link'
    }
  }
})

/**
 * (Internal) get the directURLObj that we will use to populate the instance configuration
 * @param instance
 * @returns {Promise}
 * @private
 */
NaviEntrySchema.statics._getDirectURlObj = function (instance) {
  return Promise.fromCallback(function (callback) {
    instance.getDependencies(callback)
  })
    .then(function (dependencies) {
      return {
        branch: instance.getBranchName(),
        url: instance.getContainerHostname(),
        dependencies: dependencies,
        dockerHost: keypather.get(instance, 'attrs.container.dockerHost'),
        ports: keypather.get(instance, 'attrs.container.ports'),
        running: !!keypather.get(instance, 'attrs.container.Running') // Coerce this value to a boolean.
      }
    })
}

/**
 * Handle when the instance changes in any way
 * @param {Object} instance
 * @returns Promise
 */
NaviEntrySchema.statics.handleInstanceUpdate = function (instance, timestamp) {
  instance = superUser.newInstance(instance)
  return NaviEntrySchema.statics._getDirectURlObj(instance)
    .then(function (directUrlObj) {
      var updateCommand = { $set: {} }
      updateCommand.$set['directUrls.' + instance.attrs.shortHash] = directUrlObj
      updateCommand.$set.lastUpdated = timestamp;
      var find = {
        'lastUpdated': { $lt: timestamp }
      }
      find['directUrls.' + instance.attrs.shortHash] = {$exists: true}
      return Promise.promisify(NaviEntry.findOneAndUpdate)(find, updateCommand)
    })
}

/**
 * Create or update a navi entry document when an instance is created
 * Create a new navi entry document if this is a masterPod instance
 * Update an existing navi entry document if this is not a masterPod instance
 * @param {Object} instance
 * @returns Promise
 */
NaviEntrySchema.statics.handleNewInstance = function (instance, timestamp) {
  if (!instance.masterPod) {
    return NaviEntry.handleInstanceUpdate(instance, timestamp)
  }
  instance = superUser.newInstance(instance)
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

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema)
