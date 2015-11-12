'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect

require('loadenv')({ debugName: 'link:env' })

var instance = require('../mocks/master-instance.json')

var logger = require('logger.js')

describe('logger', function () {
  describe('serializers', function () {
    describe('job', function () {
      it('should serialize non-instance fields', function (done) {
        var job = { a: 'a', b: 'b', c: 'foo' }
        expect(logger.serializers.job(job)).to.deep.equal(job)
        done()
      })
      it('should only have certain fields for instance', function (done) {
        var job = {instance: instance}
        expect(logger.serializers.job(job).instance).to.only.include([
          '_id',
          'name',
          'shortHash',
          'dockerHost',
          'ports',
          'running',
          'owner'
        ])
        done()
      })
    })
  })
})
