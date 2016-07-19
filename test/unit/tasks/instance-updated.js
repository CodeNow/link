'use strict'

const Code = require('code')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const instance = require('../../mocks/master-instance')
const instanceUpdated = require('tasks/instance-updated')
const NaviEntry = require('models/navi-entry')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

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
        expect(err).to.be.an.instanceof(WorkerStopError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      var job = { instance: [] }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(WorkerStopError)
        expect(err.message).to.match(/instance.*object/)
        done()
      })
    })

    it('should fatally reject without number `timestamp`', function (done) {
      var job = { instance: instance }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(WorkerStopError)
        expect(err.message).to.match(/timestamp.*number/)
        done()
      })
    })

    it('should fatally reject without `Job.instance.owner.username`', function (done) {
      var job = { instance: {}, timestamp: new Date().valueOf() }
      instanceUpdated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(WorkerStopError)
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
  })
})
