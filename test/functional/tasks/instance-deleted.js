'use strict'
require('loadenv')({ debugName: 'link:env' })

const Code = require('code')
const Lab = require('lab')
const mongooseControl = require('mongoose-control')
const Runnable = require('@runnable/api-client')
const sinon = require('sinon')

const instanceDeleted = require('tasks/instance-deleted')
const masterInstance = require('../../mocks/master-instance')
const NaviEntry = require('models/navi-entry')
const publisher = require('../../../lib/publisher')

const lab = exports.lab = Lab.script()

const after = lab.after
const afterEach = lab.afterEach
const before = lab.before
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('functional', function () {
  describe('tasks', function () {
    describe('instance-deleted', function () {
      before(function (done) {
        mongooseControl.start().asCallback(done)
      })

      after(function (done) {
        mongooseControl.stop().asCallback(done)
      })

      beforeEach(function (done) {
        sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
        sinon.stub(publisher._publisher, 'publishEvent')
        NaviEntry.remove({}, function (err) {
          done(err)
        })
      })

      afterEach(function (done) {
        Runnable.prototype.githubLogin.restore()
        publisher._publisher.publishEvent.restore()
        NaviEntry.remove({}, done)
      })

      describe('when there is more than one instance added', function () {
        beforeEach(function (done) {
          var naviEntry = new NaviEntry()
          naviEntry.elasticUrl = 'api-staging-runnabledemo.runnable2.net'
          naviEntry.ownerGithubId = 9487339
          naviEntry.ownerUsername = 'RunnableDemo'
          naviEntry.directUrls = {
            asdf: {
              branch: 'foo'
            }
          }
          naviEntry.directUrls[masterInstance.shortHash] = {
            branch: 'asdf',
            lastUpdated: new Date(1995, 11, 17)
          }
          naviEntry.save(done)
        })

        it('should remove the instance from the record', function (done) {
          var job = { instance: masterInstance, timestamp: new Date(2001, 11, 17).valueOf() }
          instanceDeleted(job)
            .then(function () {
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(Object.keys(document.directUrls).length).to.equal(1)
                expect(document.directUrls[masterInstance.shortHash]).to.not.exist()
                sinon.assert.calledOnce(publisher._publisher.publishEvent)
                done()
              })
            })
        })

        it('should do nothing if the request is late', function (done) {
          var job = {instance: masterInstance, timestamp: new Date(1990, 11, 17).valueOf()}
          instanceDeleted(job)
            .then(function () {
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(Object.keys(document.directUrls).length).to.equal(2)
                expect(document.directUrls[masterInstance.shortHash]).to.exist()
                sinon.assert.notCalled(publisher._publisher.publishEvent)
                done()
              })
            })
        })
      })

      describe('when there is only one instance added', function () {
        beforeEach(function (done) {
          var naviEntry = new NaviEntry()
          naviEntry.elasticUrl = 'api-staging-runnabledemo.runnable2.net'
          naviEntry.ownerGithubId = 9487339
          naviEntry.ownerUsername = 'RunnableDemo'
          naviEntry.directUrls = {}
          naviEntry.directUrls[masterInstance.shortHash] = {
            branch: 'asdf',
            lastUpdated: new Date(1995, 11, 17)
          }
          naviEntry.save(done)
        })

        it('should remove the entire record', function (done) {
          var job = {instance: masterInstance, timestamp: new Date(2001, 11, 17).valueOf()}
          instanceDeleted(job)
            .then(function () {
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(document).to.not.exist()
                sinon.assert.calledOnce(publisher._publisher.publishEvent)
                done()
              })
            })
        })
      })
    })
  })
})
