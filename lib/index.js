'use strict'

require('loadenv')({ project: 'link', debugName: 'link:env' })

var server = require('./server')
var mongooseControl = require('./mongoose-control')
var log = require('./logger').child({ module: 'index' })

mongooseControl.start()
  .then(function () {
    return server.start()
  })
  .then(function () {
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