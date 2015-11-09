'use strict'

var log = require('./logger')
var ponos = require('ponos')

/**
 * Names of the job queues that are consumed by link.
 * @type {array}
 */
var queues = [
  'instance-updated',
  'instance-created'
]

/**
 * Singelton instance of the worker server.
 * @module link:server
 */
var server = module.exports = new ponos.Server({ queues: queues, log: log })

// Set the task handlers for each queue
queues.forEach(function (name) {
  server.setTask(name, require('./tasks/' + name))
})
