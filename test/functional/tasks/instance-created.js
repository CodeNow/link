'use strict'
require('loadenv')({ debugName: 'link:env' })

const Code = require('code')
const Lab = require('lab')
const mongooseControl = require('mongoose-control')
const nock = require('nock')
const Runnable = require('@runnable/api-client')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const instanceCreated = require('tasks/instance-created')
const masterInstance = require('../../mocks/master-instance')
const NaviEntry = require('models/navi-entry')
const publisher = require('../../../lib/publisher')
const slaveInstance = require('../../mocks/slave-instance')

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
    describe('instance-created', function () {
      before(function (done) {
        mongooseControl.start().asCallback(done)
      })

      after(function (done) {
        mongooseControl.stop().asCallback(done)
      })

      beforeEach(function (done) {
        sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
        sinon.stub(publisher._publisher, 'publishEvent')
        NaviEntry.remove({}, done)
      })

      afterEach(function (done) {
        Runnable.prototype.githubLogin.restore()
        publisher._publisher.publishEvent.restore()
        NaviEntry.remove({}, function (err) {
          done(err)
        })
      })

      describe('when there is no record', function () {
        var nockScope
        beforeEach(function (done) {
          nockScope = nock.load('test/functional/fixtures/master-instance-nock.json')
          done()
        })

        afterEach(function (done) {
          nock.cleanAll()
          done()
        })

        it('should add the instance data to the database', function (done) {
          var job = { instance: masterInstance, timestamp: new Date().valueOf() }
          instanceCreated(job)
            .then(function () {
              nockScope.forEach(function (nockedRequest) {
                expect(nockedRequest.isDone()).to.equal(true)
              })
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(document.ipWhitelist).to.be.object()
                expect(document.ipWhitelist.enabled).to.be.true()

                expect(document.elasticUrl).to.equal('api-staging-runnabledemo.runnable2.net')
                expect(Object.keys(document.directUrls).length).to.equal(1)

                var subDocument = document.directUrls[masterInstance.shortHash]
                expect(subDocument.running).to.equal(true)
                expect(subDocument.branch).to.equal(masterInstance.contextVersion.appCodeVersions[0].branch)
                expect(subDocument.ports).to.deep.equal({
                  '80': '32823',
                  '3000': '32821',
                  '3001': '32822',
                  '8000': '32824',
                  '8080': '32825'
                })
                expect(subDocument.dependencies).to.deep.equal([
                  { elasticUrl: 'mongodb-staging-runnabledemo.runnablecloud.com',
                    shortHash: '2gxk81' },
                  { elasticUrl: 'helloworld-staging-runnabledemo.runnablecloud.com',
                    shortHash: '1jndz2' }
                ])
                sinon.assert.calledOnce(publisher._publisher.publishEvent)
                done()
              })
            })
        })
      })

      describe('when there is a record in the database', function () {
        var nockScope
        beforeEach(function (done) {
          nockScope = nock.load('test/functional/fixtures/slave-instance-nock.json')
          done()
        })

        afterEach(function (done) {
          nock.cleanAll()
          done()
        })

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
          naviEntry.directUrls[slaveInstance.shortHash] = {
            branch: 'asdf',
            lastUpdated: new Date(1995, 11, 17)
          }
          naviEntry.save(done)
        })

        it('should add the instance data to the database', function (done) {
          var job = { instance: slaveInstance, timestamp: new Date().valueOf() }
          instanceCreated(job)
            .then(function () {
              nockScope.forEach(function (nockedRequest) {
                expect(nockedRequest.isDone()).to.equal(true)
              })
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(document.elasticUrl).to.equal('api-staging-runnabledemo.runnable2.net')
                expect(Object.keys(document.directUrls).length).to.equal(2)

                var subDocument = document.directUrls[slaveInstance.shortHash]
                expect(subDocument.running).to.equal(true)
                expect(subDocument.branch).to.equal(slaveInstance.contextVersion.appCodeVersions[0].branch)
                expect(subDocument.ports).to.deep.equal({
                  '80': '32818',
                  '3000': '32817',
                  '8000': '32819',
                  '8080': '32820'
                })
                expect(subDocument.dependencies).to.deep.equal([
                  { elasticUrl: 'mongodb-staging-runnabledemo.runnablecloud.com',
                    shortHash: '2gxk81' },
                  { elasticUrl: 'helloworld-staging-runnabledemo.runnablecloud.com',
                    shortHash: '1jndz2' }
                ])
                sinon.assert.calledOnce(publisher._publisher.publishEvent)
                done()
              })
            })
            .catch(done)
        })

        it('should do nothing if the update is old', function (done) {
          var job = { instance: slaveInstance, timestamp: new Date(1990, 11, 17).valueOf() }
          instanceCreated(job)
            .catch(function (err) {
              expect(err).to.be.an.instanceof(WorkerStopError)
              expect(err.message).to.match(/old/)
              nockScope.forEach(function (nockedRequest) {
                expect(nockedRequest.isDone()).to.equal(true)
              })
              NaviEntry.findOne({elasticUrl: 'api-staging-runnabledemo.runnable2.net'}, function (err, document) {
                if (err) {
                  return done(err)
                }
                expect(Object.keys(document.directUrls).length).to.equal(2)
                expect(document.directUrls[slaveInstance.shortHash]).to.exist()
                sinon.assert.notCalled(publisher._publisher.publishEvent)
                done()
              })
            })
        })
      })
    })
  })
})
