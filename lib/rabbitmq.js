'use strict'
require('loadenv')()

var ErrorCat = require('error-cat')
var error = new ErrorCat()

var hermesInstance = require('hermes')
var log = require('logger')

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
 * Overriding Hermes.prototype.getQueues
 * Original method returns publishedEvents + subscribedEvents + queues
 * Ponos uses getQueues to determine what workers need to be defined
 * Ponos will throw an error when it sees we don't have a defined worker for the publishedEvents
 *   'routing.cache.invalidated'
 */
hermesInstance.getQueues = function () {
  return Object.keys(tasks);
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
    return hermesInstance
  }
  static _handleHermesError (err) {
    log.error({ err: err }, '_handleHermesError')
    throw error.createAndReport(502, 'RabbitMQ error', err)
  }
}

hermesInstance.on('error', rabbitMQ._handleHermesError)
