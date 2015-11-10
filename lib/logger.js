'use strict'

require('loadenv')({ project: 'link', debugName: 'link:env' })
var keypather = require('keypather')()
var isObject = require('101/is-object')

var bunyan = require('bunyan')

/**
 * Bunyan logger for link.
 * @author Ryan Kahn
 * @module link:logger
 */
module.exports = bunyan.createLogger({
  name: 'link',
  streams: [
    {
      level: process.env.LOG_LEVEL,
      stream: process.stdout
    }
  ],
  serializers: {
    job: jobSerializer
  }
})

/**
 * Bunyan serializer for jobs. Certain jobs contain a lot of information that
 * is far too verbose for the logs. This limits the amount of information that
 * is reported.
 * @param {object} job Job to serialize.
 * @return {object} The serialized job.
 */
function jobSerializer (job) {
  var obj = {}
  Object.keys(job).forEach(function (key) {
    var value = job[key]
    if (key === 'instance' && isObject(value)) {
      obj[key] = {
        shortHash: keypather.get(value, 'shortHash'),
        dockerHost: keypather.get(value, 'container.dockerHost'),
        ports: keypather.get(value, 'container.ports'),
        running: keypather.get(value, 'container.Running'),
        owner: keypather.get(value, 'owner')
      }
      return
    }
    obj[key] = value
  })
  return obj
}