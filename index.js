/* jshint node: true */
'use strict';

/**
* Module dependencies.
*/

var Concat = require('concat-with-sourcemaps');
var extend = require('object-assign');
var through = require('through2');
var gutil = require('gulp-util');
var stream = require('stream');
var path = require('path');

/**
* gulp-header plugin
*/

module.exports = function (headerText, data) {
  headerText = headerText || '';

  var filename;
  var concat;
  var _file;

  function TransformStream (file, enc, cb) {
    if (typeof file === 'string') {
      filename = file;
    } else if (typeof file.path === 'string') {
      filename = path.basename(file.path);
    } else {
      filename = '';
    }

    var template = gutil.template(headerText, extend({file : file}, data));
    _file = file;
    concat = new Concat(true, filename);

    if (file.isBuffer()) {
      concat.add(filename, new Buffer(template));
    }

    if (file.isStream()) {
      var stream = through();
      stream.write(new Buffer(template));
      stream.on('error', this.emit.bind(this, 'error'));
      file.contents = file.contents.pipe(stream);
    }

    // add sourcemap
    concat.add(file.relative, file.contents, file.sourceMap);

    // tell the stream engine that we are done with this file
    cb();
  }

  function EndStream (cb) {
    // return if there are no files in the stream
    if(!_file){
      return cb();
    }
    var file = _file.clone({ contents: false });

    // make sure streaming content is preserved
    if (file.contents && !isStream(file.contents)) {
      file.contents = concat.content;
    }

    // apply source map
    if (concat.sourceMapping) {
      file.sourceMap = JSON.parse(concat.sourceMap);
    }

    // make sure the file goes through the next gulp plugin
    this.push(file);
    cb();
  }

  return through.obj(TransformStream, EndStream);
};

/**
* is stream?
*/

function isStream (obj) {
  return obj instanceof stream.Stream;
}
