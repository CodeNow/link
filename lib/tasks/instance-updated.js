'use strict'

var Promise = require('bluebird')
var TaskFatalError = require('ponos').TaskFatalError
var isNumber = require('101/is-number')
var isObject = require('101/is-object')
var isString = require('101/is-string')
var keypather = require('keypather')()

var NaviEntry = require('../models/navi-entry')

/**
 * Task handler for incoming instance update events
 * @module link:tasks
 */
module.exports = instanceUpdated

/**
 * Takes the incoming instance update event and writes to the database for navi denormalized data
 * @param {object} job The job the task should handle.
 * @param {string} job.deliveryId The unique delivery id for the event (sent via
 *   the `x-github-delivery` header to the webhook).
 * @param {string} job.eventType The type of the event (sent via the
 *   `x-github-event` header to the webhook).
 * @param {Number} job.recordedAt Unix timestamp for when the webhook recieved
 *   the event.
 * @param {object} job.payload The body of the event sent to the webhook.
 */
function instanceUpdated (job) {
  return Promise.try(function validateJob () {
    if (!isObject(job)) {
      throw new TaskFatalError(
        'instance-updated',
        'Encountered non-object job',
        { job: job }
      )
    }

    if (!isObject(job.instance)) {
      throw new TaskFatalError(
        'instance-updated',
        'Job missing `instance` field of type {object}',
        { job: job }
      )
    }

    if (!isNumber(job.timestamp)) {
      throw new TaskFatalError(
        'instance-updated',
        'Job missing `timestamp` field of type {number}',
        { job: job }
      )
    }

    if (!isString(keypather.get(job, 'instance.owner.username'))) {
      throw new TaskFatalError(
        'instance-updated',
        'Job.instance missing `owner.username` of type {string}',
        { job: job }
      )
    }

    return NaviEntry.handleInstanceUpdate(job.instance, new Date(job.timestamp))
  })
}
