'use strict'
require('loadenv')({ debugName: 'link:env' })

const Code = require('code')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const instance = require('../../mocks/master-instance')
const instanceDeleted = require('tasks/instance-deleted')
const NaviEntry = require('models/navi-entry')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

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
        expect(err).to.be.an.instanceof(WorkerStopError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      var job = { instance: [] }
      instanceDeleted(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(WorkerStopError)
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
