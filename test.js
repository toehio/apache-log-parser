var LogParser = require('./');
var fs = require('fs');
var expect = require('expect.js');
var aggregate = require('stream-aggregate');
var stream = require('stream');

var example_log = './example.log';
var log_requests = fs.readFileSync(example_log).toString().split("\n");
var num_log_requests = log_requests.length - 1;

var makeSmallStream = function (num) {
    var pt = new stream.PassThrough();
    var some_lines = log_requests.slice(0, num || 26).join("\n");
    pt.write(some_lines);
    pt.end();
    return pt;
};

describe('Log parsed as objects', function () {

  it('should return objects', function (done) {
    var lp = LogParser({format: false});
    fs.createReadStream(example_log).pipe(lp);
    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.an('array');
      expect(results).to.have.length(num_log_requests);
      done();
    });
  });

  it('should be pipeable', function (done) {
    var lp = LogParser({format: false});
    var pt = new stream.PassThrough({objectMode: true});
    fs.createReadStream(example_log).pipe(lp).pipe(pt);
    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.an('array');
      expect(results).to.have.length(num_log_requests);
      done();
    });
  });

  it('should emit data event', function (done) {
    var lp = LogParser({format: false});
    fs.createReadStream(example_log).pipe(lp);
    lp.once('data', function (req) {
      expect(req).to.be.an('object');
      expect(req).to.have.property('ip');
      expect(req.ip).to.be('180.76.15.21');
      expect(req.date).to.be('09/Aug/2015:06:41:58 +0000');
      expect(req.verb).to.be('GET');
      expect(req.resource).to.be('/');
      expect(req.code).to.be('200');
      expect(req.referer).to.be('-');
      expect(req.ua).to.be('Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)');
      done();
    });
  });
});

describe('Log parsed as stringified JSON', function () {
  this.slow(1000);

  it('should return JSON string', function (done) {
    var lp = LogParser({format: 'json'});
    fs.createReadStream(example_log).pipe(lp);
    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.a('string');
      expect(results.length).to.be.greaterThan(100);
      expect(results[0]).to.be('[');
      expect(results[results.length - 1]).to.be(']');

      var obj = JSON.parse(results);
      expect(obj).to.be.an('array');
      expect(obj).to.have.length(num_log_requests);
      obj.forEach(function (req) {
        expect(req).to.be.an('object');
        expect(req).to.have.property('ip');
      });

      done();
    });
  });
});

describe('Log parsed as CSV', function () {
  this.slow(2000);

  it('should return CSV string', function (done) {
    var lp = LogParser({format: 'csv'});
    fs.createReadStream(example_log).pipe(lp);
    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.a('object');
      var lines = results.toString().split("\n");
      expect(lines).to.have.length(num_log_requests + 1);
      var header = lines[0];
      expect(results.length).to.be.greaterThan(100);
      expect(header).to.contain('ip');
      expect(header).to.contain('ua');
      expect(header).to.contain('date');
      expect(header).to.contain('code');
      expect(lines[1]).to.contain('180.76.15.21');
      done();
    });
  });
});

describe('Passing a parse hook', function () {
  this.slow(2000);

  it('should change the req object', function (done) {
    var hook = function (line, req, cb) {
      expect(line).to.be.a('string');
      expect(line).to.contain('HTTP');
      expect(req).to.be.an('object');
      expect(cb).to.be.a('function');
      req.foo = 'bar';
      cb();
    };

    var lp = LogParser({format: false, parseHook: hook});
    fs.createReadStream(example_log).pipe(lp);
    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.an('array');
      results.forEach(function (req) {
        expect(req).to.have.property('foo');
        expect(req.foo).to.be('bar');
      });
      done();
    });
  });
});

describe('Looking up geo location', function () {
  this.slow(2000);

  it('should find the lat/long', function (done) {
    var lp = LogParser({format: false, geoLookup: true});

    makeSmallStream().pipe(lp);

    aggregate(lp, function (err, results) {
      expect(err).to.not.be.ok();
      expect(results).to.be.an('array');
      results.forEach(function (req) {
        expect(req).to.have.property('lat');
        expect(req).to.have.property('lng');
        expect(req.lat).to.be.a('number');
        expect(req.lng).to.be.a('number');
      });
      done();
    });
  });

  it('should use overridden cache', function (done) {
    var lp = LogParser({format: false,
                       geoLookup: true,
                       ipGeoCache: {'180.76.15.21': [12.34, 56.78]}
    });

    makeSmallStream().pipe(lp);

    lp.once('data', function (req) {
      expect(req.lat).to.be(12.34);
      expect(req.lng).to.be(56.78);
      done();
    });
  });
});
