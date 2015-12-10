/**
 * @module lib/hermes
 */
'use strict';

var Hermes = require('runnable-hermes')

var isString = require('101/is-string');
var log = require('logger')

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

/**
 * Helper function to enqueue cache-invalidated tasks
 */
hermesInstance.publishCacheInvalidated = function (elasticUrl) {
  var logData = {
    tx: true,
    elasticUrl: elasticUrl
  };
  log.info(logData, 'hermesInstance.publishCacheInvalidated');
  if (!isString(elasticUrl)) {
    log.error(logData, 'publishCacheInvalidated elasticUrl argument must be a string');
    throw new Error('elasticUrl argument must be a string', elasticUrl);
  }
  hermesInstance.publish('cache.invalidated', {
    elasticUrl: elasticUrl
  });
};
