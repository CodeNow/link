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

let instanceDeleted = require('tasks/instance-deleted')
let NaviEntry = require('models/navi-entry')

describe('tasks', function () {
  let deleteResults
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
      let job = null
      instanceDeleted(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/non-object job/)
        done()
      })
    })

    it('should fatally reject without object `instance`', function (done) {
      let job = { instance: [] }
      instanceDeleted(job).asCallback(function (err) {
        expect(err).to.be.an.instanceof(TaskFatalError)
        expect(err.message).to.match(/instance.*object/)
        done()
      })
    })

    it('should call naviEntry.handleInstanceDelete with the instance', function (done) {
      let job = { instance: instance, timestamp: new Date().valueOf() }
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
