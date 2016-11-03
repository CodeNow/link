'use strict'

require('loadenv')({ debugName: 'link:env' })
const Promise = require('bluebird')
const NaviEntry = require('../lib/models/navi-entry')
var mongoose = require('mongoose')

mongoose.connect(process.env.MONGO)

const DRY_RUN = !process.env.ACTUALLY_RUN

NaviEntry.findAsync({})
  .then(function (allRecords) {
    const recordMap = {}
    const multiples = {}
    allRecords.forEach(record => {
      if (recordMap[ record.elasticUrl ]) {
        if (!multiples[ record.elasticUrl ]) {
          multiples[ record.elasticUrl ] = []
        }
        multiples[ record.elasticUrl ].push(record)
      } else {
        recordMap[ record.elasticUrl ] = record
      }
    })
    const promises = []
    Object.keys(multiples).forEach(elasticUrl => {
      let newestDate = 0
      let newestRecord = null
      multiples[ elasticUrl ].forEach(record => {
        Object.keys(record.directUrls).forEach(directUrl => {
          if (directUrl.lastUpdated > newestDate) {
            newestDate = directUrl.lastUpdated
            newestRecord = record
          }
        })
      })
      multiples[ elasticUrl ].forEach(record => {
        if (record !== newestRecord) {
          if (DRY_RUN) {
            console.log('Remove navi-entry ' + record.elasticUrl)
            console.log(record)
          } else {
            console.log('Remove navi-entry ' + record.elasticUrl)
            promises.push(NaviEntry.removeAsync({ _id: record._id }))
          }
        }
      })
    })
    return Promise.all(promises)
  })
  .catch(err => {
    console.error(err)
  })
  .finally(() => {
    process.exit(0)
  })
