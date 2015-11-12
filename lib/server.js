'use strict'

var log = require('./logger')
var ponos = require('ponos')
var RabbitMQ = require('./rabbitmq.js')

var tasks = {
  'instance.updated': require('./tasks/instance-updated.js'),
  'instance.created': require('./tasks/instance-created.js'),
  'instance.deleted': require('./tasks/instance-deleted.js')
}

/**
 * Singelton instance of the worker server.
 * @module link:server
 */
module.exports = new ponos.Server({
  hermes: RabbitMQ.getSubscriber(),
  queues: Object.keys(tasks),
  log: log
})
  .setAllTasks(tasks)
