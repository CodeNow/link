'use strict'

require('loadenv')({ project: 'link', debugName: 'link:env' })

var bunyan = require('bunyan')

/**
 * Bunyan logger for link.
 * @author Ryan Kahn
 * @module link:logger
 */
module.exports = bunyan.createLogger({
  name: 'link',
  streams: [
    {
      level: process.env.LOG_LEVEL,
      stream: process.stdout
    }
  ]
})
