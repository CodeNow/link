'use strict'

let Promise = require('bluebird')
let mongoose = require('mongoose')
let mongooseControl = module.exports = {}

mongooseControl.start = function () {
  let mongooseOptions = {}
  if (process.env.MONGO_REPLSET_NAME) {
    mongooseOptions.replset = {
      rs_name: process.env.MONGO_REPLSET_NAME
    }
  }
  return Promise.fromCallback(function (callback) {
    mongoose.connect(process.env.MONGO, mongooseOptions, callback)
  })
}

mongooseControl.stop = function () {
  return Promise.fromCallback(function (callback) {
    mongoose.disconnect(callback)
  })
}
