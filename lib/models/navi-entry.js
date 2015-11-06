'use strict';

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
  static update () {
    return new Promise(function (resolve){
      resolve();
    });
  }
};