var mochaSpawn = require('../..');
var path = require('path');
var expect = require('expect.js');
var semver = require('semver');

if (!semver.satisfies(process.version, '>=7.10.0')) return;

describe('with async await error', function () {

  var scriptFile = path.resolve(__dirname, '..', 'procs', 'server-with-async-errors');
  var scriptOpts = {};

  var originalBefore = global.before;
  var originalAfter = global.after;

  afterEach(function () {

    global.before = originalBefore;
    global.after = originalAfter;

  });

  var childRef;

  it('handles async rejections on start', function (done) {

    global.before = function (title, fn) {

      var doneFn = function (error) {

        expect(error.name).to.be('Error');
        expect(error.message).to.be('Failed to start');
        done();

      };

      fn(doneFn);

    };

    childRef = mochaSpawn.before.start({
      script: scriptFile
    }, scriptOpts);

  });

  it('handles async rejections on stop', function (done) {

    global.after = function (title, fn) {

      var doneFn = function (error) {

        expect(error.name).to.be('Error');
        expect(error.message).to.be('Failed to stop');
        done();

      };

      fn(doneFn);

    };

    childRef.after.stop();

  });

});
