'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var before = lab.before
var after = lab.after
var sinon = require('sinon')
var Runnable = require('runnable')
var Code = require('code')
var expect = Code.expect
var mongooseControl = require('mongoose-control')

require('loadenv')({ debugName: 'link:env' })

var instanceDeleted = require('tasks/instance-deleted')
var NaviEntry = require('models/navi-entry')
var masterInstance = require('../../mocks/master-instance')

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
        NaviEntry.remove({}, function (err) {
          done(err)
        })
      })
      afterEach(function (done) {
        Runnable.prototype.githubLogin.restore()
        NaviEntry.remove({}, done)
      })

      describe('when there is more than one instance added', function () {
        beforeEach(function (done) {
          var naviEntry = new NaviEntry()
          naviEntry.elasticUrl = 'api-staging-runnabledemo.runnable2.net'
          naviEntry.ownerGithubId = 9487339
          naviEntry.directUrls = {
            asdf: {
              branch: 'foo'
            }
          }
          naviEntry.directUrls[masterInstance.shortHash] = {
            branch: 'asdf',
            lastUpdated: new Date(1995, 11, 17)
          }
          naviEntry.save(function (err) {
            done(err)
          })
        })

        it('should remove the instance from the record', function (done) {
          var job = { instance: masterInstance, timestamp: new Date(2001, 11, 17).valueOf()}
          instanceDeleted(job)
            .then(function () {
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(Object.keys(document.directUrls).length).to.equal(1)
                expect(document.directUrls[masterInstance.shortHash]).to.not.exist()
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
          naviEntry.directUrls = {}
          naviEntry.directUrls[masterInstance.shortHash] = {
            branch: 'asdf',
            lastUpdated: new Date(1995, 11, 17)
          }
          naviEntry.save(function (err) {
            done(err)
          })
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
                done()
              })
            })
        })
      })
    })
  })
})
