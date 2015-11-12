'use strict'
require('loadenv')()

var Hermes = require('runnable-hermes')
var log = require('./logger.js')()
var ErrorCat = require('error-cat')
var error = new ErrorCat()
var put = require('101/put')
var ip = require('ip')

module.exports = RabbitMQ

function RabbitMQ () { }

/**
 * rabbitmq _subscriber (used by ponos)
 * @type {Object}
 */
RabbitMQ._subscriber = null;

var subscribedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started'
]

RabbitMQ.create = function () {
  var opts = {
    hostname: process.env.RABBITMQ_HOSTNAME,
    password: process.env.RABBITMQ_PASSWORD,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    name: ip.address() + '.' + process.env.APP_NAME
  }

  log.info(opts, 'create')

  RabbitMQ._subscriber = new Hermes(
    put({
      subscribedEvents: subscribedEvents
    },
    opts)
  )
    .on('error', RabbitMQ._handleFatalError)
}

/**
 * returns hermes client
 * @return {Object} hermes client
 */
RabbitMQ.getSubscriber = function () {
  return RabbitMQ._subscriber
}

/**
 * reports errors on clients
 */
RabbitMQ._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError')
  throw error.createAndReport(502, 'RabbitMQ error', err)
}