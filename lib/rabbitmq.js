'use strict'
require('loadenv')()

var ErrorCat = require('error-cat')
var error = new ErrorCat()

var hermesInstance = require('./hermes')
var log = require('./logger.js')

/**
 * Tasks list
 * @type {Object} Maps task id to task worker function
 */
var tasks = {
  'instance.updated': require('./tasks/instance-updated.js'),
  'instance.created': require('./tasks/instance-created.js'),
  'instance.deleted': require('./tasks/instance-deleted.js')
}

/**
 * RabbitMQ initializing class
 * @type {RabbitMQ}
 */
var rabbitMQ = module.exports = class RabbitMQ {
  static getTasks () {
    return tasks
  }
  static getSubscriber () {
    return hermesInstance;
  }
  static _handleHermesError (err) {
    log.error({ err: err }, '_handleHermesError')
    throw error.createAndReport(502, 'RabbitMQ error', err)
  }
}

hermesInstance.on('error', rabbitMQ._handleHermesError)
