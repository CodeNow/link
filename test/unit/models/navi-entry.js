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
var Runnable = require('runnable')

require('loadenv')({ debugName: 'link:env' })

var NaviEntry = require('models/navi-entry')
var TaskFatalError = require('ponos').TaskFatalError

describe('link', function () {
  describe('models', function () {
    var mockInstance
    var mockRunnableInstance
    var mockTimestamp
    describe('navi-entry', function () {
      beforeEach(function (done) {
        mockTimestamp = new Date().toString()
        mockInstance = {
          _id: 'instanceID',
          shortHash: 'instanceID',
          owner: {
            github: 1234,
            username: 'Myztiq'
          },
          masterPod: true,
          container: {
            Running: false
          }
        }
        mockRunnableInstance = {
          getElasticHostname: sinon.stub().returns('elasticHostname.example.com'),
          getContainerHostname: sinon.stub().returns('directHostname.example.com'),
          getBranchName: sinon.stub().returns('branchName'),
          fetchDependencies: sinon.stub().yieldsAsync(null, [{dep: 1}]),
          attrs: mockInstance
        }
        sinon.stub(Runnable.prototype, 'newInstance').returns(mockRunnableInstance)
        sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
        done()
      })
      afterEach(function (done) {
        Runnable.prototype.newInstance.restore()
        Runnable.prototype.githubLogin.restore()
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
                  sinon.assert.calledOnce(Runnable.prototype.newInstance)
                  sinon.assert.calledOnce(mockRunnableInstance.getElasticHostname)
                  sinon.assert.calledOnce(mockRunnableInstance.getContainerHostname)
                  sinon.assert.calledOnce(mockRunnableInstance.getBranchName)
                  sinon.assert.calledOnce(mockRunnableInstance.fetchDependencies)
                  sinon.assert.calledOnce(NaviEntry.prototype.save)
                  var naviEntryValue = NaviEntry.prototype.save.lastCall.thisValue
                  expect(naviEntryValue.elasticUrl, 'elastic URL').to.equal('elasticHostname.example.com')
                  expect(naviEntryValue.ownerGithubId, 'ownerGithubId').to.equal(1234)
                  expect(naviEntryValue['directUrls'].instanceID, 'DirectUrls').to.deep.equal({
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
            sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync()
            done()
          })
          afterEach(function (done) {
            NaviEntry.findOneAndUpdate.restore()
            done()
          })
          describe('db success', function () {
            it('should create a navi entry', function (done) {
              NaviEntry.handleNewInstance(mockInstance, mockTimestamp)
                .catch(done)
                .then(function () {
                  sinon.assert.calledWith(
                    NaviEntry.findOneAndUpdate,
                    {
                      'directUrls.instanceID': {$exists: true},
                      lastUpdated: { $lt: mockTimestamp }
                    }, {
                      $set: {
                        lastUpdated: mockTimestamp,
                        'directUrls.instanceID': {
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
                  expect(returnedErr).to.be.an.instanceof(TaskFatalError)
                  expect(returnedErr.message).to.match(/findOneAndUpdate/)
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
                expect(returnedErr).to.be.an.instanceof(TaskFatalError)
                expect(returnedErr.message).to.match(/findOneAndUpdate/)
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
            NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
              .catch(done)
              .then(function () {
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    'directUrls.instanceID': {$exists: true},
                    lastUpdated: { $lt: mockTimestamp }
                  }, {
                    $set: {
                      lastUpdated: mockTimestamp,
                      'directUrls.instanceID': {
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
          mockRunnableInstance.fetchDependencies.yieldsAsync(err)
          NaviEntry._getDirectURlObj(mockRunnableInstance)
            .catch(function (returnedError) {
              expect(returnedError).to.exist()
              expect(returnedError.message).to.equal(err.message)
              done()
            })
            .catch(done)
        })
        it('should handle 4040 fetching dependencies', function (done) {
          var err = new Error('Hello!')
          err.statusCode = 404
          mockRunnableInstance.fetchDependencies.yieldsAsync(err)
          NaviEntry._getDirectURlObj(mockRunnableInstance)
            .catch(function (returnedError) {
              expect(returnedError).to.exist()
              expect(returnedError).to.be.an.instanceof(TaskFatalError)
              expect(returnedError.message).to.match(/not found/)
              done()
            })
            .catch(done)
        })
        it('should return the direct url object', function (done) {
          NaviEntry._getDirectURlObj(mockRunnableInstance)
            .catch(done)
            .then(function (data) {
              sinon.assert.calledOnce(mockRunnableInstance.fetchDependencies)
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
      describe('handleInstanceDelete', function () {
        describe('master instance', function () {
          beforeEach(function (done) {
            mockInstance.masterPod = true
            sinon.stub(NaviEntry, 'findOneAndRemove').yieldsAsync(null)
            done()
          })

          afterEach(function (done) {
            NaviEntry.findOneAndRemove.restore()
            done()
          })

          describe('db err', function () {
            var err
            beforeEach(function (done) {
              err = new Error('boom')
              NaviEntry.findOneAndRemove.yieldsAsync(err)
              done()
            })
            it('should callback err if db errs', function (done) {
              NaviEntry.handleInstanceDelete(mockInstance)
                .catch(function (returnedErr) {
                  expect(returnedErr).to.be.an.instanceof(Error)
                  expect(returnedErr).to.not.be.an.instanceof(TaskFatalError)
                  done()
                })
                .catch(done)
            })
          })
          it('should update the database', function (done) {
            NaviEntry.handleInstanceDelete(mockInstance)
              .catch(done)
              .then(function () {
                sinon.assert.calledWith(
                  NaviEntry.findOneAndRemove,
                  {
                    'directUrls.instanceID': {$exists: true}
                  })
                done()
              })
              .catch(done)
          })
        })
        describe('slave instance', function () {
          beforeEach(function (done) {
            mockInstance.masterPod = false
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
              NaviEntry.handleInstanceDelete(mockInstance)
                .catch(function (returnedErr) {
                  expect(returnedErr).to.be.an.instanceof(TaskFatalError)
                  expect(returnedErr.message).to.match(/findOneAndUpdate/)
                  done()
                })
                .catch(done)
            })
          })
          it('should update the database', function (done) {
            NaviEntry.handleInstanceDelete(mockInstance)
              .catch(done)
              .then(function () {
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    'directUrls.instanceID': {$exists: true}
                  })
                done()
              })
              .catch(done)
          })
        })
      })
    })
  })
})
