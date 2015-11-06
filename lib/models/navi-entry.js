'use strict';

var Promise = require('bluebird');
var mongoose = require('mongoose');
var keypather = require('keypather')();

var NaviEntrySchema = require('models/schemas/navi-entry');

/**
 * (Internal) get the directURLObj that we will use to populate the instance configuration
 * @param instance
 * @returns {Promise.<T>}
 * @private
 */
NaviEntrySchema.statics._getDirectURlObj = function (instance) {
  return Promise.promisify(instance.getDependencies)()
    .then(function (dependencies) {
      return {
        branch: instance.getMainBranchName(),
        url: instance.getDirectHostname(instance.owner.username),
        dependencies: dependencies,
        dockerHost: keypather.get(instance, 'container.dockerHost'),
        ports: keypather.get(instance, 'container.ports'),
        running: !!keypather.get(instance, 'container.Running') // Coerce this value to a boolean.
      };
    });
};

/**
 * Handle when the instance changes in any way
 * @param {Object} instance
 * @returns Promise
 */
NaviEntrySchema.statics.handleInstanceUpdate = function (instance) {
  return NaviEntrySchema.statics._getDirectURlObj(instance)
  .then(function (directUrlObj) {
    var updateCommand = { $set: {} };
    updateCommand.$set['direct-urls.' + instance.shortHash] = directUrlObj;
    var find = {};
    find['direct-urls.' + instance.shortHash] = {$exists: true};
    return Promise.promisify(NaviEntry.findOneAndUpdate)(find, updateCommand);
  });
};

/**
 * Create or update a navi entry document when an instance is created
 * Create a new navi entry document if this is a masterPod instance
 * Update an existing navi entry document if this is not a masterPod instance
 * @param {Object} instance
 * @returns Promise
 */
NaviEntrySchema.statics.handleNewInstance = function (instance) {
  if (!instance.masterPod) {
    return NaviEntry.handleInstanceUpdate(instance);
  }
  return NaviEntrySchema.statics._getDirectURlObj(instance)
    .then(function (directUrlObj) {
      var directUrls = {};
      directUrls[instance.shortHash] = directUrlObj;
      var naviEntry = new NaviEntry({
        elasticUrl: instance.getElasticHostname(instance.owner.username),
        ownerGithubId: instance.owner.github,
        directUrls: directUrls
      });
      return Promise.fromCallback(function(callback) {
        naviEntry.save(callback);
      });
    });
};

var NaviEntry = module.exports = mongoose.model('NaviEntries', NaviEntrySchema);