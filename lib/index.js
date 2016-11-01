'use strict'
require('loadenv')({ debugName: 'link:env' })

const log = require('./logger').child({ module: 'index' })
const mongooseControl = require('./mongoose-control')
const publisher = require('./publisher')
const server = require('./server')

mongooseControl.start()
  .then(() => {
    return publisher.connect()
  })
  .then(() => {
    return server.start()
  })
  .then(() => {
    log.info({ env: process.env }, 'Link Started')
  })

function handleStop () {
  mongooseControl.stop()
    .finally(function () {
      process.exit(1)
    })
}

// Handle closing the server
process.on('SIGINT', handleStop)
process.on('SIGTERM', handleStop)
