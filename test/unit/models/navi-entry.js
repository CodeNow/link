'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');

var loadenv = require('loadenv');
loadenv.restore();
loadenv({ project: 'link', debugName: 'link:test' });

var NaviEntry = require('models/navi-entry');

describe('link', function() {
  describe('models', function() {
    var ctx = {};
    describe('navi-entry', function() {
      beforeEach(function (done) {
        ctx.mockInstance = {
          shortHash: 'instanceID',
          getElasticHostname: sinon.stub().returns('elasticHostname.example.com'),
          getDirectHostname: sinon.stub().returns('directHostname.example.com'),
          getMainBranchName: sinon.stub().returns('branchName'),
          getDependencies: sinon.stub().yieldsAsync(null, [{dep:1}]),
          owner: {
            github: 1234,
            username: 'Myztiq'
          },
          masterPod: true,
          container: {
            Running: false
          }
        };
        done();
      });
      describe('handleNewInstance', function () {
        describe('masterPod Instance', function (){
          beforeEach(function (done) {
            ctx.mockInstance.masterPod = true;
            sinon.stub(NaviEntry.prototype, 'save');
            done();
          });
          afterEach(function (done) {
            NaviEntry.prototype.save.restore();
            done();
          });
          describe('db success', function () {
            beforeEach(function (done) {
              NaviEntry.prototype.save.yieldsAsync();
              done();
            });
            it('should create a navi entry', function (done) {
              NaviEntry.handleNewInstance(ctx.mockInstance)
                .catch(done)
                .then(function () {
                  sinon.assert.calledOnce(ctx.mockInstance.getElasticHostname);
                  sinon.assert.calledOnce(ctx.mockInstance.getDirectHostname);
                  sinon.assert.calledOnce(ctx.mockInstance.getMainBranchName);
                  sinon.assert.calledOnce(ctx.mockInstance.getDependencies);
                  sinon.assert.calledOnce(NaviEntry.prototype.save);
                  var naviEntryValue = NaviEntry.prototype.save.lastCall.thisValue;
                  expect(naviEntryValue.elasticUrl, 'elastic URL').to.equal('elasticHostname.example.com');
                  expect(naviEntryValue.ownerGithubId, 'ownerGithubId').to.equal(1234);
                  expect(naviEntryValue.directUrls.instanceID, 'DirectUrls').to.deep.equal({
                    branch: 'branchName',
                    url: 'directHostname.example.com',
                    dependencies: [{dep: 1}],
                    ports: undefined,
                    running: false,
                    dockerHost: undefined
                  });
                  done();
                })
                .catch(done);
            });
          });
          describe('db err', function () {
            beforeEach(function (done) {
              ctx.err = new Error('boom');
              NaviEntry.prototype.save.yieldsAsync(ctx.err);
              done();
            });
            it('should callback err if db errs', function (done) {
              NaviEntry.handleNewInstance(ctx.mockInstance)
                .catch(function (err) {
                  expect(err).to.exist();
                  expect(err.message).to.equal(ctx.err.message);
                  done();
                })
                .catch(done);
            });
          });
        });
        describe('non masterPod Instance', function (){
          beforeEach(function (done) {
            ctx.mockInstance.masterPod = false;
            sinon.stub(NaviEntry, 'findOneAndUpdate');
            done();
          });
          afterEach(function (done) {
            NaviEntry.findOneAndUpdate.restore();
            done();
          });
          describe('db success', function () {
            beforeEach(function (done) {
              NaviEntry.findOneAndUpdate.yieldsAsync();
              done();
            });
            it('should create a navi entry', function (done) {
              NaviEntry.handleNewInstance(ctx.mockInstance)
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
                  );
                  done();
                })
                .catch(done);
            });
          });
          describe('db err', function () {
            beforeEach(function (done) {
              ctx.err = new Error('boom');
              NaviEntry.findOneAndUpdate.yieldsAsync(ctx.err);
              done();
            });
            it('should callback err if db errs', function (done) {
              NaviEntry.handleNewInstance(ctx.mockInstance)
                .catch(function (err) {
                  expect(err).to.equal(err);
                  done();
                });
            });
          });
        });
      });
      describe('handleInstanceUpdate', function () {
        beforeEach(function (done) {
          sinon.stub(NaviEntry, 'findOneAndUpdate').yieldsAsync(null);
          done();
        });
        afterEach(function (done) {
          NaviEntry.findOneAndUpdate.restore();
          done();
        });

        describe('db err', function () {
          beforeEach(function (done) {
            ctx.err = new Error('boom');
            NaviEntry.findOneAndUpdate.yieldsAsync(ctx.err);
            done();
          });
          it('should callback err if db errs', function (done) {
            NaviEntry.handleInstanceUpdate(ctx.mockInstance)
              .catch(function (err) {
                expect(err).to.exist();
                expect(err.message).to.equal(ctx.err.message);
                done();
              })
              .catch(done);
          });
        });

        describe('running', function (){
          beforeEach(function (done) {
            ctx.mockInstance.container = {
              dockerHost: '10.0.0.1',
              ports: [80, 3000],
              Running: true
            };
            done();
          });
          it('should update the database', function (done) {
            NaviEntry.handleInstanceUpdate(ctx.mockInstance)
              .catch(done)
              .then(function () {
                sinon.assert.calledWith(
                  NaviEntry.findOneAndUpdate,
                  {
                    'direct-urls.instanceID': {$exists: true}
                  }, {
                    $set: {
                      'direct-urls.instanceID': {
                        ports: ctx.mockInstance.container.ports,
                        dockerHost: ctx.mockInstance.container.dockerHost,
                        running: true,
                        branch: 'branchName',
                        dependencies: [{dep: 1}],
                        url: 'directHostname.example.com'
                      }
                    }
                  }
                );
                done();
              })
              .catch(done);
          });
        });
      });
      describe('_getDirectURlObj', function (){
        it('should handle error fetching dependencies', function (done) {
          var err = new Error('Hello!');
          ctx.mockInstance.getDependencies.yieldsAsync(err);
          NaviEntry._getDirectURlObj(ctx.mockInstance)
            .catch(function (returnedError){
              expect(returnedError).to.exist();
              expect(returnedError.message).to.equal(err.message);
              done();
            })
            .catch(done);
        });
        it('should return the direct url object', function (done) {
          NaviEntry._getDirectURlObj(ctx.mockInstance)
            .catch(done)
            .then(function (data){
              sinon.assert.calledOnce(ctx.mockInstance.getDependencies);
              expect(data).to.deep.equal({
                branch: 'branchName',
                url: 'directHostname.example.com',
                dependencies: [{dep: 1}],
                dockerHost: undefined,
                ports: undefined,
                running: false
              });
              done();
            })
            .catch(done);
        });
      });
    });
  });
});
