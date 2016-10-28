/**
 * Navi instance routing data
 * @module models/schemas/navi-entry
 */
'use strict'

var mongoose = require('mongoose')

// var ObjectId = mongoose.Schema.ObjectId
var Schema = mongoose.Schema

var NaviEntry = module.exports = new Schema({
  elasticUrl: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  directUrls: {},
  userMappings: {},
  ownerGithubId: {
    type: Number,
    required: true
  },
  ownerUsername: {
    type: String,
    required: true
  },
  ipWhitelist: {
    type: {
      enabled: {
        type: Boolean,
        default: false
      }, // When active, IP filtering is enabled
      ipTable: [{}]
    }
  }
})
