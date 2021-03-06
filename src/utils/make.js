const debug = require('debug')('thumbsup')
const fs = require('fs-extra')
const path = require('path')
const pad  = require('pad')
const async = require('async')
const progress = require('./progress')

exports.exec = function(input, output, collection, options, callback) {
  var message = pad(options.message, 20)
  // create {src, dest} tasks
  var tasks = collection.filter(extension(options.ext)).map(file => {
    return {
      src: path.join(input, file.path),
      dest: path.join(output, transform(file.path, options.dest)),
      metadata: file
    };
  });
  // only keep the ones where dest is out of date
  var process = tasks.filter(function(task) {
    try {
      var destDate = fs.statSync(task.dest).mtime.getTime();
      return task.metadata.fileDate > destDate;
    } catch (ex) {
      return true;
    }
  });
  // run all in sequence
  var bar = progress.create(options.message, process.length);
  if (process.length > 0) {
    var ops = process.map(function(task) {
      return function(next) {
        debug(`Transforming ${task.src} into ${task.dest}`)
        fs.mkdirpSync(path.dirname(task.dest));
        options.func(task, function(err) {
          bar.tick();
          next(err);
        });
      };
    });
    async.parallelLimit(ops, 2, callback);
  } else {
    callback();
  }
}

function extension(regex) {
  return function(file) {
    return file.path.match(new RegExp('\.(' + regex + ')$', 'i'));
  }
}

function transform(file, pattern) {
  var absolutePrefix = (pattern[0] === '/') ? '/' : '';
  var parts = pattern.split('/');
  var full = path.join.apply(this, parts);
  return absolutePrefix +
         full.replace('$path', path.dirname(file))
             .replace('$name', path.basename(file, path.extname(file)))
             .replace('$ext',  path.extname(file).substr(1));
}
