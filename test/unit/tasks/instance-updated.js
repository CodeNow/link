'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')

var loadenv = require('loadenv')
loadenv.restore()
loadenv({ project: 'link', debugName: 'link:test' })

var Promise = require('bluebird')
var TaskFatalError = require('ponos').TaskFatalError

var instanceUpdated = require('tasks/instance-updated')
var NaviEntry = require('models/navi-entry')

describe('link', function () {
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
        var job = { instance: {} }
        instanceUpdated(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalError)
          expect(err.message).to.match(/timestamp.*number/)
          done()
        })
      })

      it('should call naviEntry.handleInstanceUpdate with the instance', function (done) {
        var job = { instance: { _id: 1234 }, timestamp: new Date().valueOf() }
        instanceUpdated(job)
          .then(function (results) {
            sinon.assert.calledOnce(NaviEntry.handleInstanceUpdate)
            sinon.assert.calledWith(NaviEntry.handleInstanceUpdate, job.instance, new Date(job.timestamp))
            expect(results).to.equal(updateResults)
            done()
          })
          .catch(done)
      })
    })
  })
})
