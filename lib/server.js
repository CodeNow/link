'use strict'

const log = require('logger').child({ module: 'worker-server' })
const ponos = require('ponos')

/**
 * The link ponos server.
 * @type {ponos~Server}
 * @module link/server
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  rabbitmq: {
    channel: {
      prefetch: process.env.WORKER_PREFETCH
    },
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD
  },
  log: log,
  events: {
    'instance.updated': require('./tasks/instance-updated.js'),
    'instance.created': require('./tasks/instance-created.js'),
    'instance.deleted': require('./tasks/instance-deleted.js')
  }
})
