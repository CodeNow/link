'use strict'

let Lab = require('lab')
let lab = exports.lab = Lab.script()
let describe = lab.describe
let it = lab.it
let beforeEach = lab.beforeEach
let afterEach = lab.afterEach
let sinon = require('sinon')

require('loadenv')({ debugName: 'link:env' })

let instanceUpdated = require('tasks/instance-updated')
let NaviEntry = require('models/navi-entry')
let masterInstance = require('../../mocks/master-instance')
let slaveInstance = require('../../mocks/slave-instance')

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
          let job = { instance: masterInstance, timestamp: new Date().valueOf() }
          instanceUpdated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              let find = {
                lastUpdated: { $lt: sinon.match.date }
              }
              find['directUrls.' + masterInstance.shortHash] = {$exists: true}
              let set = {
                $set: {lastUpdated: sinon.match.date}
              }
              set.$set[ 'directUrls.' + masterInstance.shortHash ] = {
                branch: masterInstance.contextVersion.appCodeVersions[0].branch,
                dependencies: [],
                dockerHost: null,
                ports: null,
                running: false,
                url: masterInstance.shortHash + '-runnable-angular-staging-codenow.runnable2.net'
              }
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
          let job = { instance: slaveInstance, timestamp: new Date().valueOf() }
          instanceUpdated(job)
            .then(function () {
              sinon.assert.calledOnce(NaviEntry.findOneAndUpdate)
              let find = {
                lastUpdated: { $lt: sinon.match.date }
              }
              find['directUrls.' + slaveInstance.shortHash] = {$exists: true}
              let set = {
                $set: {lastUpdated: sinon.match.date}
              }
              set.$set[ 'directUrls.' + slaveInstance.shortHash ] = {
                branch: slaveInstance.contextVersion.appCodeVersions[0].branch,
                dependencies: [],
                dockerHost: null,
                ports: null,
                running: false,
                url: slaveInstance.shortHash + '-runnable-angular-staging-codenow.runnable2.net'
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
