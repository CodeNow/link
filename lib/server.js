'use strict'

let log = require('./logger')
let ponos = require('ponos')

/**
 * Names of the job queues that are consumed by link.
 * @type {array}
 */
let queues = [
  'instance-updated',
  'instance-created',
  'instance-deleted'
]

/**
 * Singelton instance of the worker server.
 * @module link:server
 */
let server = module.exports = new ponos.Server({ queues: queues, log: log })

// Set the task handlers for each queue
queues.forEach(function (name) {
  server.setTask(name, require('./tasks/' + name))
})
