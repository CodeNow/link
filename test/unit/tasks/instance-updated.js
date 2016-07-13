'use strict'

var Code = require('code')
var Lab = require('lab')
var Promise = require('bluebird')
var TaskFatalError = require('ponos').TaskFatalError
var sinon = require('sinon')

var lab = exports.lab = Lab.script()

var NaviEntry = require('models/navi-entry')
var instance = require('../../mocks/master-instance')
var instanceUpdated = require('tasks/instance-updated')

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.describe
var expect = Code.expect
var it = lab.it

require('loadenv')({ debugName: 'link:env' })

describe('tasks', function () {
  var updateResults
  describe('instance-update-event', function () {
    beforeEach(function (done) {
      updateResults = { updateResults: true }
      sinon.stub(NaviEntry, 'handleInstanceUpdate').returns(Promise.resolve(updateResults))
      done()
    })

    afterEach(function (done) {
      NaviEntry.handleInstanceUpdate.restore()
      done()
    })

    it('should fatally reject without a job', function (done) {
      var job = null
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      var job = { instance: [] }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/instance.*object/)
        done()
      })
    })

    it('should fatally reject without number `timestamp`', function (done) {
      var job = { instance: instance }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/timestamp.*number/)
        done()
      })
    })

    it('should fatally reject without `Job.instance.owner.username`', function (done) {
      var job = { instance: {}, timestamp: new Date().valueOf() }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/username.*string/)
        done()
      })
    })

    it('should call naviEntry.handleInstanceUpdate with the instance', function (done) {
      var job = { instance: instance, timestamp: new Date().valueOf() }
      instanceUpdated(job)
        .then(function (results) {
          sinon.assert.calledOnce(NaviEntry.handleInstanceUpdate)
          sinon.assert.calledWith(NaviEntry.handleInstanceUpdate, job.instance, new Date(job.timestamp))
          expect(results).to.equal(updateResults)
          done()
        })
        .catch(done)
    })

    it('should skip isolation updates', function (done) {
      var job = { instance: instance, timestamp: new Date().valueOf(), action: 'isolation' }
      instanceUpdated(job)
        .then(function (results) {
          sinon.assert.notCalled(NaviEntry.handleInstanceUpdate)
          done()
        })
        .catch(done)
    })
  })
})
