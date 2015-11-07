'use strict'

var TaskFatalError = require('ponos').TaskFatalError
var Promise = require('bluebird')
var isObject = require('101/is-object')
var NaviEntry = require('../models/navi-entry')

/**
 * Task handler for incoming instance update events
 * @module link:tasks
 */
module.exports = instanceCreateEvent

/**
 * Takes the incoming instance create event and triggers a create of the navi entry
 * @param {object} job The job the task should handle.
 * @param {string} job.instance The instance that's being updated
 */
function instanceCreateEvent (job) {
  return Promise.try(function validateJob () {
    if (!isObject(job)) {
      throw new TaskFatalError(
        'instance-update-event',
        'Encountered non-object job',
        { job: job }
      )
    }

    if (!isObject(job.instance)) {
      throw new TaskFatalError(
        'instance-update-event',
        'Job missing `instance` field of type {object}',
        { job: job }
      )
    }

    return NaviEntry.handleNewInstance({
      instance: job.instance
    })
  })
}
