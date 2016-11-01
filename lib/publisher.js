'use strict'
require('loadenv')()
const isString = require('101/is-string')

const log = require('logger')
const PonosPublisher = require('ponos/lib/rabbitmq')

/**
 * Module in charge of rabbitmq connection
 *  client and pubSub are singletons
 */
class Publisher {
  constructor () {
    this._publisher = new PonosPublisher({
      name: process.env.APP_NAME,
      hostname: process.env.RABBITMQ_HOSTNAME,
      port: process.env.RABBITMQ_PORT,
      username: process.env.RABBITMQ_USERNAME,
      password: process.env.RABBITMQ_PASSWORD
    })
  }

  /**
   * connect publisher to rabbit
   * @return {Promise}
   * @resolves when connected
   */
  connect () {
    return this._publisher.connect()
  }

  /**
   * Helper function to enqueue cache-invalidated tasks
   * @param {Object} elasticUrl to invalidate
   * @throws {Error} If missing data
   */
  publishCacheInvalidated (elasticUrl) {
    const logData = {
      tx: true,
      elasticUrl: elasticUrl
    }
    log.info(logData, 'Publisher.publishCacheInvalidated')
    if (!isString(elasticUrl)) {
      log.error(logData, 'publishCacheInvalidated elasticUrl argument must be a string')
      throw new Error('elasticUrl argument must be a string: ' + elasticUrl)
    }

    this._publisher.publishEvent('routing.cache.invalidated', {
      elasticUrl: elasticUrl
    })
  }
}

module.exports = new Publisher()
