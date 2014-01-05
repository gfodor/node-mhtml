'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');
var stream = require('stream');

var mkdir = require('mkdirp');
var rmdir = require('rimraf');
var mimelib = require('mimelib');
var url = require('url');

var EOL = require('os').EOL;

var Part = require(__dirname + '/part');
var PartCollection = require(__dirname + '/partCollection');

module.exports = extractMHTML;

function MHTMLExtractor(source, opts) {
  this.boundary = null;
  this.source = source;
  this.parts = new PartCollection();
  this.primaryPart = null;

  return this;
}

MHTMLExtractor.prototype = {

  getParts: function (cb) {

    var instream = fs.createReadStream(this.source);
    var outstream = new stream;
    var rl = readline.createInterface(instream, outstream);

    var lineno = 0;
    var validMhtml = false;
    var boundary, part, meta, parsed;

    var readMeta = false;
    var readContent = false;
    var primaryContentLocationPrefix = null;

    rl.on('line', function readLine(line) {

      boundary = line.match(/boundary=["'](.+?)["']/);

      if (!this.boundry) {
        if (boundary) {
          this.boundary = boundary[1];
        }
        if (line.match('Content-Type: multipart/related')) {
          validMhtml = true;
        }
      }

      if (line.match(new RegExp('^--' + this.boundary))) {
        readMeta = true;
        readContent = false;
        part = new Part();

        if (this.primaryPart == null) {
          this.primaryPart = part;
        }
      }

      if (readMeta === true) {

        // a newline after the meta block signifies the start of the content block
        if (line.match(/^$/)) {
          readMeta = false;
          readContent = true;
          this.parts.push(part);
        } else {
          meta = line.match(/^(Content-[A-Za-z-]+):(?:\s+)?(.*)/i);
          if (meta) {
            if (meta[1].toLowerCase() == "content-location") {
              part.meta("content-location", meta[2]);
            } else {
              parsed = mimelib.parseHeaderLine(meta[2]);
              part.meta(meta[1], parsed.defaultValue);
              if (parsed.charset) {
                part.meta('charset', parsed.charset.replace(/["']/g, ''));
              }
            }
          }
        }
      }

      if (readContent === true && !line.match(/^$/)) {
        part.content += line + EOL;
      }

      lineno++;

    }.bind(this));

    rl.on('close', function endRead() {
      if (!validMhtml) cb(new Error('Invalid MHTML file'));
      else cb(null);
    }.bind(this));
  },

  extractParts: function (dest, cb, force, primaryContentLocationPrefix) {
    // TODO: allow mode to be passed as an argument

    var noParts = this.parts.length;
    var done = 0;
    var primaryContentLocationPrefix = null;

    if (this.primaryPart) {
      primaryContentLocationPrefix = this.primaryPart.contentLocationPrefix();
    }

    var extract = function (err) {

      mkdir(dest, function (err) {

        if (err) return cb(err);

        this.parts.each(function (part) {

          var filePath = path.join(dest, part.filePath());
          var fileDir = path.dirname(filePath);

          if (!part.hasContentLocationPrefix(primaryContentLocationPrefix)) {
            done++;

            if (done == noParts) return cb(null);
            else return;
          }

          part.decoded(function (err, content) {
            mkdir(fileDir, function (err) {
              if (err) return cb(err);
              fs.writeFile(filePath, content, function (err) {
                if (err) return cb(err);
                done++;
                if (done == noParts) return cb(null);
              });
            });
          });
        });
      }.bind(this));
    }.bind(this);

    if (force) {
      rmdir(dest, extract);
    } else {
      extract();
    }
  },

  extract: function (dest, cb, force) {
    var force = (typeof force === 'undefined') ? false : force;
    this.getParts(function readFile(err) {
      if (err) return cb(err);
      this.extractParts(dest, function extractParts(err) {
        cb(err);
      }, force);
    }.bind(this));
  }
};

function extractMHTML(source, destination, cb, force) {
  new MHTMLExtractor(source).extract(destination, cb, force);
}
