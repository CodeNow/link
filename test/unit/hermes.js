'use strict'

require('loadenv')({ debugName: 'link:env' })

var Code = require('code')
var Lab = require('lab')
var sinon = require('sinon')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.describe
var expect = Code.expect
var it = lab.it

var hermesInstance = require('hermes')

describe('lib/hermes', function () {
  beforeEach(function (done) {
    sinon.stub(hermesInstance, 'publish')
    done()
  })

  afterEach(function (done) {
    hermesInstance.publish.restore()
    done()
  })

  describe('hermesInstance.publishCacheInvalidated', function () {
    it('should throw with invalid arguments', function (done) {
      function throws () {
        hermesInstance.publishCacheInvalidated(null)
      }
      expect(throws).to.throw()
      sinon.assert.notCalled(hermesInstance.publish)
      done()
    })

    it('should enqueue cache.invalidated tasks with correct arguments', function (done) {
      hermesInstance.publishCacheInvalidated('elastic-url-staging.runnableapp.com')
      sinon.assert.calledOnce(hermesInstance.publish)
      sinon.assert.calledWith(hermesInstance.publish, 'routing.cache.invalidated', sinon.match.has(
        'elasticUrl', 'elastic-url-staging.runnableapp.com'
      ))
      done()
    })
  })
})
