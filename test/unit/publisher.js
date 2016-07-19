'use strict'

require('loadenv')({ debugName: 'link:env' })

const Code = require('code')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

const publisher = require('../../lib/publisher')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('lib/publisher', function () {
  beforeEach(function (done) {
    sinon.stub(publisher._publisher, 'publishEvent')
    sinon.stub(publisher._publisher, 'connect')
    done()
  })

  afterEach(function (done) {
    publisher._publisher.publishEvent.restore()
    publisher._publisher.connect.restore()
    done()
  })

  describe('connect', function () {
    it('should call connect', function (done) {
      publisher._publisher.connect.returns(Promise.resolve())
      publisher.connect().asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(publisher._publisher.connect)
        done()
      })
    })
  }) // end connect

  describe('publisher.publishCacheInvalidated', function () {
    it('should throw with invalid arguments', function (done) {
      function throws () {
        publisher.publishCacheInvalidated(null)
      }
      expect(throws).to.throw()
      sinon.assert.notCalled(publisher._publisher.publishEvent)
      done()
    })

    it('should enqueue cache.invalidated tasks with correct arguments', function (done) {
      publisher.publishCacheInvalidated('elastic-url-staging.runnableapp.com')
      sinon.assert.calledOnce(publisher._publisher.publishEvent)
      sinon.assert.calledWith(publisher._publisher.publishEvent, 'routing.cache.invalidated', sinon.match.has(
        'elasticUrl', 'elastic-url-staging.runnableapp.com'
      ))
      done()
    })
  })
})
