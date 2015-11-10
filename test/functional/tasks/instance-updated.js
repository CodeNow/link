'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var sinon = require('sinon')

require('loadenv')({ debugName: 'link:env' })

var instanceUpdated = require('tasks/instance-updated')
var NaviEntry = require('models/navi-entry')
var masterInstance = require('../../mocks/master-instance')
var slaveInstance = require('../../mocks/slave-instance')

describe('functional', function () {
  describe('tasks', function () {
    describe('instance-updated', function () {
      describe('master instance', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore()
          done()
        })

        it('should add the instance data to the database', function (done) {
          var job = { instance: masterInstance, timestamp: new Date().valueOf() }
          instanceUpdated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {
                lastUpdated: { $lt: sinon.match.date }
              }
              find['directUrls.' + masterInstance.shortHash] = {$exists: true}
              var set = {
                $set: {lastUpdated: sinon.match.date}
              }
              // set.$set['directUrls.' + masterInstance.shortHash] = sinon.match.object
              console.log(NaviEntry.findOneAndUpdate.lastCall.args)
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, set, sinon.match.func)
              done()
            })
            .catch(function (err) {
              done(err)
            })
        })
      })
      describe('slave instance', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore()
          done()
        })

        it('should add the instance data to the database', function (done) {
          var job = { instance: slaveInstance, timestamp: new Date().valueOf() }
          instanceUpdated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {
                lastUpdated: { $lt: sinon.match.date }
              }
              find['directUrls.' + slaveInstance.shortHash] = {$exists: true}
              var set = {
                $set: {lastUpdated: sinon.match.date}
              }
              // set.$set['directUrls.' + slaveInstance.shortHash] = sinon.match.object
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, set, sinon.match.func)
              done()
            })
            .catch(function (err) {
              done(err)
            })
        })
      })
    })
  })
})
