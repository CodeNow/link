'use strict';

var isObject = require('101/is-object');
var keypath = require('keypather')();
var Promise = require('bluebird');

/**
 * Model for updating navi entries
 * @author Ryan Kahn
 * @class
 * @module link:models
 */
module.exports = class NaviEntry {
  /**
   * Updates the instance in the database
   * @param instance The instance to update
   */
  static update (instance) {
    return new Promise(function (resolve, reject){
      resolve();
    })
  }
}