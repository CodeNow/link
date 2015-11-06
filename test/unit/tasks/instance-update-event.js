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

var Promise = require('bluebird');
var TaskFatalError = require('ponos').TaskFatalError;

var instanceUpdateEvent = require('tasks/instance-update-event');
var NaviEntry = require('models/navi-entry');



describe('link', function() {
  describe('tasks', function() {
    var ctx = {};
    describe('instance-update-event', function() {
      beforeEach(function (done) {
        ctx.updateResults = { updateResults: true };
        sinon.stub(NaviEntry, 'update').returns(Promise.resolve(ctx.updateResults));
        done();
      });

      afterEach(function (done) {
        NaviEntry.update.restore();
        done();
      });

      it('should fatally reject without a job', function(done) {
        var job = null;
        instanceUpdateEvent(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalError);
          expect(err.message).to.match(/non-object job/);
          done();
        });
      });

      it('should fatally reject without object `instance`', function(done) {
        var job = { instance: [] };
        instanceUpdateEvent(job).asCallback(function (err) {
          expect(err).to.be.an.instanceof(TaskFatalError);
          expect(err.message).to.match(/instance.*object/);
          done();
        });
      });

      it('should call naviEntry.update with the instance', function (done) {
        var job = { instance: { _id: 1234 } };
        instanceUpdateEvent(job)
          .then(function (results) {
            sinon.assert.calledOnce(NaviEntry.update);
            sinon.assert.calledWith(NaviEntry.update, { instance: job.instance });
            expect(results).to.equal(ctx.updateResults);
            done();
          })
          .catch(done);
      });
    }); // end 'instance-update-event'
  }); // end 'tasks'
}); // end 'metis'
