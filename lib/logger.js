'use strict'
require('loadenv')({ debugName: 'link:env' })

const defaults = require('101/defaults')
const getNamespace = require('continuation-local-storage').getNamespace
const isObject = require('101/is-object')
const keypather = require('keypather')()

const bunyan = require('bunyan')

/**
 * Bunyan serializer for jobs. Certain jobs contain a lot of information that
 * is far too verbose for the logs. This limits the amount of information that
 * is reported.
 * @param {object} job Job to serialize.
 * @return {object} The serialized job.
 */
const serializers = {
  tx () {
    var out
    try {
      out = {
        tid: getNamespace('ponos').get('tid')
      }
    } catch (e) {
      // cant do anything here
    }
    return out
  },
  job (job) {
    var obj = {}
    Object.keys(job).forEach((key) => {
      var value = job[key]
      if (key === 'instance' && isObject(value)) {
        obj.instance = {
          _id: keypather.get(value, '_id'),
          name: keypather.get(value, 'name'),
          shortHash: keypather.get(value, 'shortHash'),
          dockerHost: keypather.get(value, 'container.dockerHost'),
          ports: keypather.get(value, 'container.ports'),
          running: !!keypather.get(value, 'container.Running'),
          owner: keypather.get(value, 'owner')
        }
        return
      }
      obj[key] = value
    })
    return obj
  }
}

defaults(serializers, bunyan.stdSerializers)

/**
 * Bunyan logger for link.
 * @author Ryan Kahn
 * @module link:logger
 */
module.exports = bunyan.createLogger({
  name: process.env.APP_NAME,
  streams: [{ level: process.env.LOG_LEVEL, stream: process.stdout }],
  serializers: serializers
}).child({ tx: true })
