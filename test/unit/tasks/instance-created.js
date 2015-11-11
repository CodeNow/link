'use strict'

let Lab = require('lab')
let lab = exports.lab = Lab.script()
let describe = lab.describe
let it = lab.it
let beforeEach = lab.beforeEach
let afterEach = lab.afterEach
let Code = require('code')
let expect = Code.expect
let sinon = require('sinon')
let instance = require('../../mocks/master-instance')

require('loadenv')({ debugName: 'link:env' })

let Promise = require('bluebird')
let TaskFatalError = require('ponos').TaskFatalError

let instanceCreated = require('tasks/instance-created')
let NaviEntry = require('models/navi-entry')

describe('tasks', function () {
  let updateResults
  describe('instance-create-event', function () {
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
      let job = null
      instanceCreated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      let job = { instance: [] }
      instanceCreated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/instance.*object/)
        done()
      })
    })

    it('should fatally reject without object `timestamp`', function (done) {
      let job = { instance: instance }
      instanceCreated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/timestamp.*number/)
        done()
      })
    })

    it('should fatally reject without `Job.instance.owner.username`', function (done) {
      let job = { instance: {}, timestamp: new Date().valueOf() }
      instanceCreated(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/username.*string/)
        done()
      })
    })

    it('should call naviEntry.handleInstanceUpdate with the instance', function (done) {
      let job = { instance: instance, timestamp: new Date().valueOf() }
      instanceCreated(job)
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
