'use strict'

var log = require('logger')
var ponos = require('ponos')
var RabbitMQ = require('rabbitmq.js')

/**
 * Singelton instance of the worker server.
 * @module link:server
 */
module.exports = new ponos.Server({
  hermes: RabbitMQ.getSubscriber(),
  queues: Object.keys(RabbitMQ.getTasks()),
  log: log
})
  .setAllTasks(RabbitMQ.getTasks())
