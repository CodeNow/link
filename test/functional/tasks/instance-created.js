'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var sinon = require('sinon')
var nock = require('nock')
var Code = require('code')
var expect = Code.expect
var Runnable = require('runnable')

require('loadenv')({ debugName: 'link:env' })

var instanceCreated = require('tasks/instance-created')
var NaviEntry = require('models/navi-entry')
var masterInstance = require('../../mocks/master-instance')
var slaveInstance = require('../../mocks/slave-instance')

describe('functional', function () {
  describe('tasks', function () {
    describe('instance-created', function () {
      beforeEach(function (done) {
        sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
        done()
      })
      afterEach(function (done) {
        Runnable.prototype.githubLogin.restore()
        done()
      })
      describe('master instance', function () {
        var nockScope
        beforeEach(function (done) {
          nockScope = nock.load('test/functional/tasks/master-instance-nock.json')
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          nock.cleanAll()
          NaviEntry.findOneAndUpdate.restore()
          done()
        })
        it('should add the instance data to the database', function (done) {
          var job = { instance: masterInstance, timestamp: new Date().valueOf() }
          instanceCreated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {
                elasticUrl: 'api-staging-runnabledemo.runnable2.net',
                $or: [
                  {'directUrls.17joj1.lastUpdated': {$lt: sinon.match.date}},
                  {'directUrls.17joj1.lastUpdated': {$exists: false}}
                ]
              }
              var set = {
                $set: {
                  elasticUrl: 'api-staging-runnabledemo.runnable2.net',
                  ownerGithubId: masterInstance.owner.github
                }
              }
              set.$set['directUrls.' + masterInstance.shortHash] = {
                branch: masterInstance.contextVersion.appCodeVersions[0].branch,
                dependencies: [],
                dockerHost: null,
                ports: null,
                running: false,
                url: masterInstance.shortHash + '-runnable-angular-staging-codenow.runnable2.net'
              }
              set.$set['directUrls.' + masterInstance.shortHash] = sinon.match.object
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, set, {
                new: true,
                upsert: true
              }, sinon.match.func)
              nockScope.forEach(function (nockedRequest) {
                expect(nockedRequest.isDone()).to.equal(true)
              })
              done()
            })
        })
      })
      describe('slave instance', function () {
        var nockScope
        beforeEach(function (done) {
          nockScope = nock.load('test/functional/tasks/slave-instance-nock.json')
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          nock.cleanAll()
          NaviEntry.findOneAndUpdate.restore()
          done()
        })
        it('should add the instance data to the database', function (done) {
          var job = { instance: slaveInstance, timestamp: new Date().valueOf() }
          instanceCreated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              var find = {
                elasticUrl: 'api-staging-runnabledemo.runnable2.net',
                $or: [
                  { 'directUrls.1mn7k2.lastUpdated': { $lt: sinon.match.date } },
                  { 'directUrls.1mn7k2.lastUpdated': { $exists: false } }
                ]
              }
              var set = {
                $set: {
                  elasticUrl: 'api-staging-runnabledemo.runnable2.net',
                  ownerGithubId: slaveInstance.owner.github
                }
              }
              set.$set[ 'directUrls.' + slaveInstance.shortHash ] = {
                branch: slaveInstance.contextVersion.appCodeVersions[0].branch,
                dependencies: [],
                dockerHost: null,
                ports: null,
                running: false,
                url: slaveInstance.shortHash + '-runnable-angular-staging-codenow.runnable2.net'
              }
              set.$set['directUrls.' + slaveInstance.shortHash] = sinon.match.object
              sinon.assert.calledWith(NaviEntry.findOneAndUpdate, find, set, { new: true, upsert: true }, sinon.match.func)
              nockScope.forEach(function (nockedRequest) {
                expect(nockedRequest.isDone()).to.equal(true)
              })
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
