'use strict'

var TaskFatalError = require('ponos').TaskFatalError
var Promise = require('bluebird')
var isObject = require('101/is-object')
var isNumber = require('101/is-number')
var NaviEntry = require('../models/navi-entry')

/**
 * Task handler for incoming instance update events
 * @module link:tasks
 */
module.exports = instanceCreated

/**
 * Takes the incoming instance create event and triggers a create of the navi entry
 * @param {object} job The job the task should handle.
 * @param {string} job.instance The instance that's being updated
 */
function instanceCreated (job) {
  return Promise.try(function validateJob () {
    if (!isObject(job)) {
      throw new TaskFatalError(
        'instance-created',
        'Encountered non-object job',
        { job: job }
      )
    }

    if (!isObject(job.instance)) {
      throw new TaskFatalError(
        'instance-created',
        'Job missing `instance` field of type {object}',
        { job: job }
      )
    }

    if (!isNumber(job.timestamp)) {
      throw new TaskFatalError(
        'instance-created',
        'Job missing `timestamp` field of type {number}',
        { job: job }
      )
    }

    return NaviEntry.handleNewInstance(job.instance, new Date(job.timestamp))
  })
}
