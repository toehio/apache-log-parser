var stream = require('stream');
var async = require('async');
var util = require('util');
var split = require('split');
var csv = require('fast-csv');
var fs = require('fs');
var exec = require('exec-queue');
var Transform = stream.Transform ||
    require('readable-stream').Transform;

var logRe = /^(\d+\.\d+\.\d+\.\d+) - - \[(.*?)\] "(\w+) (.*) HTTP\/\d.\d" (\d*) (\d*) "(.*?)" "(.*?)"$/i;

function getIpLoc(line, req, cb) {
  var self = this;
  if (self.ipGeoCache[req.ip]) {
    req.lat = self.ipGeoCache[req.ip][0];
    req.lng = self.ipGeoCache[req.ip][1];
    return cb();
  }
  exec('geoiplookup -f /usr/share/GeoIP/GeoLiteCity.dat ' + req.ip, function (err, out) {
    var p = out.split(', ');
    p.reverse();
    self.ipGeoCache[req.ip] = [parseFloat(p[3]), parseFloat(p[2])];
    req.lat = self.ipGeoCache[req.ip][0];
    req.lng = self.ipGeoCache[req.ip][1];
    cb();
  });
}

var LogParser = function (opts) {
  opts = opts || {};
  opts.parseHooks = opts.parseHooks || [];
  if (typeof(opts.parseHook) === 'function')
    opts.parseHooks.push(opts.parseHook);
  if (opts.geoLookup)
    opts.parseHooks.push(getIpLoc);

  this.parserOpts = opts;
  this.ipGeoCache = opts.ipGeoCache || {};

  opts.objectMode = true;
  Transform.call(this, opts);
};
util.inherits(LogParser, Transform);

LogParser.prototype._transform = function (line, encoding, done) {
  if (!line) {
    this.push(null);
    return done();
  }
  var self = this;
  var m = logRe.exec(line);

  var req = {
    ip: m[1],
    date: m[2],
    verb: m[3],
    resource: m[4],
    code: m[5],
    referer: m[7],
    ua: m[8]
  };

  if (self.parserOpts.parseHooks) {
    async.parallel(self.parserOpts.parseHooks.map(function (h) {
      return function (cb) {
        h.call(self, line, req, cb);
      };
    }), function (err) {
      self.push(req);
      done();
    });
  }
  else {
    self.push(req);
    done();
  }
};

var JSONFormatter = function (opts) {
  opts = opts || {};
  this.first = true;

  opts.objectMode = true;
  Transform.call(this, opts);
};
util.inherits(JSONFormatter, Transform);

JSONFormatter.prototype._transform = function (obj, encoding, done) {
  if (this.first) {
    this.push('[' + JSON.stringify(obj));
    this.first = false;
  }
  else 
    this.push(',' + JSON.stringify(obj));
  done();
};

JSONFormatter.prototype._flush = function (done) {
  this.push(']');
  done();
};


module.exports = function (opts) {
  opts = opts || {};

  var parser = new LogParser(opts);

  var formatter = new stream.PassThrough({objectMode: true});
  if (opts.format === 'csv')
    formatter = csv.createWriteStream({headers: true});
  else if (opts.format === 'json')
    formatter = new JSONFormatter(opts);

  parser.on('end', formatter.end);

  var wrapper = new stream.PassThrough();
  wrapper.on('pipe', function (source) {
    source.unpipe(wrapper);
    source.pipe(split()).pipe(parser);
    parser.pipe(formatter);
  });
  wrapper.pipe = function () {
    return formatter.pipe.apply(formatter, arguments);
  };
  wrapper.read = function () {
    return formatter.read.apply(formatter, arguments);
  };
  formatter.on('data', function (chunk) {
    wrapper.emit('data', chunk);
  });

  return wrapper;
};
