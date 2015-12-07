/**
 * @module test/unit/tasks/instance-deleted
 */
'use strict'

var Promise = require('bluebird')
var TaskFatalError = require('ponos').TaskFatalError
var isObject = require('101/is-object')

var NaviEntry = require('../models/navi-entry')

/**
 * Task handler for incoming instance delete events
 * @module link:tasks
 */
module.exports = instanceDeleted

/**
 * Takes the incoming instance delete event and removes its entry in teh navi database
 * @param {object} job The job the task should handle.
 * @param {string} job.deliveryId The unique delivery id for the event (sent via
 *   the `x-github-delivery` header to the webhook).
 * @param {string} job.eventType The type of the event (sent via the
 *   `x-github-event` header to the webhook).
 * @param {Number} job.recordedAt Unix timestamp for when the webhook recieved
 *   the event.
 * @param {object} job.payload The body of the event sent to the webhook.
 */
function instanceDeleted (job) {
  return Promise.try(function validateJob () {
    if (!isObject(job)) {
      throw new TaskFatalError(
        'instance-deleted',
        'Encountered non-object job',
        { job: job }
      )
    }

    if (!isObject(job.instance)) {
      throw new TaskFatalError(
        'instance-deleted',
        'Job missing `instance` field of type {object}',
        { job: job }
      )
    }

    return NaviEntry.handleInstanceDelete(job.instance, new Date(job.timestamp))
  })
}
