'use strict'
require('loadenv')()

var Hermes = require('runnable-hermes')
var log = require('./logger.js')()
var ErrorCat = require('error-cat')
var error = new ErrorCat()
var ip = require('ip')

/**
 * RabbitMQ initializing class
 * @type {RabbitMQ}
 */
module.exports = new class RabbitMQ {
  constructor () {
    this.hermesInstance = null
    this.tasks = {
      'instance.updated': require('./tasks/instance-updated.js'),
      'instance.created': require('./tasks/instance-created.js'),
      'instance.deleted': require('./tasks/instance-deleted.js')
    }
  }

  static getSubscriber () {
    if (!this.hermesInstance) {
      var opts = {
        hostname: process.env.RABBITMQ_HOSTNAME,
        password: process.env.RABBITMQ_PASSWORD,
        port: process.env.RABBITMQ_PORT,
        username: process.env.RABBITMQ_USERNAME,
        name: ip.address() + '.' + process.env.APP_NAME,
        subscribedEvents: Object.keys(this.tasks)
      }
      this.hermesInstance = new Hermes(opts)
      this.hermesInstance.on('error', this._handleHermesError)
    }
    return this.hermesInstance
  }

  static _handleHermesError (err) {
    log.error({ err: err }, '_handleHermesError')
    throw error.createAndReport(502, 'RabbitMQ error', err)
  }
}