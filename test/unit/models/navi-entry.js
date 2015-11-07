'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')
// var Runnable = require('runnable')

var loadenv = require('loadenv')
loadenv.restore()
loadenv({ project: 'link', debugName: 'link:test' })

var NaviEntry = require('models/navi-entry')

describe('link', function () {
  describe('models', function () {
    var mockInstance
    describe('navi-entry', function () {
      beforeEach(function (done) {
        mockInstance = {
          _id: 'instanceID',
          shortHash: 'instanceID',
          getElasticHostname: sinon.stub().returns('elasticHostname.example.com'),
          getContainerHostname: sinon.stub().returns('directHostname.example.com'),
          getBranchName: sinon.stub().returns('branchName'),
          getDependencies: sinon.stub().yieldsAsync(null, [{dep: 1}]),
          owner: {
            github: 1234,
            username: 'Myztiq'
          },
          masterPod: true,
          container: {
            Running: false
          }
        }
        done()
      })
      describe('handleNewInstance', function () {
        describe('masterPod Instance', function () {
          beforeEach(function (done) {
            mockInstance.masterPod = true
            sinon.stub(NaviEntry.prototype, 'save')
            done()
          })
          afterEach(function (done) {
            NaviEntry.prototype.save.restore()
            done()
          })
          describe('db success', function () {
            beforeEach(function (done) {
              NaviEntry.prototype.save.yieldsAsync()
              done()
            })
            it('should create a navi entry', function (done) {
              NaviEntry.handleNewInstance(mockInstance)
                .catch(done)
                .then(function () {
                  sinon.assert.calledOnce(mockInstance.getElasticHostname)
                  sinon.assert.calledOnce(mockInstance.getContainerHostname)
                  sinon.assert.calledOnce(mockInstance.getBranchName)
                  sinon.assert.calledOnce(mockInstance.getDependencies)
                  sinon.assert.calledOnce(NaviEntry.prototype.save)
                  var naviEntryValue = NaviEntry.prototype.save.lastCall.thisValue
                  expect(naviEntryValue.elasticUrl, 'elastic URL').to.equal('elasticHostname.example.com')
                  expect(naviEntryValue.ownerGithubId, 'ownerGithubId').to.equal(1234)
                  expect(naviEntryValue.directUrls.instanceID, 'DirectUrls').to.deep.equal({
                    branch: 'branchName',
                    url: 'directHostname.example.com',
                    dependencies: [{dep: 1}],
                    ports: undefined,
                    running: false,
                    dockerHost: undefined
                  })
                  done()
                })
                .catch(done)
            })
          })
          describe('db err', function () {
            var err
            beforeEach(function (done) {
              err = new Error('boom')
              NaviEntry.prototype.save.yieldsAsync(err)
              done()
            })
            it('should callback err if db errs', function (done) {
              NaviEntry.handleNewInstance(mockInstance)
                .catch(function (returnedErr) {
                  expect(returnedErr).to.exist()
                  expect(returnedErr.message).to.equal(err.message)
                  done()
                })
                .catch(done)
            })
          })
        })
        describe('non masterPod Instance', function () {
          beforeEach(function (done) {
            mockInstance.masterPod = false
            sinon.stub(NaviEntry, 'findOneAndUpdate')
            done()
          })
          afterEach(function (done) {
            NaviEntry.findOneAndUpdate.restore()
            done()
          })
          describe('db success', function () {
            beforeEach(function (done) {
              NaviEntry.findOneAndUpdate.yieldsAsync()
              done()
            })
            it('should create a navi entry', function (done) {
              NaviEntry.handleNewInstance(mockInstance)
                .catch(done)
                .then(function () {
                  sinon.assert.calledWith(
                    NaviEntry.findOneAndUpdate,
                    {
                      'direct-urls.instanceID': {$exists: true}
                    }, {
                      $set: {
                        'direct-urls.instanceID': {
                          branch: 'branchName',
                          url: 'directHostname.example.com',
                          dependencies: [{dep: 1}],
                          ports: undefined,
                          running: false,
                          dockerHost: undefined
                        }
                      }
                    }
                  )
                  done()
                })
                .catch(done)
            })
          })
          describe('db err', function () {
            var err
            beforeEach(function (done) {
              err = new Error('boom')
              NaviEntry.findOneAndUpdate.yieldsAsync(err)
              done()
            })
            it('should callback err if db errs', function (done) {
              NaviEntry.handleNewInstance(mockInstance)
                .catch(function (returnedErr) {
                  expect(returnedErr).to.exist()
                  expect(returnedErr.message).to.equal(err.message)
                  done()
                })
            })
          })
        })
      })
      describe('handleInstanceUpdate', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
          done()
        })
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore()
          done()
        })

        describe('db err', function () {
          var err
          beforeEach(function (done) {
            err = new Error('boom')
            NaviEntry.findOneAndUpdate.yieldsAsync(err)
            done()
          })
          it('should callback err if db errs', function (done) {
            NaviEntry.handleInstanceUpdate(mockInstance)
              .catch(function (returnedErr) {
                expect(returnedErr).to.exist()
                expect(returnedErr.message).to.equal(err.message)
                done()
              })
              .catch(done)
          })
        })

        describe('running', function () {
          beforeEach(function (done) {
            mockInstance.container = {
              dockerHost: '10.0.0.1',
              ports: [80, 3000],
              Running: true
            }
            done()
          })
          it('should update the database', function (done) {
            NaviEntry.handleInstanceUpdate(mockInstance)
              .catch(done)
              .then(function () {
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    'direct-urls.instanceID': {$exists: true}
                  }, {
                    $set: {
                      'direct-urls.instanceID': {
                        ports: mockInstance.container.ports,
                        dockerHost: mockInstance.container.dockerHost,
                        running: true,
                        branch: 'branchName',
                        dependencies: [{dep: 1}],
                        url: 'directHostname.example.com'
                      }
                    }
                  }
                )
                done()
              })
              .catch(done)
          })
        })
      })
      describe('_getDirectURlObj', function () {
        it('should handle error fetching dependencies', function (done) {
          var err = new Error('Hello!')
          mockInstance.getDependencies.yieldsAsync(err)
          NaviEntry._getDirectURlObj(mockInstance)
            .catch(function (returnedError) {
              expect(returnedError).to.exist()
              expect(returnedError.message).to.equal(err.message)
              done()
            })
            .catch(done)
        })
        it('should return the direct url object', function (done) {
          NaviEntry._getDirectURlObj(mockInstance)
            .catch(done)
            .then(function (data) {
              sinon.assert.calledOnce(mockInstance.getDependencies)
              expect(data).to.deep.equal({
                branch: 'branchName',
                url: 'directHostname.example.com',
                dependencies: [{dep: 1}],
                dockerHost: undefined,
                ports: undefined,
                running: false
              })
              done()
            })
            .catch(done)
        })
      })
    })
  })
})
