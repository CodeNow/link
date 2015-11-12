'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var sinon = require('sinon')
var Code = require('code')
var Runnable = require('runnable')

require('loadenv')({ debugName: 'link:env' })

var instanceDeleted = require('tasks/instance-deleted')
var NaviEntry = require('models/navi-entry')
var masterInstance = require('../../mocks/master-instance')
var slaveInstance = require('../../mocks/slave-instance')

describe('functional', function () {
  describe('tasks', function () {
    describe('instance-deleted', function () {
      beforeEach(function (done) {
        sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
        done()
      })
      afterEach(function (done) {
        Runnable.prototype.githubLogin.restore()
        done()
      })
      describe('master instance', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null, {
            elasticUrl: 'foo.bar',
            directUrls: {
              'foo': {}
            }
          })
          done()
        })
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore()
          done()
        })
        it('should remove the instance from the record', function (done) {
          var job = { instance: masterInstance, timestamp: new Date().valueOf() }
          instanceDeleted(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {}
              find['directUrls.' + masterInstance.shortHash + '.lastUpdated'] = { $lt: sinon.match.date }
              var update = {$unset: {}}
              update.$unset['directUrls.' + masterInstance.shortHash] = true
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, update, {
                new: true
              }, sinon.match.func)
              done()
            })
        })
      })
      describe('slave instance', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null, {
            elasticUrl: 'foo.bar',
            directUrls: {}
          })
          sinon.stub(NaviEntry, 'findOneAndRemove').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore()
          NaviEntry.findOneAndRemove.restore()
          done()
        })

        it('should remove the instance from the record and delete the record from the database if it was the last item', function (done) {
          var job = { instance: slaveInstance, timestamp: new Date().valueOf() }
          instanceDeleted(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {}
              find['directUrls.' + slaveInstance.shortHash + '.lastUpdated'] = { $lt: sinon.match.date }
              var update = {$unset: {}}
              update.$unset['directUrls.' + slaveInstance.shortHash] = true
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, update, {
                new: true
              }, sinon.match.func)

              sinon.assert.calledWith(NaviEntry.findOneAndRemove, {
                elasticUrl: 'foo.bar',
                directUrls: {}
              }, sinon.match.func)
              done()
            })
        })
      })
    })
  })
})
