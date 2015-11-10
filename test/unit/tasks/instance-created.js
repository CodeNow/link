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

var instanceCreated = require('tasks/instance-created')
var NaviEntry = require('models/navi-entry')

describe('link', function () {
  describe('tasks', function () {
    var updateResults
    describe('instance-create-event', function () {
      beforeEach(function (done) {
        updateResults = { updateResults: true }
        sinon.stub(NaviEntry, 'handleNewInstance').returns(Promise.resolve(updateResults))
        done()
      })

      afterEach(function (done) {
        NaviEntry.handleNewInstance.restore()
        done()
      })

      it('should fatally reject without a job', function (done) {
        var job = null
        instanceCreated(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalError)
          expect(err.message).to.match(/non-object job/)
          done()
        })
      })

      it('should fatally reject without object `instance`', function (done) {
        var job = { instance: [] }
        instanceCreated(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalError)
          expect(err.message).to.match(/instance.*object/)
          done()
        })
      })

      it('should fatally reject without object `timestamp`', function (done) {
        var job = { instance: {} }
        instanceCreated(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalErrorisObject)
          expect(err.message).to.match(/timestamp.*number/)
          done()
        })
      })

      it('should call naviEntry.handleNewInstance with the instance', function (done) {
        var job = { instance: { _id: 1234 }, timestamp: new Date().valueOf() }
        instanceCreated(job)
          .then(function (results) {
            sinon.assert.calledOnce(NaviEntry.handleNewInstance)
            sinon.assert.calledWith(NaviEntry.handleNewInstance, job.instance, new Date(job.timestamp))
            expect(results).to.equal(updateResults)
            done()
          })
          .catch(done)
      })
    })
  })
})
