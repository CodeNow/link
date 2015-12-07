/**
 * @module lib/hermes
 */
'use strict';

var Hermes = require('runnable-hermes')

var opts = {
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  name: process.env.APP_NAME,
  publishedEvents: [
    'cache.invalidated'
  ],
  subscribedEvents: [
    'instance.updated',
    'instance.created',
    'instance.deleted'
  ]
}

var hermesInstance = new Hermes(opts)

module.exports = hermesInstance
