apache-log-parser
===================
A streaming parser for apache combined access logs.

Examples
--------
Parse the log and get each line as an object:
```javascript
var LogParser = require('apache-log-parser');

var lp = LogParser({format: false});
fs.createReadStream('access-combined.log').pipe(lp);

lp.on('data', function (req) {
  expect(req).to.be.an('object');
  expect(req.ip).to.be('180.76.15.21');
  expect(req.date).to.be('09/Aug/2015:06:41:58 +0000');
  expect(req.verb).to.be('GET');
  expect(req.resource).to.be('/');
  expect(req.code).to.be('200');
  expect(req.referer).to.be('-');
  expect(req.ua).to.be('Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)');
});
```

Parse the log and output it formatted as CSV:
```javascript
fs.createReadStream('access-combined.log')
.pipe(LogParser({format: 'csv'}))
.pipe(fs.createWriteStream('out.csv'));
```

Parse the log and output it formatted as JSON:
```javascript
fs.createReadStream('access-combined.log')
.pipe(LogParser({format: 'json'}))
.pipe(fs.createWriteStream('out.json'));
```

Lookup the geo location of each request:
```javascript
var lp = LogParser({format: false, geoLookup: true});
fs.createReadStream('access-combined.log').pipe(lp);

lp.on('data', function (req) {
  expect(req.lat).to.be.a('number');
  expect(req.lng).to.be.a('number');
});
```

Provide a hook to be called during the parsing
```javascript
function hook(rawLine, req, cb) {
  // The original line from the log file:
  console.log(rawLine);

  // Anonymize the IP address:
  req.ip = req.ip.replace(/^\d+\.\d+/, 'xx.xx');

  // Call callback at the end:
  cb();
}

fs.createReadStream('access-combined.log')
.pipe(LogParser({format: 'json', parseHook: hook}))
.pipe(fs.createWriteStream('out.json'));
```
