'use strict'

const isNumber = require('101/is-number')
const isObject = require('101/is-object')
const isString = require('101/is-string')
const keypather = require('keypather')()
const Promise = require('bluebird')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const NaviEntry = require('../models/navi-entry')

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
      throw new WorkerStopError(
        'Encountered non-object job',
        { job: job }
      )
    }

    if (!isObject(job.instance)) {
      throw new WorkerStopError(
        'Job missing `instance` field of type {object}',
        { job: job }
      )
    }

    if (!isNumber(job.timestamp)) {
      throw new WorkerStopError(
        'Job missing `timestamp` field of type {number}',
        { job: job }
      )
    }

    if (!isString(keypather.get(job, 'instance.owner.username'))) {
      throw new WorkerStopError(
        'Job.instance missing `owner.username` of type {string}',
        { job: job }
      )
    }

    return NaviEntry.handleInstanceUpdate(job.instance, new Date(job.timestamp))
  })
}
