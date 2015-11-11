'use strict'

require('loadenv')({ debugName: 'link:env' })

let server = require('./server')
let mongooseControl = require('./mongoose-control')
let log = require('./logger').child({ module: 'index' })

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