'use strict'
require('loadenv')()

var Hermes = require('runnable-hermes')
var log = require('./logger.js')
var ErrorCat = require('error-cat')
var error = new ErrorCat()

/**
 * Hermes singleton
 * @type {Hermes}
 */
var hermesInstance = null

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
module.exports = class RabbitMQ {
  static getTasks () {
    return tasks
  }
  static getSubscriber () {
    if (!hermesInstance) {
      var opts = {
        hostname: process.env.RABBITMQ_HOSTNAME,
        password: process.env.RABBITMQ_PASSWORD,
        port: process.env.RABBITMQ_PORT,
        username: process.env.RABBITMQ_USERNAME,
        name: process.env.APP_NAME,
        subscribedEvents: Object.keys(tasks)
      }
      hermesInstance = new Hermes(opts)
      hermesInstance.on('error', this._handleHermesError)
    }
    return hermesInstance
  }

  static _handleHermesError (err) {
    log.error({ err: err }, '_handleHermesError')
    throw error.createAndReport(502, 'RabbitMQ error', err)
  }
}
