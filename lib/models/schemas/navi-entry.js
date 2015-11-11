/**
 * Navi instance routing data
 * @module models/schemas/navi-entry
 */
'use strict'

let mongoose = require('mongoose')

// let ObjectId = mongoose.Schema.ObjectId
let Schema = mongoose.Schema

let NaviEntry = module.exports = new Schema({
  elasticUrl: {
    type: String,
    required: true,
    index: {
      unique: true
    }
  },
  directUrls: {},
  userMappings: {},
  ownerGithubId: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date
  }
})

NaviEntry.index({
  elasticUrl: 1
}, {
  unique: true
})
