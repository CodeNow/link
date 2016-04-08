'use strict'

var Code = require('code')
var Lab = require('lab')
var Runnable = require('@runnable/api-client')
var TaskFatalError = require('ponos').TaskFatalError
var sinon = require('sinon')

var lab = exports.lab = Lab.script()

var NaviEntry = require('models/navi-entry')
var hermesInstance = require('hermes')

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.describe
var expect = Code.expect
var it = lab.it

require('loadenv')({ debugName: 'link:env' })

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
        },
        contextVersion: {
          attrs: {
            dockRemoved: true
          }
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
        attrs: mockInstance,
        contextVersion: mockInstance.contextVersion
      }
      sinon.stub(Runnable.prototype, 'newInstance').returns(mockRunnableInstance)
      sinon.stub(Runnable.prototype, 'githubLogin').yieldsAsync(null)
      sinon.stub(hermesInstance, 'publishCacheInvalidated')
      done()
    })
    afterEach(function (done) {
      Runnable.prototype.newInstance.restore()
      Runnable.prototype.githubLogin.restore()
      hermesInstance.publishCacheInvalidated.restore()
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
              sinon.assert.notCalled(hermesInstance.publishCacheInvalidated)
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
            .catch(function (returnedErr) {
              sinon.assert.notCalled(hermesInstance.publishCacheInvalidated)
              expect(returnedErr).to.be.an.instanceof(TaskFatalError)
              expect(returnedErr.message).to.match(/old/)
              done()
            })
            .catch(done)
        })
      })

      describe('not running', function () {
        beforeEach(function (done) {
          mockRunnableInstance.fetchDependencies.yieldsAsync(null, null)
          mockRunnableInstance.attrs.contextVersion.attrs.dockRemoved = false
          mockRunnableInstance.contextVersion.attrs.dockRemoved = false
          done()
        })
        it('should update the database', function (done) {
          NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
            .then(function () {
              sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
              sinon.assert.calledWith(hermesInstance.publishCacheInvalidated,
                                      'elasticHostname.example.com')
              sinon.assert.calledWith(
                NaviEntry.findOneAndUpdate,
                {
                  elasticUrl: 'elasticHostname.example.com',
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
                    'ipWhitelist.enabled': false,
                    'directUrls.instanceID': {
                      lastUpdated: mockTimestamp,
                      ports: {},
                      dockerHost: undefined,
                      running: false,
                      branch: 'branchName',
                      dependencies: [],
                      url: 'directHostname.example.com',
                      masterPod: true,
                      dockRemoved: false
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

        describe('is masterPod', function () {
          beforeEach(function (done) {
            mockInstance.container.dockerHost = 'http://10.0.0.1:215'
            mockInstance.container.inspect = {
              State: {
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
            mockInstance.ipWhitelist = {
              enabled: true
            }
            NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
              .then(function () {
                sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
                sinon.assert.calledWith(hermesInstance.publishCacheInvalidated,
                  'elasticHostname.example.com')
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    elasticUrl: 'elasticHostname.example.com',
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
                      'ipWhitelist.enabled': true,
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
                        dependencies: [{
                          shortHash: 'dependencyShorthash',
                          elasticUrl: 'elasticHostname'
                        }],
                        url: 'directHostname.example.com',
                        masterPod: true,
                        dockRemoved: true
                      }
                    }
                  }
                )
                done()
              })
              .catch(done)
          })
        })
        describe('not masterPod', function () {
          beforeEach(function (done) {
            mockInstance.container.dockerHost = 'http://10.0.0.1:215'
            mockInstance.masterPod = false
            mockInstance.container.inspect = {
              State: {
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
            mockInstance.ipWhitelist = {
              enabled: true
            }
            NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
              .then(function () {
                sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
                sinon.assert.calledWith(hermesInstance.publishCacheInvalidated,
                  'elasticHostname.example.com')
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    elasticUrl: 'elasticHostname.example.com',
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
                        dependencies: [{
                          shortHash: 'dependencyShorthash',
                          elasticUrl: 'elasticHostname'
                        }],
                        url: 'directHostname.example.com',
                        masterPod: false,
                        dockRemoved: true
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
    })
    describe('no ports exposed', function () {
      beforeEach(function (done) {
        sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null)
        done()
      })
      afterEach(function (done) {
        NaviEntry.findOneAndUpdate.restore()
        done()
      })
      beforeEach(function (done) {
        mockInstance.container.dockerHost = 'http://10.0.0.1:215'
        mockInstance.masterPod = false
        mockInstance.container.inspect = {
          State: {
            Running: true
          }
        }
        mockInstance.container.ports = {
          '1/tcp': null,
          '3000/tcp': null,
          '3001/tcp': null,
          '443/tcp': null,
          '80/tcp': null
        }
        done()
      })
      it('should update the database', function (done) {
        mockInstance.ipWhitelist = {
          enabled: true
        }
        NaviEntry.handleInstanceUpdate(mockInstance, mockTimestamp)
          .then(function () {
            sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
            sinon.assert.calledWith(hermesInstance.publishCacheInvalidated,
              'elasticHostname.example.com')
            sinon.assert.calledWith(
              NaviEntry.findOneAndUpdate,
              {
                elasticUrl: 'elasticHostname.example.com',
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
                    dockerHost: '10.0.0.1',
                    running: true,
                    branch: 'branchName',
                    dependencies: [{
                      shortHash: 'dependencyShorthash',
                      elasticUrl: 'elasticHostname'
                    }],
                    url: 'directHostname.example.com',
                    masterPod: false,
                    dockRemoved: true
                  }
                }
              }
            )
            done()
          })
          .catch(done)
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
          .then(function (data) {
            sinon.assert.calledOnce(mockRunnableInstance.fetchDependencies)
            expect(data).to.deep.equal({
              branch: 'branchName',
              url: 'directHostname.example.com',
              dependencies: [{shortHash: 'dependencyShorthash', elasticUrl: 'elasticHostname'}],
              dockerHost: undefined,
              ports: {},
              running: false,
              lastUpdated: mockTimestamp,
              masterPod: true,
              dockRemoved: true
            })
            done()
          })
          .catch(done)
      })
      it('should return a fixed isolated object', function (done) {
        var mockTimestamp = new Date().toString()
        var mockInstance = {
          _id: 'instanceID',
          shortHash: 'instanceID',
          owner: {
            github: 1234,
            username: 'Myztiq'
          },
          masterPod: true,
          container: {
            Running: false
          },
          contextVersion: {
            attrs: {
              dockRemoved: true
            }
          }
        }
        mockDependency = {
          hostname : '2x6md2--mongodb-staging-codenow.runnablecloud.com',
          shortHash : '264yle',
          instance: {
            attrs: {
              isolated: 'asdasdasd'
            }
          }
        }
        mockRunnableInstance = {
          getElasticHostname: sinon.stub().returns('elasticHostname.example.com'),
          getContainerHostname: sinon.stub().returns('directHostname.example.com'),
          getBranchName: sinon.stub().returns('branchName'),
          fetchDependencies: sinon.stub().yieldsAsync(null, [mockDependency]),
          attrs: mockInstance,
          contextVersion: mockInstance.contextVersion
        }
        NaviEntry._getDirectURlObj(mockRunnableInstance, mockTimestamp)
          .then(function (data) {
            sinon.assert.calledOnce(mockRunnableInstance.fetchDependencies)
            expect(data).to.deep.equal({
              branch: 'branchName',
              url: 'directHostname.example.com',
              dependencies: [{
                shortHash: '2x6md2-',
                isolatedShorthash: '264yle',
                elasticUrl: 'mongodb-staging-codenow.runnablecloud.com'
              }],
              dockerHost: undefined,
              ports: {},
              running: false,
              lastUpdated: mockTimestamp,
              masterPod: true,
              dockRemoved: true
            })
            done()
          })
          .catch(done)
      })
    })
    describe('handleInstanceDelete', function () {
      beforeEach(function (done) {
        sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null, {
          elasticUrl: 'elasticUrl',
          directUrls: { foo: {} }
        })
        sinon.stub(NaviEntry, 'findOneAndRemove').yieldsAsync(null)
        done()
      })

      afterEach(function (done) {
        NaviEntry.findOneAndUpdate.restore()
        NaviEntry.findOneAndRemove.restore()
        done()
      })
      describe('when on the last document', function () {
        beforeEach(function (done) {
          NaviEntry.findOneAndUpdate.yieldsAsync(null, {
            elasticUrl: 'elasticUrl',
            directUrls: { }
          })
          done()
        })
        it('should remove the entire document', function (done) {
          NaviEntry.handleInstanceDelete(mockInstance, mockTimestamp)
            .then(function () {
              sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
              sinon.assert.calledWith(hermesInstance.publishCacheInvalidated, 'elasticUrl')
              sinon.assert.calledWith(
                NaviEntry.findOneAndUpdate,
                {
                  'directUrls.instanceID.lastUpdated': {$lt: mockTimestamp}
                }, {
                  $unset: {
                    'directUrls.instanceID': true
                  }
                })
              sinon.assert.calledWith(NaviEntry.findOneAndRemove, {
                elasticUrl: 'elasticUrl',
                directUrls: {}
              })
              done()
            })
            .catch(done)
        })
      })
      describe('when no document exists', function () {
        beforeEach(function (done) {
          NaviEntry.findOneAndUpdate.yieldsAsync(null)
          done()
        })
        it('should remove the entire document', function (done) {
          NaviEntry.handleInstanceDelete(mockInstance, mockTimestamp)
            .then(function () {
              sinon.assert.notCalled(hermesInstance.publishCacheInvalidated)
              sinon.assert.calledWith(
                NaviEntry.findOneAndUpdate,
                {
                  'directUrls.instanceID.lastUpdated': {$lt: mockTimestamp}
                }, {
                  $unset: {
                    'directUrls.instanceID': true
                  }
                })
              sinon.assert.notCalled(NaviEntry.findOneAndRemove)
              done()
            })
            .catch(done)
        })
      })
      describe('with more documents left', function () {
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
                sinon.assert.notCalled(hermesInstance.publishCacheInvalidated)
                expect(returnedErr).to.be.an.instanceof(Error)
                expect(returnedErr).to.not.be.an.instanceof(TaskFatalError)
                sinon.assert.notCalled(NaviEntry.findOneAndRemove)
                done()
              })
              .catch(done)
          })
        })
        it('should update the database', function (done) {
          NaviEntry.handleInstanceDelete(mockInstance, mockTimestamp)
            .then(function () {
              sinon.assert.notCalled(NaviEntry.findOneAndRemove)
              sinon.assert.calledOnce(hermesInstance.publishCacheInvalidated)
              sinon.assert.calledWith(hermesInstance.publishCacheInvalidated, 'elasticUrl');
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
})
