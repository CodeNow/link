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

describe('models', function () {
  var mockRunnableInstance
  var mockTimestamp
  var mockInstance
  var mockDependency
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
      mockDependency = {
        hostname: 'elasticHostname',
        shortHash: 'dependencyShorthash'
      }
      mockRunnableInstance = {
        getElasticHostname: sinon.stub().returns('elasticHostname.example.com'),
        getContainerHostname: sinon.stub().returns('directHostname.example.com'),
        getBranchName: sinon.stub().returns('branchName'),
        fetchDependencies: sinon.stub().yieldsAsync(null, [mockDependency]),
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
              expect(returnedErr).to.be.an.instanceof(Error)
              expect(returnedErr).to.not.be.an.instanceof(TaskFatalError)
              done()
            })
            .catch(done)
        })
      })

      describe('db match error', function () {
        var err
        beforeEach(function (done) {
          err = new Error('boom')
          err.code = 11000
          NaviEntry.findOneAndUpdate.yieldsAsync(err)
          done()
        })
        it('should callback err if db errs', function (done) {
          NaviEntry.handleInstanceUpdate(mockInstance)
            .catch(done)
            .then(function () {
              done()
            })
        })
      })

      describe('not running', function () {
        beforeEach(function (done) {
          mockRunnableInstance.fetchDependencies.yieldsAsync(null, null)
          done()
        })
        it('should update the database', function (done) {
          NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
            .catch(done)
            .then(function () {
              sinon.assert.calledWith(
                NaviEntry.findOneAndUpdate,
                {
                  $or: [
                    {
                      'directUrls.instanceID.lastUpdated': {$lt: mockTimestamp}
                    },
                    {
                      'directUrls.instanceID.lastUpdated': {$exists: false}
                    }
                  ]
                }, {
                  $set: {
                    elasticUrl: 'elasticHostname.example.com',
                    ownerGithubId: 1234,
                    'directUrls.instanceID': {
                      lastUpdated: mockTimestamp,
                      ports: {},
                      dockerHost: undefined,
                      running: false,
                      branch: 'branchName',
                      dependencies: {},
                      url: 'directHostname.example.com',
                      masterPod: true
                    }
                  }
                }
              )
              done()
            })
            .catch(done)
        })
      })

      describe('running', function () {
        beforeEach(function (done) {
          mockInstance.container.dockerHost = 'http://10.0.0.1:215'
          mockInstance.masterPod = false
          mockInstance.container.inspect = {
            state: {
              Running: true
            }
          }
          mockInstance.container.ports = {
            '1/tcp': [
              {
                'HostIp': '0.0.0.0',
                'HostPort': '32783'
              }
            ],
            '3000/tcp': [
              {
                'HostIp': '0.0.0.0',
                'HostPort': '32779'
              }
            ],
            '3001/tcp': [
              {
                'HostIp': '0.0.0.0',
                'HostPort': '32780'
              }
            ],
            '443/tcp': [
              {
                'HostIp': '0.0.0.0',
                'HostPort': '32781'
              }
            ],
            '80/tcp': [
              {
                'HostIp': '0.0.0.0',
                'HostPort': '32782'
              }
            ]
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
                  $or: [
                    {
                      'directUrls.instanceID.lastUpdated': {$lt: mockTimestamp}
                    },
                    {
                      'directUrls.instanceID.lastUpdated': {$exists: false}
                    }
                  ]
                }, {
                  $set: {
                    elasticUrl: 'elasticHostname.example.com',
                    ownerGithubId: 1234,
                    'directUrls.instanceID': {
                      lastUpdated: mockTimestamp,
                      ports: {
                        '1': '32783',
                        '80': '32782',
                        '443': '32781',
                        '3000': '32779',
                        '3001': '32780'
                      },
                      dockerHost: '10.0.0.1',
                      running: true,
                      branch: 'branchName',
                      dependencies: {'elasticHostname': 'dependencyShorthash'},
                      url: 'directHostname.example.com',
                      masterPod: false
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
        err.data = {}
        err.data.statusCode = 404
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
        NaviEntry._getDirectURlObj(mockRunnableInstance, mockTimestamp)
          .catch(done)
          .then(function (data) {
            sinon.assert.calledOnce(mockRunnableInstance.fetchDependencies)
            expect(data).to.deep.equal({
              branch: 'branchName',
              url: 'directHostname.example.com',
              dependencies: {'elasticHostname': 'dependencyShorthash'},
              dockerHost: undefined,
              ports: {},
              running: false,
              lastUpdated: mockTimestamp,
              masterPod: true
            })
            done()
          })
          .catch(done)
      })
    })
    describe('handleInstanceDelete', function () {
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
        NaviEntry.handleInstanceDelete(mockInstance, mockTimestamp)
          .catch(done)
          .then(function () {
            sinon.assert.calledWith(
              NaviEntry.findOneAndUpdate,
              {
                'directUrls.instanceID.lastUpdated': {$lt: mockTimestamp}
              }, {
                $unset: {
                  'directUrls.instanceID': true
                }
              })
            done()
          })
          .catch(done)
      })
    })
  })
})
