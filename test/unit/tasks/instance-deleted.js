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
var instance = require('../../mocks/master-instance')

require('loadenv')({ debugName: 'link:env' })

var Promise = require('bluebird')
var TaskFatalError = require('ponos').TaskFatalError

var instanceDeleted = require('tasks/instance-deleted')
var NaviEntry = require('models/navi-entry')

describe('tasks', function () {
  var deleteResults
  describe('instance-delete-event', function () {
    beforeEach(function (done) {
      deleteResults = { deleteResults: true }
      sinon.stub(NaviEntry, 'handleInstanceDelete').returns(Promise.resolve(deleteResults))
      done()
    })

    afterEach(function (done) {
      NaviEntry.handleInstanceDelete.restore()
      done()
    })

    it('should fatally reject without a job', function (done) {
      var job = null
      instanceDeleted(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      var job = { instance: [] }
      instanceDeleted(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/instance.*object/)
        done()
      })
    })

    it('should call naviEntry.handleInstanceDelete with the instance', function (done) {
      var job = { instance: instance, timestamp: new Date().valueOf() }
      instanceDeleted(job)
        .then(function (results) {
          sinon.assert.calledOnce(NaviEntry.handleInstanceDelete)
          sinon.assert.calledWith(NaviEntry.handleInstanceDelete, job.instance)
          expect(results).to.equal(deleteResults)
          done()
        })
        .catch(done)
    })
  })
})
