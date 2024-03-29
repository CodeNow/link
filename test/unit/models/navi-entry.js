'use strict'

const Code = require('code')
const Lab = require('lab')
const Runnable = require('@runnable/api-client')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const NaviEntry = require('models/navi-entry')
const publisher = require('../../../lib/publisher')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

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
        name: 'elasticName',
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
      sinon.stub(publisher, 'publishCacheInvalidated')
      done()
    })
    afterEach(function (done) {
      Runnable.prototype.newInstance.restore()
      Runnable.prototype.githubLogin.restore()
      publisher.publishCacheInvalidated.restore()
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
              sinon.assert.notCalled(publisher.publishCacheInvalidated)
              expect(returnedErr).to.be.an.instanceof(Error)
              expect(returnedErr).to.not.be.an.instanceof(WorkerStopError)
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
              sinon.assert.notCalled(publisher.publishCacheInvalidated)
              expect(returnedErr).to.be.an.instanceof(WorkerStopError)
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
              sinon.assert.calledOnce(publisher.publishCacheInvalidated)
              sinon.assert.calledWith(publisher.publishCacheInvalidated,
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
                    ownerUsername: 'Myztiq',
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
                sinon.assert.calledOnce(publisher.publishCacheInvalidated)
                sinon.assert.calledWith(publisher.publishCacheInvalidated,
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
                      ownerUsername: 'Myztiq',
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
                sinon.assert.calledOnce(publisher.publishCacheInvalidated)
                sinon.assert.calledWith(publisher.publishCacheInvalidated,
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
                      ownerUsername: 'Myztiq',
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
            sinon.assert.calledOnce(publisher.publishCacheInvalidated)
            sinon.assert.calledWith(publisher.publishCacheInvalidated,
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
                  ownerUsername: 'Myztiq',
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
            expect(returnedError).to.be.an.instanceof(WorkerStopError)
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
          hostname: 'mongodb-staging-codenow.runnablecloud.com',
          name: '2x6md2--mongodb',
          shortHash: '264yle',
          isolated: 'asdasdasd'
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
                shortHash: '264yle',
                isolatedMastersShortHash: '2x6md2',
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
              sinon.assert.calledOnce(publisher.publishCacheInvalidated)
              sinon.assert.calledWith(publisher.publishCacheInvalidated, 'elasticUrl')
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
              sinon.assert.notCalled(publisher.publishCacheInvalidated)
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
                sinon.assert.notCalled(publisher.publishCacheInvalidated)
                expect(returnedErr).to.be.an.instanceof(Error)
                expect(returnedErr).to.not.be.an.instanceof(WorkerStopError)
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
              sinon.assert.calledOnce(publisher.publishCacheInvalidated)
              sinon.assert.calledWith(publisher.publishCacheInvalidated, 'elasticUrl')
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
    describe('_extractIsolatedMasterShortHash', function () {
      it('should pull out the shortHash from the instance master', function (done) {
        expect(NaviEntry._extractIsolatedMasterShortHash('asdf--foo.bar.baz')).to.equal('asdf')
        done()
      })
      it('should throw a task fatal error if the regular expresion does not match properly', function (done) {
        try {
          NaviEntry._extractIsolatedMasterShortHash('asdf')
          Code.fail('No exception thrown')
        } catch (e) {
          expect(e).to.be.an.instanceof(WorkerStopError)
        }
        done()
      })
    })
    describe('_getIsolatedShortHash', function () {
      var extractedShortHash
      beforeEach(function (done) {
        extractedShortHash = 'deadbeefextracted'
        sinon.stub(NaviEntry, '_extractIsolatedMasterShortHash').returns(extractedShortHash)
        done()
      })
      afterEach(function (done) {
        NaviEntry._extractIsolatedMasterShortHash.restore()
        done()
      })
      it('should call _extractIsolatedMasterShortHash if the instance is isolated', function (done) {
        var results = NaviEntry._getIsolatedShortHash({
          attrs: {
            isolated: true,
            isIsolationGroupMaster: false,
            shortHash: 'shortHash',
            name: 'instanceName'
          }
        })
        expect(results).to.equal(extractedShortHash)
        sinon.assert.calledOnce(NaviEntry._extractIsolatedMasterShortHash)
        sinon.assert.calledWith(NaviEntry._extractIsolatedMasterShortHash, 'instanceName')
        done()
      })
      it('should return the shorthash if the instance is not isolated', function (done) {
        var results = NaviEntry._getIsolatedShortHash({
          attrs: {
            isolated: false,
            isIsolationGroupMaster: false,
            shortHash: 'shortHash'
          }
        })
        sinon.assert.notCalled(NaviEntry._extractIsolatedMasterShortHash)
        expect(results).to.equal('shortHash')
        done()
      })
    })
  })
})
