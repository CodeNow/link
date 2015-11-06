'use strict';

var TaskFatalError = require('ponos').TaskFatalError;
var Promise = require('bluebird');
var isObject = require('101/is-object');
var NaviEntry = require('../models/navi-entry');
//var log = require('../logger').child({ task: 'instance-update-event' });

/**
 * Task handler for incoming instance update events
 * @module link:tasks
 */
module.exports = instanceUpdateEvent;

/**
 * Takes the incoming instance update event and writes to the database for navi
 * denormalized data
 * @param {object} job The job the task should handle.
 * @param {string} job.deliveryId The unique delivery id for the event (sent via
 *   the `x-github-delivery` header to the webhook).
 * @param {string} job.eventType The type of the event (sent via the
 *   `x-github-event` header to the webhook).
 * @param {Number} job.recordedAt Unix timestamp for when the webhook recieved
 *   the event.
 * @param {object} job.payload The body of the event sent to the webhook.
 */
function instanceUpdateEvent (job) {
  return Promise.try(function validateJob() {
    if (!isObject(job)) {
      throw new TaskFatalError(
        'instance-update-event',
        'Encountered non-object job',
        { job: job }
      );
    }

    if (!isObject(job.instance)) {
      throw new TaskFatalError(
        'instance-update-event',
        'Job missing `instance` field of type {object}',
        { job: job }
      );
    }

    return NaviEntry.update({
      instance: job.instance
    });
  });
    //.catch(UniqueError, function (err) {
    //  throw new TaskFatalError(
    //    'metis-github-event',
    //    'Job with given `deliveryId` has already been processed.',
    //    { job: job, originalError: err }
    //  );
    //})
    //.catch(NoGithubOrgError, function (err) {
    //  throw new TaskFatalError(
    //    'metis-github-event',
    //    'Could not associate github org id with job payload.',
    //    { job: job, originalError: err }
    //  );
    //});
}
