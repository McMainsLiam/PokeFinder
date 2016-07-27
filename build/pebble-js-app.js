var __loader = (function() {

var loader = {};

loader.packages = {};

loader.packagesLinenoOrder = [{ filename: 'loader.js', lineno: 0 }];

loader.fileExts = ['?', '?.js', '?.json'];
loader.folderExts = ['?/index.js', '?/index.json'];
loader.builtins = ['safe'];

loader.basepath = function(path) {
  return path.replace(/[^\/]*$/, '');
};

loader.joinpath = function() {
  var result = arguments[0];
  for (var i = 1; i < arguments.length; ++i) {
    if (arguments[i][0] === '/') {
      result = arguments[i];
    } else {
      result += '/' + arguments[i];
    }
  }

  if (result[0] === '/') {
    result = result.substr(1);
  }
  return result;
};

var replace = function(a, regexp, b) {
  var z;
  do {
    z = a;
  } while (z !== (a = a.replace(regexp, b)));
  return z;
};

loader.normalize = function(path) {
  path = replace(path, /(?:(^|\/)\.?\/)+/g, '$1');
  path = replace(path, /[^\/]*\/\.\.\//, '');
  path = path.replace(/\/\/+/g, '/');
  path = path.replace(/^\//, '');
  return path;
};

function _require(module) {
  if (module.exports) {
    return module.exports;
  }

  var require = function(path) { return loader.require(path, module); };

  module.exports = {};
  module.loader(module.exports, module, require);
  module.loaded = true;

  return module.exports;
}

loader.require = function(path, requirer) {
  var module = loader.getPackage(path, requirer);
  if (!module) {
    throw new Error("Cannot find module '" + path + "'");
  }

  return _require(module);
};

var compareLineno = function(a, b) { return a.lineno - b.lineno; };

loader.define = function(path, lineno, loadfun) {
  var module = {
    filename: path,
    lineno: lineno,
    loader: loadfun,
  };

  loader.packages[path] = module;
  loader.packagesLinenoOrder.push(module);
  loader.packagesLinenoOrder.sort(compareLineno);
};

loader.getPackageForPath = function(path) {
  return loader.getPackageForFile(path) || loader.getPackageForDirectory(path);
};

loader.getPackage = function(path, requirer) {
  var module;
  var fullPath;
  if (requirer && requirer.filename) {
    fullPath = loader.joinpath(loader.basepath(requirer.filename), path);
  } else {
    fullPath = path;
  }

  if (loader.builtins.indexOf(path) !== -1) {
    return loader.packages[path];
  }

  // Try loading the module from a path, if it is trying to load from a path.
  if (path.substr(0, 2) === './' || path.substr(0, 1) === '/' || path.substr(0, 3) === '../') {
    module = loader.getPackageForPath(fullPath);
  }

  if (!module) {
    module = loader.getPackageFromBuildOutput(path);
  }

  if (!module) {
    module = loader.getPackageForNodeModule(path);
  }

  return module;
};

loader.getPackageForFile = function(path) {
  path = loader.normalize(path);

  var module;
  var fileExts = loader.fileExts;
  for (var i = 0, ii = fileExts.length; !module && i < ii; ++i) {
    var filepath = fileExts[i].replace('?', path);
    module = loader.packages[filepath];
  }

  return module;
};

loader.getPackageForDirectory = function(path) {
  path = loader.normalize(path);

  var module;
  var packagePackage = loader.packages[loader.joinpath(path, 'package.json')];
  if (packagePackage) {
    var info = _require(packagePackage);
    if (info.main) {
      module = loader.getPackageForFile(loader.joinpath(path, info.main));
    }
  }

  if (!module) {
    module = loader.getPackageForFile(loader.joinpath(path, 'index'));
  }

  return module;
};

loader.getPackageFromBuildOutput = function(path) {
  var moduleBuildPath = loader.normalize(loader.joinpath('build', 'js', path));

  return loader.getPackageForPath(moduleBuildPath);
};

// Nested node_modules are banned, so we can do a simple search here.
loader.getPackageForNodeModule = function(path) {
  var modulePath = loader.normalize(loader.joinpath('node_modules', path));

  return loader.getPackageForPath(modulePath);
};

loader.getPackageByLineno = function(lineno) {
  var packages = loader.packagesLinenoOrder;
  var module;
  for (var i = 0, ii = packages.length; i < ii; ++i) {
    var next = packages[i];
    if (next.lineno > lineno) {
      break;
    }
    module = next;
  }
  return module;
};

return loader;

})();

__loader.define('safe', 181, function(exports, module, require) {
/* safe.js - Building a safer world for Pebble.JS Developers
 *
 * This library provides wrapper around all the asynchronous handlers that developers
 * have access to so that error messages are caught and displayed nicely in the pebble tool
 * console.
 */

/* global __loader */

var safe = {};

/* The name of the concatenated file to translate */
safe.translateName = 'pebble-js-app.js';

safe.indent = '    ';

/* Translates a source line position to the originating file */
safe.translatePos = function(name, lineno, colno) {
  if (name === safe.translateName) {
    var pkg = __loader.getPackageByLineno(lineno);
    if (pkg) {
      name = pkg.filename;
      lineno -= pkg.lineno;
    }
  }
  return name + ':' + lineno + ':' + colno;
};

var makeTranslateStack = function(stackLineRegExp, translateLine) {
  return function(stack, level) {
    var lines = stack.split('\n');
    var firstStackLine = -1;
    for (var i = lines.length - 1; i >= 0; --i) {
      var m = lines[i].match(stackLineRegExp);
      if (!m) {
        continue;
      }
      var line = lines[i] = translateLine.apply(this, m);
      if (line) {
        firstStackLine = i;
        if (line.indexOf(module.filename) !== -1) {
          lines.splice(i, 1);
        }
      } else {
        lines.splice(i, lines.length - i);
      }
    }
    if (firstStackLine > -1) {
      lines.splice(firstStackLine, level);
    }
    return lines;
  };
};

/* Translates a node style stack trace line */
var translateLineV8 = function(line, msg, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return msg + (scope ? ' ' + scope + ' (' + pos + ')' : pos);
};

/* Matches <msg> (<scope> '(')? <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpV8 = /(.+?)(?:\s+([^\s]+)\s+\()?([^\s@:]+):(\d+):(\d+)\)?/;

safe.translateStackV8 = makeTranslateStack(stackLineRegExpV8, translateLineV8);

/* Translates an iOS stack trace line to node style */
var translateLineIOS = function(line, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return safe.indent + 'at ' + (scope ? scope  + ' (' + pos + ')' : pos);
};

/* Matches (<scope> '@' )? <name> ':' <lineno> ':' <colno> */
var stackLineRegExpIOS = /(?:([^\s@]+)@)?([^\s@:]+):(\d+):(\d+)/;

safe.translateStackIOS = makeTranslateStack(stackLineRegExpIOS, translateLineIOS);

/* Translates an Android stack trace line to node style */
var translateLineAndroid = function(line, msg, scope, name, lineno, colno) {
  if (name !== 'jskit_startup.js') {
    return translateLineV8(line, msg, scope, name, lineno, colno);
  }
};

/* Matches <msg> <scope> '('? filepath <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpAndroid = /^(.*?)(?:\s+([^\s]+)\s+\()?[^\s\(]*?([^\/]*?):(\d+):(\d+)\)?/;

safe.translateStackAndroid = makeTranslateStack(stackLineRegExpAndroid, translateLineAndroid);

/* Translates a stack trace to the originating files */
safe.translateStack = function(stack, level) {
  level = level || 0;
  if (Pebble.platform === 'pypkjs') {
    return safe.translateStackV8(stack, level);
  } else if (stack.match('com.getpebble.android')) {
    return safe.translateStackAndroid(stack, level);
  } else {
    return safe.translateStackIOS(stack, level);
  }
};

var normalizeIndent = function(lines, pos) {
  pos = pos || 0;
  var label = lines[pos].match(/^[^\s]* /);
  if (label) {
    var indent = label[0].replace(/./g, ' ');
    for (var i = pos + 1, ii = lines.length; i < ii; i++) {
      lines[i] = lines[i].replace(/^\t/, indent);
    }
  }
  return lines;
};

safe.translateError = function(err, intro, level) {
  var name = err.name;
  var message = err.message || err.toString();
  var stack = err.stack;
  var result = [intro || 'JavaScript Error:'];
  if (message && (!stack || stack.indexOf(message) === -1)) {
    if (name && message.indexOf(name + ':') === -1) {
      message = name + ': ' + message;
    }
    result.push(message);
  }
  if (stack) {
    Array.prototype.push.apply(result, safe.translateStack(stack, level));
  }
  return normalizeIndent(result, 1).join('\n');
};

/* Dumps error messages to the console. */
safe.dumpError = function(err, intro, level) {
  if (typeof err === 'object') {
    console.log(safe.translateError(err, intro, level));
  } else {
    console.log('Error: dumpError argument is not an object');
  }
};

/* Logs runtime warnings to the console. */
safe.warn = function(message, level, name) {
  var err = new Error(message);
  err.name = name || 'Warning';
  safe.dumpError(err, 'Warning:', 1);
};

/* Takes a function and return a new function with a call to it wrapped in a try/catch statement */
safe.protect = function(fn) {
  return fn ? function() {
    try {
      fn.apply(this, arguments);
    } catch (err) {
      safe.dumpError(err);
    }
  } : undefined;
};

/* Wrap event handlers added by Pebble.addEventListener */
var pblAddEventListener = Pebble.addEventListener;
Pebble.addEventListener = function(eventName, eventCallback) {
  pblAddEventListener.call(this, eventName, safe.protect(eventCallback));
};

var pblSendMessage = Pebble.sendAppMessage;
Pebble.sendAppMessage = function(message, success, failure) {
  return pblSendMessage.call(this, message, safe.protect(success), safe.protect(failure));
};

/* Wrap setTimeout and setInterval */
var originalSetTimeout = setTimeout;
window.setTimeout = function(callback, delay) {
  if (safe.warnSetTimeoutNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setTimeout was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetTimeoutNotFunction = false;
  }
  return originalSetTimeout(safe.protect(callback), delay);
};

var originalSetInterval = setInterval;
window.setInterval = function(callback, delay) {
  if (safe.warnSetIntervalNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setInterval was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetIntervalNotFunction = false;
  }
  return originalSetInterval(safe.protect(callback), delay);
};

/* Wrap the geolocation API Callbacks */
var watchPosition = navigator.geolocation.watchPosition;
navigator.geolocation.watchPosition = function(success, error, options) {
  return watchPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var getCurrentPosition = navigator.geolocation.getCurrentPosition;
navigator.geolocation.getCurrentPosition = function(success, error, options) {
  return getCurrentPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var ajax;

/* Try to load the ajax library if available and silently fail if it is not found. */
try {
  ajax = require('ajax');
} catch (err) {}

/* Wrap the success and failure callback of the ajax library */
if (ajax) {
  ajax.onHandler = function(eventName, callback) {
    return safe.protect(callback);
  };
}

module.exports = safe;
});
__loader.define('src/js/MessageQueue.js', 397, function(exports, module, require) {
"use strict";(function(root,factory){if(typeof define==="function"&&define.amd){define([],factory)}else if(typeof module==="object"&&module.exports){module.exports=factory()}else{root.MessageQueue=factory()}})(this,function(){var RETRY_MAX=5;var queue=[];var sending=false;var timer=null;return{reset:reset,sendAppMessage:sendAppMessage,size:size};function reset(){queue=[];sending=false}function sendAppMessage(message,ack,nack){if(!isValidMessage(message)){return false}queue.push({message:message,ack:ack||null,nack:nack||null,attempts:0});setTimeout(function(){sendNextMessage()},1);return true}function size(){return queue.length}function isValidMessage(message){if(message!==Object(message)){return false}var keys=Object.keys(message);if(!keys.length){return false}for(var k=0;k<keys.length;k+=1){var validKey=/^[0-9a-zA-Z-_]*$/.test(keys[k]);if(!validKey){return false}var value=message[keys[k]];if(!validValue(value)){return false}}return true;function validValue(value){switch(typeof value){case"string":return true;case"number":return true;case"object":if(toString.call(value)==="[object Array]"){return true}}return false}}function sendNextMessage(){if(sending){return}var message=queue.shift();if(!message){return}message.attempts+=1;sending=true;Pebble.sendAppMessage(message.message,ack,nack);timer=setTimeout(function(){timeout()},1e3);function ack(){clearTimeout(timer);setTimeout(function(){sending=false;sendNextMessage()},200);if(message.ack){message.ack.apply(null,arguments)}}function nack(){clearTimeout(timer);if(message.attempts<RETRY_MAX){queue.unshift(message);setTimeout(function(){sending=false;sendNextMessage()},200*message.attempts)}else{if(message.nack){message.nack.apply(null,arguments)}}}function timeout(){setTimeout(function(){sending=false;sendNextMessage()},1e3);if(message.ack){message.ack.apply(null,arguments)}}}});
});
__loader.define('src/js/app.js', 400, function(exports, module, require) {


var MessageQueue = require("./MessageQueue");

var pokemonList = [{"name":"Bulbasaur","type1":"Grass","type2":"Poison","discRadius":"0.5723","captureRate":"0.16","fleeRate":"0.1","movementType":"Jump","stamina":"90","attack":"126","defense":"126","candyToEvolve":"25"},{"name":"Ivysaur","type1":"Grass","type2":"Poison","discRadius":"0.765","captureRate":"0.08","fleeRate":"0.07","movementType":"Jump","stamina":"120","attack":"156","defense":"158","candyToEvolve":"100"},{"name":"Venusaur","type1":"Grass","type2":"Poison","discRadius":"1.1385","captureRate":"0.04","fleeRate":"0.05","movementType":"Jump","stamina":"160","attack":"198","defense":"200"},{"name":"Charmander","type1":"Fire","discRadius":"0.4688","captureRate":"0.16","fleeRate":"0.1","movementType":"Jump","stamina":"78","attack":"128","defense":"108","candyToEvolve":"25"},{"name":"Charmeleon","type1":"Fire","discRadius":"0.6953","captureRate":"0.08","fleeRate":"0.07","movementType":"Jump","stamina":"116","attack":"160","defense":"140","candyToEvolve":"100"},{"name":"Charizard","type1":"Fire","type2":"Flying","discRadius":"1.215","captureRate":"0.04","fleeRate":"0.05","movementType":"Flying","stamina":"156","attack":"212","defense":"182"},{"name":"Squirtle","type1":"Water","discRadius":"0.5738","captureRate":"0.16","fleeRate":"0.1","movementType":"Jump","stamina":"88","attack":"112","defense":"142","candyToEvolve":"25"},{"name":"Wartortle","type1":"Water","discRadius":"0.5625","captureRate":"0.08","fleeRate":"0.07","movementType":"Jump","stamina":"118","attack":"144","defense":"176","candyToEvolve":"100"},{"name":"Blastoise","type1":"Water","discRadius":"0.846","captureRate":"0.04","fleeRate":"0.05","movementType":"Jump","stamina":"158","attack":"186","defense":"222"},{"name":"Caterpie","type1":"Bug","discRadius":"0.459","captureRate":"0.4","fleeRate":"0.2","movementType":"Jump","stamina":"90","attack":"62","defense":"66","candyToEvolve":"12"},{"name":"Metapod","type1":"Bug","discRadius":"0.5265","captureRate":"0.2","fleeRate":"0.09","movementType":"Jump","stamina":"100","attack":"56","defense":"86","candyToEvolve":"50"},{"name":"Butterfree","type1":"Bug","type2":"Flying","discRadius":"0.999","captureRate":"0.1","fleeRate":"0.06","movementType":"Flying","stamina":"120","attack":"144","defense":"144"},{"name":"Weedle","type1":"Bug","type2":"Poison","discRadius":"0.3135","captureRate":"0.4","fleeRate":"0.2","movementType":"Jump","stamina":"80","attack":"68","defense":"64","candyToEvolve":"12"},{"name":"Kakuna","type1":"Bug","type2":"Poison","discRadius":"0.375","captureRate":"0.2","fleeRate":"0.09","movementType":"Jump","stamina":"90","attack":"62","defense":"82","candyToEvolve":"50"},{"name":"Beedrill","type1":"Bug","type2":"Poison","discRadius":"0.693","captureRate":"0.1","fleeRate":"0.06","movementType":"Electric","stamina":"130","attack":"144","defense":"130"},{"name":"Pidgey","type1":"Normal","type2":"Flying","discRadius":"0.378","captureRate":"0.4","fleeRate":"0.2","movementType":"Jump","stamina":"80","attack":"94","defense":"90","candyToEvolve":"12"},{"name":"Pidgeotto","type1":"Normal","type2":"Flying","discRadius":"0.711","captureRate":"0.2","fleeRate":"0.09","movementType":"Flying","stamina":"126","attack":"126","defense":"122","candyToEvolve":"50"},{"name":"Pidgeot","type1":"Normal","type2":"Flying","discRadius":"1.296","captureRate":"0.1","fleeRate":"0.06","movementType":"Flying","stamina":"166","attack":"170","defense":"166"},{"name":"Rattata","type1":"Normal","discRadius":"0.378","captureRate":"0.4","fleeRate":"0.2","movementType":"Jump","stamina":"60","attack":"92","defense":"86","candyToEvolve":"25"},{"name":"Raticate","type1":"Normal","discRadius":"0.7898","captureRate":"0.16","fleeRate":"0.07","movementType":"Jump","stamina":"110","attack":"146","defense":"150"},{"name":"Spearow","type1":"Normal","type2":"Flying","discRadius":"0.444","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"80","attack":"102","defense":"78","candyToEvolve":"50"},{"name":"Fearow","type1":"Normal","type2":"Flying","discRadius":"1.26","captureRate":"0.16","fleeRate":"0.07","movementType":"Flying","stamina":"130","attack":"168","defense":"146"},{"name":"Ekans","type1":"Poison","discRadius":"0.6488","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"70","attack":"112","defense":"112","candyToEvolve":"50"},{"name":"Arbok","type1":"Poison","discRadius":"0.9225","captureRate":"0.16","fleeRate":"0.07","movementType":"Jump","stamina":"120","attack":"166","defense":"166"},{"name":"Pikachu","type1":"Electric","discRadius":"0.555","captureRate":"0.16","fleeRate":"0.1","stamina":"70","attack":"124","defense":"108","candyToEvolve":"50"},{"name":"Raichu","type1":"Electric","discRadius":"0.729","captureRate":"0.08","fleeRate":"0.06","movementType":"Jump","stamina":"120","attack":"200","defense":"154"},{"name":"Sandshrew","type1":"Ground","discRadius":"0.4838","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"100","attack":"90","defense":"114","candyToEvolve":"50"},{"name":"Sandslash","type1":"Ground","discRadius":"0.6","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"150","attack":"150","defense":"172"},{"name":"Nidoran","type1":"Poison","discRadius":"0.555","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"110","attack":"100","defense":"104","candyToEvolve":"25"},{"name":"Nidorina","type1":"Poison","discRadius":"0.6581","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"140","attack":"132","defense":"136","candyToEvolve":"100"},{"name":"Nidoqueen","type1":"Poison","type2":"Ground","discRadius":"0.6143","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"180","attack":"184","defense":"190"},{"name":"Nidoran","type1":"Poison","discRadius":"0.7088","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"92","attack":"110","defense":"94","candyToEvolve":"25"},{"name":"Nidorino","type1":"Poison","discRadius":"0.7425","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"122","attack":"142","defense":"128","candyToEvolve":"100"},{"name":"Nidoking","type1":"Poison","type2":"Ground","discRadius":"0.8222","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"162","attack":"204","defense":"170"},{"name":"Clefairy","type1":"Fairy","discRadius":"0.675","captureRate":"0.24","fleeRate":"0.1","stamina":"140","attack":"116","defense":"124","candyToEvolve":"50"},{"name":"Clefable","type1":"Fairy","discRadius":"1.1681","captureRate":"0.08","fleeRate":"0.06","movementType":"Jump","stamina":"190","attack":"178","defense":"178"},{"name":"Vulpix","type1":"Fire","discRadius":"0.8505","captureRate":"0.24","fleeRate":"0.1","movementType":"Jump","stamina":"76","attack":"106","defense":"118","candyToEvolve":"50"},{"name":"Ninetales","type1":"Fire","discRadius":"1.296","captureRate":"0.08","fleeRate":"0.06","movementType":"Jump","stamina":"146","attack":"176","defense":"194"},{"name":"Jigglypuff","type1":"Normal","type2":"Fairy","discRadius":"0.768","captureRate":"0.4","fleeRate":"0.1","stamina":"230","attack":"98","defense":"54","candyToEvolve":"50"},{"name":"Wigglytuff","type1":"Normal","type2":"Fairy","discRadius":"1.0013","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"280","attack":"168","defense":"108"},{"name":"Zubat","type1":"Poison","type2":"Flying","discRadius":"0.963","captureRate":"0.4","fleeRate":"0.2","movementType":"Flying","stamina":"80","attack":"88","defense":"90","candyToEvolve":"50"},{"name":"Golbat","type1":"Poison","type2":"Flying","discRadius":"1.5975","captureRate":"0.16","fleeRate":"0.07","movementType":"Flying","stamina":"150","attack":"164","defense":"164"},{"name":"Oddish","type1":"Grass","type2":"Poison","discRadius":"0.6075","captureRate":"0.48","fleeRate":"0.15","movementType":"Jump","stamina":"90","attack":"134","defense":"130","candyToEvolve":"25"},{"name":"Gloom","type1":"Grass","type2":"Poison","discRadius":"0.7425","captureRate":"0.24","fleeRate":"0.07","movementType":"Jump","stamina":"120","attack":"162","defense":"158","candyToEvolve":"100"},{"name":"Vileplume","type1":"Grass","type2":"Poison","discRadius":"1.242","captureRate":"0.12","fleeRate":"0.05","movementType":"Jump","stamina":"150","attack":"202","defense":"190"},{"name":"Paras","type1":"Bug","type2":"Grass","discRadius":"0.576","captureRate":"0.32","fleeRate":"0.15","movementType":"Jump","stamina":"70","attack":"122","defense":"120","candyToEvolve":"50"},{"name":"Parasect","type1":"Bug","type2":"Grass","discRadius":"0.9469","captureRate":"0.16","fleeRate":"0.07","movementType":"Jump","stamina":"120","attack":"162","defense":"170"},{"name":"Venonat","type1":"Bug","type2":"Poison","discRadius":"0.7988","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"120","attack":"108","defense":"118","candyToEvolve":"50"},{"name":"Venomoth","type1":"Bug","type2":"Poison","discRadius":"0.864","captureRate":"0.16","fleeRate":"0.07","movementType":"Flying","stamina":"140","attack":"172","defense":"154"},{"name":"Diglett","type1":"Ground","discRadius":"0.45","captureRate":"0.4","fleeRate":"0.1","stamina":"20","attack":"108","defense":"86","candyToEvolve":"50"},{"name":"Dugtrio","type1":"Ground","discRadius":"1.008","captureRate":"0.16","fleeRate":"0.06","stamina":"70","attack":"148","defense":"140"},{"name":"Meowth","type1":"Normal","discRadius":"0.6","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"80","attack":"104","defense":"94","candyToEvolve":"50"},{"name":"Persian","type1":"Normal","discRadius":"0.7995","captureRate":"0.16","fleeRate":"0.07","movementType":"Jump","stamina":"130","attack":"156","defense":"146"},{"name":"Psyduck","type1":"Water","discRadius":"0.5456","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"100","attack":"132","defense":"112","candyToEvolve":"50"},{"name":"Golduck","type1":"Water","discRadius":"0.9765","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"160","attack":"194","defense":"176"},{"name":"Mankey","type1":"Fighting","discRadius":"0.7256","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"80","attack":"122","defense":"96","candyToEvolve":"50"},{"name":"Primeape","type1":"Fighting","discRadius":"0.69","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"130","attack":"178","defense":"150"},{"name":"Growlithe","type1":"Fire","discRadius":"0.8775","captureRate":"0.24","fleeRate":"0.1","movementType":"Jump","stamina":"110","attack":"156","defense":"110","candyToEvolve":"50"},{"name":"Arcanine","type1":"Fire","discRadius":"0.999","captureRate":"0.08","fleeRate":"0.06","movementType":"Jump","stamina":"180","attack":"230","defense":"180"},{"name":"Poliwag","type1":"Water","discRadius":"0.75","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"80","attack":"108","defense":"98","candyToEvolve":"25"},{"name":"Poliwhirl","type1":"Water","discRadius":"1.1025","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"130","attack":"132","defense":"132","candyToEvolve":"100"},{"name":"Poliwrath","type1":"Water","type2":"Fighting","discRadius":"1.2255","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"180","attack":"180","defense":"202"},{"name":"Abra","type1":"Psychic","discRadius":"0.672","captureRate":"0.4","fleeRate":"0.99","movementType":"Psychic","stamina":"50","attack":"110","defense":"76","candyToEvolve":"25"},{"name":"Kadabra","type1":"Psychic","discRadius":"1.0013","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"80","attack":"150","defense":"112","candyToEvolve":"100"},{"name":"Alakazam","type1":"Psychic","discRadius":"0.765","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"110","attack":"186","defense":"152"},{"name":"Machop","type1":"Fighting","discRadius":"0.6188","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"140","attack":"118","defense":"96","candyToEvolve":"25"},{"name":"Machoke","type1":"Fighting","discRadius":"0.819","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"160","attack":"154","defense":"144","candyToEvolve":"100"},{"name":"Machamp","type1":"Fighting","discRadius":"0.8678","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"180","attack":"198","defense":"180"},{"name":"Bellsprout","type1":"Grass","type2":"Poison","discRadius":"0.6773","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"100","attack":"158","defense":"78","candyToEvolve":"25"},{"name":"Weepinbell","type1":"Grass","type2":"Poison","discRadius":"0.975","captureRate":"0.2","fleeRate":"0.07","movementType":"Hovering","stamina":"130","attack":"190","defense":"110","candyToEvolve":"100"},{"name":"Victreebel","type1":"Grass","type2":"Poison","discRadius":"0.819","captureRate":"0.1","fleeRate":"0.05","movementType":"Hovering","stamina":"160","attack":"222","defense":"152"},{"name":"Tentacool","type1":"Water","type2":"Poison","discRadius":"0.4725","captureRate":"0.4","fleeRate":"0.15","movementType":"Hovering","stamina":"80","attack":"106","defense":"136","candyToEvolve":"50"},{"name":"Tentacruel","type1":"Water","type2":"Poison","discRadius":"0.738","captureRate":"0.16","fleeRate":"0.07","movementType":"Hovering","stamina":"160","attack":"170","defense":"196"},{"name":"Geodude","type1":"Rock","type2":"Ground","discRadius":"0.5873","captureRate":"0.4","fleeRate":"0.1","movementType":"Hovering","stamina":"80","attack":"106","defense":"118","candyToEvolve":"25"},{"name":"Graveler","type1":"Rock","type2":"Ground","discRadius":"1.0455","captureRate":"0.2","fleeRate":"0.07","movementType":"Jump","stamina":"110","attack":"142","defense":"156","candyToEvolve":"100"},{"name":"Golem","type1":"Rock","type2":"Ground","discRadius":"0.945","captureRate":"0.1","fleeRate":"0.05","movementType":"Jump","stamina":"160","attack":"176","defense":"198"},{"name":"Ponyta","type1":"Fire","discRadius":"0.5681","captureRate":"0.32","fleeRate":"0.1","movementType":"Jump","stamina":"100","attack":"168","defense":"138","candyToEvolve":"50"},{"name":"Rapidash","type1":"Fire","discRadius":"0.6075","captureRate":"0.12","fleeRate":"0.06","movementType":"Jump","stamina":"130","attack":"200","defense":"170"},{"name":"Slowpoke","type1":"Water","type2":"Psychic","discRadius":"1.185","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"180","attack":"110","defense":"110","candyToEvolve":"50"},{"name":"Slowbro","type1":"Water","type2":"Psychic","discRadius":"0.7013","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"190","attack":"184","defense":"198"},{"name":"Magnemite","type1":"Electric","type2":"Steel","discRadius":"0.684","captureRate":"0.4","fleeRate":"0.1","movementType":"Electric","stamina":"50","attack":"128","defense":"138","candyToEvolve":"50"},{"name":"Magneton","type1":"Electric","type2":"Steel","discRadius":"0.66","captureRate":"0.16","fleeRate":"0.06","movementType":"Electric","stamina":"100","attack":"186","defense":"180"},{"name":"Farfetchd","type1":"Normal","type2":"Flying","discRadius":"0.678","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"104","attack":"138","defense":"132"},{"name":"Doduo","type1":"Normal","type2":"Flying","discRadius":"0.594","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"70","attack":"126","defense":"96","candyToEvolve":"50"},{"name":"Dodrio","type1":"Normal","type2":"Flying","discRadius":"0.7722","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"120","attack":"182","defense":"150"},{"name":"Seel","type1":"Water","discRadius":"0.4125","captureRate":"0.4","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"104","defense":"138","candyToEvolve":"50"},{"name":"Dewgong","type1":"Water","type2":"Ice","discRadius":"0.7875","captureRate":"0.16","fleeRate":"0.06","movementType":"Hovering","stamina":"180","attack":"156","defense":"192"},{"name":"Grimer","type1":"Poison","discRadius":"0.882","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"160","attack":"124","defense":"110","candyToEvolve":"50"},{"name":"Muk","type1":"Poison","discRadius":"1.14","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"210","attack":"180","defense":"188"},{"name":"Shellder","type1":"Water","discRadius":"0.5796","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"60","attack":"120","defense":"112","candyToEvolve":"50"},{"name":"Cloyster","type1":"Water","type2":"Ice","discRadius":"0.945","captureRate":"0.16","fleeRate":"0.06","movementType":"Hovering","stamina":"100","attack":"196","defense":"196"},{"name":"Gastly","type1":"Ghost","type2":"Poison","discRadius":"0.675","captureRate":"0.32","fleeRate":"0.1","movementType":"Psychic","stamina":"60","attack":"136","defense":"82","candyToEvolve":"25"},{"name":"Haunter","type1":"Ghost","type2":"Poison","discRadius":"0.765","captureRate":"0.16","fleeRate":"0.07","movementType":"Psychic","stamina":"90","attack":"172","defense":"118","candyToEvolve":"100"},{"name":"Gengar","type1":"Ghost","type2":"Poison","discRadius":"0.693","captureRate":"0.08","fleeRate":"0.05","movementType":"Jump","stamina":"120","attack":"204","defense":"156"},{"name":"Onix","type1":"Rock","type2":"Ground","discRadius":"0.987","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"70","attack":"90","defense":"186"},{"name":"Drowzee","type1":"Psychic","discRadius":"0.63","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"120","attack":"104","defense":"140","candyToEvolve":"50"},{"name":"Hypno","type1":"Psychic","discRadius":"0.9338","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"170","attack":"162","defense":"196"},{"name":"Krabby","type1":"Water","discRadius":"0.783","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"60","attack":"116","defense":"110","candyToEvolve":"50"},{"name":"Kingler","type1":"Water","discRadius":"0.9788","captureRate":"0.16","fleeRate":"0.07","movementType":"Jump","stamina":"110","attack":"178","defense":"168"},{"name":"Voltorb","type1":"Electric","discRadius":"0.5063","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"80","attack":"102","defense":"124","candyToEvolve":"50"},{"name":"Electrode","type1":"Electric","discRadius":"0.828","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"120","attack":"150","defense":"174"},{"name":"Exeggcute","type1":"Grass","type2":"Psychic","discRadius":"0.7725","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"120","attack":"110","defense":"132","candyToEvolve":"50"},{"name":"Exeggutor","type1":"Grass","type2":"Psychic","discRadius":"0.7605","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"190","attack":"232","defense":"164"},{"name":"Cubone","type1":"Ground","discRadius":"0.444","captureRate":"0.32","fleeRate":"0.1","movementType":"Jump","stamina":"100","attack":"102","defense":"150","candyToEvolve":"50"},{"name":"Marowak","type1":"Ground","discRadius":"0.525","captureRate":"0.12","fleeRate":"0.06","movementType":"Jump","stamina":"120","attack":"140","defense":"202"},{"name":"Hitmonlee","type1":"Fighting","discRadius":"0.6225","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"100","attack":"148","defense":"172"},{"name":"Hitmonchan","type1":"Fighting","discRadius":"0.6885","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"100","attack":"138","defense":"204"},{"name":"Lickitung","type1":"Normal","discRadius":"0.69","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"180","attack":"126","defense":"160"},{"name":"Koffing","type1":"Poison","discRadius":"0.72","captureRate":"0.4","fleeRate":"0.1","movementType":"Flying","stamina":"80","attack":"136","defense":"142","candyToEvolve":"50"},{"name":"Weezing","type1":"Poison","discRadius":"0.93","captureRate":"0.16","fleeRate":"0.06","movementType":"Flying","stamina":"130","attack":"190","defense":"198"},{"name":"Rhyhorn","type1":"Ground","type2":"Rock","discRadius":"0.75","captureRate":"0.4","fleeRate":"0.1","movementType":"Jump","stamina":"160","attack":"110","defense":"116","candyToEvolve":"50"},{"name":"Rhydon","type1":"Ground","type2":"Rock","discRadius":"1.185","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"210","attack":"166","defense":"160"},{"name":"Chansey","type1":"Normal","discRadius":"0.72","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"500","attack":"40","defense":"60"},{"name":"Tangela","type1":"Grass","discRadius":"1.095","captureRate":"0.32","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"164","defense":"152"},{"name":"Kangaskhan","type1":"Normal","discRadius":"0.864","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"210","attack":"142","defense":"178"},{"name":"Horsea","type1":"Water","discRadius":"0.2775","captureRate":"0.4","fleeRate":"0.1","movementType":"Hovering","stamina":"60","attack":"122","defense":"100","candyToEvolve":"50"},{"name":"Seadra","type1":"Water","discRadius":"0.69","captureRate":"0.16","fleeRate":"0.06","movementType":"Hovering","stamina":"110","attack":"176","defense":"150"},{"name":"Goldeen","type1":"Water","discRadius":"0.405","captureRate":"0.4","fleeRate":"0.15","movementType":"Hovering","stamina":"90","attack":"112","defense":"126","candyToEvolve":"50"},{"name":"Seaking","type1":"Water","discRadius":"0.594","captureRate":"0.16","fleeRate":"0.07","movementType":"Hovering","stamina":"160","attack":"172","defense":"160"},{"name":"Staryu","type1":"Water","discRadius":"0.6188","captureRate":"0.4","fleeRate":"0.15","movementType":"Jump","stamina":"60","attack":"130","defense":"128","candyToEvolve":"50"},{"name":"Starmie","type1":"Water","type2":"Psychic","discRadius":"0.7275","captureRate":"0.16","fleeRate":"0.06","movementType":"Jump","stamina":"120","attack":"194","defense":"192"},{"name":"M","type1":"Psychic","type2":"Fairy","discRadius":"0.6675","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"80","attack":"154","defense":"196"},{"name":"Scyther","type1":"Bug","type2":"Flying","discRadius":"1.14","captureRate":"0.24","fleeRate":"0.09","movementType":"Flying","stamina":"140","attack":"176","defense":"180"},{"name":"Jynx","type1":"Ice","type2":"Psychic","discRadius":"0.9788","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"172","defense":"134"},{"name":"Electabuzz","type1":"Electric","discRadius":"0.8453","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"198","defense":"160"},{"name":"Magmar","type1":"Fire","discRadius":"0.99","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"214","defense":"158"},{"name":"Pinsir","type1":"Bug","discRadius":"0.522","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"130","attack":"184","defense":"186"},{"name":"Tauros","type1":"Normal","discRadius":"0.8613","captureRate":"0.24","fleeRate":"0.09","movementType":"Jump","stamina":"150","attack":"148","defense":"184"},{"name":"Magikarp","type1":"Water","discRadius":"0.642","captureRate":"0.56","fleeRate":"0.15","movementType":"Jump","stamina":"40","attack":"42","defense":"84","candyToEvolve":"400"},{"name":"Gyarados","type1":"Water","type2":"Flying","discRadius":"0.72","captureRate":"0.08","fleeRate":"0.07","movementType":"Hovering","stamina":"190","attack":"192","defense":"196"},{"name":"Lapras","type1":"Water","type2":"Ice","discRadius":"1.05","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"260","attack":"186","defense":"190"},{"name":"Ditto","type1":"Normal","discRadius":"0.6038","captureRate":"0.16","fleeRate":"0.1","movementType":"Jump","stamina":"96","attack":"110","defense":"110"},{"name":"Eevee","type1":"Normal","discRadius":"0.63","captureRate":"0.32","fleeRate":"0.1","movementType":"Jump","stamina":"110","attack":"114","defense":"128","candyToEvolve":"25"},{"name":"Vaporeon","type1":"Water","discRadius":"0.5198","captureRate":"0.12","fleeRate":"0.06","movementType":"Jump","stamina":"260","attack":"186","defense":"168"},{"name":"Jolteon","type1":"Electric","discRadius":"0.495","captureRate":"0.12","fleeRate":"0.06","movementType":"Jump","stamina":"130","attack":"192","defense":"174"},{"name":"Flareon","type1":"Fire","discRadius":"0.4568","captureRate":"0.12","fleeRate":"0.06","movementType":"Jump","stamina":"130","attack":"238","defense":"178"},{"name":"Porygon","type1":"Normal","discRadius":"0.825","captureRate":"0.32","fleeRate":"0.09","movementType":"Hovering","stamina":"130","attack":"156","defense":"158"},{"name":"Omanyte","type1":"Rock","type2":"Water","discRadius":"0.333","captureRate":"0.32","fleeRate":"0.09","movementType":"Jump","stamina":"70","attack":"132","defense":"160","candyToEvolve":"50"},{"name":"Omastar","type1":"Rock","type2":"Water","discRadius":"0.5625","captureRate":"0.12","fleeRate":"0.05","movementType":"Jump","stamina":"140","attack":"180","defense":"202"},{"name":"Kabuto","type1":"Rock","type2":"Water","discRadius":"0.5063","captureRate":"0.32","fleeRate":"0.09","movementType":"Jump","stamina":"60","attack":"148","defense":"142","candyToEvolve":"50"},{"name":"Kabutops","type1":"Rock","type2":"Water","discRadius":"0.6825","captureRate":"0.12","fleeRate":"0.05","movementType":"Jump","stamina":"120","attack":"190","defense":"190"},{"name":"Aerodactyl","type1":"Rock","type2":"Flying","discRadius":"0.5985","captureRate":"0.16","fleeRate":"0.09","movementType":"Flying","stamina":"160","attack":"182","defense":"162"},{"name":"Snorlax","type1":"Normal","discRadius":"1.11","captureRate":"0.16","fleeRate":"0.09","movementType":"Jump","stamina":"320","attack":"180","defense":"180"},{"name":"Articuno","type1":"Ice","type2":"Flying","discRadius":"0.594","fleeRate":"0.1","movementType":"Flying","stamina":"180","attack":"198","defense":"242"},{"name":"Zapdos","type1":"Electric","type2":"Flying","discRadius":"0.7763","fleeRate":"0.1","movementType":"Electric","stamina":"180","attack":"232","defense":"194"},{"name":"Moltres","type1":"Fire","type2":"Flying","discRadius":"0.93","fleeRate":"0.1","movementType":"Flying","stamina":"180","attack":"242","defense":"194"},{"name":"Dratini","type1":"Dragon","discRadius":"0.4163","captureRate":"0.32","fleeRate":"0.09","movementType":"Jump","stamina":"82","attack":"128","defense":"110","candyToEvolve":"25"},{"name":"Dragonair","type1":"Dragon","discRadius":"0.8438","captureRate":"0.08","fleeRate":"0.06","movementType":"Jump","stamina":"122","attack":"170","defense":"152","candyToEvolve":"100"},{"name":"Dragonite","type1":"Dragon","type2":"Flying","discRadius":"0.63","captureRate":"0.04","fleeRate":"0.05","movementType":"Flying","stamina":"182","attack":"250","defense":"212"},{"name":"Mewtwo","type1":"Psychic","discRadius":"0.555","fleeRate":"0.1","movementType":"Jump","stamina":"212","attack":"284","defense":"202"},{"name":"Mew","type1":"Psychic","discRadius":"0.423","fleeRate":"0.1","movementType":"Psychic","stamina":"200","attack":"220","defense":"220"}];
var pokemonName = "";
var mostNearbyPokemon;
var nearbyPokemonArray;
//var pokemonID = 0;
var pokemon;

// Function to send a message to the Pebble using AppMessage API
// We are currently only sending a message using the "status" appKey defined in appinfo.json/Settings
function sendMessage() {
    searchForPokemon(pokemonName);
    if(pokemon != undefined) {
        //send all the messages over, sorry my code is shitty
        // //MessageQueue.sendAppMessage({"typeone": pokemon.type1}, messageSuccessHandler, messageFailureHandler);
        // if(pokemon.type2 == undefined) {
        //     MessageQueue.sendAppMessage({"typetwo": ""}, messageSuccessHandler, messageFailureHandler);
        // } else {
        //     MessageQueue.sendAppMessage({"typetwo": pokemon.type2}, messageSuccessHandler, messageFailureHandler);
        // }
        if(pokemon.captureRate == undefined) {
            MessageQueue.sendAppMessage({"caprate": "0.0"}, messageSuccessHandler, messageFailureHandler);
        } else {
            MessageQueue.sendAppMessage({"caprate": (String(parseFloat(pokemon.captureRate) * 100))}, messageSuccessHandler, messageFailureHandler);
        }
        //
        // MessageQueue.sendAppMessage({"fleerate": pokemon.fleeRate}, messageSuccessHandler, messageFailureHandler);
        // MessageQueue.sendAppMessage({"name": pokemon.name}, messageSuccessHandler, messageFailureHandler);
        // MessageQueue.sendAppMessage({"stamina": pokemon.stamina}, messageSuccessHandler, messageFailureHandler);
        // MessageQueue.sendAppMessage({"attack": pokemon.attack}, messageSuccessHandler, messageFailureHandler);
        // MessageQueue.sendAppMessage({"defense": pokemon.defense}, messageSuccessHandler, messageFailureHandler);

    } else {
        console.log("POKEMON NOT FOUND");
        MessageQueue.sendAppMessage({"status": 0}, messageSuccessHandler, messageFailureHandler);
    }

}

function searchForPokemon(string) {

    //Change some dictation to match pokemon names if they sound close to real words.
    if (string == "Ghastly") {
        string = "Gastly"
    } else if (string == "Drowsy") {
        string = "Drowzee"
    } else if (string == "Onyx") {
        string = "Onix"
    } else if (string == "Crabby") {
        string = "Krabby"
    } else if (string == "Execute") {
        string = "Exeggcute"
    } else if (string == "Executor") {
        string = "Exeggutor"
    } else if (string =="Coughing") {
        string = "Koffing"
    } else if (string == "Wheezing") {
        string = "Weezing"
    } else if (string == "Genghis Khan") {
        string = "Kangaskhan"
    } else if (string == "Horsey") {
        string = "Horsea"
    } else if (string == "Seeking") {
        string = "Seaking"
    }

    //Loops through the list of pokemon until you find the one with a matching name and return it
    pokemonList.forEach(function(element, index) {
        if(element.name.valueOf() === string.valueOf()) {
            pokemon = element;
            return;
        }
    });
}


// Called when the message send attempt succeeds
function messageSuccessHandler() {
    //console.log("Message send succeeded.");
}

// Called when the message send attempt fails
function messageFailureHandler() {
    console.log("Message send failed.");
    //sendMessage();
}

// Called when JS is ready

function searchForNewPokemon() {
    //get newest location
    navigator.geolocation.getCurrentPosition(
        locationSuccess,
        locationError,
        {timeout: 15000, maximumAge: 100}
    );
}

function updateScannedPokemon(pos) {
    var scanhttp = new XMLHttpRequest();
    scanhttp.timeout = 15000;
    var scanURL = "https://pokevision.com/map/scan/" + pos.coords.latitude + "/" + pos.coords.longitude;
    scanhttp.onreadystatechange = function() {
        if(scanhttp.readyState == 4 && scanhttp.status == 200) {
            if (scanhttp.responseText.indexOf("maintenance") > -1) {
                console.log("UNABLE TO SCAN AREA");
                MessageQueue.sendAppMessage({"status": 0}, messageSuccessHandler, messageFailureHandler);
            } else {

            }
        }
    };

    scanhttp.ontimeout = function (e) {
        console.log("SCAN TIMED OUT");
        MessageQueue.sendAppMessage({"status": 1}, messageSuccessHandler, messageFailureHandler);
    };

    //send the request
    scanhttp.open("GET", scanURL, true);
    scanhttp.send();
}

function locationSuccess(pos) {

    mostNearbyPokemon = undefined;
    var lastClosestPoke = undefined;

    updateScannedPokemon(pos);

    //create a request with the location from the location API
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.timeout = 15000;

    var url = "https://pokevision.com/map/data/" + Number((pos.coords.latitude).toFixed(7)) + "/" + Number((pos.coords.longitude).toFixed(7));

    //var url = "https://pokevision.com/map/data/29.8872264/-97.96209610000001";
    console.log(url);

    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            //uncomment next line for coordinate debugging
            //console.log(pos.coords.latitude + "," + pos.coords.longitude)

            //uncomment to see entire response
            //console.log(xmlhttp.responseText);

            console.log(xmlhttp.responseText.constructor.name)
            //Really bad way of checking whether pokevision is down
            if (xmlhttp.responseText.indexOf("maintenance") > -1) {
                console.log("DOWN FOR maintenance");
                MessageQueue.sendAppMessage({"status": 0}, messageSuccessHandler, messageFailureHandler);
            } else {
                var object = JSON.parse(xmlhttp.responseText);
                mostNearbyPokemon = undefined;
                var lastClosestPoke = undefined;
                nearbyPokemonArray = object.pokemon;
                console.log(nearbyPokemonArray);
                var closestDistance = 10000;

                nearbyPokemonArray.forEach(function(pokemon, index) {

                    var distance = getDistanceFromLatLonInKm(pos.coords.latitude, pos.coords.longitude, pokemon.latitude, pokemon.longitude)
                    //console.log(pos.coords.latitude + ", " + pos.coords.longitude + ", " + parseFloat(pokemon.latitude) + ", " + parseFloat(pokemon.longitude) + " " + distance);
                    var timeUntilDespawn = new Date(pokemon.expiration_time * 1000);
                    var secondsLeft = daysBetween(new Date(), timeUntilDespawn);
                    console.log(pokemonList[pokemon.pokemonId - 1].name + " is " + Number((distance).toFixed(3)) + " away with " + secondsLeft + " seconds left");
                    //console.log(distance);
                    if (distance < closestDistance) {

                        closestDistance = distance;
                        lastClosestPoke = mostNearbyPokemon;
                        mostNearbyPokemon = pokemon;

                        if(lastClosestPoke != undefined && mostNearbyPokemon != undefined) {
                            //console.log((pokemonList[mostNearbyPokemon.pokemonId - 1].name) + " closer than " + (pokemonList[lastClosestPoke.pokemonId - 1].name))
                        }
                    }
                });

                //mostNearbyPokemon = nearbyPokemonArray[0];

                //make sure there is a pokemon that is nearby
                if (mostNearbyPokemon != undefined) {
                    MessageQueue.sendAppMessage({"name": pokemonList[mostNearbyPokemon.pokemonId - 1].name}, messageSuccessHandler, messageFailureHandler);
                    //calculate bearing and distance, still WIP not 100% sure how accurate these calculations are
                    var timeUntilDespawn = new Date(mostNearbyPokemon.expiration_time * 1000);
                    var distance = getDistanceFromLatLonInKm(pos.coords.latitude, pos.coords.longitude, parseFloat(mostNearbyPokemon.latitude), parseFloat(mostNearbyPokemon.longitude))
                    var bearing = getBearing(pos.coords.latitude, pos.coords.longitude, parseFloat(mostNearbyPokemon.latitude), parseFloat(mostNearbyPokemon.longitude))
                    MessageQueue.sendAppMessage({"angle": Math.floor(bearing)}, messageSuccessHandler, messageFailureHandler);
                    var d = new Date(mostNearbyPokemon.expiration_time * 1000);

                    var minutesLeft = daysBetween(new Date(), d);
                    console.log( minutesLeft + " minutes left!");

                    if (minutesLeft == 1) {
                        MessageQueue.sendAppMessage({"fleerate": minutesLeft + " second until despawn"}, messageSuccessHandler, messageFailureHandler);
                    } else {
                        MessageQueue.sendAppMessage({"fleerate": minutesLeft + " seconds until despawn"}, messageSuccessHandler, messageFailureHandler);
                    }


                    console.log("DIST: " + distance)
                    // Print out breaing and name of pokemon nearby
                    console.log("BEARING: " + bearing)
                    // console.log(pokemonList[mostNearbyPokemon.pokemonId - 1].name);

                    //send the message to update the bottom text layer
                    MessageQueue.sendAppMessage({"typeone": "" + Number((distance * 1000).toFixed(0)) + " meters away" }, messageSuccessHandler, messageFailureHandler);
                    //update the stats of the pokemon with the new pokemon we found close to us
                    pokemonName = pokemonList[mostNearbyPokemon.pokemonId - 1].name;
                    sendMessage();
                } else {
                    //if there are no nearby pokemon notify the user
                    MessageQueue.sendAppMessage({"message": "No Pokemon nearby!"}, messageSuccessHandler, messageFailureHandler);
                }
            }
        } else {
            //console.log("STATUS CODES INCORRECT")
            //MessageQueue.sendAppMessage({"status": 0}, messageSuccessHandler, messageFailureHandler);
        }
    };

    xmlhttp.ontimeout = function (e) {
        console.log("TIMEOUT")
        MessageQueue.sendAppMessage({"status": 1}, messageSuccessHandler, messageFailureHandler);
    };

    //send the request
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
}

function locationError(pos) {
    //cannot get location
    console.log("Error requesting location!!");
    MessageQueue.sendAppMessage({"status": 0}, messageSuccessHandler, messageFailureHandler);
}

// Called when incoming message from the Pebble is received
// We are currently only checking the "message" appKey defined in appinfo.json/Settings
Pebble.addEventListener("appmessage", function(e) {
    searchForNewPokemon();
    console.log("Received Message: " + e.payload.message);
});

//helper functions
function radians(n) {
    return n * (Math.PI / 180);
}
function degrees(n) {
    return n * (180 / Math.PI);
}

//I didnt do this math, straight from Stack Overflow
function getBearing(startLat,startLong,endLat,endLong){
    startLat = radians(startLat);
    startLong = radians(startLong);
    endLat = radians(endLat);
    endLong = radians(endLong);

    var dLong = endLong - startLong;

    var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
    if (Math.abs(dLong) > Math.PI){
        if (dLong > 0.0)
        dLong = -(2.0 * Math.PI - dLong);
        else
        dLong = (2.0 * Math.PI + dLong);
    }

    return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

// WIP -- Seems to always point ESE for some reason, maybe its my bearing function thats wrong im not sure
function getDirectionFromDegree(deg) {
    var directions = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
    console.log("DEG: " + deg + " = " + directions[Math.round(deg/directions.length)])
    return directions[Math.round(deg/directions.length)];
}




daysBetween = function( date1, date2 ) {
    //Get 1 day in milliseconds
    var one_day=1000;

    // Convert both dates to milliseconds
    var date1_ms = date1.getTime();
    var date2_ms = date2.getTime();

    // Calculate the difference in milliseconds
    var difference_ms = date2_ms - date1_ms;

    // Convert back to days and return
    return Math.round(difference_ms/one_day);
}
});
__loader.define('build/js/message_keys.json', 721, function(exports, module, require) {
module.exports = {
    "angle": 10,
    "attack": 9,
    "caprate": 4,
    "defense": 8,
    "fleerate": 5,
    "message": 1,
    "name": 6,
    "stamina": 7,
    "status": 0,
    "typeone": 2,
    "typetwo": 3
};
});
(function() {
  var safe = __loader.require('safe');
  safe.protect(function() {
    __loader.require('/src/js/app');
  })();
})();