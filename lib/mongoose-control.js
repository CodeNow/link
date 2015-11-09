'use strict'

var Promise = require('bluebird')
var mongoose = require('mongoose')
var mongooseControl = module.exports = {}

mongooseControl.start = function () {
  var mongooseOptions = {}
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
