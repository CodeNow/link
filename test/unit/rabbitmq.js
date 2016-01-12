'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect
var ErrorCat = require('error-cat')
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var sinon = require('sinon')
var Hermes = require('runnable-hermes')
var log = require('logger.js')

require('loadenv')({ debugName: 'link:env' })

var rabbitmq = require('rabbitmq')

describe('rabbitmq', function () {
  describe('getTasks', function () {
    it('should return the tasks', function (done) {
      var tasks = rabbitmq.getTasks()
      expect(Object.keys(tasks)).to.include('instance.updated')
      expect(Object.keys(tasks)).to.include('instance.created')
      expect(Object.keys(tasks)).to.include('instance.deleted')
      done()
    })
  })
  describe('getSubscriber', function () {
    it('should return a hermes instance', function (done) {
      var subscriber = rabbitmq.getSubscriber()
      expect(subscriber).to.be.an.instanceOf(Hermes)
      done()
    })
    it('should return the same hermes instance if called a second time', function (done) {
      var subscriber = rabbitmq.getSubscriber()
      var newSubscriber = rabbitmq.getSubscriber()
      expect(subscriber).to.equal(newSubscriber)
      done()
    })
  })
  describe('_handleHermesError', function () {
    beforeEach(function (done) {
      sinon.stub(ErrorCat.prototype, 'createAndReport')
      sinon.stub(log, 'error')
      done()
    })
    afterEach(function (done) {
      ErrorCat.prototype.createAndReport.restore()
      log.error.restore()
      done()
    })
    it('should throw the error with errorcat', function (done) {
      var err = {'Hello!!!': 'foo'}
      rabbitmq._handleHermesError(err)
      sinon.assert.calledOnce(ErrorCat.createAndReport)
      sinon.assert.calledWith(ErrorCat.createAndReport, 502, 'RabbitMQ error', err)
      sinon.assert.calledWith(log.error, {err: err}, '_handleHermesError')
      done()
    })
    describe('_handleHermesError bound to hermesInstance error event', function () {
      beforeEach(function (done) {
        sinon.stub(rabbitmq, '_handleHermesError')
        done()
      })
      afterEach(function (done) {
        rabbitmq._handleHermesError.restore()
        done()
      })
      it('should invoke function if rabbitMQ eventemitter emits error event', function (done) {
        var hermesInstance = rabbitmq.getSubscriber()
        hermesInstance.emit('error', {foo: 'bar'})
        sinon.assert.calledOnce(rabbitmq._handleHermesError)
        done()
      })
    })
  })
})
