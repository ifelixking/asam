// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('Module[\'ENVIRONMENT\'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    Module['printErr']('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  Module['setWindowTitle'] = function(title) { document.title = title };
}
else {
  // Unreachable because SHELL is dependent on the others
  throw new Error('unknown runtime environment');
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] = typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null);
Module['printErr'] = typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || Module['print']);

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    Module.printErr('Warning: addFunction: Provide a wasm function signature ' +
                    'string as a second argument');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html


function getSafeHeapType(bytes, isFloat) {
  switch (bytes) {
    case 1: return 'i8';
    case 2: return 'i16';
    case 4: return isFloat ? 'float' : 'i32';
    case 8: return 'double';
    default: assert(0);
  }
}


function SAFE_HEAP_STORE(dest, value, bytes, isFloat) {
  if (dest <= 0) abort('segmentation fault storing ' + bytes + ' bytes to address ' + dest);
  if (dest % bytes !== 0) abort('alignment error storing to address ' + dest + ', which was expected to be aligned to a multiple of ' + bytes);
  if (staticSealed) {
    if (dest + bytes > HEAP32[DYNAMICTOP_PTR>>2]) abort('segmentation fault, exceeded the top of the available dynamic heap when storing ' + bytes + ' bytes to address ' + dest + '. STATICTOP=' + STATICTOP + ', DYNAMICTOP=' + HEAP32[DYNAMICTOP_PTR>>2]);
    assert(DYNAMICTOP_PTR);
    assert(HEAP32[DYNAMICTOP_PTR>>2] <= TOTAL_MEMORY);
  } else {
    if (dest + bytes > STATICTOP) abort('segmentation fault, exceeded the top of the available static heap when storing ' + bytes + ' bytes to address ' + dest + '. STATICTOP=' + STATICTOP);
  }
  setValue(dest, value, getSafeHeapType(bytes, isFloat), 1);
}
function SAFE_HEAP_STORE_D(dest, value, bytes) {
  SAFE_HEAP_STORE(dest, value, bytes, true);
}

function SAFE_HEAP_LOAD(dest, bytes, unsigned, isFloat) {
  if (dest <= 0) abort('segmentation fault loading ' + bytes + ' bytes from address ' + dest);
  if (dest % bytes !== 0) abort('alignment error loading from address ' + dest + ', which was expected to be aligned to a multiple of ' + bytes);
  if (staticSealed) {
    if (dest + bytes > HEAP32[DYNAMICTOP_PTR>>2]) abort('segmentation fault, exceeded the top of the available dynamic heap when loading ' + bytes + ' bytes from address ' + dest + '. STATICTOP=' + STATICTOP + ', DYNAMICTOP=' + HEAP32[DYNAMICTOP_PTR>>2]);
    assert(DYNAMICTOP_PTR);
    assert(HEAP32[DYNAMICTOP_PTR>>2] <= TOTAL_MEMORY);
  } else {
    if (dest + bytes > STATICTOP) abort('segmentation fault, exceeded the top of the available static heap when loading ' + bytes + ' bytes from address ' + dest + '. STATICTOP=' + STATICTOP);
  }
  var type = getSafeHeapType(bytes, isFloat);
  var ret = getValue(dest, type, 1);
  if (unsigned) ret = unSign(ret, parseInt(type.substr(1)), 1);
  return ret;
}
function SAFE_HEAP_LOAD_D(dest, bytes, unsigned) {
  return SAFE_HEAP_LOAD(dest, bytes, unsigned, true);
}

function SAFE_FT_MASK(value, mask) {
  var ret = value & mask;
  if (ret !== value) {
    abort('Function table mask error: function pointer is ' + value + ' which is masked by ' + mask + ', the likely cause of this is that the function pointer is being called by the wrong type.');
  }
  return ret;
}

function segfault() {
  abort('segmentation fault');
}
function alignfault() {
  abort('alignment fault');
}
function ftfault() {
  abort('Function table mask error');
}

//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};
// For fast lookup of conversion functions
var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}

function cwrap (ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
  if (noSafe) {
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
  } else {
    switch(type) {
      case 'i1': SAFE_HEAP_STORE(((ptr)|0), ((value)|0), 1); break;
      case 'i8': SAFE_HEAP_STORE(((ptr)|0), ((value)|0), 1); break;
      case 'i16': SAFE_HEAP_STORE(((ptr)|0), ((value)|0), 2); break;
      case 'i32': SAFE_HEAP_STORE(((ptr)|0), ((value)|0), 4); break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],SAFE_HEAP_STORE(((ptr)|0), ((tempI64[0])|0), 4),SAFE_HEAP_STORE((((ptr)+(4))|0), ((tempI64[1])|0), 4)); break;
      case 'float': SAFE_HEAP_STORE_D(((ptr)|0), (+(value)), 4); break;
      case 'double': SAFE_HEAP_STORE_D(((ptr)|0), (+(value)), 8); break;
      default: abort('invalid type for setValue: ' + type);
    }
  }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
  if (noSafe) {
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  } else {
    switch(type) {
      case 'i1': return ((SAFE_HEAP_LOAD(((ptr)|0), 1, 0))|0);
      case 'i8': return ((SAFE_HEAP_LOAD(((ptr)|0), 1, 0))|0);
      case 'i16': return ((SAFE_HEAP_LOAD(((ptr)|0), 2, 0))|0);
      case 'i32': return ((SAFE_HEAP_LOAD(((ptr)|0), 4, 0))|0);
      case 'i64': return ((SAFE_HEAP_LOAD(((ptr)|0), 8, 0))|0);
      case 'float': return (+(SAFE_HEAP_LOAD_D(((ptr)|0), 4, 0)));
      case 'double': return (+(SAFE_HEAP_LOAD_D(((ptr)|0), 8, 0)));
      default: abort('invalid type for getValue: ' + type);
    }
  }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = ((SAFE_HEAP_LOAD((((ptr)+(i))|0), 1, 1))|0);
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = ((SAFE_HEAP_LOAD(((ptr++)|0), 1, 0))|0);
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = ((SAFE_HEAP_LOAD((((ptr)+(i*2))|0), 2, 0))|0);
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    SAFE_HEAP_STORE(((outPtr)|0), ((codeUnit)|0), 2);
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  SAFE_HEAP_STORE(((outPtr)|0), ((0)|0), 2);
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = ((SAFE_HEAP_LOAD((((ptr)+(i*4))|0), 4, 0))|0);
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    SAFE_HEAP_STORE(((outPtr)|0), ((codeUnit)|0), 4);
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  SAFE_HEAP_STORE(((outPtr)|0), ((0)|0), 4);
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    SAFE_HEAP_STORE(((buffer++)|0), ((str.charCodeAt(i))|0), 1);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) SAFE_HEAP_STORE(((buffer)|0), ((0)|0), 1);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 5584;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([152,2,0,0,114,13,0,0,192,2,0,0,210,13,0,0,32,0,0,0,0,0,0,0,192,2,0,0,127,13,0,0,48,0,0,0,0,0,0,0,152,2,0,0,160,13,0,0,192,2,0,0,173,13,0,0,16,0,0,0,0,0,0,0,192,2,0,0,245,14,0,0,8,0,0,0,0,0,0,0,192,2,0,0,2,15,0,0,8,0,0,0,0,0,0,0,192,2,0,0,18,15,0,0,88,0,0,0,0,0,0,0,192,2,0,0,71,15,0,0,32,0,0,0,0,0,0,0,192,2,0,0,35,15,0,0,120,0,0,0,0,0,0,0,156,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,196,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,204,17,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,136,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,16,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,0,0,0,0,56,0,0,0,6,0,0,0,14,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,15,0,0,0,16,0,0,0,17,0,0,0,0,0,0,0,72,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,0,0,0,0,88,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,0,0,0,0,104,0,0,0,21,0,0,0,24,0,0,0,23,0,0,0,97,108,108,111,99,97,116,111,114,60,84,62,58,58,97,108,108,111,99,97,116,101,40,115,105,122,101,95,116,32,110,41,32,39,110,39,32,101,120,99,101,101,100,115,32,109,97,120,105,109,117,109,32,115,117,112,112,111,114,116,101,100,32,115,105,122,101,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,118,101,99,116,111,114,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,116,101,114,109,105,110,97,116,105,110,103,0,117,110,99,97,117,103,104,116,0,83,116,57,101,120,99,101,112,116,105,111,110,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,116,104,114,101,119,32,97,110,32,101,120,99,101,112,116,105,111,110,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,83,116,57,98,97,100,95,97,108,108,111,99,0,83,116,49,49,108,111,103,105,99,95,101,114,114,111,114,0,83,116,49,50,108,101,110,103,116,104,95,101,114,114,111,114,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch(e) { // XXX FIXME
        Module.printErr('exception during cxa_free_exception: ' + e);
      }
    }function ___cxa_end_catch() {
      // Clear state flag.
      Module['setThrew'](0);
      // Call destructor if one is registered then clear it.
      var ptr = EXCEPTIONS.caught.pop();
      if (ptr) {
        EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
        EXCEPTIONS.last = 0; // XXX in decRef?
      }
    }

  function ___cxa_find_matching_catch_2() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }

  function ___cxa_find_matching_catch_3() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }


  
  
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr;
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      SAFE_HEAP_STORE(((___cxa_find_matching_catch.buffer)|0), ((thrown)|0), 4);
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = ((SAFE_HEAP_LOAD(((thrown)|0), 4, 0))|0); // undo indirection
          info.adjusted = thrown;
          return ((setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = ((SAFE_HEAP_LOAD(((thrown)|0), 4, 0))|0); // undo indirection
      return ((setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr;
    }

  function ___gxx_personality_v0() {
    }

  function ___lock() {}


  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = ((SAFE_HEAP_LOAD((((SYSCALLS.varargs)-(4))|0), 4, 0))|0);
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      SAFE_HEAP_STORE(((result)|0), ((stream.position)|0), 4);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = ((SAFE_HEAP_LOAD((((iov)+(i*8))|0), 4, 0))|0);
        var len = ((SAFE_HEAP_LOAD((((iov)+(i*8 + 4))|0), 4, 0))|0);
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
   
  
   
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC);   

  function ___unlock() {}

   

  function _abort() {
      Module['abort']();
    }

   

   



   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      SAFE_HEAP_STORE(((key)|0), ((PTHREAD_SPECIFIC_NEXT_KEY)|0), 4);
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) SAFE_HEAP_STORE(((Module['___errno_location']())|0), ((value)|0), 4);
      else Module.printErr('failed to set errno from JS');
      return value;
    } 

  function __ZN4Asam11Application10s_instanceE() {
  Module['printErr']('missing function: _ZN4Asam11Application10s_instanceE'); abort(-1);
  }

  function __ZN4Asam17WebGLRenderSystem10s_instanceE() {
  Module['printErr']('missing function: _ZN4Asam17WebGLRenderSystem10s_instanceE'); abort(-1);
  }
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



function nullFunc_i(x) { Module["printErr"]("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { Module["printErr"]("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "segfault": segfault, "alignfault": alignfault, "ftfault": ftfault, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_end_catch": ___cxa_end_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_find_matching_catch_2": ___cxa_find_matching_catch_2, "___cxa_find_matching_catch_3": ___cxa_find_matching_catch_3, "___cxa_free_exception": ___cxa_free_exception, "___cxa_throw": ___cxa_throw, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_abort": _abort, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_pthread_getspecific": _pthread_getspecific, "_pthread_key_create": _pthread_key_create, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8, "__ZN4Asam11Application10s_instanceE": __ZN4Asam11Application10s_instanceE, "__ZN4Asam17WebGLRenderSystem10s_instanceE": __ZN4Asam17WebGLRenderSystem10s_instanceE };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;
  var __ZN4Asam11Application10s_instanceE=env.__ZN4Asam11Application10s_instanceE|0;
  var __ZN4Asam17WebGLRenderSystem10s_instanceE=env.__ZN4Asam17WebGLRenderSystem10s_instanceE|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var segfault=env.segfault;
  var alignfault=env.alignfault;
  var ftfault=env.ftfault;
  var nullFunc_i=env.nullFunc_i;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_viiii=env.nullFunc_viiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_viiiiii=env.nullFunc_viiiiii;
  var invoke_i=env.invoke_i;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_v=env.invoke_v;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_viiii=env.invoke_viiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var ___cxa_end_catch=env.___cxa_end_catch;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var ___cxa_find_matching_catch_2=env.___cxa_find_matching_catch_2;
  var ___cxa_find_matching_catch_3=env.___cxa_find_matching_catch_3;
  var ___cxa_free_exception=env.___cxa_free_exception;
  var ___cxa_throw=env.___cxa_throw;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var ___lock=env.___lock;
  var ___resumeException=env.___resumeException;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var _abort=env._abort;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _pthread_getspecific=env._pthread_getspecific;
  var _pthread_key_create=env._pthread_key_create;
  var _pthread_once=env._pthread_once;
  var _pthread_setspecific=env._pthread_setspecific;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function _malloc($0) {
 $0 = $0 | 0; //@line 1110
 var $$$0192$i = 0, $$$0193$i = 0, $$$4236$i = 0, $$$4351$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0189$i = 0, $$0192$lcssa$i = 0, $$01926$i = 0, $$0193$lcssa$i = 0, $$01935$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0; //@line 1111
 var $$024367$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0289$i$i = 0, $$0295$i$i = 0, $$0296$i$i = 0, $$0342$i = 0, $$0344$i = 0, $$0345$i = 0, $$0347$i = 0, $$0353$i = 0, $$0358$i = 0, $$0359$$i = 0, $$0359$i = 0, $$0361$i = 0, $$0362$i = 0, $$0368$i = 0, $$1196$i = 0, $$1198$i = 0, $$124466$i = 0; //@line 1112
 var $$1291$i$i = 0, $$1293$i$i = 0, $$1343$i = 0, $$1348$i = 0, $$1363$i = 0, $$1370$i = 0, $$1374$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2355$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i203 = 0, $$3350$i = 0, $$3372$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$414$i = 0, $$4236$i = 0; //@line 1113
 var $$4351$lcssa$i = 0, $$435113$i = 0, $$4357$$4$i = 0, $$4357$ph$i = 0, $$435712$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i18$i = 0, $$pre$i210 = 0, $$pre$i212 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i19$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi11$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre10$i$i = 0; //@line 1114
 var $$sink1$i = 0, $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i205 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0; //@line 1115
 var $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0; //@line 1116
 var $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0; //@line 1117
 var $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $107 = 0, $108 = 0; //@line 1118
 var $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0; //@line 1119
 var $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0; //@line 1120
 var $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0; //@line 1121
 var $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0; //@line 1122
 var $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0; //@line 1123
 var $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0; //@line 1124
 var $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0; //@line 1125
 var $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0; //@line 1126
 var $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0; //@line 1127
 var $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0; //@line 1128
 var $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0; //@line 1129
 var $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0; //@line 1130
 var $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0; //@line 1131
 var $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0; //@line 1132
 var $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0; //@line 1133
 var $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0; //@line 1134
 var $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0; //@line 1135
 var $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0; //@line 1136
 var $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0; //@line 1137
 var $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0; //@line 1138
 var $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0; //@line 1139
 var $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0; //@line 1140
 var $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0; //@line 1141
 var $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0; //@line 1142
 var $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0; //@line 1143
 var $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0; //@line 1144
 var $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0; //@line 1145
 var $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0; //@line 1146
 var $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0; //@line 1147
 var $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0; //@line 1148
 var $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0; //@line 1149
 var $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0; //@line 1150
 var $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0; //@line 1151
 var $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0; //@line 1152
 var $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0; //@line 1153
 var $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0; //@line 1154
 var $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0; //@line 1155
 var $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0; //@line 1156
 var $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0; //@line 1157
 var $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0; //@line 1158
 var $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0; //@line 1159
 var $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0; //@line 1160
 var $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0; //@line 1161
 var $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0; //@line 1162
 var $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0; //@line 1163
 var $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0; //@line 1164
 var $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0; //@line 1165
 var $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0; //@line 1166
 var $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0; //@line 1167
 var $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i209 = 0, $not$$i = 0, $not$7$i = 0, $or$cond$i = 0, $or$cond$i214 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0; //@line 1168
 var $or$cond2$i = 0, $or$cond2$i215 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0; //@line 1169
 sp = STACKTOP; //@line 1170
 STACKTOP = STACKTOP + 16 | 0; //@line 1171
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 1171
 $1 = sp; //@line 1172
 $2 = $0 >>> 0 < 245; //@line 1173
 do {
  if ($2) {
   $3 = $0 >>> 0 < 11; //@line 1176
   $4 = $0 + 11 | 0; //@line 1177
   $5 = $4 & -8; //@line 1178
   $6 = $3 ? 16 : $5; //@line 1179
   $7 = $6 >>> 3; //@line 1180
   $8 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 1181
   $9 = $8 >>> $7; //@line 1182
   $10 = $9 & 3; //@line 1183
   $11 = ($10 | 0) == 0; //@line 1184
   if (!$11) {
    $12 = $9 & 1; //@line 1186
    $13 = $12 ^ 1; //@line 1187
    $14 = $13 + $7 | 0; //@line 1188
    $15 = $14 << 1; //@line 1189
    $16 = 3992 + ($15 << 2) | 0; //@line 1190
    $17 = $16 + 8 | 0; //@line 1191
    $18 = SAFE_HEAP_LOAD($17 | 0, 4, 0) | 0 | 0; //@line 1192
    $19 = $18 + 8 | 0; //@line 1193
    $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 1194
    $21 = ($20 | 0) == ($16 | 0); //@line 1195
    do {
     if ($21) {
      $22 = 1 << $14; //@line 1198
      $23 = $22 ^ -1; //@line 1199
      $24 = $8 & $23; //@line 1200
      SAFE_HEAP_STORE(988 * 4 | 0, $24 | 0, 4);
     } else {
      $25 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1203
      $26 = $25 >>> 0 > $20 >>> 0; //@line 1204
      if ($26) {
       _abort(); //@line 1206
      }
      $27 = $20 + 12 | 0; //@line 1209
      $28 = SAFE_HEAP_LOAD($27 | 0, 4, 0) | 0 | 0; //@line 1210
      $29 = ($28 | 0) == ($18 | 0); //@line 1211
      if ($29) {
       SAFE_HEAP_STORE($27 | 0, $16 | 0, 4);
       SAFE_HEAP_STORE($17 | 0, $20 | 0, 4);
       break;
      } else {
       _abort(); //@line 1217
      }
     }
    } while (0);
    $30 = $14 << 3; //@line 1222
    $31 = $30 | 3; //@line 1223
    $32 = $18 + 4 | 0; //@line 1224
    SAFE_HEAP_STORE($32 | 0, $31 | 0, 4);
    $33 = $18 + $30 | 0; //@line 1226
    $34 = $33 + 4 | 0; //@line 1227
    $35 = SAFE_HEAP_LOAD($34 | 0, 4, 0) | 0 | 0; //@line 1228
    $36 = $35 | 1; //@line 1229
    SAFE_HEAP_STORE($34 | 0, $36 | 0, 4);
    $$0 = $19; //@line 1231
    STACKTOP = sp; //@line 1232
    return $$0 | 0; //@line 1232
   }
   $37 = SAFE_HEAP_LOAD(3960 | 0, 4, 0) | 0 | 0; //@line 1234
   $38 = $6 >>> 0 > $37 >>> 0; //@line 1235
   if ($38) {
    $39 = ($9 | 0) == 0; //@line 1237
    if (!$39) {
     $40 = $9 << $7; //@line 1239
     $41 = 2 << $7; //@line 1240
     $42 = 0 - $41 | 0; //@line 1241
     $43 = $41 | $42; //@line 1242
     $44 = $40 & $43; //@line 1243
     $45 = 0 - $44 | 0; //@line 1244
     $46 = $44 & $45; //@line 1245
     $47 = $46 + -1 | 0; //@line 1246
     $48 = $47 >>> 12; //@line 1247
     $49 = $48 & 16; //@line 1248
     $50 = $47 >>> $49; //@line 1249
     $51 = $50 >>> 5; //@line 1250
     $52 = $51 & 8; //@line 1251
     $53 = $52 | $49; //@line 1252
     $54 = $50 >>> $52; //@line 1253
     $55 = $54 >>> 2; //@line 1254
     $56 = $55 & 4; //@line 1255
     $57 = $53 | $56; //@line 1256
     $58 = $54 >>> $56; //@line 1257
     $59 = $58 >>> 1; //@line 1258
     $60 = $59 & 2; //@line 1259
     $61 = $57 | $60; //@line 1260
     $62 = $58 >>> $60; //@line 1261
     $63 = $62 >>> 1; //@line 1262
     $64 = $63 & 1; //@line 1263
     $65 = $61 | $64; //@line 1264
     $66 = $62 >>> $64; //@line 1265
     $67 = $65 + $66 | 0; //@line 1266
     $68 = $67 << 1; //@line 1267
     $69 = 3992 + ($68 << 2) | 0; //@line 1268
     $70 = $69 + 8 | 0; //@line 1269
     $71 = SAFE_HEAP_LOAD($70 | 0, 4, 0) | 0 | 0; //@line 1270
     $72 = $71 + 8 | 0; //@line 1271
     $73 = SAFE_HEAP_LOAD($72 | 0, 4, 0) | 0 | 0; //@line 1272
     $74 = ($73 | 0) == ($69 | 0); //@line 1273
     do {
      if ($74) {
       $75 = 1 << $67; //@line 1276
       $76 = $75 ^ -1; //@line 1277
       $77 = $8 & $76; //@line 1278
       SAFE_HEAP_STORE(988 * 4 | 0, $77 | 0, 4);
       $98 = $77; //@line 1280
      } else {
       $78 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1282
       $79 = $78 >>> 0 > $73 >>> 0; //@line 1283
       if ($79) {
        _abort(); //@line 1285
       }
       $80 = $73 + 12 | 0; //@line 1288
       $81 = SAFE_HEAP_LOAD($80 | 0, 4, 0) | 0 | 0; //@line 1289
       $82 = ($81 | 0) == ($71 | 0); //@line 1290
       if ($82) {
        SAFE_HEAP_STORE($80 | 0, $69 | 0, 4);
        SAFE_HEAP_STORE($70 | 0, $73 | 0, 4);
        $98 = $8; //@line 1294
        break;
       } else {
        _abort(); //@line 1297
       }
      }
     } while (0);
     $83 = $67 << 3; //@line 1302
     $84 = $83 - $6 | 0; //@line 1303
     $85 = $6 | 3; //@line 1304
     $86 = $71 + 4 | 0; //@line 1305
     SAFE_HEAP_STORE($86 | 0, $85 | 0, 4);
     $87 = $71 + $6 | 0; //@line 1307
     $88 = $84 | 1; //@line 1308
     $89 = $87 + 4 | 0; //@line 1309
     SAFE_HEAP_STORE($89 | 0, $88 | 0, 4);
     $90 = $71 + $83 | 0; //@line 1311
     SAFE_HEAP_STORE($90 | 0, $84 | 0, 4);
     $91 = ($37 | 0) == 0; //@line 1313
     if (!$91) {
      $92 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 1315
      $93 = $37 >>> 3; //@line 1316
      $94 = $93 << 1; //@line 1317
      $95 = 3992 + ($94 << 2) | 0; //@line 1318
      $96 = 1 << $93; //@line 1319
      $97 = $98 & $96; //@line 1320
      $99 = ($97 | 0) == 0; //@line 1321
      if ($99) {
       $100 = $98 | $96; //@line 1323
       SAFE_HEAP_STORE(988 * 4 | 0, $100 | 0, 4);
       $$pre = $95 + 8 | 0; //@line 1325
       $$0199 = $95; //@line 1326
       $$pre$phiZ2D = $$pre; //@line 1326
      } else {
       $101 = $95 + 8 | 0; //@line 1328
       $102 = SAFE_HEAP_LOAD($101 | 0, 4, 0) | 0 | 0; //@line 1329
       $103 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1330
       $104 = $103 >>> 0 > $102 >>> 0; //@line 1331
       if ($104) {
        _abort(); //@line 1333
       } else {
        $$0199 = $102; //@line 1336
        $$pre$phiZ2D = $101; //@line 1336
       }
      }
      SAFE_HEAP_STORE($$pre$phiZ2D | 0, $92 | 0, 4);
      $105 = $$0199 + 12 | 0; //@line 1340
      SAFE_HEAP_STORE($105 | 0, $92 | 0, 4);
      $106 = $92 + 8 | 0; //@line 1342
      SAFE_HEAP_STORE($106 | 0, $$0199 | 0, 4);
      $107 = $92 + 12 | 0; //@line 1344
      SAFE_HEAP_STORE($107 | 0, $95 | 0, 4);
     }
     SAFE_HEAP_STORE(3960 | 0, $84 | 0, 4);
     SAFE_HEAP_STORE(3972 | 0, $87 | 0, 4);
     $$0 = $72; //@line 1349
     STACKTOP = sp; //@line 1350
     return $$0 | 0; //@line 1350
    }
    $108 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 1352
    $109 = ($108 | 0) == 0; //@line 1353
    if ($109) {
     $$0197 = $6; //@line 1355
    } else {
     $110 = 0 - $108 | 0; //@line 1357
     $111 = $108 & $110; //@line 1358
     $112 = $111 + -1 | 0; //@line 1359
     $113 = $112 >>> 12; //@line 1360
     $114 = $113 & 16; //@line 1361
     $115 = $112 >>> $114; //@line 1362
     $116 = $115 >>> 5; //@line 1363
     $117 = $116 & 8; //@line 1364
     $118 = $117 | $114; //@line 1365
     $119 = $115 >>> $117; //@line 1366
     $120 = $119 >>> 2; //@line 1367
     $121 = $120 & 4; //@line 1368
     $122 = $118 | $121; //@line 1369
     $123 = $119 >>> $121; //@line 1370
     $124 = $123 >>> 1; //@line 1371
     $125 = $124 & 2; //@line 1372
     $126 = $122 | $125; //@line 1373
     $127 = $123 >>> $125; //@line 1374
     $128 = $127 >>> 1; //@line 1375
     $129 = $128 & 1; //@line 1376
     $130 = $126 | $129; //@line 1377
     $131 = $127 >>> $129; //@line 1378
     $132 = $130 + $131 | 0; //@line 1379
     $133 = 4256 + ($132 << 2) | 0; //@line 1380
     $134 = SAFE_HEAP_LOAD($133 | 0, 4, 0) | 0 | 0; //@line 1381
     $135 = $134 + 4 | 0; //@line 1382
     $136 = SAFE_HEAP_LOAD($135 | 0, 4, 0) | 0 | 0; //@line 1383
     $137 = $136 & -8; //@line 1384
     $138 = $137 - $6 | 0; //@line 1385
     $139 = $134 + 16 | 0; //@line 1386
     $140 = SAFE_HEAP_LOAD($139 | 0, 4, 0) | 0 | 0; //@line 1387
     $141 = ($140 | 0) == (0 | 0); //@line 1388
     $$sink14$i = $141 & 1; //@line 1389
     $142 = ($134 + 16 | 0) + ($$sink14$i << 2) | 0; //@line 1390
     $143 = SAFE_HEAP_LOAD($142 | 0, 4, 0) | 0 | 0; //@line 1391
     $144 = ($143 | 0) == (0 | 0); //@line 1392
     if ($144) {
      $$0192$lcssa$i = $134; //@line 1394
      $$0193$lcssa$i = $138; //@line 1394
     } else {
      $$01926$i = $134; //@line 1396
      $$01935$i = $138; //@line 1396
      $146 = $143; //@line 1396
      while (1) {
       $145 = $146 + 4 | 0; //@line 1398
       $147 = SAFE_HEAP_LOAD($145 | 0, 4, 0) | 0 | 0; //@line 1399
       $148 = $147 & -8; //@line 1400
       $149 = $148 - $6 | 0; //@line 1401
       $150 = $149 >>> 0 < $$01935$i >>> 0; //@line 1402
       $$$0193$i = $150 ? $149 : $$01935$i; //@line 1403
       $$$0192$i = $150 ? $146 : $$01926$i; //@line 1404
       $151 = $146 + 16 | 0; //@line 1405
       $152 = SAFE_HEAP_LOAD($151 | 0, 4, 0) | 0 | 0; //@line 1406
       $153 = ($152 | 0) == (0 | 0); //@line 1407
       $$sink1$i = $153 & 1; //@line 1408
       $154 = ($146 + 16 | 0) + ($$sink1$i << 2) | 0; //@line 1409
       $155 = SAFE_HEAP_LOAD($154 | 0, 4, 0) | 0 | 0; //@line 1410
       $156 = ($155 | 0) == (0 | 0); //@line 1411
       if ($156) {
        $$0192$lcssa$i = $$$0192$i; //@line 1413
        $$0193$lcssa$i = $$$0193$i; //@line 1413
        break;
       } else {
        $$01926$i = $$$0192$i; //@line 1416
        $$01935$i = $$$0193$i; //@line 1416
        $146 = $155; //@line 1416
       }
      }
     }
     $157 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1420
     $158 = $157 >>> 0 > $$0192$lcssa$i >>> 0; //@line 1421
     if ($158) {
      _abort(); //@line 1423
     }
     $159 = $$0192$lcssa$i + $6 | 0; //@line 1426
     $160 = $159 >>> 0 > $$0192$lcssa$i >>> 0; //@line 1427
     if (!$160) {
      _abort(); //@line 1429
     }
     $161 = $$0192$lcssa$i + 24 | 0; //@line 1432
     $162 = SAFE_HEAP_LOAD($161 | 0, 4, 0) | 0 | 0; //@line 1433
     $163 = $$0192$lcssa$i + 12 | 0; //@line 1434
     $164 = SAFE_HEAP_LOAD($163 | 0, 4, 0) | 0 | 0; //@line 1435
     $165 = ($164 | 0) == ($$0192$lcssa$i | 0); //@line 1436
     do {
      if ($165) {
       $175 = $$0192$lcssa$i + 20 | 0; //@line 1439
       $176 = SAFE_HEAP_LOAD($175 | 0, 4, 0) | 0 | 0; //@line 1440
       $177 = ($176 | 0) == (0 | 0); //@line 1441
       if ($177) {
        $178 = $$0192$lcssa$i + 16 | 0; //@line 1443
        $179 = SAFE_HEAP_LOAD($178 | 0, 4, 0) | 0 | 0; //@line 1444
        $180 = ($179 | 0) == (0 | 0); //@line 1445
        if ($180) {
         $$3$i = 0; //@line 1447
         break;
        } else {
         $$1196$i = $179; //@line 1450
         $$1198$i = $178; //@line 1450
        }
       } else {
        $$1196$i = $176; //@line 1453
        $$1198$i = $175; //@line 1453
       }
       while (1) {
        $181 = $$1196$i + 20 | 0; //@line 1456
        $182 = SAFE_HEAP_LOAD($181 | 0, 4, 0) | 0 | 0; //@line 1457
        $183 = ($182 | 0) == (0 | 0); //@line 1458
        if (!$183) {
         $$1196$i = $182; //@line 1460
         $$1198$i = $181; //@line 1460
         continue;
        }
        $184 = $$1196$i + 16 | 0; //@line 1463
        $185 = SAFE_HEAP_LOAD($184 | 0, 4, 0) | 0 | 0; //@line 1464
        $186 = ($185 | 0) == (0 | 0); //@line 1465
        if ($186) {
         break;
        } else {
         $$1196$i = $185; //@line 1469
         $$1198$i = $184; //@line 1469
        }
       }
       $187 = $157 >>> 0 > $$1198$i >>> 0; //@line 1472
       if ($187) {
        _abort(); //@line 1474
       } else {
        SAFE_HEAP_STORE($$1198$i | 0, 0 | 0, 4);
        $$3$i = $$1196$i; //@line 1478
        break;
       }
      } else {
       $166 = $$0192$lcssa$i + 8 | 0; //@line 1482
       $167 = SAFE_HEAP_LOAD($166 | 0, 4, 0) | 0 | 0; //@line 1483
       $168 = $157 >>> 0 > $167 >>> 0; //@line 1484
       if ($168) {
        _abort(); //@line 1486
       }
       $169 = $167 + 12 | 0; //@line 1489
       $170 = SAFE_HEAP_LOAD($169 | 0, 4, 0) | 0 | 0; //@line 1490
       $171 = ($170 | 0) == ($$0192$lcssa$i | 0); //@line 1491
       if (!$171) {
        _abort(); //@line 1493
       }
       $172 = $164 + 8 | 0; //@line 1496
       $173 = SAFE_HEAP_LOAD($172 | 0, 4, 0) | 0 | 0; //@line 1497
       $174 = ($173 | 0) == ($$0192$lcssa$i | 0); //@line 1498
       if ($174) {
        SAFE_HEAP_STORE($169 | 0, $164 | 0, 4);
        SAFE_HEAP_STORE($172 | 0, $167 | 0, 4);
        $$3$i = $164; //@line 1502
        break;
       } else {
        _abort(); //@line 1505
       }
      }
     } while (0);
     $188 = ($162 | 0) == (0 | 0); //@line 1510
     L73 : do {
      if (!$188) {
       $189 = $$0192$lcssa$i + 28 | 0; //@line 1513
       $190 = SAFE_HEAP_LOAD($189 | 0, 4, 0) | 0 | 0; //@line 1514
       $191 = 4256 + ($190 << 2) | 0; //@line 1515
       $192 = SAFE_HEAP_LOAD($191 | 0, 4, 0) | 0 | 0; //@line 1516
       $193 = ($$0192$lcssa$i | 0) == ($192 | 0); //@line 1517
       do {
        if ($193) {
         SAFE_HEAP_STORE($191 | 0, $$3$i | 0, 4);
         $cond$i = ($$3$i | 0) == (0 | 0); //@line 1521
         if ($cond$i) {
          $194 = 1 << $190; //@line 1523
          $195 = $194 ^ -1; //@line 1524
          $196 = $108 & $195; //@line 1525
          SAFE_HEAP_STORE(3956 | 0, $196 | 0, 4);
          break L73;
         }
        } else {
         $197 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1530
         $198 = $197 >>> 0 > $162 >>> 0; //@line 1531
         if ($198) {
          _abort(); //@line 1533
         } else {
          $199 = $162 + 16 | 0; //@line 1536
          $200 = SAFE_HEAP_LOAD($199 | 0, 4, 0) | 0 | 0; //@line 1537
          $201 = ($200 | 0) != ($$0192$lcssa$i | 0); //@line 1538
          $$sink2$i = $201 & 1; //@line 1539
          $202 = ($162 + 16 | 0) + ($$sink2$i << 2) | 0; //@line 1540
          SAFE_HEAP_STORE($202 | 0, $$3$i | 0, 4);
          $203 = ($$3$i | 0) == (0 | 0); //@line 1542
          if ($203) {
           break L73;
          } else {
           break;
          }
         }
        }
       } while (0);
       $204 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1551
       $205 = $204 >>> 0 > $$3$i >>> 0; //@line 1552
       if ($205) {
        _abort(); //@line 1554
       }
       $206 = $$3$i + 24 | 0; //@line 1557
       SAFE_HEAP_STORE($206 | 0, $162 | 0, 4);
       $207 = $$0192$lcssa$i + 16 | 0; //@line 1559
       $208 = SAFE_HEAP_LOAD($207 | 0, 4, 0) | 0 | 0; //@line 1560
       $209 = ($208 | 0) == (0 | 0); //@line 1561
       do {
        if (!$209) {
         $210 = $204 >>> 0 > $208 >>> 0; //@line 1564
         if ($210) {
          _abort(); //@line 1566
         } else {
          $211 = $$3$i + 16 | 0; //@line 1569
          SAFE_HEAP_STORE($211 | 0, $208 | 0, 4);
          $212 = $208 + 24 | 0; //@line 1571
          SAFE_HEAP_STORE($212 | 0, $$3$i | 0, 4);
          break;
         }
        }
       } while (0);
       $213 = $$0192$lcssa$i + 20 | 0; //@line 1577
       $214 = SAFE_HEAP_LOAD($213 | 0, 4, 0) | 0 | 0; //@line 1578
       $215 = ($214 | 0) == (0 | 0); //@line 1579
       if (!$215) {
        $216 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1581
        $217 = $216 >>> 0 > $214 >>> 0; //@line 1582
        if ($217) {
         _abort(); //@line 1584
        } else {
         $218 = $$3$i + 20 | 0; //@line 1587
         SAFE_HEAP_STORE($218 | 0, $214 | 0, 4);
         $219 = $214 + 24 | 0; //@line 1589
         SAFE_HEAP_STORE($219 | 0, $$3$i | 0, 4);
         break;
        }
       }
      }
     } while (0);
     $220 = $$0193$lcssa$i >>> 0 < 16; //@line 1596
     if ($220) {
      $221 = $$0193$lcssa$i + $6 | 0; //@line 1598
      $222 = $221 | 3; //@line 1599
      $223 = $$0192$lcssa$i + 4 | 0; //@line 1600
      SAFE_HEAP_STORE($223 | 0, $222 | 0, 4);
      $224 = $$0192$lcssa$i + $221 | 0; //@line 1602
      $225 = $224 + 4 | 0; //@line 1603
      $226 = SAFE_HEAP_LOAD($225 | 0, 4, 0) | 0 | 0; //@line 1604
      $227 = $226 | 1; //@line 1605
      SAFE_HEAP_STORE($225 | 0, $227 | 0, 4);
     } else {
      $228 = $6 | 3; //@line 1608
      $229 = $$0192$lcssa$i + 4 | 0; //@line 1609
      SAFE_HEAP_STORE($229 | 0, $228 | 0, 4);
      $230 = $$0193$lcssa$i | 1; //@line 1611
      $231 = $159 + 4 | 0; //@line 1612
      SAFE_HEAP_STORE($231 | 0, $230 | 0, 4);
      $232 = $159 + $$0193$lcssa$i | 0; //@line 1614
      SAFE_HEAP_STORE($232 | 0, $$0193$lcssa$i | 0, 4);
      $233 = ($37 | 0) == 0; //@line 1616
      if (!$233) {
       $234 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 1618
       $235 = $37 >>> 3; //@line 1619
       $236 = $235 << 1; //@line 1620
       $237 = 3992 + ($236 << 2) | 0; //@line 1621
       $238 = 1 << $235; //@line 1622
       $239 = $8 & $238; //@line 1623
       $240 = ($239 | 0) == 0; //@line 1624
       if ($240) {
        $241 = $8 | $238; //@line 1626
        SAFE_HEAP_STORE(988 * 4 | 0, $241 | 0, 4);
        $$pre$i = $237 + 8 | 0; //@line 1628
        $$0189$i = $237; //@line 1629
        $$pre$phi$iZ2D = $$pre$i; //@line 1629
       } else {
        $242 = $237 + 8 | 0; //@line 1631
        $243 = SAFE_HEAP_LOAD($242 | 0, 4, 0) | 0 | 0; //@line 1632
        $244 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1633
        $245 = $244 >>> 0 > $243 >>> 0; //@line 1634
        if ($245) {
         _abort(); //@line 1636
        } else {
         $$0189$i = $243; //@line 1639
         $$pre$phi$iZ2D = $242; //@line 1639
        }
       }
       SAFE_HEAP_STORE($$pre$phi$iZ2D | 0, $234 | 0, 4);
       $246 = $$0189$i + 12 | 0; //@line 1643
       SAFE_HEAP_STORE($246 | 0, $234 | 0, 4);
       $247 = $234 + 8 | 0; //@line 1645
       SAFE_HEAP_STORE($247 | 0, $$0189$i | 0, 4);
       $248 = $234 + 12 | 0; //@line 1647
       SAFE_HEAP_STORE($248 | 0, $237 | 0, 4);
      }
      SAFE_HEAP_STORE(3960 | 0, $$0193$lcssa$i | 0, 4);
      SAFE_HEAP_STORE(3972 | 0, $159 | 0, 4);
     }
     $249 = $$0192$lcssa$i + 8 | 0; //@line 1653
     $$0 = $249; //@line 1654
     STACKTOP = sp; //@line 1655
     return $$0 | 0; //@line 1655
    }
   } else {
    $$0197 = $6; //@line 1658
   }
  } else {
   $250 = $0 >>> 0 > 4294967231; //@line 1661
   if ($250) {
    $$0197 = -1; //@line 1663
   } else {
    $251 = $0 + 11 | 0; //@line 1665
    $252 = $251 & -8; //@line 1666
    $253 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 1667
    $254 = ($253 | 0) == 0; //@line 1668
    if ($254) {
     $$0197 = $252; //@line 1670
    } else {
     $255 = 0 - $252 | 0; //@line 1672
     $256 = $251 >>> 8; //@line 1673
     $257 = ($256 | 0) == 0; //@line 1674
     if ($257) {
      $$0358$i = 0; //@line 1676
     } else {
      $258 = $252 >>> 0 > 16777215; //@line 1678
      if ($258) {
       $$0358$i = 31; //@line 1680
      } else {
       $259 = $256 + 1048320 | 0; //@line 1682
       $260 = $259 >>> 16; //@line 1683
       $261 = $260 & 8; //@line 1684
       $262 = $256 << $261; //@line 1685
       $263 = $262 + 520192 | 0; //@line 1686
       $264 = $263 >>> 16; //@line 1687
       $265 = $264 & 4; //@line 1688
       $266 = $265 | $261; //@line 1689
       $267 = $262 << $265; //@line 1690
       $268 = $267 + 245760 | 0; //@line 1691
       $269 = $268 >>> 16; //@line 1692
       $270 = $269 & 2; //@line 1693
       $271 = $266 | $270; //@line 1694
       $272 = 14 - $271 | 0; //@line 1695
       $273 = $267 << $270; //@line 1696
       $274 = $273 >>> 15; //@line 1697
       $275 = $272 + $274 | 0; //@line 1698
       $276 = $275 << 1; //@line 1699
       $277 = $275 + 7 | 0; //@line 1700
       $278 = $252 >>> $277; //@line 1701
       $279 = $278 & 1; //@line 1702
       $280 = $279 | $276; //@line 1703
       $$0358$i = $280; //@line 1704
      }
     }
     $281 = 4256 + ($$0358$i << 2) | 0; //@line 1707
     $282 = SAFE_HEAP_LOAD($281 | 0, 4, 0) | 0 | 0; //@line 1708
     $283 = ($282 | 0) == (0 | 0); //@line 1709
     L117 : do {
      if ($283) {
       $$2355$i = 0; //@line 1712
       $$3$i203 = 0; //@line 1712
       $$3350$i = $255; //@line 1712
       label = 81; //@line 1713
      } else {
       $284 = ($$0358$i | 0) == 31; //@line 1715
       $285 = $$0358$i >>> 1; //@line 1716
       $286 = 25 - $285 | 0; //@line 1717
       $287 = $284 ? 0 : $286; //@line 1718
       $288 = $252 << $287; //@line 1719
       $$0342$i = 0; //@line 1720
       $$0347$i = $255; //@line 1720
       $$0353$i = $282; //@line 1720
       $$0359$i = $288; //@line 1720
       $$0362$i = 0; //@line 1720
       while (1) {
        $289 = $$0353$i + 4 | 0; //@line 1722
        $290 = SAFE_HEAP_LOAD($289 | 0, 4, 0) | 0 | 0; //@line 1723
        $291 = $290 & -8; //@line 1724
        $292 = $291 - $252 | 0; //@line 1725
        $293 = $292 >>> 0 < $$0347$i >>> 0; //@line 1726
        if ($293) {
         $294 = ($292 | 0) == 0; //@line 1728
         if ($294) {
          $$414$i = $$0353$i; //@line 1730
          $$435113$i = 0; //@line 1730
          $$435712$i = $$0353$i; //@line 1730
          label = 85; //@line 1731
          break L117;
         } else {
          $$1343$i = $$0353$i; //@line 1734
          $$1348$i = $292; //@line 1734
         }
        } else {
         $$1343$i = $$0342$i; //@line 1737
         $$1348$i = $$0347$i; //@line 1737
        }
        $295 = $$0353$i + 20 | 0; //@line 1739
        $296 = SAFE_HEAP_LOAD($295 | 0, 4, 0) | 0 | 0; //@line 1740
        $297 = $$0359$i >>> 31; //@line 1741
        $298 = ($$0353$i + 16 | 0) + ($297 << 2) | 0; //@line 1742
        $299 = SAFE_HEAP_LOAD($298 | 0, 4, 0) | 0 | 0; //@line 1743
        $300 = ($296 | 0) == (0 | 0); //@line 1744
        $301 = ($296 | 0) == ($299 | 0); //@line 1745
        $or$cond2$i = $300 | $301; //@line 1746
        $$1363$i = $or$cond2$i ? $$0362$i : $296; //@line 1747
        $302 = ($299 | 0) == (0 | 0); //@line 1748
        $not$7$i = $302 ^ 1; //@line 1749
        $303 = $not$7$i & 1; //@line 1750
        $$0359$$i = $$0359$i << $303; //@line 1751
        if ($302) {
         $$2355$i = $$1363$i; //@line 1753
         $$3$i203 = $$1343$i; //@line 1753
         $$3350$i = $$1348$i; //@line 1753
         label = 81; //@line 1754
         break;
        } else {
         $$0342$i = $$1343$i; //@line 1757
         $$0347$i = $$1348$i; //@line 1757
         $$0353$i = $299; //@line 1757
         $$0359$i = $$0359$$i; //@line 1757
         $$0362$i = $$1363$i; //@line 1757
        }
       }
      }
     } while (0);
     if ((label | 0) == 81) {
      $304 = ($$2355$i | 0) == (0 | 0); //@line 1763
      $305 = ($$3$i203 | 0) == (0 | 0); //@line 1764
      $or$cond$i = $304 & $305; //@line 1765
      if ($or$cond$i) {
       $306 = 2 << $$0358$i; //@line 1767
       $307 = 0 - $306 | 0; //@line 1768
       $308 = $306 | $307; //@line 1769
       $309 = $253 & $308; //@line 1770
       $310 = ($309 | 0) == 0; //@line 1771
       if ($310) {
        $$0197 = $252; //@line 1773
        break;
       }
       $311 = 0 - $309 | 0; //@line 1776
       $312 = $309 & $311; //@line 1777
       $313 = $312 + -1 | 0; //@line 1778
       $314 = $313 >>> 12; //@line 1779
       $315 = $314 & 16; //@line 1780
       $316 = $313 >>> $315; //@line 1781
       $317 = $316 >>> 5; //@line 1782
       $318 = $317 & 8; //@line 1783
       $319 = $318 | $315; //@line 1784
       $320 = $316 >>> $318; //@line 1785
       $321 = $320 >>> 2; //@line 1786
       $322 = $321 & 4; //@line 1787
       $323 = $319 | $322; //@line 1788
       $324 = $320 >>> $322; //@line 1789
       $325 = $324 >>> 1; //@line 1790
       $326 = $325 & 2; //@line 1791
       $327 = $323 | $326; //@line 1792
       $328 = $324 >>> $326; //@line 1793
       $329 = $328 >>> 1; //@line 1794
       $330 = $329 & 1; //@line 1795
       $331 = $327 | $330; //@line 1796
       $332 = $328 >>> $330; //@line 1797
       $333 = $331 + $332 | 0; //@line 1798
       $334 = 4256 + ($333 << 2) | 0; //@line 1799
       $335 = SAFE_HEAP_LOAD($334 | 0, 4, 0) | 0 | 0; //@line 1800
       $$4$ph$i = 0; //@line 1801
       $$4357$ph$i = $335; //@line 1801
      } else {
       $$4$ph$i = $$3$i203; //@line 1803
       $$4357$ph$i = $$2355$i; //@line 1803
      }
      $336 = ($$4357$ph$i | 0) == (0 | 0); //@line 1805
      if ($336) {
       $$4$lcssa$i = $$4$ph$i; //@line 1807
       $$4351$lcssa$i = $$3350$i; //@line 1807
      } else {
       $$414$i = $$4$ph$i; //@line 1809
       $$435113$i = $$3350$i; //@line 1809
       $$435712$i = $$4357$ph$i; //@line 1809
       label = 85; //@line 1810
      }
     }
     if ((label | 0) == 85) {
      while (1) {
       label = 0; //@line 1815
       $337 = $$435712$i + 4 | 0; //@line 1816
       $338 = SAFE_HEAP_LOAD($337 | 0, 4, 0) | 0 | 0; //@line 1817
       $339 = $338 & -8; //@line 1818
       $340 = $339 - $252 | 0; //@line 1819
       $341 = $340 >>> 0 < $$435113$i >>> 0; //@line 1820
       $$$4351$i = $341 ? $340 : $$435113$i; //@line 1821
       $$4357$$4$i = $341 ? $$435712$i : $$414$i; //@line 1822
       $342 = $$435712$i + 16 | 0; //@line 1823
       $343 = SAFE_HEAP_LOAD($342 | 0, 4, 0) | 0 | 0; //@line 1824
       $344 = ($343 | 0) == (0 | 0); //@line 1825
       $$sink2$i205 = $344 & 1; //@line 1826
       $345 = ($$435712$i + 16 | 0) + ($$sink2$i205 << 2) | 0; //@line 1827
       $346 = SAFE_HEAP_LOAD($345 | 0, 4, 0) | 0 | 0; //@line 1828
       $347 = ($346 | 0) == (0 | 0); //@line 1829
       if ($347) {
        $$4$lcssa$i = $$4357$$4$i; //@line 1831
        $$4351$lcssa$i = $$$4351$i; //@line 1831
        break;
       } else {
        $$414$i = $$4357$$4$i; //@line 1834
        $$435113$i = $$$4351$i; //@line 1834
        $$435712$i = $346; //@line 1834
        label = 85; //@line 1835
       }
      }
     }
     $348 = ($$4$lcssa$i | 0) == (0 | 0); //@line 1839
     if ($348) {
      $$0197 = $252; //@line 1841
     } else {
      $349 = SAFE_HEAP_LOAD(3960 | 0, 4, 0) | 0 | 0; //@line 1843
      $350 = $349 - $252 | 0; //@line 1844
      $351 = $$4351$lcssa$i >>> 0 < $350 >>> 0; //@line 1845
      if ($351) {
       $352 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1847
       $353 = $352 >>> 0 > $$4$lcssa$i >>> 0; //@line 1848
       if ($353) {
        _abort(); //@line 1850
       }
       $354 = $$4$lcssa$i + $252 | 0; //@line 1853
       $355 = $354 >>> 0 > $$4$lcssa$i >>> 0; //@line 1854
       if (!$355) {
        _abort(); //@line 1856
       }
       $356 = $$4$lcssa$i + 24 | 0; //@line 1859
       $357 = SAFE_HEAP_LOAD($356 | 0, 4, 0) | 0 | 0; //@line 1860
       $358 = $$4$lcssa$i + 12 | 0; //@line 1861
       $359 = SAFE_HEAP_LOAD($358 | 0, 4, 0) | 0 | 0; //@line 1862
       $360 = ($359 | 0) == ($$4$lcssa$i | 0); //@line 1863
       do {
        if ($360) {
         $370 = $$4$lcssa$i + 20 | 0; //@line 1866
         $371 = SAFE_HEAP_LOAD($370 | 0, 4, 0) | 0 | 0; //@line 1867
         $372 = ($371 | 0) == (0 | 0); //@line 1868
         if ($372) {
          $373 = $$4$lcssa$i + 16 | 0; //@line 1870
          $374 = SAFE_HEAP_LOAD($373 | 0, 4, 0) | 0 | 0; //@line 1871
          $375 = ($374 | 0) == (0 | 0); //@line 1872
          if ($375) {
           $$3372$i = 0; //@line 1874
           break;
          } else {
           $$1370$i = $374; //@line 1877
           $$1374$i = $373; //@line 1877
          }
         } else {
          $$1370$i = $371; //@line 1880
          $$1374$i = $370; //@line 1880
         }
         while (1) {
          $376 = $$1370$i + 20 | 0; //@line 1883
          $377 = SAFE_HEAP_LOAD($376 | 0, 4, 0) | 0 | 0; //@line 1884
          $378 = ($377 | 0) == (0 | 0); //@line 1885
          if (!$378) {
           $$1370$i = $377; //@line 1887
           $$1374$i = $376; //@line 1887
           continue;
          }
          $379 = $$1370$i + 16 | 0; //@line 1890
          $380 = SAFE_HEAP_LOAD($379 | 0, 4, 0) | 0 | 0; //@line 1891
          $381 = ($380 | 0) == (0 | 0); //@line 1892
          if ($381) {
           break;
          } else {
           $$1370$i = $380; //@line 1896
           $$1374$i = $379; //@line 1896
          }
         }
         $382 = $352 >>> 0 > $$1374$i >>> 0; //@line 1899
         if ($382) {
          _abort(); //@line 1901
         } else {
          SAFE_HEAP_STORE($$1374$i | 0, 0 | 0, 4);
          $$3372$i = $$1370$i; //@line 1905
          break;
         }
        } else {
         $361 = $$4$lcssa$i + 8 | 0; //@line 1909
         $362 = SAFE_HEAP_LOAD($361 | 0, 4, 0) | 0 | 0; //@line 1910
         $363 = $352 >>> 0 > $362 >>> 0; //@line 1911
         if ($363) {
          _abort(); //@line 1913
         }
         $364 = $362 + 12 | 0; //@line 1916
         $365 = SAFE_HEAP_LOAD($364 | 0, 4, 0) | 0 | 0; //@line 1917
         $366 = ($365 | 0) == ($$4$lcssa$i | 0); //@line 1918
         if (!$366) {
          _abort(); //@line 1920
         }
         $367 = $359 + 8 | 0; //@line 1923
         $368 = SAFE_HEAP_LOAD($367 | 0, 4, 0) | 0 | 0; //@line 1924
         $369 = ($368 | 0) == ($$4$lcssa$i | 0); //@line 1925
         if ($369) {
          SAFE_HEAP_STORE($364 | 0, $359 | 0, 4);
          SAFE_HEAP_STORE($367 | 0, $362 | 0, 4);
          $$3372$i = $359; //@line 1929
          break;
         } else {
          _abort(); //@line 1932
         }
        }
       } while (0);
       $383 = ($357 | 0) == (0 | 0); //@line 1937
       L164 : do {
        if ($383) {
         $475 = $253; //@line 1940
        } else {
         $384 = $$4$lcssa$i + 28 | 0; //@line 1942
         $385 = SAFE_HEAP_LOAD($384 | 0, 4, 0) | 0 | 0; //@line 1943
         $386 = 4256 + ($385 << 2) | 0; //@line 1944
         $387 = SAFE_HEAP_LOAD($386 | 0, 4, 0) | 0 | 0; //@line 1945
         $388 = ($$4$lcssa$i | 0) == ($387 | 0); //@line 1946
         do {
          if ($388) {
           SAFE_HEAP_STORE($386 | 0, $$3372$i | 0, 4);
           $cond$i209 = ($$3372$i | 0) == (0 | 0); //@line 1950
           if ($cond$i209) {
            $389 = 1 << $385; //@line 1952
            $390 = $389 ^ -1; //@line 1953
            $391 = $253 & $390; //@line 1954
            SAFE_HEAP_STORE(3956 | 0, $391 | 0, 4);
            $475 = $391; //@line 1956
            break L164;
           }
          } else {
           $392 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1960
           $393 = $392 >>> 0 > $357 >>> 0; //@line 1961
           if ($393) {
            _abort(); //@line 1963
           } else {
            $394 = $357 + 16 | 0; //@line 1966
            $395 = SAFE_HEAP_LOAD($394 | 0, 4, 0) | 0 | 0; //@line 1967
            $396 = ($395 | 0) != ($$4$lcssa$i | 0); //@line 1968
            $$sink3$i = $396 & 1; //@line 1969
            $397 = ($357 + 16 | 0) + ($$sink3$i << 2) | 0; //@line 1970
            SAFE_HEAP_STORE($397 | 0, $$3372$i | 0, 4);
            $398 = ($$3372$i | 0) == (0 | 0); //@line 1972
            if ($398) {
             $475 = $253; //@line 1974
             break L164;
            } else {
             break;
            }
           }
          }
         } while (0);
         $399 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 1982
         $400 = $399 >>> 0 > $$3372$i >>> 0; //@line 1983
         if ($400) {
          _abort(); //@line 1985
         }
         $401 = $$3372$i + 24 | 0; //@line 1988
         SAFE_HEAP_STORE($401 | 0, $357 | 0, 4);
         $402 = $$4$lcssa$i + 16 | 0; //@line 1990
         $403 = SAFE_HEAP_LOAD($402 | 0, 4, 0) | 0 | 0; //@line 1991
         $404 = ($403 | 0) == (0 | 0); //@line 1992
         do {
          if (!$404) {
           $405 = $399 >>> 0 > $403 >>> 0; //@line 1995
           if ($405) {
            _abort(); //@line 1997
           } else {
            $406 = $$3372$i + 16 | 0; //@line 2000
            SAFE_HEAP_STORE($406 | 0, $403 | 0, 4);
            $407 = $403 + 24 | 0; //@line 2002
            SAFE_HEAP_STORE($407 | 0, $$3372$i | 0, 4);
            break;
           }
          }
         } while (0);
         $408 = $$4$lcssa$i + 20 | 0; //@line 2008
         $409 = SAFE_HEAP_LOAD($408 | 0, 4, 0) | 0 | 0; //@line 2009
         $410 = ($409 | 0) == (0 | 0); //@line 2010
         if ($410) {
          $475 = $253; //@line 2012
         } else {
          $411 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2014
          $412 = $411 >>> 0 > $409 >>> 0; //@line 2015
          if ($412) {
           _abort(); //@line 2017
          } else {
           $413 = $$3372$i + 20 | 0; //@line 2020
           SAFE_HEAP_STORE($413 | 0, $409 | 0, 4);
           $414 = $409 + 24 | 0; //@line 2022
           SAFE_HEAP_STORE($414 | 0, $$3372$i | 0, 4);
           $475 = $253; //@line 2024
           break;
          }
         }
        }
       } while (0);
       $415 = $$4351$lcssa$i >>> 0 < 16; //@line 2030
       do {
        if ($415) {
         $416 = $$4351$lcssa$i + $252 | 0; //@line 2033
         $417 = $416 | 3; //@line 2034
         $418 = $$4$lcssa$i + 4 | 0; //@line 2035
         SAFE_HEAP_STORE($418 | 0, $417 | 0, 4);
         $419 = $$4$lcssa$i + $416 | 0; //@line 2037
         $420 = $419 + 4 | 0; //@line 2038
         $421 = SAFE_HEAP_LOAD($420 | 0, 4, 0) | 0 | 0; //@line 2039
         $422 = $421 | 1; //@line 2040
         SAFE_HEAP_STORE($420 | 0, $422 | 0, 4);
        } else {
         $423 = $252 | 3; //@line 2043
         $424 = $$4$lcssa$i + 4 | 0; //@line 2044
         SAFE_HEAP_STORE($424 | 0, $423 | 0, 4);
         $425 = $$4351$lcssa$i | 1; //@line 2046
         $426 = $354 + 4 | 0; //@line 2047
         SAFE_HEAP_STORE($426 | 0, $425 | 0, 4);
         $427 = $354 + $$4351$lcssa$i | 0; //@line 2049
         SAFE_HEAP_STORE($427 | 0, $$4351$lcssa$i | 0, 4);
         $428 = $$4351$lcssa$i >>> 3; //@line 2051
         $429 = $$4351$lcssa$i >>> 0 < 256; //@line 2052
         if ($429) {
          $430 = $428 << 1; //@line 2054
          $431 = 3992 + ($430 << 2) | 0; //@line 2055
          $432 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 2056
          $433 = 1 << $428; //@line 2057
          $434 = $432 & $433; //@line 2058
          $435 = ($434 | 0) == 0; //@line 2059
          if ($435) {
           $436 = $432 | $433; //@line 2061
           SAFE_HEAP_STORE(988 * 4 | 0, $436 | 0, 4);
           $$pre$i210 = $431 + 8 | 0; //@line 2063
           $$0368$i = $431; //@line 2064
           $$pre$phi$i211Z2D = $$pre$i210; //@line 2064
          } else {
           $437 = $431 + 8 | 0; //@line 2066
           $438 = SAFE_HEAP_LOAD($437 | 0, 4, 0) | 0 | 0; //@line 2067
           $439 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2068
           $440 = $439 >>> 0 > $438 >>> 0; //@line 2069
           if ($440) {
            _abort(); //@line 2071
           } else {
            $$0368$i = $438; //@line 2074
            $$pre$phi$i211Z2D = $437; //@line 2074
           }
          }
          SAFE_HEAP_STORE($$pre$phi$i211Z2D | 0, $354 | 0, 4);
          $441 = $$0368$i + 12 | 0; //@line 2078
          SAFE_HEAP_STORE($441 | 0, $354 | 0, 4);
          $442 = $354 + 8 | 0; //@line 2080
          SAFE_HEAP_STORE($442 | 0, $$0368$i | 0, 4);
          $443 = $354 + 12 | 0; //@line 2082
          SAFE_HEAP_STORE($443 | 0, $431 | 0, 4);
          break;
         }
         $444 = $$4351$lcssa$i >>> 8; //@line 2086
         $445 = ($444 | 0) == 0; //@line 2087
         if ($445) {
          $$0361$i = 0; //@line 2089
         } else {
          $446 = $$4351$lcssa$i >>> 0 > 16777215; //@line 2091
          if ($446) {
           $$0361$i = 31; //@line 2093
          } else {
           $447 = $444 + 1048320 | 0; //@line 2095
           $448 = $447 >>> 16; //@line 2096
           $449 = $448 & 8; //@line 2097
           $450 = $444 << $449; //@line 2098
           $451 = $450 + 520192 | 0; //@line 2099
           $452 = $451 >>> 16; //@line 2100
           $453 = $452 & 4; //@line 2101
           $454 = $453 | $449; //@line 2102
           $455 = $450 << $453; //@line 2103
           $456 = $455 + 245760 | 0; //@line 2104
           $457 = $456 >>> 16; //@line 2105
           $458 = $457 & 2; //@line 2106
           $459 = $454 | $458; //@line 2107
           $460 = 14 - $459 | 0; //@line 2108
           $461 = $455 << $458; //@line 2109
           $462 = $461 >>> 15; //@line 2110
           $463 = $460 + $462 | 0; //@line 2111
           $464 = $463 << 1; //@line 2112
           $465 = $463 + 7 | 0; //@line 2113
           $466 = $$4351$lcssa$i >>> $465; //@line 2114
           $467 = $466 & 1; //@line 2115
           $468 = $467 | $464; //@line 2116
           $$0361$i = $468; //@line 2117
          }
         }
         $469 = 4256 + ($$0361$i << 2) | 0; //@line 2120
         $470 = $354 + 28 | 0; //@line 2121
         SAFE_HEAP_STORE($470 | 0, $$0361$i | 0, 4);
         $471 = $354 + 16 | 0; //@line 2123
         $472 = $471 + 4 | 0; //@line 2124
         SAFE_HEAP_STORE($472 | 0, 0 | 0, 4);
         SAFE_HEAP_STORE($471 | 0, 0 | 0, 4);
         $473 = 1 << $$0361$i; //@line 2127
         $474 = $475 & $473; //@line 2128
         $476 = ($474 | 0) == 0; //@line 2129
         if ($476) {
          $477 = $475 | $473; //@line 2131
          SAFE_HEAP_STORE(3956 | 0, $477 | 0, 4);
          SAFE_HEAP_STORE($469 | 0, $354 | 0, 4);
          $478 = $354 + 24 | 0; //@line 2134
          SAFE_HEAP_STORE($478 | 0, $469 | 0, 4);
          $479 = $354 + 12 | 0; //@line 2136
          SAFE_HEAP_STORE($479 | 0, $354 | 0, 4);
          $480 = $354 + 8 | 0; //@line 2138
          SAFE_HEAP_STORE($480 | 0, $354 | 0, 4);
          break;
         }
         $481 = SAFE_HEAP_LOAD($469 | 0, 4, 0) | 0 | 0; //@line 2142
         $482 = ($$0361$i | 0) == 31; //@line 2143
         $483 = $$0361$i >>> 1; //@line 2144
         $484 = 25 - $483 | 0; //@line 2145
         $485 = $482 ? 0 : $484; //@line 2146
         $486 = $$4351$lcssa$i << $485; //@line 2147
         $$0344$i = $486; //@line 2148
         $$0345$i = $481; //@line 2148
         while (1) {
          $487 = $$0345$i + 4 | 0; //@line 2150
          $488 = SAFE_HEAP_LOAD($487 | 0, 4, 0) | 0 | 0; //@line 2151
          $489 = $488 & -8; //@line 2152
          $490 = ($489 | 0) == ($$4351$lcssa$i | 0); //@line 2153
          if ($490) {
           label = 139; //@line 2155
           break;
          }
          $491 = $$0344$i >>> 31; //@line 2158
          $492 = ($$0345$i + 16 | 0) + ($491 << 2) | 0; //@line 2159
          $493 = $$0344$i << 1; //@line 2160
          $494 = SAFE_HEAP_LOAD($492 | 0, 4, 0) | 0 | 0; //@line 2161
          $495 = ($494 | 0) == (0 | 0); //@line 2162
          if ($495) {
           label = 136; //@line 2164
           break;
          } else {
           $$0344$i = $493; //@line 2167
           $$0345$i = $494; //@line 2167
          }
         }
         if ((label | 0) == 136) {
          $496 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2171
          $497 = $496 >>> 0 > $492 >>> 0; //@line 2172
          if ($497) {
           _abort(); //@line 2174
          } else {
           SAFE_HEAP_STORE($492 | 0, $354 | 0, 4);
           $498 = $354 + 24 | 0; //@line 2178
           SAFE_HEAP_STORE($498 | 0, $$0345$i | 0, 4);
           $499 = $354 + 12 | 0; //@line 2180
           SAFE_HEAP_STORE($499 | 0, $354 | 0, 4);
           $500 = $354 + 8 | 0; //@line 2182
           SAFE_HEAP_STORE($500 | 0, $354 | 0, 4);
           break;
          }
         } else if ((label | 0) == 139) {
          $501 = $$0345$i + 8 | 0; //@line 2188
          $502 = SAFE_HEAP_LOAD($501 | 0, 4, 0) | 0 | 0; //@line 2189
          $503 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2190
          $504 = $503 >>> 0 <= $$0345$i >>> 0; //@line 2191
          $505 = $503 >>> 0 <= $502 >>> 0; //@line 2192
          $506 = $505 & $504; //@line 2193
          if ($506) {
           $507 = $502 + 12 | 0; //@line 2195
           SAFE_HEAP_STORE($507 | 0, $354 | 0, 4);
           SAFE_HEAP_STORE($501 | 0, $354 | 0, 4);
           $508 = $354 + 8 | 0; //@line 2198
           SAFE_HEAP_STORE($508 | 0, $502 | 0, 4);
           $509 = $354 + 12 | 0; //@line 2200
           SAFE_HEAP_STORE($509 | 0, $$0345$i | 0, 4);
           $510 = $354 + 24 | 0; //@line 2202
           SAFE_HEAP_STORE($510 | 0, 0 | 0, 4);
           break;
          } else {
           _abort(); //@line 2206
          }
         }
        }
       } while (0);
       $511 = $$4$lcssa$i + 8 | 0; //@line 2212
       $$0 = $511; //@line 2213
       STACKTOP = sp; //@line 2214
       return $$0 | 0; //@line 2214
      } else {
       $$0197 = $252; //@line 2216
      }
     }
    }
   }
  }
 } while (0);
 $512 = SAFE_HEAP_LOAD(3960 | 0, 4, 0) | 0 | 0; //@line 2223
 $513 = $512 >>> 0 < $$0197 >>> 0; //@line 2224
 if (!$513) {
  $514 = $512 - $$0197 | 0; //@line 2226
  $515 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 2227
  $516 = $514 >>> 0 > 15; //@line 2228
  if ($516) {
   $517 = $515 + $$0197 | 0; //@line 2230
   SAFE_HEAP_STORE(3972 | 0, $517 | 0, 4);
   SAFE_HEAP_STORE(3960 | 0, $514 | 0, 4);
   $518 = $514 | 1; //@line 2233
   $519 = $517 + 4 | 0; //@line 2234
   SAFE_HEAP_STORE($519 | 0, $518 | 0, 4);
   $520 = $515 + $512 | 0; //@line 2236
   SAFE_HEAP_STORE($520 | 0, $514 | 0, 4);
   $521 = $$0197 | 3; //@line 2238
   $522 = $515 + 4 | 0; //@line 2239
   SAFE_HEAP_STORE($522 | 0, $521 | 0, 4);
  } else {
   SAFE_HEAP_STORE(3960 | 0, 0 | 0, 4);
   SAFE_HEAP_STORE(3972 | 0, 0 | 0, 4);
   $523 = $512 | 3; //@line 2244
   $524 = $515 + 4 | 0; //@line 2245
   SAFE_HEAP_STORE($524 | 0, $523 | 0, 4);
   $525 = $515 + $512 | 0; //@line 2247
   $526 = $525 + 4 | 0; //@line 2248
   $527 = SAFE_HEAP_LOAD($526 | 0, 4, 0) | 0 | 0; //@line 2249
   $528 = $527 | 1; //@line 2250
   SAFE_HEAP_STORE($526 | 0, $528 | 0, 4);
  }
  $529 = $515 + 8 | 0; //@line 2253
  $$0 = $529; //@line 2254
  STACKTOP = sp; //@line 2255
  return $$0 | 0; //@line 2255
 }
 $530 = SAFE_HEAP_LOAD(3964 | 0, 4, 0) | 0 | 0; //@line 2257
 $531 = $530 >>> 0 > $$0197 >>> 0; //@line 2258
 if ($531) {
  $532 = $530 - $$0197 | 0; //@line 2260
  SAFE_HEAP_STORE(3964 | 0, $532 | 0, 4);
  $533 = SAFE_HEAP_LOAD(3976 | 0, 4, 0) | 0 | 0; //@line 2262
  $534 = $533 + $$0197 | 0; //@line 2263
  SAFE_HEAP_STORE(3976 | 0, $534 | 0, 4);
  $535 = $532 | 1; //@line 2265
  $536 = $534 + 4 | 0; //@line 2266
  SAFE_HEAP_STORE($536 | 0, $535 | 0, 4);
  $537 = $$0197 | 3; //@line 2268
  $538 = $533 + 4 | 0; //@line 2269
  SAFE_HEAP_STORE($538 | 0, $537 | 0, 4);
  $539 = $533 + 8 | 0; //@line 2271
  $$0 = $539; //@line 2272
  STACKTOP = sp; //@line 2273
  return $$0 | 0; //@line 2273
 }
 $540 = SAFE_HEAP_LOAD(1106 * 4 | 0, 4, 0) | 0 | 0; //@line 2275
 $541 = ($540 | 0) == 0; //@line 2276
 if ($541) {
  SAFE_HEAP_STORE(4432 | 0, 4096 | 0, 4);
  SAFE_HEAP_STORE(4428 | 0, 4096 | 0, 4);
  SAFE_HEAP_STORE(4436 | 0, -1 | 0, 4);
  SAFE_HEAP_STORE(4440 | 0, -1 | 0, 4);
  SAFE_HEAP_STORE(4444 | 0, 0 | 0, 4);
  SAFE_HEAP_STORE(4396 | 0, 0 | 0, 4);
  $542 = $1; //@line 2284
  $543 = $542 & -16; //@line 2285
  $544 = $543 ^ 1431655768; //@line 2286
  SAFE_HEAP_STORE(1106 * 4 | 0, $544 | 0, 4);
  $548 = 4096; //@line 2288
 } else {
  $$pre$i212 = SAFE_HEAP_LOAD(4432 | 0, 4, 0) | 0 | 0; //@line 2290
  $548 = $$pre$i212; //@line 2291
 }
 $545 = $$0197 + 48 | 0; //@line 2293
 $546 = $$0197 + 47 | 0; //@line 2294
 $547 = $548 + $546 | 0; //@line 2295
 $549 = 0 - $548 | 0; //@line 2296
 $550 = $547 & $549; //@line 2297
 $551 = $550 >>> 0 > $$0197 >>> 0; //@line 2298
 if (!$551) {
  $$0 = 0; //@line 2300
  STACKTOP = sp; //@line 2301
  return $$0 | 0; //@line 2301
 }
 $552 = SAFE_HEAP_LOAD(4392 | 0, 4, 0) | 0 | 0; //@line 2303
 $553 = ($552 | 0) == 0; //@line 2304
 if (!$553) {
  $554 = SAFE_HEAP_LOAD(4384 | 0, 4, 0) | 0 | 0; //@line 2306
  $555 = $554 + $550 | 0; //@line 2307
  $556 = $555 >>> 0 <= $554 >>> 0; //@line 2308
  $557 = $555 >>> 0 > $552 >>> 0; //@line 2309
  $or$cond1$i = $556 | $557; //@line 2310
  if ($or$cond1$i) {
   $$0 = 0; //@line 2312
   STACKTOP = sp; //@line 2313
   return $$0 | 0; //@line 2313
  }
 }
 $558 = SAFE_HEAP_LOAD(4396 | 0, 4, 0) | 0 | 0; //@line 2316
 $559 = $558 & 4; //@line 2317
 $560 = ($559 | 0) == 0; //@line 2318
 L244 : do {
  if ($560) {
   $561 = SAFE_HEAP_LOAD(3976 | 0, 4, 0) | 0 | 0; //@line 2321
   $562 = ($561 | 0) == (0 | 0); //@line 2322
   L246 : do {
    if ($562) {
     label = 163; //@line 2325
    } else {
     $$0$i$i = 4400; //@line 2327
     while (1) {
      $563 = SAFE_HEAP_LOAD($$0$i$i | 0, 4, 0) | 0 | 0; //@line 2329
      $564 = $563 >>> 0 > $561 >>> 0; //@line 2330
      if (!$564) {
       $565 = $$0$i$i + 4 | 0; //@line 2332
       $566 = SAFE_HEAP_LOAD($565 | 0, 4, 0) | 0 | 0; //@line 2333
       $567 = $563 + $566 | 0; //@line 2334
       $568 = $567 >>> 0 > $561 >>> 0; //@line 2335
       if ($568) {
        break;
       }
      }
      $569 = $$0$i$i + 8 | 0; //@line 2340
      $570 = SAFE_HEAP_LOAD($569 | 0, 4, 0) | 0 | 0; //@line 2341
      $571 = ($570 | 0) == (0 | 0); //@line 2342
      if ($571) {
       label = 163; //@line 2344
       break L246;
      } else {
       $$0$i$i = $570; //@line 2347
      }
     }
     $594 = $547 - $530 | 0; //@line 2350
     $595 = $594 & $549; //@line 2351
     $596 = $595 >>> 0 < 2147483647; //@line 2352
     if ($596) {
      $597 = _sbrk($595 | 0) | 0; //@line 2354
      $598 = SAFE_HEAP_LOAD($$0$i$i | 0, 4, 0) | 0 | 0; //@line 2355
      $599 = SAFE_HEAP_LOAD($565 | 0, 4, 0) | 0 | 0; //@line 2356
      $600 = $598 + $599 | 0; //@line 2357
      $601 = ($597 | 0) == ($600 | 0); //@line 2358
      if ($601) {
       $602 = ($597 | 0) == (-1 | 0); //@line 2360
       if ($602) {
        $$2234243136$i = $595; //@line 2362
       } else {
        $$723947$i = $595; //@line 2364
        $$748$i = $597; //@line 2364
        label = 180; //@line 2365
        break L244;
       }
      } else {
       $$2247$ph$i = $597; //@line 2369
       $$2253$ph$i = $595; //@line 2369
       label = 171; //@line 2370
      }
     } else {
      $$2234243136$i = 0; //@line 2373
     }
    }
   } while (0);
   do {
    if ((label | 0) == 163) {
     $572 = _sbrk(0) | 0; //@line 2379
     $573 = ($572 | 0) == (-1 | 0); //@line 2380
     if ($573) {
      $$2234243136$i = 0; //@line 2382
     } else {
      $574 = $572; //@line 2384
      $575 = SAFE_HEAP_LOAD(4428 | 0, 4, 0) | 0 | 0; //@line 2385
      $576 = $575 + -1 | 0; //@line 2386
      $577 = $576 & $574; //@line 2387
      $578 = ($577 | 0) == 0; //@line 2388
      $579 = $576 + $574 | 0; //@line 2389
      $580 = 0 - $575 | 0; //@line 2390
      $581 = $579 & $580; //@line 2391
      $582 = $581 - $574 | 0; //@line 2392
      $583 = $578 ? 0 : $582; //@line 2393
      $$$i = $583 + $550 | 0; //@line 2394
      $584 = SAFE_HEAP_LOAD(4384 | 0, 4, 0) | 0 | 0; //@line 2395
      $585 = $$$i + $584 | 0; //@line 2396
      $586 = $$$i >>> 0 > $$0197 >>> 0; //@line 2397
      $587 = $$$i >>> 0 < 2147483647; //@line 2398
      $or$cond$i214 = $586 & $587; //@line 2399
      if ($or$cond$i214) {
       $588 = SAFE_HEAP_LOAD(4392 | 0, 4, 0) | 0 | 0; //@line 2401
       $589 = ($588 | 0) == 0; //@line 2402
       if (!$589) {
        $590 = $585 >>> 0 <= $584 >>> 0; //@line 2404
        $591 = $585 >>> 0 > $588 >>> 0; //@line 2405
        $or$cond2$i215 = $590 | $591; //@line 2406
        if ($or$cond2$i215) {
         $$2234243136$i = 0; //@line 2408
         break;
        }
       }
       $592 = _sbrk($$$i | 0) | 0; //@line 2412
       $593 = ($592 | 0) == ($572 | 0); //@line 2413
       if ($593) {
        $$723947$i = $$$i; //@line 2415
        $$748$i = $572; //@line 2415
        label = 180; //@line 2416
        break L244;
       } else {
        $$2247$ph$i = $592; //@line 2419
        $$2253$ph$i = $$$i; //@line 2419
        label = 171; //@line 2420
       }
      } else {
       $$2234243136$i = 0; //@line 2423
      }
     }
    }
   } while (0);
   do {
    if ((label | 0) == 171) {
     $603 = 0 - $$2253$ph$i | 0; //@line 2430
     $604 = ($$2247$ph$i | 0) != (-1 | 0); //@line 2431
     $605 = $$2253$ph$i >>> 0 < 2147483647; //@line 2432
     $or$cond7$i = $605 & $604; //@line 2433
     $606 = $545 >>> 0 > $$2253$ph$i >>> 0; //@line 2434
     $or$cond10$i = $606 & $or$cond7$i; //@line 2435
     if (!$or$cond10$i) {
      $616 = ($$2247$ph$i | 0) == (-1 | 0); //@line 2437
      if ($616) {
       $$2234243136$i = 0; //@line 2439
       break;
      } else {
       $$723947$i = $$2253$ph$i; //@line 2442
       $$748$i = $$2247$ph$i; //@line 2442
       label = 180; //@line 2443
       break L244;
      }
     }
     $607 = SAFE_HEAP_LOAD(4432 | 0, 4, 0) | 0 | 0; //@line 2447
     $608 = $546 - $$2253$ph$i | 0; //@line 2448
     $609 = $608 + $607 | 0; //@line 2449
     $610 = 0 - $607 | 0; //@line 2450
     $611 = $609 & $610; //@line 2451
     $612 = $611 >>> 0 < 2147483647; //@line 2452
     if (!$612) {
      $$723947$i = $$2253$ph$i; //@line 2454
      $$748$i = $$2247$ph$i; //@line 2454
      label = 180; //@line 2455
      break L244;
     }
     $613 = _sbrk($611 | 0) | 0; //@line 2458
     $614 = ($613 | 0) == (-1 | 0); //@line 2459
     if ($614) {
      _sbrk($603 | 0) | 0; //@line 2461
      $$2234243136$i = 0; //@line 2462
      break;
     } else {
      $615 = $611 + $$2253$ph$i | 0; //@line 2465
      $$723947$i = $615; //@line 2466
      $$748$i = $$2247$ph$i; //@line 2466
      label = 180; //@line 2467
      break L244;
     }
    }
   } while (0);
   $617 = SAFE_HEAP_LOAD(4396 | 0, 4, 0) | 0 | 0; //@line 2472
   $618 = $617 | 4; //@line 2473
   SAFE_HEAP_STORE(4396 | 0, $618 | 0, 4);
   $$4236$i = $$2234243136$i; //@line 2475
   label = 178; //@line 2476
  } else {
   $$4236$i = 0; //@line 2478
   label = 178; //@line 2479
  }
 } while (0);
 if ((label | 0) == 178) {
  $619 = $550 >>> 0 < 2147483647; //@line 2483
  if ($619) {
   $620 = _sbrk($550 | 0) | 0; //@line 2485
   $621 = _sbrk(0) | 0; //@line 2486
   $622 = ($620 | 0) != (-1 | 0); //@line 2487
   $623 = ($621 | 0) != (-1 | 0); //@line 2488
   $or$cond5$i = $622 & $623; //@line 2489
   $624 = $620 >>> 0 < $621 >>> 0; //@line 2490
   $or$cond11$i = $624 & $or$cond5$i; //@line 2491
   $625 = $621; //@line 2492
   $626 = $620; //@line 2493
   $627 = $625 - $626 | 0; //@line 2494
   $628 = $$0197 + 40 | 0; //@line 2495
   $629 = $627 >>> 0 > $628 >>> 0; //@line 2496
   $$$4236$i = $629 ? $627 : $$4236$i; //@line 2497
   $or$cond11$not$i = $or$cond11$i ^ 1; //@line 2498
   $630 = ($620 | 0) == (-1 | 0); //@line 2499
   $not$$i = $629 ^ 1; //@line 2500
   $631 = $630 | $not$$i; //@line 2501
   $or$cond49$i = $631 | $or$cond11$not$i; //@line 2502
   if (!$or$cond49$i) {
    $$723947$i = $$$4236$i; //@line 2504
    $$748$i = $620; //@line 2504
    label = 180; //@line 2505
   }
  }
 }
 if ((label | 0) == 180) {
  $632 = SAFE_HEAP_LOAD(4384 | 0, 4, 0) | 0 | 0; //@line 2510
  $633 = $632 + $$723947$i | 0; //@line 2511
  SAFE_HEAP_STORE(4384 | 0, $633 | 0, 4);
  $634 = SAFE_HEAP_LOAD(4388 | 0, 4, 0) | 0 | 0; //@line 2513
  $635 = $633 >>> 0 > $634 >>> 0; //@line 2514
  if ($635) {
   SAFE_HEAP_STORE(4388 | 0, $633 | 0, 4);
  }
  $636 = SAFE_HEAP_LOAD(3976 | 0, 4, 0) | 0 | 0; //@line 2518
  $637 = ($636 | 0) == (0 | 0); //@line 2519
  do {
   if ($637) {
    $638 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2522
    $639 = ($638 | 0) == (0 | 0); //@line 2523
    $640 = $$748$i >>> 0 < $638 >>> 0; //@line 2524
    $or$cond12$i = $639 | $640; //@line 2525
    if ($or$cond12$i) {
     SAFE_HEAP_STORE(3968 | 0, $$748$i | 0, 4);
    }
    SAFE_HEAP_STORE(4400 | 0, $$748$i | 0, 4);
    SAFE_HEAP_STORE(4404 | 0, $$723947$i | 0, 4);
    SAFE_HEAP_STORE(4412 | 0, 0 | 0, 4);
    $641 = SAFE_HEAP_LOAD(1106 * 4 | 0, 4, 0) | 0 | 0; //@line 2532
    SAFE_HEAP_STORE(3988 | 0, $641 | 0, 4);
    SAFE_HEAP_STORE(3984 | 0, -1 | 0, 4);
    SAFE_HEAP_STORE(4004 | 0, 3992 | 0, 4);
    SAFE_HEAP_STORE(4e3 | 0, 3992 | 0, 4);
    SAFE_HEAP_STORE(4012 | 0, 4e3 | 0, 4);
    SAFE_HEAP_STORE(4008 | 0, 4e3 | 0, 4);
    SAFE_HEAP_STORE(4020 | 0, 4008 | 0, 4);
    SAFE_HEAP_STORE(4016 | 0, 4008 | 0, 4);
    SAFE_HEAP_STORE(4028 | 0, 4016 | 0, 4);
    SAFE_HEAP_STORE(4024 | 0, 4016 | 0, 4);
    SAFE_HEAP_STORE(4036 | 0, 4024 | 0, 4);
    SAFE_HEAP_STORE(4032 | 0, 4024 | 0, 4);
    SAFE_HEAP_STORE(4044 | 0, 4032 | 0, 4);
    SAFE_HEAP_STORE(4040 | 0, 4032 | 0, 4);
    SAFE_HEAP_STORE(4052 | 0, 4040 | 0, 4);
    SAFE_HEAP_STORE(4048 | 0, 4040 | 0, 4);
    SAFE_HEAP_STORE(4060 | 0, 4048 | 0, 4);
    SAFE_HEAP_STORE(4056 | 0, 4048 | 0, 4);
    SAFE_HEAP_STORE(4068 | 0, 4056 | 0, 4);
    SAFE_HEAP_STORE(4064 | 0, 4056 | 0, 4);
    SAFE_HEAP_STORE(4076 | 0, 4064 | 0, 4);
    SAFE_HEAP_STORE(4072 | 0, 4064 | 0, 4);
    SAFE_HEAP_STORE(4084 | 0, 4072 | 0, 4);
    SAFE_HEAP_STORE(4080 | 0, 4072 | 0, 4);
    SAFE_HEAP_STORE(4092 | 0, 4080 | 0, 4);
    SAFE_HEAP_STORE(4088 | 0, 4080 | 0, 4);
    SAFE_HEAP_STORE(4100 | 0, 4088 | 0, 4);
    SAFE_HEAP_STORE(4096 | 0, 4088 | 0, 4);
    SAFE_HEAP_STORE(4108 | 0, 4096 | 0, 4);
    SAFE_HEAP_STORE(4104 | 0, 4096 | 0, 4);
    SAFE_HEAP_STORE(4116 | 0, 4104 | 0, 4);
    SAFE_HEAP_STORE(4112 | 0, 4104 | 0, 4);
    SAFE_HEAP_STORE(4124 | 0, 4112 | 0, 4);
    SAFE_HEAP_STORE(4120 | 0, 4112 | 0, 4);
    SAFE_HEAP_STORE(4132 | 0, 4120 | 0, 4);
    SAFE_HEAP_STORE(4128 | 0, 4120 | 0, 4);
    SAFE_HEAP_STORE(4140 | 0, 4128 | 0, 4);
    SAFE_HEAP_STORE(4136 | 0, 4128 | 0, 4);
    SAFE_HEAP_STORE(4148 | 0, 4136 | 0, 4);
    SAFE_HEAP_STORE(4144 | 0, 4136 | 0, 4);
    SAFE_HEAP_STORE(4156 | 0, 4144 | 0, 4);
    SAFE_HEAP_STORE(4152 | 0, 4144 | 0, 4);
    SAFE_HEAP_STORE(4164 | 0, 4152 | 0, 4);
    SAFE_HEAP_STORE(4160 | 0, 4152 | 0, 4);
    SAFE_HEAP_STORE(4172 | 0, 4160 | 0, 4);
    SAFE_HEAP_STORE(4168 | 0, 4160 | 0, 4);
    SAFE_HEAP_STORE(4180 | 0, 4168 | 0, 4);
    SAFE_HEAP_STORE(4176 | 0, 4168 | 0, 4);
    SAFE_HEAP_STORE(4188 | 0, 4176 | 0, 4);
    SAFE_HEAP_STORE(4184 | 0, 4176 | 0, 4);
    SAFE_HEAP_STORE(4196 | 0, 4184 | 0, 4);
    SAFE_HEAP_STORE(4192 | 0, 4184 | 0, 4);
    SAFE_HEAP_STORE(4204 | 0, 4192 | 0, 4);
    SAFE_HEAP_STORE(4200 | 0, 4192 | 0, 4);
    SAFE_HEAP_STORE(4212 | 0, 4200 | 0, 4);
    SAFE_HEAP_STORE(4208 | 0, 4200 | 0, 4);
    SAFE_HEAP_STORE(4220 | 0, 4208 | 0, 4);
    SAFE_HEAP_STORE(4216 | 0, 4208 | 0, 4);
    SAFE_HEAP_STORE(4228 | 0, 4216 | 0, 4);
    SAFE_HEAP_STORE(4224 | 0, 4216 | 0, 4);
    SAFE_HEAP_STORE(4236 | 0, 4224 | 0, 4);
    SAFE_HEAP_STORE(4232 | 0, 4224 | 0, 4);
    SAFE_HEAP_STORE(4244 | 0, 4232 | 0, 4);
    SAFE_HEAP_STORE(4240 | 0, 4232 | 0, 4);
    SAFE_HEAP_STORE(4252 | 0, 4240 | 0, 4);
    SAFE_HEAP_STORE(4248 | 0, 4240 | 0, 4);
    $642 = $$723947$i + -40 | 0; //@line 2599
    $643 = $$748$i + 8 | 0; //@line 2600
    $644 = $643; //@line 2601
    $645 = $644 & 7; //@line 2602
    $646 = ($645 | 0) == 0; //@line 2603
    $647 = 0 - $644 | 0; //@line 2604
    $648 = $647 & 7; //@line 2605
    $649 = $646 ? 0 : $648; //@line 2606
    $650 = $$748$i + $649 | 0; //@line 2607
    $651 = $642 - $649 | 0; //@line 2608
    SAFE_HEAP_STORE(3976 | 0, $650 | 0, 4);
    SAFE_HEAP_STORE(3964 | 0, $651 | 0, 4);
    $652 = $651 | 1; //@line 2611
    $653 = $650 + 4 | 0; //@line 2612
    SAFE_HEAP_STORE($653 | 0, $652 | 0, 4);
    $654 = $$748$i + $642 | 0; //@line 2614
    $655 = $654 + 4 | 0; //@line 2615
    SAFE_HEAP_STORE($655 | 0, 40 | 0, 4);
    $656 = SAFE_HEAP_LOAD(4440 | 0, 4, 0) | 0 | 0; //@line 2617
    SAFE_HEAP_STORE(3980 | 0, $656 | 0, 4);
   } else {
    $$024367$i = 4400; //@line 2620
    while (1) {
     $657 = SAFE_HEAP_LOAD($$024367$i | 0, 4, 0) | 0 | 0; //@line 2622
     $658 = $$024367$i + 4 | 0; //@line 2623
     $659 = SAFE_HEAP_LOAD($658 | 0, 4, 0) | 0 | 0; //@line 2624
     $660 = $657 + $659 | 0; //@line 2625
     $661 = ($$748$i | 0) == ($660 | 0); //@line 2626
     if ($661) {
      label = 188; //@line 2628
      break;
     }
     $662 = $$024367$i + 8 | 0; //@line 2631
     $663 = SAFE_HEAP_LOAD($662 | 0, 4, 0) | 0 | 0; //@line 2632
     $664 = ($663 | 0) == (0 | 0); //@line 2633
     if ($664) {
      break;
     } else {
      $$024367$i = $663; //@line 2637
     }
    }
    if ((label | 0) == 188) {
     $665 = $$024367$i + 12 | 0; //@line 2641
     $666 = SAFE_HEAP_LOAD($665 | 0, 4, 0) | 0 | 0; //@line 2642
     $667 = $666 & 8; //@line 2643
     $668 = ($667 | 0) == 0; //@line 2644
     if ($668) {
      $669 = $657 >>> 0 <= $636 >>> 0; //@line 2646
      $670 = $$748$i >>> 0 > $636 >>> 0; //@line 2647
      $or$cond50$i = $670 & $669; //@line 2648
      if ($or$cond50$i) {
       $671 = $659 + $$723947$i | 0; //@line 2650
       SAFE_HEAP_STORE($658 | 0, $671 | 0, 4);
       $672 = SAFE_HEAP_LOAD(3964 | 0, 4, 0) | 0 | 0; //@line 2652
       $673 = $672 + $$723947$i | 0; //@line 2653
       $674 = $636 + 8 | 0; //@line 2654
       $675 = $674; //@line 2655
       $676 = $675 & 7; //@line 2656
       $677 = ($676 | 0) == 0; //@line 2657
       $678 = 0 - $675 | 0; //@line 2658
       $679 = $678 & 7; //@line 2659
       $680 = $677 ? 0 : $679; //@line 2660
       $681 = $636 + $680 | 0; //@line 2661
       $682 = $673 - $680 | 0; //@line 2662
       SAFE_HEAP_STORE(3976 | 0, $681 | 0, 4);
       SAFE_HEAP_STORE(3964 | 0, $682 | 0, 4);
       $683 = $682 | 1; //@line 2665
       $684 = $681 + 4 | 0; //@line 2666
       SAFE_HEAP_STORE($684 | 0, $683 | 0, 4);
       $685 = $636 + $673 | 0; //@line 2668
       $686 = $685 + 4 | 0; //@line 2669
       SAFE_HEAP_STORE($686 | 0, 40 | 0, 4);
       $687 = SAFE_HEAP_LOAD(4440 | 0, 4, 0) | 0 | 0; //@line 2671
       SAFE_HEAP_STORE(3980 | 0, $687 | 0, 4);
       break;
      }
     }
    }
    $688 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2677
    $689 = $$748$i >>> 0 < $688 >>> 0; //@line 2678
    if ($689) {
     SAFE_HEAP_STORE(3968 | 0, $$748$i | 0, 4);
     $753 = $$748$i; //@line 2681
    } else {
     $753 = $688; //@line 2683
    }
    $690 = $$748$i + $$723947$i | 0; //@line 2685
    $$124466$i = 4400; //@line 2686
    while (1) {
     $691 = SAFE_HEAP_LOAD($$124466$i | 0, 4, 0) | 0 | 0; //@line 2688
     $692 = ($691 | 0) == ($690 | 0); //@line 2689
     if ($692) {
      label = 196; //@line 2691
      break;
     }
     $693 = $$124466$i + 8 | 0; //@line 2694
     $694 = SAFE_HEAP_LOAD($693 | 0, 4, 0) | 0 | 0; //@line 2695
     $695 = ($694 | 0) == (0 | 0); //@line 2696
     if ($695) {
      $$0$i$i$i = 4400; //@line 2698
      break;
     } else {
      $$124466$i = $694; //@line 2701
     }
    }
    if ((label | 0) == 196) {
     $696 = $$124466$i + 12 | 0; //@line 2705
     $697 = SAFE_HEAP_LOAD($696 | 0, 4, 0) | 0 | 0; //@line 2706
     $698 = $697 & 8; //@line 2707
     $699 = ($698 | 0) == 0; //@line 2708
     if ($699) {
      SAFE_HEAP_STORE($$124466$i | 0, $$748$i | 0, 4);
      $700 = $$124466$i + 4 | 0; //@line 2711
      $701 = SAFE_HEAP_LOAD($700 | 0, 4, 0) | 0 | 0; //@line 2712
      $702 = $701 + $$723947$i | 0; //@line 2713
      SAFE_HEAP_STORE($700 | 0, $702 | 0, 4);
      $703 = $$748$i + 8 | 0; //@line 2715
      $704 = $703; //@line 2716
      $705 = $704 & 7; //@line 2717
      $706 = ($705 | 0) == 0; //@line 2718
      $707 = 0 - $704 | 0; //@line 2719
      $708 = $707 & 7; //@line 2720
      $709 = $706 ? 0 : $708; //@line 2721
      $710 = $$748$i + $709 | 0; //@line 2722
      $711 = $690 + 8 | 0; //@line 2723
      $712 = $711; //@line 2724
      $713 = $712 & 7; //@line 2725
      $714 = ($713 | 0) == 0; //@line 2726
      $715 = 0 - $712 | 0; //@line 2727
      $716 = $715 & 7; //@line 2728
      $717 = $714 ? 0 : $716; //@line 2729
      $718 = $690 + $717 | 0; //@line 2730
      $719 = $718; //@line 2731
      $720 = $710; //@line 2732
      $721 = $719 - $720 | 0; //@line 2733
      $722 = $710 + $$0197 | 0; //@line 2734
      $723 = $721 - $$0197 | 0; //@line 2735
      $724 = $$0197 | 3; //@line 2736
      $725 = $710 + 4 | 0; //@line 2737
      SAFE_HEAP_STORE($725 | 0, $724 | 0, 4);
      $726 = ($636 | 0) == ($718 | 0); //@line 2739
      do {
       if ($726) {
        $727 = SAFE_HEAP_LOAD(3964 | 0, 4, 0) | 0 | 0; //@line 2742
        $728 = $727 + $723 | 0; //@line 2743
        SAFE_HEAP_STORE(3964 | 0, $728 | 0, 4);
        SAFE_HEAP_STORE(3976 | 0, $722 | 0, 4);
        $729 = $728 | 1; //@line 2746
        $730 = $722 + 4 | 0; //@line 2747
        SAFE_HEAP_STORE($730 | 0, $729 | 0, 4);
       } else {
        $731 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 2750
        $732 = ($731 | 0) == ($718 | 0); //@line 2751
        if ($732) {
         $733 = SAFE_HEAP_LOAD(3960 | 0, 4, 0) | 0 | 0; //@line 2753
         $734 = $733 + $723 | 0; //@line 2754
         SAFE_HEAP_STORE(3960 | 0, $734 | 0, 4);
         SAFE_HEAP_STORE(3972 | 0, $722 | 0, 4);
         $735 = $734 | 1; //@line 2757
         $736 = $722 + 4 | 0; //@line 2758
         SAFE_HEAP_STORE($736 | 0, $735 | 0, 4);
         $737 = $722 + $734 | 0; //@line 2760
         SAFE_HEAP_STORE($737 | 0, $734 | 0, 4);
         break;
        }
        $738 = $718 + 4 | 0; //@line 2764
        $739 = SAFE_HEAP_LOAD($738 | 0, 4, 0) | 0 | 0; //@line 2765
        $740 = $739 & 3; //@line 2766
        $741 = ($740 | 0) == 1; //@line 2767
        if ($741) {
         $742 = $739 & -8; //@line 2769
         $743 = $739 >>> 3; //@line 2770
         $744 = $739 >>> 0 < 256; //@line 2771
         L311 : do {
          if ($744) {
           $745 = $718 + 8 | 0; //@line 2774
           $746 = SAFE_HEAP_LOAD($745 | 0, 4, 0) | 0 | 0; //@line 2775
           $747 = $718 + 12 | 0; //@line 2776
           $748 = SAFE_HEAP_LOAD($747 | 0, 4, 0) | 0 | 0; //@line 2777
           $749 = $743 << 1; //@line 2778
           $750 = 3992 + ($749 << 2) | 0; //@line 2779
           $751 = ($746 | 0) == ($750 | 0); //@line 2780
           do {
            if (!$751) {
             $752 = $753 >>> 0 > $746 >>> 0; //@line 2783
             if ($752) {
              _abort(); //@line 2785
             }
             $754 = $746 + 12 | 0; //@line 2788
             $755 = SAFE_HEAP_LOAD($754 | 0, 4, 0) | 0 | 0; //@line 2789
             $756 = ($755 | 0) == ($718 | 0); //@line 2790
             if ($756) {
              break;
             }
             _abort(); //@line 2794
            }
           } while (0);
           $757 = ($748 | 0) == ($746 | 0); //@line 2798
           if ($757) {
            $758 = 1 << $743; //@line 2800
            $759 = $758 ^ -1; //@line 2801
            $760 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 2802
            $761 = $760 & $759; //@line 2803
            SAFE_HEAP_STORE(988 * 4 | 0, $761 | 0, 4);
            break;
           }
           $762 = ($748 | 0) == ($750 | 0); //@line 2807
           do {
            if ($762) {
             $$pre10$i$i = $748 + 8 | 0; //@line 2810
             $$pre$phi11$i$iZ2D = $$pre10$i$i; //@line 2811
            } else {
             $763 = $753 >>> 0 > $748 >>> 0; //@line 2813
             if ($763) {
              _abort(); //@line 2815
             }
             $764 = $748 + 8 | 0; //@line 2818
             $765 = SAFE_HEAP_LOAD($764 | 0, 4, 0) | 0 | 0; //@line 2819
             $766 = ($765 | 0) == ($718 | 0); //@line 2820
             if ($766) {
              $$pre$phi11$i$iZ2D = $764; //@line 2822
              break;
             }
             _abort(); //@line 2825
            }
           } while (0);
           $767 = $746 + 12 | 0; //@line 2829
           SAFE_HEAP_STORE($767 | 0, $748 | 0, 4);
           SAFE_HEAP_STORE($$pre$phi11$i$iZ2D | 0, $746 | 0, 4);
          } else {
           $768 = $718 + 24 | 0; //@line 2833
           $769 = SAFE_HEAP_LOAD($768 | 0, 4, 0) | 0 | 0; //@line 2834
           $770 = $718 + 12 | 0; //@line 2835
           $771 = SAFE_HEAP_LOAD($770 | 0, 4, 0) | 0 | 0; //@line 2836
           $772 = ($771 | 0) == ($718 | 0); //@line 2837
           do {
            if ($772) {
             $782 = $718 + 16 | 0; //@line 2840
             $783 = $782 + 4 | 0; //@line 2841
             $784 = SAFE_HEAP_LOAD($783 | 0, 4, 0) | 0 | 0; //@line 2842
             $785 = ($784 | 0) == (0 | 0); //@line 2843
             if ($785) {
              $786 = SAFE_HEAP_LOAD($782 | 0, 4, 0) | 0 | 0; //@line 2845
              $787 = ($786 | 0) == (0 | 0); //@line 2846
              if ($787) {
               $$3$i$i = 0; //@line 2848
               break;
              } else {
               $$1291$i$i = $786; //@line 2851
               $$1293$i$i = $782; //@line 2851
              }
             } else {
              $$1291$i$i = $784; //@line 2854
              $$1293$i$i = $783; //@line 2854
             }
             while (1) {
              $788 = $$1291$i$i + 20 | 0; //@line 2857
              $789 = SAFE_HEAP_LOAD($788 | 0, 4, 0) | 0 | 0; //@line 2858
              $790 = ($789 | 0) == (0 | 0); //@line 2859
              if (!$790) {
               $$1291$i$i = $789; //@line 2861
               $$1293$i$i = $788; //@line 2861
               continue;
              }
              $791 = $$1291$i$i + 16 | 0; //@line 2864
              $792 = SAFE_HEAP_LOAD($791 | 0, 4, 0) | 0 | 0; //@line 2865
              $793 = ($792 | 0) == (0 | 0); //@line 2866
              if ($793) {
               break;
              } else {
               $$1291$i$i = $792; //@line 2870
               $$1293$i$i = $791; //@line 2870
              }
             }
             $794 = $753 >>> 0 > $$1293$i$i >>> 0; //@line 2873
             if ($794) {
              _abort(); //@line 2875
             } else {
              SAFE_HEAP_STORE($$1293$i$i | 0, 0 | 0, 4);
              $$3$i$i = $$1291$i$i; //@line 2879
              break;
             }
            } else {
             $773 = $718 + 8 | 0; //@line 2883
             $774 = SAFE_HEAP_LOAD($773 | 0, 4, 0) | 0 | 0; //@line 2884
             $775 = $753 >>> 0 > $774 >>> 0; //@line 2885
             if ($775) {
              _abort(); //@line 2887
             }
             $776 = $774 + 12 | 0; //@line 2890
             $777 = SAFE_HEAP_LOAD($776 | 0, 4, 0) | 0 | 0; //@line 2891
             $778 = ($777 | 0) == ($718 | 0); //@line 2892
             if (!$778) {
              _abort(); //@line 2894
             }
             $779 = $771 + 8 | 0; //@line 2897
             $780 = SAFE_HEAP_LOAD($779 | 0, 4, 0) | 0 | 0; //@line 2898
             $781 = ($780 | 0) == ($718 | 0); //@line 2899
             if ($781) {
              SAFE_HEAP_STORE($776 | 0, $771 | 0, 4);
              SAFE_HEAP_STORE($779 | 0, $774 | 0, 4);
              $$3$i$i = $771; //@line 2903
              break;
             } else {
              _abort(); //@line 2906
             }
            }
           } while (0);
           $795 = ($769 | 0) == (0 | 0); //@line 2911
           if ($795) {
            break;
           }
           $796 = $718 + 28 | 0; //@line 2915
           $797 = SAFE_HEAP_LOAD($796 | 0, 4, 0) | 0 | 0; //@line 2916
           $798 = 4256 + ($797 << 2) | 0; //@line 2917
           $799 = SAFE_HEAP_LOAD($798 | 0, 4, 0) | 0 | 0; //@line 2918
           $800 = ($799 | 0) == ($718 | 0); //@line 2919
           do {
            if ($800) {
             SAFE_HEAP_STORE($798 | 0, $$3$i$i | 0, 4);
             $cond$i$i = ($$3$i$i | 0) == (0 | 0); //@line 2923
             if (!$cond$i$i) {
              break;
             }
             $801 = 1 << $797; //@line 2927
             $802 = $801 ^ -1; //@line 2928
             $803 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 2929
             $804 = $803 & $802; //@line 2930
             SAFE_HEAP_STORE(3956 | 0, $804 | 0, 4);
             break L311;
            } else {
             $805 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2934
             $806 = $805 >>> 0 > $769 >>> 0; //@line 2935
             if ($806) {
              _abort(); //@line 2937
             } else {
              $807 = $769 + 16 | 0; //@line 2940
              $808 = SAFE_HEAP_LOAD($807 | 0, 4, 0) | 0 | 0; //@line 2941
              $809 = ($808 | 0) != ($718 | 0); //@line 2942
              $$sink1$i$i = $809 & 1; //@line 2943
              $810 = ($769 + 16 | 0) + ($$sink1$i$i << 2) | 0; //@line 2944
              SAFE_HEAP_STORE($810 | 0, $$3$i$i | 0, 4);
              $811 = ($$3$i$i | 0) == (0 | 0); //@line 2946
              if ($811) {
               break L311;
              } else {
               break;
              }
             }
            }
           } while (0);
           $812 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2955
           $813 = $812 >>> 0 > $$3$i$i >>> 0; //@line 2956
           if ($813) {
            _abort(); //@line 2958
           }
           $814 = $$3$i$i + 24 | 0; //@line 2961
           SAFE_HEAP_STORE($814 | 0, $769 | 0, 4);
           $815 = $718 + 16 | 0; //@line 2963
           $816 = SAFE_HEAP_LOAD($815 | 0, 4, 0) | 0 | 0; //@line 2964
           $817 = ($816 | 0) == (0 | 0); //@line 2965
           do {
            if (!$817) {
             $818 = $812 >>> 0 > $816 >>> 0; //@line 2968
             if ($818) {
              _abort(); //@line 2970
             } else {
              $819 = $$3$i$i + 16 | 0; //@line 2973
              SAFE_HEAP_STORE($819 | 0, $816 | 0, 4);
              $820 = $816 + 24 | 0; //@line 2975
              SAFE_HEAP_STORE($820 | 0, $$3$i$i | 0, 4);
              break;
             }
            }
           } while (0);
           $821 = $815 + 4 | 0; //@line 2981
           $822 = SAFE_HEAP_LOAD($821 | 0, 4, 0) | 0 | 0; //@line 2982
           $823 = ($822 | 0) == (0 | 0); //@line 2983
           if ($823) {
            break;
           }
           $824 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 2987
           $825 = $824 >>> 0 > $822 >>> 0; //@line 2988
           if ($825) {
            _abort(); //@line 2990
           } else {
            $826 = $$3$i$i + 20 | 0; //@line 2993
            SAFE_HEAP_STORE($826 | 0, $822 | 0, 4);
            $827 = $822 + 24 | 0; //@line 2995
            SAFE_HEAP_STORE($827 | 0, $$3$i$i | 0, 4);
            break;
           }
          }
         } while (0);
         $828 = $718 + $742 | 0; //@line 3001
         $829 = $742 + $723 | 0; //@line 3002
         $$0$i17$i = $828; //@line 3003
         $$0287$i$i = $829; //@line 3003
        } else {
         $$0$i17$i = $718; //@line 3005
         $$0287$i$i = $723; //@line 3005
        }
        $830 = $$0$i17$i + 4 | 0; //@line 3007
        $831 = SAFE_HEAP_LOAD($830 | 0, 4, 0) | 0 | 0; //@line 3008
        $832 = $831 & -2; //@line 3009
        SAFE_HEAP_STORE($830 | 0, $832 | 0, 4);
        $833 = $$0287$i$i | 1; //@line 3011
        $834 = $722 + 4 | 0; //@line 3012
        SAFE_HEAP_STORE($834 | 0, $833 | 0, 4);
        $835 = $722 + $$0287$i$i | 0; //@line 3014
        SAFE_HEAP_STORE($835 | 0, $$0287$i$i | 0, 4);
        $836 = $$0287$i$i >>> 3; //@line 3016
        $837 = $$0287$i$i >>> 0 < 256; //@line 3017
        if ($837) {
         $838 = $836 << 1; //@line 3019
         $839 = 3992 + ($838 << 2) | 0; //@line 3020
         $840 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 3021
         $841 = 1 << $836; //@line 3022
         $842 = $840 & $841; //@line 3023
         $843 = ($842 | 0) == 0; //@line 3024
         do {
          if ($843) {
           $844 = $840 | $841; //@line 3027
           SAFE_HEAP_STORE(988 * 4 | 0, $844 | 0, 4);
           $$pre$i18$i = $839 + 8 | 0; //@line 3029
           $$0295$i$i = $839; //@line 3030
           $$pre$phi$i19$iZ2D = $$pre$i18$i; //@line 3030
          } else {
           $845 = $839 + 8 | 0; //@line 3032
           $846 = SAFE_HEAP_LOAD($845 | 0, 4, 0) | 0 | 0; //@line 3033
           $847 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3034
           $848 = $847 >>> 0 > $846 >>> 0; //@line 3035
           if (!$848) {
            $$0295$i$i = $846; //@line 3037
            $$pre$phi$i19$iZ2D = $845; //@line 3037
            break;
           }
           _abort(); //@line 3040
          }
         } while (0);
         SAFE_HEAP_STORE($$pre$phi$i19$iZ2D | 0, $722 | 0, 4);
         $849 = $$0295$i$i + 12 | 0; //@line 3045
         SAFE_HEAP_STORE($849 | 0, $722 | 0, 4);
         $850 = $722 + 8 | 0; //@line 3047
         SAFE_HEAP_STORE($850 | 0, $$0295$i$i | 0, 4);
         $851 = $722 + 12 | 0; //@line 3049
         SAFE_HEAP_STORE($851 | 0, $839 | 0, 4);
         break;
        }
        $852 = $$0287$i$i >>> 8; //@line 3053
        $853 = ($852 | 0) == 0; //@line 3054
        do {
         if ($853) {
          $$0296$i$i = 0; //@line 3057
         } else {
          $854 = $$0287$i$i >>> 0 > 16777215; //@line 3059
          if ($854) {
           $$0296$i$i = 31; //@line 3061
           break;
          }
          $855 = $852 + 1048320 | 0; //@line 3064
          $856 = $855 >>> 16; //@line 3065
          $857 = $856 & 8; //@line 3066
          $858 = $852 << $857; //@line 3067
          $859 = $858 + 520192 | 0; //@line 3068
          $860 = $859 >>> 16; //@line 3069
          $861 = $860 & 4; //@line 3070
          $862 = $861 | $857; //@line 3071
          $863 = $858 << $861; //@line 3072
          $864 = $863 + 245760 | 0; //@line 3073
          $865 = $864 >>> 16; //@line 3074
          $866 = $865 & 2; //@line 3075
          $867 = $862 | $866; //@line 3076
          $868 = 14 - $867 | 0; //@line 3077
          $869 = $863 << $866; //@line 3078
          $870 = $869 >>> 15; //@line 3079
          $871 = $868 + $870 | 0; //@line 3080
          $872 = $871 << 1; //@line 3081
          $873 = $871 + 7 | 0; //@line 3082
          $874 = $$0287$i$i >>> $873; //@line 3083
          $875 = $874 & 1; //@line 3084
          $876 = $875 | $872; //@line 3085
          $$0296$i$i = $876; //@line 3086
         }
        } while (0);
        $877 = 4256 + ($$0296$i$i << 2) | 0; //@line 3089
        $878 = $722 + 28 | 0; //@line 3090
        SAFE_HEAP_STORE($878 | 0, $$0296$i$i | 0, 4);
        $879 = $722 + 16 | 0; //@line 3092
        $880 = $879 + 4 | 0; //@line 3093
        SAFE_HEAP_STORE($880 | 0, 0 | 0, 4);
        SAFE_HEAP_STORE($879 | 0, 0 | 0, 4);
        $881 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 3096
        $882 = 1 << $$0296$i$i; //@line 3097
        $883 = $881 & $882; //@line 3098
        $884 = ($883 | 0) == 0; //@line 3099
        if ($884) {
         $885 = $881 | $882; //@line 3101
         SAFE_HEAP_STORE(3956 | 0, $885 | 0, 4);
         SAFE_HEAP_STORE($877 | 0, $722 | 0, 4);
         $886 = $722 + 24 | 0; //@line 3104
         SAFE_HEAP_STORE($886 | 0, $877 | 0, 4);
         $887 = $722 + 12 | 0; //@line 3106
         SAFE_HEAP_STORE($887 | 0, $722 | 0, 4);
         $888 = $722 + 8 | 0; //@line 3108
         SAFE_HEAP_STORE($888 | 0, $722 | 0, 4);
         break;
        }
        $889 = SAFE_HEAP_LOAD($877 | 0, 4, 0) | 0 | 0; //@line 3112
        $890 = ($$0296$i$i | 0) == 31; //@line 3113
        $891 = $$0296$i$i >>> 1; //@line 3114
        $892 = 25 - $891 | 0; //@line 3115
        $893 = $890 ? 0 : $892; //@line 3116
        $894 = $$0287$i$i << $893; //@line 3117
        $$0288$i$i = $894; //@line 3118
        $$0289$i$i = $889; //@line 3118
        while (1) {
         $895 = $$0289$i$i + 4 | 0; //@line 3120
         $896 = SAFE_HEAP_LOAD($895 | 0, 4, 0) | 0 | 0; //@line 3121
         $897 = $896 & -8; //@line 3122
         $898 = ($897 | 0) == ($$0287$i$i | 0); //@line 3123
         if ($898) {
          label = 263; //@line 3125
          break;
         }
         $899 = $$0288$i$i >>> 31; //@line 3128
         $900 = ($$0289$i$i + 16 | 0) + ($899 << 2) | 0; //@line 3129
         $901 = $$0288$i$i << 1; //@line 3130
         $902 = SAFE_HEAP_LOAD($900 | 0, 4, 0) | 0 | 0; //@line 3131
         $903 = ($902 | 0) == (0 | 0); //@line 3132
         if ($903) {
          label = 260; //@line 3134
          break;
         } else {
          $$0288$i$i = $901; //@line 3137
          $$0289$i$i = $902; //@line 3137
         }
        }
        if ((label | 0) == 260) {
         $904 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3141
         $905 = $904 >>> 0 > $900 >>> 0; //@line 3142
         if ($905) {
          _abort(); //@line 3144
         } else {
          SAFE_HEAP_STORE($900 | 0, $722 | 0, 4);
          $906 = $722 + 24 | 0; //@line 3148
          SAFE_HEAP_STORE($906 | 0, $$0289$i$i | 0, 4);
          $907 = $722 + 12 | 0; //@line 3150
          SAFE_HEAP_STORE($907 | 0, $722 | 0, 4);
          $908 = $722 + 8 | 0; //@line 3152
          SAFE_HEAP_STORE($908 | 0, $722 | 0, 4);
          break;
         }
        } else if ((label | 0) == 263) {
         $909 = $$0289$i$i + 8 | 0; //@line 3158
         $910 = SAFE_HEAP_LOAD($909 | 0, 4, 0) | 0 | 0; //@line 3159
         $911 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3160
         $912 = $911 >>> 0 <= $$0289$i$i >>> 0; //@line 3161
         $913 = $911 >>> 0 <= $910 >>> 0; //@line 3162
         $914 = $913 & $912; //@line 3163
         if ($914) {
          $915 = $910 + 12 | 0; //@line 3165
          SAFE_HEAP_STORE($915 | 0, $722 | 0, 4);
          SAFE_HEAP_STORE($909 | 0, $722 | 0, 4);
          $916 = $722 + 8 | 0; //@line 3168
          SAFE_HEAP_STORE($916 | 0, $910 | 0, 4);
          $917 = $722 + 12 | 0; //@line 3170
          SAFE_HEAP_STORE($917 | 0, $$0289$i$i | 0, 4);
          $918 = $722 + 24 | 0; //@line 3172
          SAFE_HEAP_STORE($918 | 0, 0 | 0, 4);
          break;
         } else {
          _abort(); //@line 3176
         }
        }
       }
      } while (0);
      $1051 = $710 + 8 | 0; //@line 3182
      $$0 = $1051; //@line 3183
      STACKTOP = sp; //@line 3184
      return $$0 | 0; //@line 3184
     } else {
      $$0$i$i$i = 4400; //@line 3186
     }
    }
    while (1) {
     $919 = SAFE_HEAP_LOAD($$0$i$i$i | 0, 4, 0) | 0 | 0; //@line 3190
     $920 = $919 >>> 0 > $636 >>> 0; //@line 3191
     if (!$920) {
      $921 = $$0$i$i$i + 4 | 0; //@line 3193
      $922 = SAFE_HEAP_LOAD($921 | 0, 4, 0) | 0 | 0; //@line 3194
      $923 = $919 + $922 | 0; //@line 3195
      $924 = $923 >>> 0 > $636 >>> 0; //@line 3196
      if ($924) {
       break;
      }
     }
     $925 = $$0$i$i$i + 8 | 0; //@line 3201
     $926 = SAFE_HEAP_LOAD($925 | 0, 4, 0) | 0 | 0; //@line 3202
     $$0$i$i$i = $926; //@line 3203
    }
    $927 = $923 + -47 | 0; //@line 3205
    $928 = $927 + 8 | 0; //@line 3206
    $929 = $928; //@line 3207
    $930 = $929 & 7; //@line 3208
    $931 = ($930 | 0) == 0; //@line 3209
    $932 = 0 - $929 | 0; //@line 3210
    $933 = $932 & 7; //@line 3211
    $934 = $931 ? 0 : $933; //@line 3212
    $935 = $927 + $934 | 0; //@line 3213
    $936 = $636 + 16 | 0; //@line 3214
    $937 = $935 >>> 0 < $936 >>> 0; //@line 3215
    $938 = $937 ? $636 : $935; //@line 3216
    $939 = $938 + 8 | 0; //@line 3217
    $940 = $938 + 24 | 0; //@line 3218
    $941 = $$723947$i + -40 | 0; //@line 3219
    $942 = $$748$i + 8 | 0; //@line 3220
    $943 = $942; //@line 3221
    $944 = $943 & 7; //@line 3222
    $945 = ($944 | 0) == 0; //@line 3223
    $946 = 0 - $943 | 0; //@line 3224
    $947 = $946 & 7; //@line 3225
    $948 = $945 ? 0 : $947; //@line 3226
    $949 = $$748$i + $948 | 0; //@line 3227
    $950 = $941 - $948 | 0; //@line 3228
    SAFE_HEAP_STORE(3976 | 0, $949 | 0, 4);
    SAFE_HEAP_STORE(3964 | 0, $950 | 0, 4);
    $951 = $950 | 1; //@line 3231
    $952 = $949 + 4 | 0; //@line 3232
    SAFE_HEAP_STORE($952 | 0, $951 | 0, 4);
    $953 = $$748$i + $941 | 0; //@line 3234
    $954 = $953 + 4 | 0; //@line 3235
    SAFE_HEAP_STORE($954 | 0, 40 | 0, 4);
    $955 = SAFE_HEAP_LOAD(4440 | 0, 4, 0) | 0 | 0; //@line 3237
    SAFE_HEAP_STORE(3980 | 0, $955 | 0, 4);
    $956 = $938 + 4 | 0; //@line 3239
    SAFE_HEAP_STORE($956 | 0, 27 | 0, 4);
    SAFE_HEAP_STORE($939 | 0, SAFE_HEAP_LOAD(4400 | 0, 4, 0) | 0 | 0 | 0, 4);
    SAFE_HEAP_STORE($939 + 4 | 0, SAFE_HEAP_LOAD(4400 + 4 | 0, 4, 0) | 0 | 0 | 0, 4);
    SAFE_HEAP_STORE($939 + 8 | 0, SAFE_HEAP_LOAD(4400 + 8 | 0, 4, 0) | 0 | 0 | 0, 4);
    SAFE_HEAP_STORE($939 + 12 | 0, SAFE_HEAP_LOAD(4400 + 12 | 0, 4, 0) | 0 | 0 | 0, 4);
    SAFE_HEAP_STORE(4400 | 0, $$748$i | 0, 4);
    SAFE_HEAP_STORE(4404 | 0, $$723947$i | 0, 4);
    SAFE_HEAP_STORE(4412 | 0, 0 | 0, 4);
    SAFE_HEAP_STORE(4408 | 0, $939 | 0, 4);
    $958 = $940; //@line 3246
    while (1) {
     $957 = $958 + 4 | 0; //@line 3248
     SAFE_HEAP_STORE($957 | 0, 7 | 0, 4);
     $959 = $958 + 8 | 0; //@line 3250
     $960 = $959 >>> 0 < $923 >>> 0; //@line 3251
     if ($960) {
      $958 = $957; //@line 3253
     } else {
      break;
     }
    }
    $961 = ($938 | 0) == ($636 | 0); //@line 3258
    if (!$961) {
     $962 = $938; //@line 3260
     $963 = $636; //@line 3261
     $964 = $962 - $963 | 0; //@line 3262
     $965 = SAFE_HEAP_LOAD($956 | 0, 4, 0) | 0 | 0; //@line 3263
     $966 = $965 & -2; //@line 3264
     SAFE_HEAP_STORE($956 | 0, $966 | 0, 4);
     $967 = $964 | 1; //@line 3266
     $968 = $636 + 4 | 0; //@line 3267
     SAFE_HEAP_STORE($968 | 0, $967 | 0, 4);
     SAFE_HEAP_STORE($938 | 0, $964 | 0, 4);
     $969 = $964 >>> 3; //@line 3270
     $970 = $964 >>> 0 < 256; //@line 3271
     if ($970) {
      $971 = $969 << 1; //@line 3273
      $972 = 3992 + ($971 << 2) | 0; //@line 3274
      $973 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 3275
      $974 = 1 << $969; //@line 3276
      $975 = $973 & $974; //@line 3277
      $976 = ($975 | 0) == 0; //@line 3278
      if ($976) {
       $977 = $973 | $974; //@line 3280
       SAFE_HEAP_STORE(988 * 4 | 0, $977 | 0, 4);
       $$pre$i$i = $972 + 8 | 0; //@line 3282
       $$0211$i$i = $972; //@line 3283
       $$pre$phi$i$iZ2D = $$pre$i$i; //@line 3283
      } else {
       $978 = $972 + 8 | 0; //@line 3285
       $979 = SAFE_HEAP_LOAD($978 | 0, 4, 0) | 0 | 0; //@line 3286
       $980 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3287
       $981 = $980 >>> 0 > $979 >>> 0; //@line 3288
       if ($981) {
        _abort(); //@line 3290
       } else {
        $$0211$i$i = $979; //@line 3293
        $$pre$phi$i$iZ2D = $978; //@line 3293
       }
      }
      SAFE_HEAP_STORE($$pre$phi$i$iZ2D | 0, $636 | 0, 4);
      $982 = $$0211$i$i + 12 | 0; //@line 3297
      SAFE_HEAP_STORE($982 | 0, $636 | 0, 4);
      $983 = $636 + 8 | 0; //@line 3299
      SAFE_HEAP_STORE($983 | 0, $$0211$i$i | 0, 4);
      $984 = $636 + 12 | 0; //@line 3301
      SAFE_HEAP_STORE($984 | 0, $972 | 0, 4);
      break;
     }
     $985 = $964 >>> 8; //@line 3305
     $986 = ($985 | 0) == 0; //@line 3306
     if ($986) {
      $$0212$i$i = 0; //@line 3308
     } else {
      $987 = $964 >>> 0 > 16777215; //@line 3310
      if ($987) {
       $$0212$i$i = 31; //@line 3312
      } else {
       $988 = $985 + 1048320 | 0; //@line 3314
       $989 = $988 >>> 16; //@line 3315
       $990 = $989 & 8; //@line 3316
       $991 = $985 << $990; //@line 3317
       $992 = $991 + 520192 | 0; //@line 3318
       $993 = $992 >>> 16; //@line 3319
       $994 = $993 & 4; //@line 3320
       $995 = $994 | $990; //@line 3321
       $996 = $991 << $994; //@line 3322
       $997 = $996 + 245760 | 0; //@line 3323
       $998 = $997 >>> 16; //@line 3324
       $999 = $998 & 2; //@line 3325
       $1000 = $995 | $999; //@line 3326
       $1001 = 14 - $1000 | 0; //@line 3327
       $1002 = $996 << $999; //@line 3328
       $1003 = $1002 >>> 15; //@line 3329
       $1004 = $1001 + $1003 | 0; //@line 3330
       $1005 = $1004 << 1; //@line 3331
       $1006 = $1004 + 7 | 0; //@line 3332
       $1007 = $964 >>> $1006; //@line 3333
       $1008 = $1007 & 1; //@line 3334
       $1009 = $1008 | $1005; //@line 3335
       $$0212$i$i = $1009; //@line 3336
      }
     }
     $1010 = 4256 + ($$0212$i$i << 2) | 0; //@line 3339
     $1011 = $636 + 28 | 0; //@line 3340
     SAFE_HEAP_STORE($1011 | 0, $$0212$i$i | 0, 4);
     $1012 = $636 + 20 | 0; //@line 3342
     SAFE_HEAP_STORE($1012 | 0, 0 | 0, 4);
     SAFE_HEAP_STORE($936 | 0, 0 | 0, 4);
     $1013 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 3345
     $1014 = 1 << $$0212$i$i; //@line 3346
     $1015 = $1013 & $1014; //@line 3347
     $1016 = ($1015 | 0) == 0; //@line 3348
     if ($1016) {
      $1017 = $1013 | $1014; //@line 3350
      SAFE_HEAP_STORE(3956 | 0, $1017 | 0, 4);
      SAFE_HEAP_STORE($1010 | 0, $636 | 0, 4);
      $1018 = $636 + 24 | 0; //@line 3353
      SAFE_HEAP_STORE($1018 | 0, $1010 | 0, 4);
      $1019 = $636 + 12 | 0; //@line 3355
      SAFE_HEAP_STORE($1019 | 0, $636 | 0, 4);
      $1020 = $636 + 8 | 0; //@line 3357
      SAFE_HEAP_STORE($1020 | 0, $636 | 0, 4);
      break;
     }
     $1021 = SAFE_HEAP_LOAD($1010 | 0, 4, 0) | 0 | 0; //@line 3361
     $1022 = ($$0212$i$i | 0) == 31; //@line 3362
     $1023 = $$0212$i$i >>> 1; //@line 3363
     $1024 = 25 - $1023 | 0; //@line 3364
     $1025 = $1022 ? 0 : $1024; //@line 3365
     $1026 = $964 << $1025; //@line 3366
     $$0206$i$i = $1026; //@line 3367
     $$0207$i$i = $1021; //@line 3367
     while (1) {
      $1027 = $$0207$i$i + 4 | 0; //@line 3369
      $1028 = SAFE_HEAP_LOAD($1027 | 0, 4, 0) | 0 | 0; //@line 3370
      $1029 = $1028 & -8; //@line 3371
      $1030 = ($1029 | 0) == ($964 | 0); //@line 3372
      if ($1030) {
       label = 289; //@line 3374
       break;
      }
      $1031 = $$0206$i$i >>> 31; //@line 3377
      $1032 = ($$0207$i$i + 16 | 0) + ($1031 << 2) | 0; //@line 3378
      $1033 = $$0206$i$i << 1; //@line 3379
      $1034 = SAFE_HEAP_LOAD($1032 | 0, 4, 0) | 0 | 0; //@line 3380
      $1035 = ($1034 | 0) == (0 | 0); //@line 3381
      if ($1035) {
       label = 286; //@line 3383
       break;
      } else {
       $$0206$i$i = $1033; //@line 3386
       $$0207$i$i = $1034; //@line 3386
      }
     }
     if ((label | 0) == 286) {
      $1036 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3390
      $1037 = $1036 >>> 0 > $1032 >>> 0; //@line 3391
      if ($1037) {
       _abort(); //@line 3393
      } else {
       SAFE_HEAP_STORE($1032 | 0, $636 | 0, 4);
       $1038 = $636 + 24 | 0; //@line 3397
       SAFE_HEAP_STORE($1038 | 0, $$0207$i$i | 0, 4);
       $1039 = $636 + 12 | 0; //@line 3399
       SAFE_HEAP_STORE($1039 | 0, $636 | 0, 4);
       $1040 = $636 + 8 | 0; //@line 3401
       SAFE_HEAP_STORE($1040 | 0, $636 | 0, 4);
       break;
      }
     } else if ((label | 0) == 289) {
      $1041 = $$0207$i$i + 8 | 0; //@line 3407
      $1042 = SAFE_HEAP_LOAD($1041 | 0, 4, 0) | 0 | 0; //@line 3408
      $1043 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3409
      $1044 = $1043 >>> 0 <= $$0207$i$i >>> 0; //@line 3410
      $1045 = $1043 >>> 0 <= $1042 >>> 0; //@line 3411
      $1046 = $1045 & $1044; //@line 3412
      if ($1046) {
       $1047 = $1042 + 12 | 0; //@line 3414
       SAFE_HEAP_STORE($1047 | 0, $636 | 0, 4);
       SAFE_HEAP_STORE($1041 | 0, $636 | 0, 4);
       $1048 = $636 + 8 | 0; //@line 3417
       SAFE_HEAP_STORE($1048 | 0, $1042 | 0, 4);
       $1049 = $636 + 12 | 0; //@line 3419
       SAFE_HEAP_STORE($1049 | 0, $$0207$i$i | 0, 4);
       $1050 = $636 + 24 | 0; //@line 3421
       SAFE_HEAP_STORE($1050 | 0, 0 | 0, 4);
       break;
      } else {
       _abort(); //@line 3425
      }
     }
    }
   }
  } while (0);
  $1052 = SAFE_HEAP_LOAD(3964 | 0, 4, 0) | 0 | 0; //@line 3432
  $1053 = $1052 >>> 0 > $$0197 >>> 0; //@line 3433
  if ($1053) {
   $1054 = $1052 - $$0197 | 0; //@line 3435
   SAFE_HEAP_STORE(3964 | 0, $1054 | 0, 4);
   $1055 = SAFE_HEAP_LOAD(3976 | 0, 4, 0) | 0 | 0; //@line 3437
   $1056 = $1055 + $$0197 | 0; //@line 3438
   SAFE_HEAP_STORE(3976 | 0, $1056 | 0, 4);
   $1057 = $1054 | 1; //@line 3440
   $1058 = $1056 + 4 | 0; //@line 3441
   SAFE_HEAP_STORE($1058 | 0, $1057 | 0, 4);
   $1059 = $$0197 | 3; //@line 3443
   $1060 = $1055 + 4 | 0; //@line 3444
   SAFE_HEAP_STORE($1060 | 0, $1059 | 0, 4);
   $1061 = $1055 + 8 | 0; //@line 3446
   $$0 = $1061; //@line 3447
   STACKTOP = sp; //@line 3448
   return $$0 | 0; //@line 3448
  }
 }
 $1062 = ___errno_location() | 0; //@line 3451
 SAFE_HEAP_STORE($1062 | 0, 12 | 0, 4);
 $$0 = 0; //@line 3453
 STACKTOP = sp; //@line 3454
 return $$0 | 0; //@line 3454
}
function _fmt_fp($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0; //@line 6133
 $1 = +$1; //@line 6134
 $2 = $2 | 0; //@line 6135
 $3 = $3 | 0; //@line 6136
 $4 = $4 | 0; //@line 6137
 $5 = $5 | 0; //@line 6138
 var $$ = 0, $$$ = 0, $$$$564 = 0.0, $$$3484 = 0, $$$3484699 = 0, $$$3484700 = 0, $$$3501 = 0, $$$4502 = 0, $$$543 = 0.0, $$$564 = 0.0, $$0 = 0, $$0463$lcssa = 0, $$0463587 = 0, $$0464597 = 0, $$0471 = 0.0, $$0479 = 0, $$0487644 = 0, $$0488 = 0, $$0488655 = 0, $$0488657 = 0; //@line 6139
 var $$0496$$9 = 0, $$0497656 = 0, $$0498 = 0, $$0509585 = 0.0, $$0510 = 0, $$0511 = 0, $$0514639 = 0, $$0520 = 0, $$0521 = 0, $$0521$ = 0, $$0523 = 0, $$0527 = 0, $$0527$in633 = 0, $$0530638 = 0, $$1465 = 0, $$1467 = 0.0, $$1469 = 0.0, $$1472 = 0.0, $$1480 = 0, $$1482$lcssa = 0; //@line 6140
 var $$1482663 = 0, $$1489643 = 0, $$1499$lcssa = 0, $$1499662 = 0, $$1508586 = 0, $$1512$lcssa = 0, $$1512610 = 0, $$1515 = 0, $$1524 = 0, $$1526 = 0, $$1528617 = 0, $$1531$lcssa = 0, $$1531632 = 0, $$1601 = 0, $$2 = 0, $$2473 = 0.0, $$2476 = 0, $$2476$$549 = 0, $$2476$$551 = 0, $$2483$ph = 0; //@line 6141
 var $$2500 = 0, $$2513 = 0, $$2516621 = 0, $$2529 = 0, $$2532620 = 0, $$3 = 0.0, $$3477 = 0, $$3484$lcssa = 0, $$3484650 = 0, $$3501$lcssa = 0, $$3501649 = 0, $$3533616 = 0, $$4 = 0.0, $$4478$lcssa = 0, $$4478593 = 0, $$4492 = 0, $$4502 = 0, $$4518 = 0, $$5$lcssa = 0, $$534$ = 0; //@line 6142
 var $$540 = 0, $$540$ = 0, $$543 = 0.0, $$548 = 0, $$5486$lcssa = 0, $$5486626 = 0, $$5493600 = 0, $$550 = 0, $$5519$ph = 0, $$557 = 0, $$5605 = 0, $$561 = 0, $$564 = 0.0, $$6 = 0, $$6494592 = 0, $$7495604 = 0, $$7505 = 0, $$7505$ = 0, $$7505$ph = 0, $$8 = 0; //@line 6143
 var $$9$ph = 0, $$lcssa675 = 0, $$neg = 0, $$neg568 = 0, $$pn = 0, $$pr = 0, $$pr566 = 0, $$pre = 0, $$pre$phi691Z2D = 0, $$pre$phi698Z2D = 0, $$pre690 = 0, $$pre693 = 0, $$pre697 = 0, $$sink = 0, $$sink547$lcssa = 0, $$sink547625 = 0, $$sink560 = 0, $10 = 0, $100 = 0, $101 = 0; //@line 6144
 var $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0.0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0.0, $119 = 0.0, $12 = 0; //@line 6145
 var $120 = 0.0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0;
 var $139 = 0, $14 = 0.0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0; //@line 6147
 var $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0; //@line 6148
 var $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0; //@line 6149
 var $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0; //@line 6150
 var $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0; //@line 6151
 var $23 = 0, $230 = 0, $231 = 0.0, $232 = 0.0, $233 = 0, $234 = 0.0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0; //@line 6152
 var $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0; //@line 6153
 var $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0; //@line 6154
 var $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0; //@line 6155
 var $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0; //@line 6156
 var $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0; //@line 6157
 var $339 = 0, $34 = 0.0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0; //@line 6158
 var $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0; //@line 6159
 var $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $40 = 0; //@line 6160
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0; //@line 6161
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0; //@line 6162
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0; //@line 6163
 var $97 = 0, $98 = 0, $99 = 0, $not$ = 0, $or$cond = 0, $or$cond3$not = 0, $or$cond542 = 0, $or$cond545 = 0, $or$cond556 = 0, $or$cond6 = 0, $scevgep686 = 0, $scevgep686687 = 0, label = 0, sp = 0; //@line 6164
 sp = STACKTOP; //@line 6165
 STACKTOP = STACKTOP + 560 | 0; //@line 6166
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(560 | 0); //@line 6166
 $6 = sp + 8 | 0; //@line 6167
 $7 = sp; //@line 6168
 $8 = sp + 524 | 0; //@line 6169
 $9 = $8; //@line 6170
 $10 = sp + 512 | 0; //@line 6171
 SAFE_HEAP_STORE($7 | 0, 0 | 0, 4);
 $11 = $10 + 12 | 0; //@line 6173
 ___DOUBLE_BITS_670($1) | 0; //@line 6174
 $12 = tempRet0; //@line 6175
 $13 = ($12 | 0) < 0; //@line 6176
 if ($13) {
  $14 = -$1; //@line 6178
  $$0471 = $14; //@line 6179
  $$0520 = 1; //@line 6179
  $$0521 = 1345; //@line 6179
 } else {
  $15 = $4 & 2048; //@line 6181
  $16 = ($15 | 0) == 0; //@line 6182
  $17 = $4 & 1; //@line 6183
  $18 = ($17 | 0) == 0; //@line 6184
  $$ = $18 ? 1346 : 1351; //@line 6185
  $$$ = $16 ? $$ : 1348; //@line 6186
  $19 = $4 & 2049; //@line 6187
  $20 = ($19 | 0) != 0; //@line 6188
  $$534$ = $20 & 1; //@line 6189
  $$0471 = $1; //@line 6190
  $$0520 = $$534$; //@line 6190
  $$0521 = $$$; //@line 6190
 }
 ___DOUBLE_BITS_670($$0471) | 0; //@line 6192
 $21 = tempRet0; //@line 6193
 $22 = $21 & 2146435072; //@line 6194
 $23 = 0 == 0; //@line 6195
 $24 = ($22 | 0) == 2146435072; //@line 6196
 $25 = $23 & $24; //@line 6197
 do {
  if ($25) {
   $26 = $5 & 32; //@line 6200
   $27 = ($26 | 0) != 0; //@line 6201
   $28 = $27 ? 1364 : 1368; //@line 6202
   $29 = $$0471 != $$0471 | 0.0 != 0.0; //@line 6203
   $30 = $27 ? 1372 : 1376; //@line 6204
   $$0510 = $29 ? $30 : $28; //@line 6205
   $31 = $$0520 + 3 | 0; //@line 6206
   $32 = $4 & -65537; //@line 6207
   _pad_669($0, 32, $2, $31, $32); //@line 6208
   _out($0, $$0521, $$0520); //@line 6209
   _out($0, $$0510, 3); //@line 6210
   $33 = $4 ^ 8192; //@line 6211
   _pad_669($0, 32, $2, $31, $33); //@line 6212
   $$sink560 = $31; //@line 6213
  } else {
   $34 = +_frexpl($$0471, $7); //@line 6215
   $35 = $34 * 2.0; //@line 6216
   $36 = $35 != 0.0; //@line 6217
   if ($36) {
    $37 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6219
    $38 = $37 + -1 | 0; //@line 6220
    SAFE_HEAP_STORE($7 | 0, $38 | 0, 4);
   }
   $39 = $5 | 32; //@line 6223
   $40 = ($39 | 0) == 97; //@line 6224
   if ($40) {
    $41 = $5 & 32; //@line 6226
    $42 = ($41 | 0) == 0; //@line 6227
    $43 = $$0521 + 9 | 0; //@line 6228
    $$0521$ = $42 ? $$0521 : $43; //@line 6229
    $44 = $$0520 | 2; //@line 6230
    $45 = $3 >>> 0 > 11; //@line 6231
    $46 = 12 - $3 | 0; //@line 6232
    $47 = ($46 | 0) == 0; //@line 6233
    $48 = $45 | $47; //@line 6234
    do {
     if ($48) {
      $$1472 = $35; //@line 6237
     } else {
      $$0509585 = 8.0; //@line 6239
      $$1508586 = $46; //@line 6239
      while (1) {
       $49 = $$1508586 + -1 | 0; //@line 6241
       $50 = $$0509585 * 16.0; //@line 6242
       $51 = ($49 | 0) == 0; //@line 6243
       if ($51) {
        break;
       } else {
        $$0509585 = $50; //@line 6247
        $$1508586 = $49; //@line 6247
       }
      }
      $52 = SAFE_HEAP_LOAD($$0521$ >> 0 | 0, 1, 0) | 0 | 0; //@line 6250
      $53 = $52 << 24 >> 24 == 45; //@line 6251
      if ($53) {
       $54 = -$35; //@line 6253
       $55 = $54 - $50; //@line 6254
       $56 = $50 + $55; //@line 6255
       $57 = -$56; //@line 6256
       $$1472 = $57; //@line 6257
       break;
      } else {
       $58 = $35 + $50; //@line 6260
       $59 = $58 - $50; //@line 6261
       $$1472 = $59; //@line 6262
       break;
      }
     }
    } while (0);
    $60 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6267
    $61 = ($60 | 0) < 0; //@line 6268
    $62 = 0 - $60 | 0; //@line 6269
    $63 = $61 ? $62 : $60; //@line 6270
    $64 = ($63 | 0) < 0; //@line 6271
    $65 = $64 << 31 >> 31; //@line 6272
    $66 = _fmt_u($63, $65, $11) | 0; //@line 6273
    $67 = ($66 | 0) == ($11 | 0); //@line 6274
    if ($67) {
     $68 = $10 + 11 | 0; //@line 6276
     SAFE_HEAP_STORE($68 >> 0 | 0, 48 | 0, 1);
     $$0511 = $68; //@line 6278
    } else {
     $$0511 = $66; //@line 6280
    }
    $69 = $60 >> 31; //@line 6282
    $70 = $69 & 2; //@line 6283
    $71 = $70 + 43 | 0; //@line 6284
    $72 = $71 & 255; //@line 6285
    $73 = $$0511 + -1 | 0; //@line 6286
    SAFE_HEAP_STORE($73 >> 0 | 0, $72 | 0, 1);
    $74 = $5 + 15 | 0; //@line 6288
    $75 = $74 & 255; //@line 6289
    $76 = $$0511 + -2 | 0; //@line 6290
    SAFE_HEAP_STORE($76 >> 0 | 0, $75 | 0, 1);
    $77 = ($3 | 0) < 1; //@line 6292
    $78 = $4 & 8; //@line 6293
    $79 = ($78 | 0) == 0; //@line 6294
    $$0523 = $8; //@line 6295
    $$2473 = $$1472; //@line 6295
    while (1) {
     $80 = ~~$$2473; //@line 6297
     $81 = 1380 + $80 | 0; //@line 6298
     $82 = SAFE_HEAP_LOAD($81 >> 0 | 0, 1, 0) | 0 | 0; //@line 6299
     $83 = $82 & 255; //@line 6300
     $84 = $41 | $83; //@line 6301
     $85 = $84 & 255; //@line 6302
     $86 = $$0523 + 1 | 0; //@line 6303
     SAFE_HEAP_STORE($$0523 >> 0 | 0, $85 | 0, 1);
     $87 = +($80 | 0); //@line 6305
     $88 = $$2473 - $87; //@line 6306
     $89 = $88 * 16.0; //@line 6307
     $90 = $86; //@line 6308
     $91 = $90 - $9 | 0; //@line 6309
     $92 = ($91 | 0) == 1; //@line 6310
     if ($92) {
      $93 = $89 == 0.0; //@line 6312
      $or$cond3$not = $77 & $93; //@line 6313
      $or$cond = $79 & $or$cond3$not; //@line 6314
      if ($or$cond) {
       $$1524 = $86; //@line 6316
      } else {
       $94 = $$0523 + 2 | 0; //@line 6318
       SAFE_HEAP_STORE($86 >> 0 | 0, 46 | 0, 1);
       $$1524 = $94; //@line 6320
      }
     } else {
      $$1524 = $86; //@line 6323
     }
     $95 = $89 != 0.0; //@line 6325
     if ($95) {
      $$0523 = $$1524; //@line 6327
      $$2473 = $89; //@line 6327
     } else {
      break;
     }
    }
    $96 = ($3 | 0) == 0; //@line 6332
    $$pre693 = $$1524; //@line 6333
    if ($96) {
     label = 24; //@line 6335
    } else {
     $97 = -2 - $9 | 0; //@line 6337
     $98 = $97 + $$pre693 | 0; //@line 6338
     $99 = ($98 | 0) < ($3 | 0); //@line 6339
     if ($99) {
      $100 = $3 + 2 | 0; //@line 6341
      $$pre690 = $$pre693 - $9 | 0; //@line 6342
      $$pre$phi691Z2D = $$pre690; //@line 6343
      $$sink = $100; //@line 6343
     } else {
      label = 24; //@line 6345
     }
    }
    if ((label | 0) == 24) {
     $101 = $$pre693 - $9 | 0; //@line 6349
     $$pre$phi691Z2D = $101; //@line 6350
     $$sink = $101; //@line 6350
    }
    $102 = $11; //@line 6352
    $103 = $76; //@line 6353
    $104 = $102 - $103 | 0; //@line 6354
    $105 = $104 + $44 | 0; //@line 6355
    $106 = $105 + $$sink | 0; //@line 6356
    _pad_669($0, 32, $2, $106, $4); //@line 6357
    _out($0, $$0521$, $44); //@line 6358
    $107 = $4 ^ 65536; //@line 6359
    _pad_669($0, 48, $2, $106, $107); //@line 6360
    _out($0, $8, $$pre$phi691Z2D); //@line 6361
    $108 = $$sink - $$pre$phi691Z2D | 0; //@line 6362
    _pad_669($0, 48, $108, 0, 0); //@line 6363
    _out($0, $76, $104); //@line 6364
    $109 = $4 ^ 8192; //@line 6365
    _pad_669($0, 32, $2, $106, $109); //@line 6366
    $$sink560 = $106; //@line 6367
    break;
   }
   $110 = ($3 | 0) < 0; //@line 6370
   $$540 = $110 ? 6 : $3; //@line 6371
   if ($36) {
    $111 = $35 * 268435456.0; //@line 6373
    $112 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6374
    $113 = $112 + -28 | 0; //@line 6375
    SAFE_HEAP_STORE($7 | 0, $113 | 0, 4);
    $$3 = $111; //@line 6377
    $$pr = $113; //@line 6377
   } else {
    $$pre = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6379
    $$3 = $35; //@line 6380
    $$pr = $$pre; //@line 6380
   }
   $114 = ($$pr | 0) < 0; //@line 6382
   $115 = $6 + 288 | 0; //@line 6383
   $$561 = $114 ? $6 : $115; //@line 6384
   $$0498 = $$561; //@line 6385
   $$4 = $$3; //@line 6385
   while (1) {
    $116 = ~~$$4 >>> 0; //@line 6387
    SAFE_HEAP_STORE($$0498 | 0, $116 | 0, 4);
    $117 = $$0498 + 4 | 0; //@line 6389
    $118 = +($116 >>> 0); //@line 6390
    $119 = $$4 - $118; //@line 6391
    $120 = $119 * 1.0e9; //@line 6392
    $121 = $120 != 0.0; //@line 6393
    if ($121) {
     $$0498 = $117; //@line 6395
     $$4 = $120; //@line 6395
    } else {
     break;
    }
   }
   $122 = ($$pr | 0) > 0; //@line 6400
   if ($122) {
    $$1482663 = $$561; //@line 6402
    $$1499662 = $117; //@line 6402
    $124 = $$pr; //@line 6402
    while (1) {
     $123 = ($124 | 0) < 29; //@line 6404
     $125 = $123 ? $124 : 29; //@line 6405
     $$0488655 = $$1499662 + -4 | 0; //@line 6406
     $126 = $$0488655 >>> 0 < $$1482663 >>> 0; //@line 6407
     if ($126) {
      $$2483$ph = $$1482663; //@line 6409
     } else {
      $$0488657 = $$0488655; //@line 6411
      $$0497656 = 0; //@line 6411
      while (1) {
       $127 = SAFE_HEAP_LOAD($$0488657 | 0, 4, 0) | 0 | 0; //@line 6413
       $128 = _bitshift64Shl($127 | 0, 0, $125 | 0) | 0; //@line 6414
       $129 = tempRet0; //@line 6415
       $130 = _i64Add($128 | 0, $129 | 0, $$0497656 | 0, 0) | 0; //@line 6416
       $131 = tempRet0; //@line 6417
       $132 = ___uremdi3($130 | 0, $131 | 0, 1e9, 0) | 0; //@line 6418
       $133 = tempRet0; //@line 6419
       SAFE_HEAP_STORE($$0488657 | 0, $132 | 0, 4);
       $134 = ___udivdi3($130 | 0, $131 | 0, 1e9, 0) | 0; //@line 6421
       $135 = tempRet0; //@line 6422
       $$0488 = $$0488657 + -4 | 0; //@line 6423
       $136 = $$0488 >>> 0 < $$1482663 >>> 0; //@line 6424
       if ($136) {
        break;
       } else {
        $$0488657 = $$0488; //@line 6428
        $$0497656 = $134; //@line 6428
       }
      }
      $137 = ($134 | 0) == 0; //@line 6431
      if ($137) {
       $$2483$ph = $$1482663; //@line 6433
      } else {
       $138 = $$1482663 + -4 | 0; //@line 6435
       SAFE_HEAP_STORE($138 | 0, $134 | 0, 4);
       $$2483$ph = $138; //@line 6437
      }
     }
     $$2500 = $$1499662; //@line 6440
     while (1) {
      $139 = $$2500 >>> 0 > $$2483$ph >>> 0; //@line 6442
      if (!$139) {
       break;
      }
      $140 = $$2500 + -4 | 0; //@line 6446
      $141 = SAFE_HEAP_LOAD($140 | 0, 4, 0) | 0 | 0; //@line 6447
      $142 = ($141 | 0) == 0; //@line 6448
      if ($142) {
       $$2500 = $140; //@line 6450
      } else {
       break;
      }
     }
     $143 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6455
     $144 = $143 - $125 | 0; //@line 6456
     SAFE_HEAP_STORE($7 | 0, $144 | 0, 4);
     $145 = ($144 | 0) > 0; //@line 6458
     if ($145) {
      $$1482663 = $$2483$ph; //@line 6460
      $$1499662 = $$2500; //@line 6460
      $124 = $144; //@line 6460
     } else {
      $$1482$lcssa = $$2483$ph; //@line 6462
      $$1499$lcssa = $$2500; //@line 6462
      $$pr566 = $144; //@line 6462
      break;
     }
    }
   } else {
    $$1482$lcssa = $$561; //@line 6467
    $$1499$lcssa = $117; //@line 6467
    $$pr566 = $$pr; //@line 6467
   }
   $146 = ($$pr566 | 0) < 0; //@line 6469
   if ($146) {
    $147 = $$540 + 25 | 0; //@line 6471
    $148 = ($147 | 0) / 9 & -1; //@line 6472
    $149 = $148 + 1 | 0; //@line 6473
    $150 = ($39 | 0) == 102; //@line 6474
    $$3484650 = $$1482$lcssa; //@line 6475
    $$3501649 = $$1499$lcssa; //@line 6475
    $152 = $$pr566; //@line 6475
    while (1) {
     $151 = 0 - $152 | 0; //@line 6477
     $153 = ($151 | 0) < 9; //@line 6478
     $154 = $153 ? $151 : 9; //@line 6479
     $155 = $$3484650 >>> 0 < $$3501649 >>> 0; //@line 6480
     if ($155) {
      $159 = 1 << $154; //@line 6482
      $160 = $159 + -1 | 0; //@line 6483
      $161 = 1e9 >>> $154; //@line 6484
      $$0487644 = 0; //@line 6485
      $$1489643 = $$3484650; //@line 6485
      while (1) {
       $162 = SAFE_HEAP_LOAD($$1489643 | 0, 4, 0) | 0 | 0; //@line 6487
       $163 = $162 & $160; //@line 6488
       $164 = $162 >>> $154; //@line 6489
       $165 = $164 + $$0487644 | 0; //@line 6490
       SAFE_HEAP_STORE($$1489643 | 0, $165 | 0, 4);
       $166 = Math_imul($163, $161) | 0; //@line 6492
       $167 = $$1489643 + 4 | 0; //@line 6493
       $168 = $167 >>> 0 < $$3501649 >>> 0; //@line 6494
       if ($168) {
        $$0487644 = $166; //@line 6496
        $$1489643 = $167; //@line 6496
       } else {
        break;
       }
      }
      $169 = SAFE_HEAP_LOAD($$3484650 | 0, 4, 0) | 0 | 0; //@line 6501
      $170 = ($169 | 0) == 0; //@line 6502
      $171 = $$3484650 + 4 | 0; //@line 6503
      $$$3484 = $170 ? $171 : $$3484650; //@line 6504
      $172 = ($166 | 0) == 0; //@line 6505
      if ($172) {
       $$$3484700 = $$$3484; //@line 6507
       $$4502 = $$3501649; //@line 6507
      } else {
       $173 = $$3501649 + 4 | 0; //@line 6509
       SAFE_HEAP_STORE($$3501649 | 0, $166 | 0, 4);
       $$$3484700 = $$$3484; //@line 6511
       $$4502 = $173; //@line 6511
      }
     } else {
      $156 = SAFE_HEAP_LOAD($$3484650 | 0, 4, 0) | 0 | 0; //@line 6514
      $157 = ($156 | 0) == 0; //@line 6515
      $158 = $$3484650 + 4 | 0; //@line 6516
      $$$3484699 = $157 ? $158 : $$3484650; //@line 6517
      $$$3484700 = $$$3484699; //@line 6518
      $$4502 = $$3501649; //@line 6518
     }
     $174 = $150 ? $$561 : $$$3484700; //@line 6520
     $175 = $$4502; //@line 6521
     $176 = $174; //@line 6522
     $177 = $175 - $176 | 0; //@line 6523
     $178 = $177 >> 2; //@line 6524
     $179 = ($178 | 0) > ($149 | 0); //@line 6525
     $180 = $174 + ($149 << 2) | 0; //@line 6526
     $$$4502 = $179 ? $180 : $$4502; //@line 6527
     $181 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 6528
     $182 = $181 + $154 | 0; //@line 6529
     SAFE_HEAP_STORE($7 | 0, $182 | 0, 4);
     $183 = ($182 | 0) < 0; //@line 6531
     if ($183) {
      $$3484650 = $$$3484700; //@line 6533
      $$3501649 = $$$4502; //@line 6533
      $152 = $182; //@line 6533
     } else {
      $$3484$lcssa = $$$3484700; //@line 6535
      $$3501$lcssa = $$$4502; //@line 6535
      break;
     }
    }
   } else {
    $$3484$lcssa = $$1482$lcssa; //@line 6540
    $$3501$lcssa = $$1499$lcssa; //@line 6540
   }
   $184 = $$3484$lcssa >>> 0 < $$3501$lcssa >>> 0; //@line 6542
   $185 = $$561; //@line 6543
   if ($184) {
    $186 = $$3484$lcssa; //@line 6545
    $187 = $185 - $186 | 0; //@line 6546
    $188 = $187 >> 2; //@line 6547
    $189 = $188 * 9 | 0; //@line 6548
    $190 = SAFE_HEAP_LOAD($$3484$lcssa | 0, 4, 0) | 0 | 0; //@line 6549
    $191 = $190 >>> 0 < 10; //@line 6550
    if ($191) {
     $$1515 = $189; //@line 6552
    } else {
     $$0514639 = $189; //@line 6554
     $$0530638 = 10; //@line 6554
     while (1) {
      $192 = $$0530638 * 10 | 0; //@line 6556
      $193 = $$0514639 + 1 | 0; //@line 6557
      $194 = $190 >>> 0 < $192 >>> 0; //@line 6558
      if ($194) {
       $$1515 = $193; //@line 6560
       break;
      } else {
       $$0514639 = $193; //@line 6563
       $$0530638 = $192; //@line 6563
      }
     }
    }
   } else {
    $$1515 = 0; //@line 6568
   }
   $195 = ($39 | 0) != 102; //@line 6570
   $196 = $195 ? $$1515 : 0; //@line 6571
   $197 = $$540 - $196 | 0; //@line 6572
   $198 = ($39 | 0) == 103; //@line 6573
   $199 = ($$540 | 0) != 0; //@line 6574
   $200 = $199 & $198; //@line 6575
   $$neg = $200 << 31 >> 31; //@line 6576
   $201 = $197 + $$neg | 0; //@line 6577
   $202 = $$3501$lcssa; //@line 6578
   $203 = $202 - $185 | 0; //@line 6579
   $204 = $203 >> 2; //@line 6580
   $205 = $204 * 9 | 0; //@line 6581
   $206 = $205 + -9 | 0; //@line 6582
   $207 = ($201 | 0) < ($206 | 0); //@line 6583
   if ($207) {
    $208 = $$561 + 4 | 0; //@line 6585
    $209 = $201 + 9216 | 0; //@line 6586
    $210 = ($209 | 0) / 9 & -1; //@line 6587
    $211 = $210 + -1024 | 0; //@line 6588
    $212 = $208 + ($211 << 2) | 0; //@line 6589
    $213 = ($209 | 0) % 9 & -1; //@line 6590
    $214 = ($213 | 0) < 8; //@line 6591
    if ($214) {
     $$0527$in633 = $213; //@line 6593
     $$1531632 = 10; //@line 6593
     while (1) {
      $$0527 = $$0527$in633 + 1 | 0; //@line 6595
      $215 = $$1531632 * 10 | 0; //@line 6596
      $216 = ($$0527$in633 | 0) < 7; //@line 6597
      if ($216) {
       $$0527$in633 = $$0527; //@line 6599
       $$1531632 = $215; //@line 6599
      } else {
       $$1531$lcssa = $215; //@line 6601
       break;
      }
     }
    } else {
     $$1531$lcssa = 10; //@line 6606
    }
    $217 = SAFE_HEAP_LOAD($212 | 0, 4, 0) | 0 | 0; //@line 6608
    $218 = ($217 >>> 0) % ($$1531$lcssa >>> 0) & -1; //@line 6609
    $219 = ($218 | 0) == 0; //@line 6610
    $220 = $212 + 4 | 0; //@line 6611
    $221 = ($220 | 0) == ($$3501$lcssa | 0); //@line 6612
    $or$cond542 = $221 & $219; //@line 6613
    if ($or$cond542) {
     $$4492 = $212; //@line 6615
     $$4518 = $$1515; //@line 6615
     $$8 = $$3484$lcssa; //@line 6615
    } else {
     $222 = ($217 >>> 0) / ($$1531$lcssa >>> 0) & -1; //@line 6617
     $223 = $222 & 1; //@line 6618
     $224 = ($223 | 0) == 0; //@line 6619
     $$543 = $224 ? 9007199254740992.0 : 9007199254740994.0; //@line 6620
     $225 = ($$1531$lcssa | 0) / 2 & -1; //@line 6621
     $226 = $218 >>> 0 < $225 >>> 0; //@line 6622
     $227 = ($218 | 0) == ($225 | 0); //@line 6623
     $or$cond545 = $221 & $227; //@line 6624
     $$564 = $or$cond545 ? 1.0 : 1.5; //@line 6625
     $$$564 = $226 ? .5 : $$564; //@line 6626
     $228 = ($$0520 | 0) == 0; //@line 6627
     if ($228) {
      $$1467 = $$$564; //@line 6629
      $$1469 = $$543; //@line 6629
     } else {
      $229 = SAFE_HEAP_LOAD($$0521 >> 0 | 0, 1, 0) | 0 | 0; //@line 6631
      $230 = $229 << 24 >> 24 == 45; //@line 6632
      $231 = -$$543; //@line 6633
      $232 = -$$$564; //@line 6634
      $$$543 = $230 ? $231 : $$543; //@line 6635
      $$$$564 = $230 ? $232 : $$$564; //@line 6636
      $$1467 = $$$$564; //@line 6637
      $$1469 = $$$543; //@line 6637
     }
     $233 = $217 - $218 | 0; //@line 6639
     SAFE_HEAP_STORE($212 | 0, $233 | 0, 4);
     $234 = $$1469 + $$1467; //@line 6641
     $235 = $234 != $$1469; //@line 6642
     if ($235) {
      $236 = $233 + $$1531$lcssa | 0; //@line 6644
      SAFE_HEAP_STORE($212 | 0, $236 | 0, 4);
      $237 = $236 >>> 0 > 999999999; //@line 6646
      if ($237) {
       $$5486626 = $$3484$lcssa; //@line 6648
       $$sink547625 = $212; //@line 6648
       while (1) {
        $238 = $$sink547625 + -4 | 0; //@line 6650
        SAFE_HEAP_STORE($$sink547625 | 0, 0 | 0, 4);
        $239 = $238 >>> 0 < $$5486626 >>> 0; //@line 6652
        if ($239) {
         $240 = $$5486626 + -4 | 0; //@line 6654
         SAFE_HEAP_STORE($240 | 0, 0 | 0, 4);
         $$6 = $240; //@line 6656
        } else {
         $$6 = $$5486626; //@line 6658
        }
        $241 = SAFE_HEAP_LOAD($238 | 0, 4, 0) | 0 | 0; //@line 6660
        $242 = $241 + 1 | 0; //@line 6661
        SAFE_HEAP_STORE($238 | 0, $242 | 0, 4);
        $243 = $242 >>> 0 > 999999999; //@line 6663
        if ($243) {
         $$5486626 = $$6; //@line 6665
         $$sink547625 = $238; //@line 6665
        } else {
         $$5486$lcssa = $$6; //@line 6667
         $$sink547$lcssa = $238; //@line 6667
         break;
        }
       }
      } else {
       $$5486$lcssa = $$3484$lcssa; //@line 6672
       $$sink547$lcssa = $212; //@line 6672
      }
      $244 = $$5486$lcssa; //@line 6674
      $245 = $185 - $244 | 0; //@line 6675
      $246 = $245 >> 2; //@line 6676
      $247 = $246 * 9 | 0; //@line 6677
      $248 = SAFE_HEAP_LOAD($$5486$lcssa | 0, 4, 0) | 0 | 0; //@line 6678
      $249 = $248 >>> 0 < 10; //@line 6679
      if ($249) {
       $$4492 = $$sink547$lcssa; //@line 6681
       $$4518 = $247; //@line 6681
       $$8 = $$5486$lcssa; //@line 6681
      } else {
       $$2516621 = $247; //@line 6683
       $$2532620 = 10; //@line 6683
       while (1) {
        $250 = $$2532620 * 10 | 0; //@line 6685
        $251 = $$2516621 + 1 | 0; //@line 6686
        $252 = $248 >>> 0 < $250 >>> 0; //@line 6687
        if ($252) {
         $$4492 = $$sink547$lcssa; //@line 6689
         $$4518 = $251; //@line 6689
         $$8 = $$5486$lcssa; //@line 6689
         break;
        } else {
         $$2516621 = $251; //@line 6692
         $$2532620 = $250; //@line 6692
        }
       }
      }
     } else {
      $$4492 = $212; //@line 6697
      $$4518 = $$1515; //@line 6697
      $$8 = $$3484$lcssa; //@line 6697
     }
    }
    $253 = $$4492 + 4 | 0; //@line 6700
    $254 = $$3501$lcssa >>> 0 > $253 >>> 0; //@line 6701
    $$$3501 = $254 ? $253 : $$3501$lcssa; //@line 6702
    $$5519$ph = $$4518; //@line 6703
    $$7505$ph = $$$3501; //@line 6703
    $$9$ph = $$8; //@line 6703
   } else {
    $$5519$ph = $$1515; //@line 6705
    $$7505$ph = $$3501$lcssa; //@line 6705
    $$9$ph = $$3484$lcssa; //@line 6705
   }
   $$7505 = $$7505$ph; //@line 6707
   while (1) {
    $255 = $$7505 >>> 0 > $$9$ph >>> 0; //@line 6709
    if (!$255) {
     $$lcssa675 = 0; //@line 6711
     break;
    }
    $256 = $$7505 + -4 | 0; //@line 6714
    $257 = SAFE_HEAP_LOAD($256 | 0, 4, 0) | 0 | 0; //@line 6715
    $258 = ($257 | 0) == 0; //@line 6716
    if ($258) {
     $$7505 = $256; //@line 6718
    } else {
     $$lcssa675 = 1; //@line 6720
     break;
    }
   }
   $259 = 0 - $$5519$ph | 0; //@line 6724
   do {
    if ($198) {
     $not$ = $199 ^ 1; //@line 6727
     $260 = $not$ & 1; //@line 6728
     $$540$ = $$540 + $260 | 0; //@line 6729
     $261 = ($$540$ | 0) > ($$5519$ph | 0); //@line 6730
     $262 = ($$5519$ph | 0) > -5; //@line 6731
     $or$cond6 = $261 & $262; //@line 6732
     if ($or$cond6) {
      $263 = $5 + -1 | 0; //@line 6734
      $$neg568 = $$540$ + -1 | 0; //@line 6735
      $264 = $$neg568 - $$5519$ph | 0; //@line 6736
      $$0479 = $263; //@line 6737
      $$2476 = $264; //@line 6737
     } else {
      $265 = $5 + -2 | 0; //@line 6739
      $266 = $$540$ + -1 | 0; //@line 6740
      $$0479 = $265; //@line 6741
      $$2476 = $266; //@line 6741
     }
     $267 = $4 & 8; //@line 6743
     $268 = ($267 | 0) == 0; //@line 6744
     if ($268) {
      if ($$lcssa675) {
       $269 = $$7505 + -4 | 0; //@line 6747
       $270 = SAFE_HEAP_LOAD($269 | 0, 4, 0) | 0 | 0; //@line 6748
       $271 = ($270 | 0) == 0; //@line 6749
       if ($271) {
        $$2529 = 9; //@line 6751
       } else {
        $272 = ($270 >>> 0) % 10 & -1; //@line 6753
        $273 = ($272 | 0) == 0; //@line 6754
        if ($273) {
         $$1528617 = 0; //@line 6756
         $$3533616 = 10; //@line 6756
         while (1) {
          $274 = $$3533616 * 10 | 0; //@line 6758
          $275 = $$1528617 + 1 | 0; //@line 6759
          $276 = ($270 >>> 0) % ($274 >>> 0) & -1; //@line 6760
          $277 = ($276 | 0) == 0; //@line 6761
          if ($277) {
           $$1528617 = $275; //@line 6763
           $$3533616 = $274; //@line 6763
          } else {
           $$2529 = $275; //@line 6765
           break;
          }
         }
        } else {
         $$2529 = 0; //@line 6770
        }
       }
      } else {
       $$2529 = 9; //@line 6774
      }
      $278 = $$0479 | 32; //@line 6776
      $279 = ($278 | 0) == 102; //@line 6777
      $280 = $$7505; //@line 6778
      $281 = $280 - $185 | 0; //@line 6779
      $282 = $281 >> 2; //@line 6780
      $283 = $282 * 9 | 0; //@line 6781
      $284 = $283 + -9 | 0; //@line 6782
      if ($279) {
       $285 = $284 - $$2529 | 0; //@line 6784
       $286 = ($285 | 0) > 0; //@line 6785
       $$548 = $286 ? $285 : 0; //@line 6786
       $287 = ($$2476 | 0) < ($$548 | 0); //@line 6787
       $$2476$$549 = $287 ? $$2476 : $$548; //@line 6788
       $$1480 = $$0479; //@line 6789
       $$3477 = $$2476$$549; //@line 6789
       $$pre$phi698Z2D = 0; //@line 6789
       break;
      } else {
       $288 = $284 + $$5519$ph | 0; //@line 6792
       $289 = $288 - $$2529 | 0; //@line 6793
       $290 = ($289 | 0) > 0; //@line 6794
       $$550 = $290 ? $289 : 0; //@line 6795
       $291 = ($$2476 | 0) < ($$550 | 0); //@line 6796
       $$2476$$551 = $291 ? $$2476 : $$550; //@line 6797
       $$1480 = $$0479; //@line 6798
       $$3477 = $$2476$$551; //@line 6798
       $$pre$phi698Z2D = 0; //@line 6798
       break;
      }
     } else {
      $$1480 = $$0479; //@line 6802
      $$3477 = $$2476; //@line 6802
      $$pre$phi698Z2D = $267; //@line 6802
     }
    } else {
     $$pre697 = $4 & 8; //@line 6805
     $$1480 = $5; //@line 6806
     $$3477 = $$540; //@line 6806
     $$pre$phi698Z2D = $$pre697; //@line 6806
    }
   } while (0);
   $292 = $$3477 | $$pre$phi698Z2D; //@line 6809
   $293 = ($292 | 0) != 0; //@line 6810
   $294 = $293 & 1; //@line 6811
   $295 = $$1480 | 32; //@line 6812
   $296 = ($295 | 0) == 102; //@line 6813
   if ($296) {
    $297 = ($$5519$ph | 0) > 0; //@line 6815
    $298 = $297 ? $$5519$ph : 0; //@line 6816
    $$2513 = 0; //@line 6817
    $$pn = $298; //@line 6817
   } else {
    $299 = ($$5519$ph | 0) < 0; //@line 6819
    $300 = $299 ? $259 : $$5519$ph; //@line 6820
    $301 = ($300 | 0) < 0; //@line 6821
    $302 = $301 << 31 >> 31; //@line 6822
    $303 = _fmt_u($300, $302, $11) | 0; //@line 6823
    $304 = $11; //@line 6824
    $305 = $303; //@line 6825
    $306 = $304 - $305 | 0; //@line 6826
    $307 = ($306 | 0) < 2; //@line 6827
    if ($307) {
     $$1512610 = $303; //@line 6829
     while (1) {
      $308 = $$1512610 + -1 | 0; //@line 6831
      SAFE_HEAP_STORE($308 >> 0 | 0, 48 | 0, 1);
      $309 = $308; //@line 6833
      $310 = $304 - $309 | 0; //@line 6834
      $311 = ($310 | 0) < 2; //@line 6835
      if ($311) {
       $$1512610 = $308; //@line 6837
      } else {
       $$1512$lcssa = $308; //@line 6839
       break;
      }
     }
    } else {
     $$1512$lcssa = $303; //@line 6844
    }
    $312 = $$5519$ph >> 31; //@line 6846
    $313 = $312 & 2; //@line 6847
    $314 = $313 + 43 | 0; //@line 6848
    $315 = $314 & 255; //@line 6849
    $316 = $$1512$lcssa + -1 | 0; //@line 6850
    SAFE_HEAP_STORE($316 >> 0 | 0, $315 | 0, 1);
    $317 = $$1480 & 255; //@line 6852
    $318 = $$1512$lcssa + -2 | 0; //@line 6853
    SAFE_HEAP_STORE($318 >> 0 | 0, $317 | 0, 1);
    $319 = $318; //@line 6855
    $320 = $304 - $319 | 0; //@line 6856
    $$2513 = $318; //@line 6857
    $$pn = $320; //@line 6857
   }
   $321 = $$0520 + 1 | 0; //@line 6859
   $322 = $321 + $$3477 | 0; //@line 6860
   $$1526 = $322 + $294 | 0; //@line 6861
   $323 = $$1526 + $$pn | 0; //@line 6862
   _pad_669($0, 32, $2, $323, $4); //@line 6863
   _out($0, $$0521, $$0520); //@line 6864
   $324 = $4 ^ 65536; //@line 6865
   _pad_669($0, 48, $2, $323, $324); //@line 6866
   if ($296) {
    $325 = $$9$ph >>> 0 > $$561 >>> 0; //@line 6868
    $$0496$$9 = $325 ? $$561 : $$9$ph; //@line 6869
    $326 = $8 + 9 | 0; //@line 6870
    $327 = $326; //@line 6871
    $328 = $8 + 8 | 0; //@line 6872
    $$5493600 = $$0496$$9; //@line 6873
    while (1) {
     $329 = SAFE_HEAP_LOAD($$5493600 | 0, 4, 0) | 0 | 0; //@line 6875
     $330 = _fmt_u($329, 0, $326) | 0; //@line 6876
     $331 = ($$5493600 | 0) == ($$0496$$9 | 0); //@line 6877
     if ($331) {
      $337 = ($330 | 0) == ($326 | 0); //@line 6879
      if ($337) {
       SAFE_HEAP_STORE($328 >> 0 | 0, 48 | 0, 1);
       $$1465 = $328; //@line 6882
      } else {
       $$1465 = $330; //@line 6884
      }
     } else {
      $332 = $330 >>> 0 > $8 >>> 0; //@line 6887
      if ($332) {
       $333 = $330; //@line 6889
       $334 = $333 - $9 | 0; //@line 6890
       _memset($8 | 0, 48, $334 | 0) | 0; //@line 6891
       $$0464597 = $330; //@line 6892
       while (1) {
        $335 = $$0464597 + -1 | 0; //@line 6894
        $336 = $335 >>> 0 > $8 >>> 0; //@line 6895
        if ($336) {
         $$0464597 = $335; //@line 6897
        } else {
         $$1465 = $335; //@line 6899
         break;
        }
       }
      } else {
       $$1465 = $330; //@line 6904
      }
     }
     $338 = $$1465; //@line 6907
     $339 = $327 - $338 | 0; //@line 6908
     _out($0, $$1465, $339); //@line 6909
     $340 = $$5493600 + 4 | 0; //@line 6910
     $341 = $340 >>> 0 > $$561 >>> 0; //@line 6911
     if ($341) {
      break;
     } else {
      $$5493600 = $340; //@line 6915
     }
    }
    $342 = ($292 | 0) == 0; //@line 6918
    if (!$342) {
     _out($0, 1396, 1); //@line 6920
    }
    $343 = $340 >>> 0 < $$7505 >>> 0; //@line 6922
    $344 = ($$3477 | 0) > 0; //@line 6923
    $345 = $343 & $344; //@line 6924
    if ($345) {
     $$4478593 = $$3477; //@line 6926
     $$6494592 = $340; //@line 6926
     while (1) {
      $346 = SAFE_HEAP_LOAD($$6494592 | 0, 4, 0) | 0 | 0; //@line 6928
      $347 = _fmt_u($346, 0, $326) | 0; //@line 6929
      $348 = $347 >>> 0 > $8 >>> 0; //@line 6930
      if ($348) {
       $349 = $347; //@line 6932
       $350 = $349 - $9 | 0; //@line 6933
       _memset($8 | 0, 48, $350 | 0) | 0; //@line 6934
       $$0463587 = $347; //@line 6935
       while (1) {
        $351 = $$0463587 + -1 | 0; //@line 6937
        $352 = $351 >>> 0 > $8 >>> 0; //@line 6938
        if ($352) {
         $$0463587 = $351; //@line 6940
        } else {
         $$0463$lcssa = $351; //@line 6942
         break;
        }
       }
      } else {
       $$0463$lcssa = $347; //@line 6947
      }
      $353 = ($$4478593 | 0) < 9; //@line 6949
      $354 = $353 ? $$4478593 : 9; //@line 6950
      _out($0, $$0463$lcssa, $354); //@line 6951
      $355 = $$6494592 + 4 | 0; //@line 6952
      $356 = $$4478593 + -9 | 0; //@line 6953
      $357 = $355 >>> 0 < $$7505 >>> 0; //@line 6954
      $358 = ($$4478593 | 0) > 9; //@line 6955
      $359 = $357 & $358; //@line 6956
      if ($359) {
       $$4478593 = $356; //@line 6958
       $$6494592 = $355; //@line 6958
      } else {
       $$4478$lcssa = $356; //@line 6960
       break;
      }
     }
    } else {
     $$4478$lcssa = $$3477; //@line 6965
    }
    $360 = $$4478$lcssa + 9 | 0; //@line 6967
    _pad_669($0, 48, $360, 9, 0); //@line 6968
   } else {
    $361 = $$9$ph + 4 | 0; //@line 6970
    $$7505$ = $$lcssa675 ? $$7505 : $361; //@line 6971
    $362 = ($$3477 | 0) > -1; //@line 6972
    if ($362) {
     $363 = $8 + 9 | 0; //@line 6974
     $364 = ($$pre$phi698Z2D | 0) == 0; //@line 6975
     $365 = $363; //@line 6976
     $366 = 0 - $9 | 0; //@line 6977
     $367 = $8 + 8 | 0; //@line 6978
     $$5605 = $$3477; //@line 6979
     $$7495604 = $$9$ph; //@line 6979
     while (1) {
      $368 = SAFE_HEAP_LOAD($$7495604 | 0, 4, 0) | 0 | 0; //@line 6981
      $369 = _fmt_u($368, 0, $363) | 0; //@line 6982
      $370 = ($369 | 0) == ($363 | 0); //@line 6983
      if ($370) {
       SAFE_HEAP_STORE($367 >> 0 | 0, 48 | 0, 1);
       $$0 = $367; //@line 6986
      } else {
       $$0 = $369; //@line 6988
      }
      $371 = ($$7495604 | 0) == ($$9$ph | 0); //@line 6990
      do {
       if ($371) {
        $375 = $$0 + 1 | 0; //@line 6993
        _out($0, $$0, 1); //@line 6994
        $376 = ($$5605 | 0) < 1; //@line 6995
        $or$cond556 = $364 & $376; //@line 6996
        if ($or$cond556) {
         $$2 = $375; //@line 6998
         break;
        }
        _out($0, 1396, 1); //@line 7001
        $$2 = $375; //@line 7002
       } else {
        $372 = $$0 >>> 0 > $8 >>> 0; //@line 7004
        if (!$372) {
         $$2 = $$0; //@line 7006
         break;
        }
        $scevgep686 = $$0 + $366 | 0; //@line 7009
        $scevgep686687 = $scevgep686; //@line 7010
        _memset($8 | 0, 48, $scevgep686687 | 0) | 0; //@line 7011
        $$1601 = $$0; //@line 7012
        while (1) {
         $373 = $$1601 + -1 | 0; //@line 7014
         $374 = $373 >>> 0 > $8 >>> 0; //@line 7015
         if ($374) {
          $$1601 = $373; //@line 7017
         } else {
          $$2 = $373; //@line 7019
          break;
         }
        }
       }
      } while (0);
      $377 = $$2; //@line 7025
      $378 = $365 - $377 | 0; //@line 7026
      $379 = ($$5605 | 0) > ($378 | 0); //@line 7027
      $380 = $379 ? $378 : $$5605; //@line 7028
      _out($0, $$2, $380); //@line 7029
      $381 = $$5605 - $378 | 0; //@line 7030
      $382 = $$7495604 + 4 | 0; //@line 7031
      $383 = $382 >>> 0 < $$7505$ >>> 0; //@line 7032
      $384 = ($381 | 0) > -1; //@line 7033
      $385 = $383 & $384; //@line 7034
      if ($385) {
       $$5605 = $381; //@line 7036
       $$7495604 = $382; //@line 7036
      } else {
       $$5$lcssa = $381; //@line 7038
       break;
      }
     }
    } else {
     $$5$lcssa = $$3477; //@line 7043
    }
    $386 = $$5$lcssa + 18 | 0; //@line 7045
    _pad_669($0, 48, $386, 18, 0); //@line 7046
    $387 = $11; //@line 7047
    $388 = $$2513; //@line 7048
    $389 = $387 - $388 | 0; //@line 7049
    _out($0, $$2513, $389); //@line 7050
   }
   $390 = $4 ^ 8192; //@line 7052
   _pad_669($0, 32, $2, $323, $390); //@line 7053
   $$sink560 = $323; //@line 7054
  }
 } while (0);
 $391 = ($$sink560 | 0) < ($2 | 0); //@line 7057
 $$557 = $391 ? $2 : $$sink560; //@line 7058
 STACKTOP = sp; //@line 7059
 return $$557 | 0; //@line 7059
}
function _printf_core($0, $1, $2, $3, $4) {
 $0 = $0 | 0; //@line 4602
 $1 = $1 | 0; //@line 4603
 $2 = $2 | 0; //@line 4604
 $3 = $3 | 0; //@line 4605
 $4 = $4 | 0; //@line 4606
 var $$ = 0, $$$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$4266 = 0, $$$5 = 0, $$0 = 0, $$0228 = 0, $$0228$ = 0, $$0229320 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240$lcssa = 0, $$0240$lcssa357 = 0, $$0240319 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0; //@line 4607
 var $$0249307 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$$0254$ = 0, $$0259 = 0, $$0262$lcssa = 0, $$0262313 = 0, $$0269 = 0, $$0269$phi = 0, $$1 = 0, $$1230331 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241330 = 0, $$1244318 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0; //@line 4608
 var $$1260 = 0, $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$2 = 0, $$2234 = 0, $$2239 = 0, $$2242$lcssa = 0, $$2242306 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2256$$$2256 = 0, $$2261 = 0, $$2271 = 0, $$283$ = 0, $$290 = 0, $$291 = 0, $$3257 = 0; //@line 4609
 var $$3265 = 0, $$3272 = 0, $$3304 = 0, $$376 = 0, $$4258355 = 0, $$4266 = 0, $$5 = 0, $$6268 = 0, $$lcssa295 = 0, $$pre = 0, $$pre346 = 0, $$pre347 = 0, $$pre347$pre = 0, $$pre349 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0; //@line 4610
 var $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0; //@line 4611
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0; //@line 4612
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0; //@line 4613
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0; //@line 4614
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0; //@line 4615
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0; //@line 4616
 var $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0; //@line 4617
 var $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0; //@line 4618
 var $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0; //@line 4619
 var $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0; //@line 4620
 var $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0; //@line 4621
 var $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0.0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0; //@line 4622
 var $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $35 = 0; //@line 4623
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0; //@line 4624
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0; //@line 4625
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0; //@line 4626
 var $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $brmerge = 0, $brmerge312 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0; //@line 4627
 var $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit275 = 0, $isdigit277 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp274 = 0, $isdigittmp276 = 0, $or$cond = 0, $or$cond280 = 0, $or$cond282 = 0, $or$cond285 = 0, $storemerge = 0, $storemerge278 = 0, $trunc = 0, label = 0; //@line 4628
 var sp = 0; //@line 4629
 sp = STACKTOP; //@line 4630
 STACKTOP = STACKTOP + 64 | 0; //@line 4631
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(64 | 0); //@line 4631
 $5 = sp + 16 | 0; //@line 4632
 $6 = sp; //@line 4633
 $7 = sp + 24 | 0; //@line 4634
 $8 = sp + 8 | 0; //@line 4635
 $9 = sp + 20 | 0; //@line 4636
 SAFE_HEAP_STORE($5 | 0, $1 | 0, 4);
 $10 = ($0 | 0) != (0 | 0); //@line 4638
 $11 = $7 + 40 | 0; //@line 4639
 $12 = $11; //@line 4640
 $13 = $7 + 39 | 0; //@line 4641
 $14 = $8 + 4 | 0; //@line 4642
 $$0243 = 0; //@line 4643
 $$0247 = 0; //@line 4643
 $$0269 = 0; //@line 4643
 $21 = $1; //@line 4643
 L1 : while (1) {
  $15 = ($$0247 | 0) > -1; //@line 4645
  do {
   if ($15) {
    $16 = 2147483647 - $$0247 | 0; //@line 4648
    $17 = ($$0243 | 0) > ($16 | 0); //@line 4649
    if ($17) {
     $18 = ___errno_location() | 0; //@line 4651
     SAFE_HEAP_STORE($18 | 0, 75 | 0, 4);
     $$1248 = -1; //@line 4653
     break;
    } else {
     $19 = $$0243 + $$0247 | 0; //@line 4656
     $$1248 = $19; //@line 4657
     break;
    }
   } else {
    $$1248 = $$0247; //@line 4661
   }
  } while (0);
  $20 = SAFE_HEAP_LOAD($21 >> 0 | 0, 1, 0) | 0 | 0; //@line 4664
  $22 = $20 << 24 >> 24 == 0; //@line 4665
  if ($22) {
   label = 86; //@line 4667
   break;
  } else {
   $23 = $20; //@line 4670
   $25 = $21; //@line 4670
  }
  L9 : while (1) {
   switch ($23 << 24 >> 24) {
   case 37:
    {
     $$0249307 = $25; //@line 4675
     $27 = $25; //@line 4675
     label = 9; //@line 4676
     break L9;
     break;
    }
   case 0:
    {
     $$0249$lcssa = $25; //@line 4681
     $39 = $25; //@line 4681
     break L9;
     break;
    }
   default:
    {}
   }
   $24 = $25 + 1 | 0; //@line 4688
   SAFE_HEAP_STORE($5 | 0, $24 | 0, 4);
   $$pre = SAFE_HEAP_LOAD($24 >> 0 | 0, 1, 0) | 0 | 0; //@line 4690
   $23 = $$pre; //@line 4691
   $25 = $24; //@line 4691
  }
  L12 : do {
   if ((label | 0) == 9) {
    while (1) {
     label = 0; //@line 4696
     $26 = $27 + 1 | 0; //@line 4697
     $28 = SAFE_HEAP_LOAD($26 >> 0 | 0, 1, 0) | 0 | 0; //@line 4698
     $29 = $28 << 24 >> 24 == 37; //@line 4699
     if (!$29) {
      $$0249$lcssa = $$0249307; //@line 4701
      $39 = $27; //@line 4701
      break L12;
     }
     $30 = $$0249307 + 1 | 0; //@line 4704
     $31 = $27 + 2 | 0; //@line 4705
     SAFE_HEAP_STORE($5 | 0, $31 | 0, 4);
     $32 = SAFE_HEAP_LOAD($31 >> 0 | 0, 1, 0) | 0 | 0; //@line 4707
     $33 = $32 << 24 >> 24 == 37; //@line 4708
     if ($33) {
      $$0249307 = $30; //@line 4710
      $27 = $31; //@line 4710
      label = 9; //@line 4711
     } else {
      $$0249$lcssa = $30; //@line 4713
      $39 = $31; //@line 4713
      break;
     }
    }
   }
  } while (0);
  $34 = $$0249$lcssa; //@line 4719
  $35 = $21; //@line 4720
  $36 = $34 - $35 | 0; //@line 4721
  if ($10) {
   _out($0, $21, $36); //@line 4723
  }
  $37 = ($36 | 0) == 0; //@line 4725
  if (!$37) {
   $$0269$phi = $$0269; //@line 4727
   $$0243 = $36; //@line 4727
   $$0247 = $$1248; //@line 4727
   $21 = $39; //@line 4727
   $$0269 = $$0269$phi; //@line 4727
   continue;
  }
  $38 = $39 + 1 | 0; //@line 4730
  $40 = SAFE_HEAP_LOAD($38 >> 0 | 0, 1, 0) | 0 | 0; //@line 4731
  $41 = $40 << 24 >> 24; //@line 4732
  $isdigittmp = $41 + -48 | 0; //@line 4733
  $isdigit = $isdigittmp >>> 0 < 10; //@line 4734
  if ($isdigit) {
   $42 = $39 + 2 | 0; //@line 4736
   $43 = SAFE_HEAP_LOAD($42 >> 0 | 0, 1, 0) | 0 | 0; //@line 4737
   $44 = $43 << 24 >> 24 == 36; //@line 4738
   $45 = $39 + 3 | 0; //@line 4739
   $$376 = $44 ? $45 : $38; //@line 4740
   $$$0269 = $44 ? 1 : $$0269; //@line 4741
   $isdigittmp$ = $44 ? $isdigittmp : -1; //@line 4742
   $$0253 = $isdigittmp$; //@line 4743
   $$1270 = $$$0269; //@line 4743
   $storemerge = $$376; //@line 4743
  } else {
   $$0253 = -1; //@line 4745
   $$1270 = $$0269; //@line 4745
   $storemerge = $38; //@line 4745
  }
  SAFE_HEAP_STORE($5 | 0, $storemerge | 0, 4);
  $46 = SAFE_HEAP_LOAD($storemerge >> 0 | 0, 1, 0) | 0 | 0; //@line 4748
  $47 = $46 << 24 >> 24; //@line 4749
  $48 = $47 + -32 | 0; //@line 4750
  $49 = $48 >>> 0 > 31; //@line 4751
  $50 = 1 << $48; //@line 4752
  $51 = $50 & 75913; //@line 4753
  $52 = ($51 | 0) == 0; //@line 4754
  $brmerge312 = $49 | $52; //@line 4755
  if ($brmerge312) {
   $$0262$lcssa = 0; //@line 4757
   $$lcssa295 = $46; //@line 4757
   $69 = $storemerge; //@line 4757
  } else {
   $$0262313 = 0; //@line 4759
   $54 = $46; //@line 4759
   $59 = $storemerge; //@line 4759
   while (1) {
    $53 = $54 << 24 >> 24; //@line 4761
    $55 = $53 + -32 | 0; //@line 4762
    $56 = 1 << $55; //@line 4763
    $57 = $56 | $$0262313; //@line 4764
    $58 = $59 + 1 | 0; //@line 4765
    SAFE_HEAP_STORE($5 | 0, $58 | 0, 4);
    $60 = SAFE_HEAP_LOAD($58 >> 0 | 0, 1, 0) | 0 | 0; //@line 4767
    $61 = $60 << 24 >> 24; //@line 4768
    $62 = $61 + -32 | 0; //@line 4769
    $63 = $62 >>> 0 > 31; //@line 4770
    $64 = 1 << $62; //@line 4771
    $65 = $64 & 75913; //@line 4772
    $66 = ($65 | 0) == 0; //@line 4773
    $brmerge = $63 | $66; //@line 4774
    if ($brmerge) {
     $$0262$lcssa = $57; //@line 4776
     $$lcssa295 = $60; //@line 4776
     $69 = $58; //@line 4776
     break;
    } else {
     $$0262313 = $57; //@line 4779
     $54 = $60; //@line 4779
     $59 = $58; //@line 4779
    }
   }
  }
  $67 = $$lcssa295 << 24 >> 24 == 42; //@line 4783
  if ($67) {
   $68 = $69 + 1 | 0; //@line 4785
   $70 = SAFE_HEAP_LOAD($68 >> 0 | 0, 1, 0) | 0 | 0; //@line 4786
   $71 = $70 << 24 >> 24; //@line 4787
   $isdigittmp276 = $71 + -48 | 0; //@line 4788
   $isdigit277 = $isdigittmp276 >>> 0 < 10; //@line 4789
   if ($isdigit277) {
    $72 = $69 + 2 | 0; //@line 4791
    $73 = SAFE_HEAP_LOAD($72 >> 0 | 0, 1, 0) | 0 | 0; //@line 4792
    $74 = $73 << 24 >> 24 == 36; //@line 4793
    if ($74) {
     $75 = $4 + ($isdigittmp276 << 2) | 0; //@line 4795
     SAFE_HEAP_STORE($75 | 0, 10 | 0, 4);
     $76 = SAFE_HEAP_LOAD($68 >> 0 | 0, 1, 0) | 0 | 0; //@line 4797
     $77 = $76 << 24 >> 24; //@line 4798
     $78 = $77 + -48 | 0; //@line 4799
     $79 = $3 + ($78 << 3) | 0; //@line 4800
     $80 = $79; //@line 4801
     $81 = $80; //@line 4802
     $82 = SAFE_HEAP_LOAD($81 | 0, 4, 0) | 0 | 0; //@line 4803
     $83 = $80 + 4 | 0; //@line 4804
     $84 = $83; //@line 4805
     $85 = SAFE_HEAP_LOAD($84 | 0, 4, 0) | 0 | 0; //@line 4806
     $86 = $69 + 3 | 0; //@line 4807
     $$0259 = $82; //@line 4808
     $$2271 = 1; //@line 4808
     $storemerge278 = $86; //@line 4808
    } else {
     label = 22; //@line 4810
    }
   } else {
    label = 22; //@line 4813
   }
   if ((label | 0) == 22) {
    label = 0; //@line 4816
    $87 = ($$1270 | 0) == 0; //@line 4817
    if (!$87) {
     $$0 = -1; //@line 4819
     break;
    }
    if ($10) {
     $arglist_current = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 4823
     $88 = $arglist_current; //@line 4824
     $89 = 0 + 4 | 0; //@line 4825
     $expanded4 = $89; //@line 4826
     $expanded = $expanded4 - 1 | 0; //@line 4827
     $90 = $88 + $expanded | 0; //@line 4828
     $91 = 0 + 4 | 0; //@line 4829
     $expanded8 = $91; //@line 4830
     $expanded7 = $expanded8 - 1 | 0; //@line 4831
     $expanded6 = $expanded7 ^ -1; //@line 4832
     $92 = $90 & $expanded6; //@line 4833
     $93 = $92; //@line 4834
     $94 = SAFE_HEAP_LOAD($93 | 0, 4, 0) | 0 | 0; //@line 4835
     $arglist_next = $93 + 4 | 0; //@line 4836
     SAFE_HEAP_STORE($2 | 0, $arglist_next | 0, 4);
     $$0259 = $94; //@line 4838
     $$2271 = 0; //@line 4838
     $storemerge278 = $68; //@line 4838
    } else {
     $$0259 = 0; //@line 4840
     $$2271 = 0; //@line 4840
     $storemerge278 = $68; //@line 4840
    }
   }
   SAFE_HEAP_STORE($5 | 0, $storemerge278 | 0, 4);
   $95 = ($$0259 | 0) < 0; //@line 4844
   $96 = $$0262$lcssa | 8192; //@line 4845
   $97 = 0 - $$0259 | 0; //@line 4846
   $$$0262 = $95 ? $96 : $$0262$lcssa; //@line 4847
   $$$0259 = $95 ? $97 : $$0259; //@line 4848
   $$1260 = $$$0259; //@line 4849
   $$1263 = $$$0262; //@line 4849
   $$3272 = $$2271; //@line 4849
   $101 = $storemerge278; //@line 4849
  } else {
   $98 = _getint($5) | 0; //@line 4851
   $99 = ($98 | 0) < 0; //@line 4852
   if ($99) {
    $$0 = -1; //@line 4854
    break;
   }
   $$pre346 = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 4857
   $$1260 = $98; //@line 4858
   $$1263 = $$0262$lcssa; //@line 4858
   $$3272 = $$1270; //@line 4858
   $101 = $$pre346; //@line 4858
  }
  $100 = SAFE_HEAP_LOAD($101 >> 0 | 0, 1, 0) | 0 | 0; //@line 4860
  $102 = $100 << 24 >> 24 == 46; //@line 4861
  do {
   if ($102) {
    $103 = $101 + 1 | 0; //@line 4864
    $104 = SAFE_HEAP_LOAD($103 >> 0 | 0, 1, 0) | 0 | 0; //@line 4865
    $105 = $104 << 24 >> 24 == 42; //@line 4866
    if (!$105) {
     $132 = $101 + 1 | 0; //@line 4868
     SAFE_HEAP_STORE($5 | 0, $132 | 0, 4);
     $133 = _getint($5) | 0; //@line 4870
     $$pre347$pre = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 4871
     $$0254 = $133; //@line 4872
     $$pre347 = $$pre347$pre; //@line 4872
     break;
    }
    $106 = $101 + 2 | 0; //@line 4875
    $107 = SAFE_HEAP_LOAD($106 >> 0 | 0, 1, 0) | 0 | 0; //@line 4876
    $108 = $107 << 24 >> 24; //@line 4877
    $isdigittmp274 = $108 + -48 | 0; //@line 4878
    $isdigit275 = $isdigittmp274 >>> 0 < 10; //@line 4879
    if ($isdigit275) {
     $109 = $101 + 3 | 0; //@line 4881
     $110 = SAFE_HEAP_LOAD($109 >> 0 | 0, 1, 0) | 0 | 0; //@line 4882
     $111 = $110 << 24 >> 24 == 36; //@line 4883
     if ($111) {
      $112 = $4 + ($isdigittmp274 << 2) | 0; //@line 4885
      SAFE_HEAP_STORE($112 | 0, 10 | 0, 4);
      $113 = SAFE_HEAP_LOAD($106 >> 0 | 0, 1, 0) | 0 | 0; //@line 4887
      $114 = $113 << 24 >> 24; //@line 4888
      $115 = $114 + -48 | 0; //@line 4889
      $116 = $3 + ($115 << 3) | 0; //@line 4890
      $117 = $116; //@line 4891
      $118 = $117; //@line 4892
      $119 = SAFE_HEAP_LOAD($118 | 0, 4, 0) | 0 | 0; //@line 4893
      $120 = $117 + 4 | 0; //@line 4894
      $121 = $120; //@line 4895
      $122 = SAFE_HEAP_LOAD($121 | 0, 4, 0) | 0 | 0; //@line 4896
      $123 = $101 + 4 | 0; //@line 4897
      SAFE_HEAP_STORE($5 | 0, $123 | 0, 4);
      $$0254 = $119; //@line 4899
      $$pre347 = $123; //@line 4899
      break;
     }
    }
    $124 = ($$3272 | 0) == 0; //@line 4903
    if (!$124) {
     $$0 = -1; //@line 4905
     break L1;
    }
    if ($10) {
     $arglist_current2 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 4909
     $125 = $arglist_current2; //@line 4910
     $126 = 0 + 4 | 0; //@line 4911
     $expanded11 = $126; //@line 4912
     $expanded10 = $expanded11 - 1 | 0; //@line 4913
     $127 = $125 + $expanded10 | 0; //@line 4914
     $128 = 0 + 4 | 0; //@line 4915
     $expanded15 = $128; //@line 4916
     $expanded14 = $expanded15 - 1 | 0; //@line 4917
     $expanded13 = $expanded14 ^ -1; //@line 4918
     $129 = $127 & $expanded13; //@line 4919
     $130 = $129; //@line 4920
     $131 = SAFE_HEAP_LOAD($130 | 0, 4, 0) | 0 | 0; //@line 4921
     $arglist_next3 = $130 + 4 | 0; //@line 4922
     SAFE_HEAP_STORE($2 | 0, $arglist_next3 | 0, 4);
     $338 = $131; //@line 4924
    } else {
     $338 = 0; //@line 4926
    }
    SAFE_HEAP_STORE($5 | 0, $106 | 0, 4);
    $$0254 = $338; //@line 4929
    $$pre347 = $106; //@line 4929
   } else {
    $$0254 = -1; //@line 4931
    $$pre347 = $101; //@line 4931
   }
  } while (0);
  $$0252 = 0; //@line 4934
  $135 = $$pre347; //@line 4934
  while (1) {
   $134 = SAFE_HEAP_LOAD($135 >> 0 | 0, 1, 0) | 0 | 0; //@line 4936
   $136 = $134 << 24 >> 24; //@line 4937
   $137 = $136 + -65 | 0; //@line 4938
   $138 = $137 >>> 0 > 57; //@line 4939
   if ($138) {
    $$0 = -1; //@line 4941
    break L1;
   }
   $139 = $135 + 1 | 0; //@line 4944
   SAFE_HEAP_STORE($5 | 0, $139 | 0, 4);
   $140 = SAFE_HEAP_LOAD($135 >> 0 | 0, 1, 0) | 0 | 0; //@line 4946
   $141 = $140 << 24 >> 24; //@line 4947
   $142 = $141 + -65 | 0; //@line 4948
   $143 = (864 + ($$0252 * 58 | 0) | 0) + $142 | 0; //@line 4949
   $144 = SAFE_HEAP_LOAD($143 >> 0 | 0, 1, 0) | 0 | 0; //@line 4950
   $145 = $144 & 255; //@line 4951
   $146 = $145 + -1 | 0; //@line 4952
   $147 = $146 >>> 0 < 8; //@line 4953
   if ($147) {
    $$0252 = $145; //@line 4955
    $135 = $139; //@line 4955
   } else {
    break;
   }
  }
  $148 = $144 << 24 >> 24 == 0; //@line 4960
  if ($148) {
   $$0 = -1; //@line 4962
   break;
  }
  $149 = $144 << 24 >> 24 == 19; //@line 4965
  $150 = ($$0253 | 0) > -1; //@line 4966
  do {
   if ($149) {
    if ($150) {
     $$0 = -1; //@line 4970
     break L1;
    } else {
     label = 48; //@line 4973
    }
   } else {
    if ($150) {
     $151 = $4 + ($$0253 << 2) | 0; //@line 4977
     SAFE_HEAP_STORE($151 | 0, $145 | 0, 4);
     $152 = $3 + ($$0253 << 3) | 0; //@line 4979
     $153 = $152; //@line 4980
     $154 = $153; //@line 4981
     $155 = SAFE_HEAP_LOAD($154 | 0, 4, 0) | 0 | 0; //@line 4982
     $156 = $153 + 4 | 0; //@line 4983
     $157 = $156; //@line 4984
     $158 = SAFE_HEAP_LOAD($157 | 0, 4, 0) | 0 | 0; //@line 4985
     $159 = $6; //@line 4986
     $160 = $159; //@line 4987
     SAFE_HEAP_STORE($160 | 0, $155 | 0, 4);
     $161 = $159 + 4 | 0; //@line 4989
     $162 = $161; //@line 4990
     SAFE_HEAP_STORE($162 | 0, $158 | 0, 4);
     label = 48; //@line 4992
     break;
    }
    if (!$10) {
     $$0 = 0; //@line 4996
     break L1;
    }
    _pop_arg($6, $145, $2); //@line 4999
   }
  } while (0);
  if ((label | 0) == 48) {
   label = 0; //@line 5003
   if (!$10) {
    $$0243 = 0; //@line 5005
    $$0247 = $$1248; //@line 5005
    $$0269 = $$3272; //@line 5005
    $21 = $139; //@line 5005
    continue;
   }
  }
  $163 = SAFE_HEAP_LOAD($135 >> 0 | 0, 1, 0) | 0 | 0; //@line 5009
  $164 = $163 << 24 >> 24; //@line 5010
  $165 = ($$0252 | 0) != 0; //@line 5011
  $166 = $164 & 15; //@line 5012
  $167 = ($166 | 0) == 3; //@line 5013
  $or$cond280 = $165 & $167; //@line 5014
  $168 = $164 & -33; //@line 5015
  $$0235 = $or$cond280 ? $168 : $164; //@line 5016
  $169 = $$1263 & 8192; //@line 5017
  $170 = ($169 | 0) == 0; //@line 5018
  $171 = $$1263 & -65537; //@line 5019
  $$1263$ = $170 ? $$1263 : $171; //@line 5020
  L70 : do {
   switch ($$0235 | 0) {
   case 110:
    {
     $trunc = $$0252 & 255; //@line 5024
     switch ($trunc << 24 >> 24) {
     case 0:
      {
       $178 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5027
       SAFE_HEAP_STORE($178 | 0, $$1248 | 0, 4);
       $$0243 = 0; //@line 5029
       $$0247 = $$1248; //@line 5029
       $$0269 = $$3272; //@line 5029
       $21 = $139; //@line 5029
       continue L1;
       break;
      }
     case 1:
      {
       $179 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5034
       SAFE_HEAP_STORE($179 | 0, $$1248 | 0, 4);
       $$0243 = 0; //@line 5036
       $$0247 = $$1248; //@line 5036
       $$0269 = $$3272; //@line 5036
       $21 = $139; //@line 5036
       continue L1;
       break;
      }
     case 2:
      {
       $180 = ($$1248 | 0) < 0; //@line 5041
       $181 = $180 << 31 >> 31; //@line 5042
       $182 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5043
       $183 = $182; //@line 5044
       $184 = $183; //@line 5045
       SAFE_HEAP_STORE($184 | 0, $$1248 | 0, 4);
       $185 = $183 + 4 | 0; //@line 5047
       $186 = $185; //@line 5048
       SAFE_HEAP_STORE($186 | 0, $181 | 0, 4);
       $$0243 = 0; //@line 5050
       $$0247 = $$1248; //@line 5050
       $$0269 = $$3272; //@line 5050
       $21 = $139; //@line 5050
       continue L1;
       break;
      }
     case 3:
      {
       $187 = $$1248 & 65535; //@line 5055
       $188 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5056
       SAFE_HEAP_STORE($188 | 0, $187 | 0, 2);
       $$0243 = 0; //@line 5058
       $$0247 = $$1248; //@line 5058
       $$0269 = $$3272; //@line 5058
       $21 = $139; //@line 5058
       continue L1;
       break;
      }
     case 4:
      {
       $189 = $$1248 & 255; //@line 5063
       $190 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5064
       SAFE_HEAP_STORE($190 >> 0 | 0, $189 | 0, 1);
       $$0243 = 0; //@line 5066
       $$0247 = $$1248; //@line 5066
       $$0269 = $$3272; //@line 5066
       $21 = $139; //@line 5066
       continue L1;
       break;
      }
     case 6:
      {
       $191 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5071
       SAFE_HEAP_STORE($191 | 0, $$1248 | 0, 4);
       $$0243 = 0; //@line 5073
       $$0247 = $$1248; //@line 5073
       $$0269 = $$3272; //@line 5073
       $21 = $139; //@line 5073
       continue L1;
       break;
      }
     case 7:
      {
       $192 = ($$1248 | 0) < 0; //@line 5078
       $193 = $192 << 31 >> 31; //@line 5079
       $194 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5080
       $195 = $194; //@line 5081
       $196 = $195; //@line 5082
       SAFE_HEAP_STORE($196 | 0, $$1248 | 0, 4);
       $197 = $195 + 4 | 0; //@line 5084
       $198 = $197; //@line 5085
       SAFE_HEAP_STORE($198 | 0, $193 | 0, 4);
       $$0243 = 0; //@line 5087
       $$0247 = $$1248; //@line 5087
       $$0269 = $$3272; //@line 5087
       $21 = $139; //@line 5087
       continue L1;
       break;
      }
     default:
      {
       $$0243 = 0; //@line 5092
       $$0247 = $$1248; //@line 5092
       $$0269 = $$3272; //@line 5092
       $21 = $139; //@line 5092
       continue L1;
      }
     }
     break;
    }
   case 112:
    {
     $199 = $$0254 >>> 0 > 8; //@line 5099
     $200 = $199 ? $$0254 : 8; //@line 5100
     $201 = $$1263$ | 8; //@line 5101
     $$1236 = 120; //@line 5102
     $$1255 = $200; //@line 5102
     $$3265 = $201; //@line 5102
     label = 60; //@line 5103
     break;
    }
   case 88:
   case 120:
    {
     $$1236 = $$0235; //@line 5107
     $$1255 = $$0254; //@line 5107
     $$3265 = $$1263$; //@line 5107
     label = 60; //@line 5108
     break;
    }
   case 111:
    {
     $217 = $6; //@line 5112
     $218 = $217; //@line 5113
     $219 = SAFE_HEAP_LOAD($218 | 0, 4, 0) | 0 | 0; //@line 5114
     $220 = $217 + 4 | 0; //@line 5115
     $221 = $220; //@line 5116
     $222 = SAFE_HEAP_LOAD($221 | 0, 4, 0) | 0 | 0; //@line 5117
     $223 = _fmt_o($219, $222, $11) | 0; //@line 5118
     $224 = $$1263$ & 8; //@line 5119
     $225 = ($224 | 0) == 0; //@line 5120
     $226 = $223; //@line 5121
     $227 = $12 - $226 | 0; //@line 5122
     $228 = ($$0254 | 0) > ($227 | 0); //@line 5123
     $229 = $227 + 1 | 0; //@line 5124
     $230 = $225 | $228; //@line 5125
     $$0254$$0254$ = $230 ? $$0254 : $229; //@line 5126
     $$0228 = $223; //@line 5127
     $$1233 = 0; //@line 5127
     $$1238 = 1328; //@line 5127
     $$2256 = $$0254$$0254$; //@line 5127
     $$4266 = $$1263$; //@line 5127
     $256 = $219; //@line 5127
     $258 = $222; //@line 5127
     label = 66; //@line 5128
     break;
    }
   case 105:
   case 100:
    {
     $231 = $6; //@line 5132
     $232 = $231; //@line 5133
     $233 = SAFE_HEAP_LOAD($232 | 0, 4, 0) | 0 | 0; //@line 5134
     $234 = $231 + 4 | 0; //@line 5135
     $235 = $234; //@line 5136
     $236 = SAFE_HEAP_LOAD($235 | 0, 4, 0) | 0 | 0; //@line 5137
     $237 = ($236 | 0) < 0; //@line 5138
     if ($237) {
      $238 = _i64Subtract(0, 0, $233 | 0, $236 | 0) | 0; //@line 5140
      $239 = tempRet0; //@line 5141
      $240 = $6; //@line 5142
      $241 = $240; //@line 5143
      SAFE_HEAP_STORE($241 | 0, $238 | 0, 4);
      $242 = $240 + 4 | 0; //@line 5145
      $243 = $242; //@line 5146
      SAFE_HEAP_STORE($243 | 0, $239 | 0, 4);
      $$0232 = 1; //@line 5148
      $$0237 = 1328; //@line 5148
      $250 = $238; //@line 5148
      $251 = $239; //@line 5148
      label = 65; //@line 5149
      break L70;
     } else {
      $244 = $$1263$ & 2048; //@line 5152
      $245 = ($244 | 0) == 0; //@line 5153
      $246 = $$1263$ & 1; //@line 5154
      $247 = ($246 | 0) == 0; //@line 5155
      $$ = $247 ? 1328 : 1330; //@line 5156
      $$$ = $245 ? $$ : 1329; //@line 5157
      $248 = $$1263$ & 2049; //@line 5158
      $249 = ($248 | 0) != 0; //@line 5159
      $$283$ = $249 & 1; //@line 5160
      $$0232 = $$283$; //@line 5161
      $$0237 = $$$; //@line 5161
      $250 = $233; //@line 5161
      $251 = $236; //@line 5161
      label = 65; //@line 5162
      break L70;
     }
     break;
    }
   case 117:
    {
     $172 = $6; //@line 5168
     $173 = $172; //@line 5169
     $174 = SAFE_HEAP_LOAD($173 | 0, 4, 0) | 0 | 0; //@line 5170
     $175 = $172 + 4 | 0; //@line 5171
     $176 = $175; //@line 5172
     $177 = SAFE_HEAP_LOAD($176 | 0, 4, 0) | 0 | 0; //@line 5173
     $$0232 = 0; //@line 5174
     $$0237 = 1328; //@line 5174
     $250 = $174; //@line 5174
     $251 = $177; //@line 5174
     label = 65; //@line 5175
     break;
    }
   case 99:
    {
     $267 = $6; //@line 5179
     $268 = $267; //@line 5180
     $269 = SAFE_HEAP_LOAD($268 | 0, 4, 0) | 0 | 0; //@line 5181
     $270 = $267 + 4 | 0; //@line 5182
     $271 = $270; //@line 5183
     $272 = SAFE_HEAP_LOAD($271 | 0, 4, 0) | 0 | 0; //@line 5184
     $273 = $269 & 255; //@line 5185
     SAFE_HEAP_STORE($13 >> 0 | 0, $273 | 0, 1);
     $$2 = $13; //@line 5187
     $$2234 = 0; //@line 5187
     $$2239 = 1328; //@line 5187
     $$2251 = $11; //@line 5187
     $$5 = 1; //@line 5187
     $$6268 = $171; //@line 5187
     break;
    }
   case 109:
    {
     $274 = ___errno_location() | 0; //@line 5191
     $275 = SAFE_HEAP_LOAD($274 | 0, 4, 0) | 0 | 0; //@line 5192
     $276 = _strerror($275) | 0; //@line 5193
     $$1 = $276; //@line 5194
     label = 70; //@line 5195
     break;
    }
   case 115:
    {
     $277 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5199
     $278 = ($277 | 0) != (0 | 0); //@line 5200
     $279 = $278 ? $277 : 1338; //@line 5201
     $$1 = $279; //@line 5202
     label = 70; //@line 5203
     break;
    }
   case 67:
    {
     $286 = $6; //@line 5207
     $287 = $286; //@line 5208
     $288 = SAFE_HEAP_LOAD($287 | 0, 4, 0) | 0 | 0; //@line 5209
     $289 = $286 + 4 | 0; //@line 5210
     $290 = $289; //@line 5211
     $291 = SAFE_HEAP_LOAD($290 | 0, 4, 0) | 0 | 0; //@line 5212
     SAFE_HEAP_STORE($8 | 0, $288 | 0, 4);
     SAFE_HEAP_STORE($14 | 0, 0 | 0, 4);
     SAFE_HEAP_STORE($6 | 0, $8 | 0, 4);
     $$4258355 = -1; //@line 5216
     $339 = $8; //@line 5216
     label = 74; //@line 5217
     break;
    }
   case 83:
    {
     $$pre349 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 5221
     $292 = ($$0254 | 0) == 0; //@line 5222
     if ($292) {
      _pad_669($0, 32, $$1260, 0, $$1263$); //@line 5224
      $$0240$lcssa357 = 0; //@line 5225
      label = 83; //@line 5226
     } else {
      $$4258355 = $$0254; //@line 5228
      $339 = $$pre349; //@line 5228
      label = 74; //@line 5229
     }
     break;
    }
   case 65:
   case 71:
   case 70:
   case 69:
   case 97:
   case 103:
   case 102:
   case 101:
    {
     $314 = +(+SAFE_HEAP_LOAD_D($6 | 0, 8)); //@line 5234
     $315 = _fmt_fp($0, $314, $$1260, $$0254, $$1263$, $$0235) | 0; //@line 5235
     $$0243 = $315; //@line 5236
     $$0247 = $$1248; //@line 5236
     $$0269 = $$3272; //@line 5236
     $21 = $139; //@line 5236
     continue L1;
     break;
    }
   default:
    {
     $$2 = $21; //@line 5241
     $$2234 = 0; //@line 5241
     $$2239 = 1328; //@line 5241
     $$2251 = $11; //@line 5241
     $$5 = $$0254; //@line 5241
     $$6268 = $$1263$; //@line 5241
    }
   }
  } while (0);
  L94 : do {
   if ((label | 0) == 60) {
    label = 0; //@line 5247
    $202 = $6; //@line 5248
    $203 = $202; //@line 5249
    $204 = SAFE_HEAP_LOAD($203 | 0, 4, 0) | 0 | 0; //@line 5250
    $205 = $202 + 4 | 0; //@line 5251
    $206 = $205; //@line 5252
    $207 = SAFE_HEAP_LOAD($206 | 0, 4, 0) | 0 | 0; //@line 5253
    $208 = $$1236 & 32; //@line 5254
    $209 = _fmt_x($204, $207, $11, $208) | 0; //@line 5255
    $210 = ($204 | 0) == 0; //@line 5256
    $211 = ($207 | 0) == 0; //@line 5257
    $212 = $210 & $211; //@line 5258
    $213 = $$3265 & 8; //@line 5259
    $214 = ($213 | 0) == 0; //@line 5260
    $or$cond282 = $214 | $212; //@line 5261
    $215 = $$1236 >> 4; //@line 5262
    $216 = 1328 + $215 | 0; //@line 5263
    $$290 = $or$cond282 ? 1328 : $216; //@line 5264
    $$291 = $or$cond282 ? 0 : 2; //@line 5265
    $$0228 = $209; //@line 5266
    $$1233 = $$291; //@line 5266
    $$1238 = $$290; //@line 5266
    $$2256 = $$1255; //@line 5266
    $$4266 = $$3265; //@line 5266
    $256 = $204; //@line 5266
    $258 = $207; //@line 5266
    label = 66; //@line 5267
   } else if ((label | 0) == 65) {
    label = 0; //@line 5270
    $252 = _fmt_u($250, $251, $11) | 0; //@line 5271
    $$0228 = $252; //@line 5272
    $$1233 = $$0232; //@line 5272
    $$1238 = $$0237; //@line 5272
    $$2256 = $$0254; //@line 5272
    $$4266 = $$1263$; //@line 5272
    $256 = $250; //@line 5272
    $258 = $251; //@line 5272
    label = 66; //@line 5273
   } else if ((label | 0) == 70) {
    label = 0; //@line 5276
    $280 = _memchr($$1, 0, $$0254) | 0; //@line 5277
    $281 = ($280 | 0) == (0 | 0); //@line 5278
    $282 = $280; //@line 5279
    $283 = $$1; //@line 5280
    $284 = $282 - $283 | 0; //@line 5281
    $285 = $$1 + $$0254 | 0; //@line 5282
    $$3257 = $281 ? $$0254 : $284; //@line 5283
    $$1250 = $281 ? $285 : $280; //@line 5284
    $$2 = $$1; //@line 5285
    $$2234 = 0; //@line 5285
    $$2239 = 1328; //@line 5285
    $$2251 = $$1250; //@line 5285
    $$5 = $$3257; //@line 5285
    $$6268 = $171; //@line 5285
   } else if ((label | 0) == 74) {
    label = 0; //@line 5288
    $$0229320 = $339; //@line 5289
    $$0240319 = 0; //@line 5289
    $$1244318 = 0; //@line 5289
    while (1) {
     $293 = SAFE_HEAP_LOAD($$0229320 | 0, 4, 0) | 0 | 0; //@line 5291
     $294 = ($293 | 0) == 0; //@line 5292
     if ($294) {
      $$0240$lcssa = $$0240319; //@line 5294
      $$2245 = $$1244318; //@line 5294
      break;
     }
     $295 = _wctomb($9, $293) | 0; //@line 5297
     $296 = ($295 | 0) < 0; //@line 5298
     $297 = $$4258355 - $$0240319 | 0; //@line 5299
     $298 = $295 >>> 0 > $297 >>> 0; //@line 5300
     $or$cond285 = $296 | $298; //@line 5301
     if ($or$cond285) {
      $$0240$lcssa = $$0240319; //@line 5303
      $$2245 = $295; //@line 5303
      break;
     }
     $299 = $$0229320 + 4 | 0; //@line 5306
     $300 = $295 + $$0240319 | 0; //@line 5307
     $301 = $$4258355 >>> 0 > $300 >>> 0; //@line 5308
     if ($301) {
      $$0229320 = $299; //@line 5310
      $$0240319 = $300; //@line 5310
      $$1244318 = $295; //@line 5310
     } else {
      $$0240$lcssa = $300; //@line 5312
      $$2245 = $295; //@line 5312
      break;
     }
    }
    $302 = ($$2245 | 0) < 0; //@line 5316
    if ($302) {
     $$0 = -1; //@line 5318
     break L1;
    }
    _pad_669($0, 32, $$1260, $$0240$lcssa, $$1263$); //@line 5321
    $303 = ($$0240$lcssa | 0) == 0; //@line 5322
    if ($303) {
     $$0240$lcssa357 = 0; //@line 5324
     label = 83; //@line 5325
    } else {
     $$1230331 = $339; //@line 5327
     $$1241330 = 0; //@line 5327
     while (1) {
      $304 = SAFE_HEAP_LOAD($$1230331 | 0, 4, 0) | 0 | 0; //@line 5329
      $305 = ($304 | 0) == 0; //@line 5330
      if ($305) {
       $$0240$lcssa357 = $$0240$lcssa; //@line 5332
       label = 83; //@line 5333
       break L94;
      }
      $306 = _wctomb($9, $304) | 0; //@line 5336
      $307 = $306 + $$1241330 | 0; //@line 5337
      $308 = ($307 | 0) > ($$0240$lcssa | 0); //@line 5338
      if ($308) {
       $$0240$lcssa357 = $$0240$lcssa; //@line 5340
       label = 83; //@line 5341
       break L94;
      }
      $309 = $$1230331 + 4 | 0; //@line 5344
      _out($0, $9, $306); //@line 5345
      $310 = $307 >>> 0 < $$0240$lcssa >>> 0; //@line 5346
      if ($310) {
       $$1230331 = $309; //@line 5348
       $$1241330 = $307; //@line 5348
      } else {
       $$0240$lcssa357 = $$0240$lcssa; //@line 5350
       label = 83; //@line 5351
       break;
      }
     }
    }
   }
  } while (0);
  if ((label | 0) == 66) {
   label = 0; //@line 5359
   $253 = ($$2256 | 0) > -1; //@line 5360
   $254 = $$4266 & -65537; //@line 5361
   $$$4266 = $253 ? $254 : $$4266; //@line 5362
   $255 = ($256 | 0) != 0; //@line 5363
   $257 = ($258 | 0) != 0; //@line 5364
   $259 = $255 | $257; //@line 5365
   $260 = ($$2256 | 0) != 0; //@line 5366
   $or$cond = $260 | $259; //@line 5367
   $261 = $$0228; //@line 5368
   $262 = $12 - $261 | 0; //@line 5369
   $263 = $259 ^ 1; //@line 5370
   $264 = $263 & 1; //@line 5371
   $265 = $262 + $264 | 0; //@line 5372
   $266 = ($$2256 | 0) > ($265 | 0); //@line 5373
   $$2256$ = $266 ? $$2256 : $265; //@line 5374
   $$2256$$$2256 = $or$cond ? $$2256$ : $$2256; //@line 5375
   $$0228$ = $or$cond ? $$0228 : $11; //@line 5376
   $$2 = $$0228$; //@line 5377
   $$2234 = $$1233; //@line 5377
   $$2239 = $$1238; //@line 5377
   $$2251 = $11; //@line 5377
   $$5 = $$2256$$$2256; //@line 5377
   $$6268 = $$$4266; //@line 5377
  } else if ((label | 0) == 83) {
   label = 0; //@line 5380
   $311 = $$1263$ ^ 8192; //@line 5381
   _pad_669($0, 32, $$1260, $$0240$lcssa357, $311); //@line 5382
   $312 = ($$1260 | 0) > ($$0240$lcssa357 | 0); //@line 5383
   $313 = $312 ? $$1260 : $$0240$lcssa357; //@line 5384
   $$0243 = $313; //@line 5385
   $$0247 = $$1248; //@line 5385
   $$0269 = $$3272; //@line 5385
   $21 = $139; //@line 5385
   continue;
  }
  $316 = $$2251; //@line 5388
  $317 = $$2; //@line 5389
  $318 = $316 - $317 | 0; //@line 5390
  $319 = ($$5 | 0) < ($318 | 0); //@line 5391
  $$$5 = $319 ? $318 : $$5; //@line 5392
  $320 = $$$5 + $$2234 | 0; //@line 5393
  $321 = ($$1260 | 0) < ($320 | 0); //@line 5394
  $$2261 = $321 ? $320 : $$1260; //@line 5395
  _pad_669($0, 32, $$2261, $320, $$6268); //@line 5396
  _out($0, $$2239, $$2234); //@line 5397
  $322 = $$6268 ^ 65536; //@line 5398
  _pad_669($0, 48, $$2261, $320, $322); //@line 5399
  _pad_669($0, 48, $$$5, $318, 0); //@line 5400
  _out($0, $$2, $318); //@line 5401
  $323 = $$6268 ^ 8192; //@line 5402
  _pad_669($0, 32, $$2261, $320, $323); //@line 5403
  $$0243 = $$2261; //@line 5404
  $$0247 = $$1248; //@line 5404
  $$0269 = $$3272; //@line 5404
  $21 = $139; //@line 5404
 }
 L113 : do {
  if ((label | 0) == 86) {
   $324 = ($0 | 0) == (0 | 0); //@line 5408
   if ($324) {
    $325 = ($$0269 | 0) == 0; //@line 5410
    if ($325) {
     $$0 = 0; //@line 5412
    } else {
     $$2242306 = 1; //@line 5414
     while (1) {
      $326 = $4 + ($$2242306 << 2) | 0; //@line 5416
      $327 = SAFE_HEAP_LOAD($326 | 0, 4, 0) | 0 | 0; //@line 5417
      $328 = ($327 | 0) == 0; //@line 5418
      if ($328) {
       $$2242$lcssa = $$2242306; //@line 5420
       break;
      }
      $330 = $3 + ($$2242306 << 3) | 0; //@line 5423
      _pop_arg($330, $327, $2); //@line 5424
      $331 = $$2242306 + 1 | 0; //@line 5425
      $332 = ($$2242306 | 0) < 9; //@line 5426
      if ($332) {
       $$2242306 = $331; //@line 5428
      } else {
       $$2242$lcssa = $331; //@line 5430
       break;
      }
     }
     $329 = ($$2242$lcssa | 0) < 10; //@line 5434
     if ($329) {
      $$3304 = $$2242$lcssa; //@line 5436
      while (1) {
       $335 = $4 + ($$3304 << 2) | 0; //@line 5438
       $336 = SAFE_HEAP_LOAD($335 | 0, 4, 0) | 0 | 0; //@line 5439
       $337 = ($336 | 0) == 0; //@line 5440
       if (!$337) {
        $$0 = -1; //@line 5442
        break L113;
       }
       $333 = $$3304 + 1 | 0; //@line 5445
       $334 = ($$3304 | 0) < 9; //@line 5446
       if ($334) {
        $$3304 = $333; //@line 5448
       } else {
        $$0 = 1; //@line 5450
        break;
       }
      }
     } else {
      $$0 = 1; //@line 5455
     }
    }
   } else {
    $$0 = $$1248; //@line 5459
   }
  }
 } while (0);
 STACKTOP = sp; //@line 5463
 return $$0 | 0; //@line 5463
}
function _free($0) {
 $0 = $0 | 0; //@line 3457
 var $$0212$i = 0, $$0212$in$i = 0, $$0383 = 0, $$0384 = 0, $$0396 = 0, $$0403 = 0, $$1 = 0, $$1382 = 0, $$1387 = 0, $$1390 = 0, $$1398 = 0, $$1402 = 0, $$2 = 0, $$3 = 0, $$3400 = 0, $$pre = 0, $$pre$phi442Z2D = 0, $$pre$phi444Z2D = 0, $$pre$phiZ2D = 0, $$pre441 = 0; //@line 3458
 var $$pre443 = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0; //@line 3459
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0; //@line 3460
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0; //@line 3461
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0; //@line 3462
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0; //@line 3463
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0; //@line 3464
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0; //@line 3465
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0; //@line 3466
 var $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0; //@line 3467
 var $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0; //@line 3468
 var $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0; //@line 3469
 var $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0; //@line 3470
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0; //@line 3471
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0; //@line 3472
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0; //@line 3473
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0; //@line 3474
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond421 = 0, $cond422 = 0, label = 0, sp = 0; //@line 3475
 sp = STACKTOP; //@line 3476
 $1 = ($0 | 0) == (0 | 0); //@line 3477
 if ($1) {
  return;
 }
 $2 = $0 + -8 | 0; //@line 3481
 $3 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3482
 $4 = $2 >>> 0 < $3 >>> 0; //@line 3483
 if ($4) {
  _abort(); //@line 3485
 }
 $5 = $0 + -4 | 0; //@line 3488
 $6 = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 3489
 $7 = $6 & 3; //@line 3490
 $8 = ($7 | 0) == 1; //@line 3491
 if ($8) {
  _abort(); //@line 3493
 }
 $9 = $6 & -8; //@line 3496
 $10 = $2 + $9 | 0; //@line 3497
 $11 = $6 & 1; //@line 3498
 $12 = ($11 | 0) == 0; //@line 3499
 L10 : do {
  if ($12) {
   $13 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 3502
   $14 = ($7 | 0) == 0; //@line 3503
   if ($14) {
    return;
   }
   $15 = 0 - $13 | 0; //@line 3507
   $16 = $2 + $15 | 0; //@line 3508
   $17 = $13 + $9 | 0; //@line 3509
   $18 = $16 >>> 0 < $3 >>> 0; //@line 3510
   if ($18) {
    _abort(); //@line 3512
   }
   $19 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 3515
   $20 = ($19 | 0) == ($16 | 0); //@line 3516
   if ($20) {
    $105 = $10 + 4 | 0; //@line 3518
    $106 = SAFE_HEAP_LOAD($105 | 0, 4, 0) | 0 | 0; //@line 3519
    $107 = $106 & 3; //@line 3520
    $108 = ($107 | 0) == 3; //@line 3521
    if (!$108) {
     $$1 = $16; //@line 3523
     $$1382 = $17; //@line 3523
     $114 = $16; //@line 3523
     break;
    }
    SAFE_HEAP_STORE(3960 | 0, $17 | 0, 4);
    $109 = $106 & -2; //@line 3527
    SAFE_HEAP_STORE($105 | 0, $109 | 0, 4);
    $110 = $17 | 1; //@line 3529
    $111 = $16 + 4 | 0; //@line 3530
    SAFE_HEAP_STORE($111 | 0, $110 | 0, 4);
    $112 = $16 + $17 | 0; //@line 3532
    SAFE_HEAP_STORE($112 | 0, $17 | 0, 4);
    return;
   }
   $21 = $13 >>> 3; //@line 3536
   $22 = $13 >>> 0 < 256; //@line 3537
   if ($22) {
    $23 = $16 + 8 | 0; //@line 3539
    $24 = SAFE_HEAP_LOAD($23 | 0, 4, 0) | 0 | 0; //@line 3540
    $25 = $16 + 12 | 0; //@line 3541
    $26 = SAFE_HEAP_LOAD($25 | 0, 4, 0) | 0 | 0; //@line 3542
    $27 = $21 << 1; //@line 3543
    $28 = 3992 + ($27 << 2) | 0; //@line 3544
    $29 = ($24 | 0) == ($28 | 0); //@line 3545
    if (!$29) {
     $30 = $3 >>> 0 > $24 >>> 0; //@line 3547
     if ($30) {
      _abort(); //@line 3549
     }
     $31 = $24 + 12 | 0; //@line 3552
     $32 = SAFE_HEAP_LOAD($31 | 0, 4, 0) | 0 | 0; //@line 3553
     $33 = ($32 | 0) == ($16 | 0); //@line 3554
     if (!$33) {
      _abort(); //@line 3556
     }
    }
    $34 = ($26 | 0) == ($24 | 0); //@line 3560
    if ($34) {
     $35 = 1 << $21; //@line 3562
     $36 = $35 ^ -1; //@line 3563
     $37 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 3564
     $38 = $37 & $36; //@line 3565
     SAFE_HEAP_STORE(988 * 4 | 0, $38 | 0, 4);
     $$1 = $16; //@line 3567
     $$1382 = $17; //@line 3567
     $114 = $16; //@line 3567
     break;
    }
    $39 = ($26 | 0) == ($28 | 0); //@line 3570
    if ($39) {
     $$pre443 = $26 + 8 | 0; //@line 3572
     $$pre$phi444Z2D = $$pre443; //@line 3573
    } else {
     $40 = $3 >>> 0 > $26 >>> 0; //@line 3575
     if ($40) {
      _abort(); //@line 3577
     }
     $41 = $26 + 8 | 0; //@line 3580
     $42 = SAFE_HEAP_LOAD($41 | 0, 4, 0) | 0 | 0; //@line 3581
     $43 = ($42 | 0) == ($16 | 0); //@line 3582
     if ($43) {
      $$pre$phi444Z2D = $41; //@line 3584
     } else {
      _abort(); //@line 3586
     }
    }
    $44 = $24 + 12 | 0; //@line 3590
    SAFE_HEAP_STORE($44 | 0, $26 | 0, 4);
    SAFE_HEAP_STORE($$pre$phi444Z2D | 0, $24 | 0, 4);
    $$1 = $16; //@line 3593
    $$1382 = $17; //@line 3593
    $114 = $16; //@line 3593
    break;
   }
   $45 = $16 + 24 | 0; //@line 3596
   $46 = SAFE_HEAP_LOAD($45 | 0, 4, 0) | 0 | 0; //@line 3597
   $47 = $16 + 12 | 0; //@line 3598
   $48 = SAFE_HEAP_LOAD($47 | 0, 4, 0) | 0 | 0; //@line 3599
   $49 = ($48 | 0) == ($16 | 0); //@line 3600
   do {
    if ($49) {
     $59 = $16 + 16 | 0; //@line 3603
     $60 = $59 + 4 | 0; //@line 3604
     $61 = SAFE_HEAP_LOAD($60 | 0, 4, 0) | 0 | 0; //@line 3605
     $62 = ($61 | 0) == (0 | 0); //@line 3606
     if ($62) {
      $63 = SAFE_HEAP_LOAD($59 | 0, 4, 0) | 0 | 0; //@line 3608
      $64 = ($63 | 0) == (0 | 0); //@line 3609
      if ($64) {
       $$3 = 0; //@line 3611
       break;
      } else {
       $$1387 = $63; //@line 3614
       $$1390 = $59; //@line 3614
      }
     } else {
      $$1387 = $61; //@line 3617
      $$1390 = $60; //@line 3617
     }
     while (1) {
      $65 = $$1387 + 20 | 0; //@line 3620
      $66 = SAFE_HEAP_LOAD($65 | 0, 4, 0) | 0 | 0; //@line 3621
      $67 = ($66 | 0) == (0 | 0); //@line 3622
      if (!$67) {
       $$1387 = $66; //@line 3624
       $$1390 = $65; //@line 3624
       continue;
      }
      $68 = $$1387 + 16 | 0; //@line 3627
      $69 = SAFE_HEAP_LOAD($68 | 0, 4, 0) | 0 | 0; //@line 3628
      $70 = ($69 | 0) == (0 | 0); //@line 3629
      if ($70) {
       break;
      } else {
       $$1387 = $69; //@line 3633
       $$1390 = $68; //@line 3633
      }
     }
     $71 = $3 >>> 0 > $$1390 >>> 0; //@line 3636
     if ($71) {
      _abort(); //@line 3638
     } else {
      SAFE_HEAP_STORE($$1390 | 0, 0 | 0, 4);
      $$3 = $$1387; //@line 3642
      break;
     }
    } else {
     $50 = $16 + 8 | 0; //@line 3646
     $51 = SAFE_HEAP_LOAD($50 | 0, 4, 0) | 0 | 0; //@line 3647
     $52 = $3 >>> 0 > $51 >>> 0; //@line 3648
     if ($52) {
      _abort(); //@line 3650
     }
     $53 = $51 + 12 | 0; //@line 3653
     $54 = SAFE_HEAP_LOAD($53 | 0, 4, 0) | 0 | 0; //@line 3654
     $55 = ($54 | 0) == ($16 | 0); //@line 3655
     if (!$55) {
      _abort(); //@line 3657
     }
     $56 = $48 + 8 | 0; //@line 3660
     $57 = SAFE_HEAP_LOAD($56 | 0, 4, 0) | 0 | 0; //@line 3661
     $58 = ($57 | 0) == ($16 | 0); //@line 3662
     if ($58) {
      SAFE_HEAP_STORE($53 | 0, $48 | 0, 4);
      SAFE_HEAP_STORE($56 | 0, $51 | 0, 4);
      $$3 = $48; //@line 3666
      break;
     } else {
      _abort(); //@line 3669
     }
    }
   } while (0);
   $72 = ($46 | 0) == (0 | 0); //@line 3674
   if ($72) {
    $$1 = $16; //@line 3676
    $$1382 = $17; //@line 3676
    $114 = $16; //@line 3676
   } else {
    $73 = $16 + 28 | 0; //@line 3678
    $74 = SAFE_HEAP_LOAD($73 | 0, 4, 0) | 0 | 0; //@line 3679
    $75 = 4256 + ($74 << 2) | 0; //@line 3680
    $76 = SAFE_HEAP_LOAD($75 | 0, 4, 0) | 0 | 0; //@line 3681
    $77 = ($76 | 0) == ($16 | 0); //@line 3682
    do {
     if ($77) {
      SAFE_HEAP_STORE($75 | 0, $$3 | 0, 4);
      $cond421 = ($$3 | 0) == (0 | 0); //@line 3686
      if ($cond421) {
       $78 = 1 << $74; //@line 3688
       $79 = $78 ^ -1; //@line 3689
       $80 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 3690
       $81 = $80 & $79; //@line 3691
       SAFE_HEAP_STORE(3956 | 0, $81 | 0, 4);
       $$1 = $16; //@line 3693
       $$1382 = $17; //@line 3693
       $114 = $16; //@line 3693
       break L10;
      }
     } else {
      $82 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3697
      $83 = $82 >>> 0 > $46 >>> 0; //@line 3698
      if ($83) {
       _abort(); //@line 3700
      } else {
       $84 = $46 + 16 | 0; //@line 3703
       $85 = SAFE_HEAP_LOAD($84 | 0, 4, 0) | 0 | 0; //@line 3704
       $86 = ($85 | 0) != ($16 | 0); //@line 3705
       $$sink3 = $86 & 1; //@line 3706
       $87 = ($46 + 16 | 0) + ($$sink3 << 2) | 0; //@line 3707
       SAFE_HEAP_STORE($87 | 0, $$3 | 0, 4);
       $88 = ($$3 | 0) == (0 | 0); //@line 3709
       if ($88) {
        $$1 = $16; //@line 3711
        $$1382 = $17; //@line 3711
        $114 = $16; //@line 3711
        break L10;
       } else {
        break;
       }
      }
     }
    } while (0);
    $89 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3719
    $90 = $89 >>> 0 > $$3 >>> 0; //@line 3720
    if ($90) {
     _abort(); //@line 3722
    }
    $91 = $$3 + 24 | 0; //@line 3725
    SAFE_HEAP_STORE($91 | 0, $46 | 0, 4);
    $92 = $16 + 16 | 0; //@line 3727
    $93 = SAFE_HEAP_LOAD($92 | 0, 4, 0) | 0 | 0; //@line 3728
    $94 = ($93 | 0) == (0 | 0); //@line 3729
    do {
     if (!$94) {
      $95 = $89 >>> 0 > $93 >>> 0; //@line 3732
      if ($95) {
       _abort(); //@line 3734
      } else {
       $96 = $$3 + 16 | 0; //@line 3737
       SAFE_HEAP_STORE($96 | 0, $93 | 0, 4);
       $97 = $93 + 24 | 0; //@line 3739
       SAFE_HEAP_STORE($97 | 0, $$3 | 0, 4);
       break;
      }
     }
    } while (0);
    $98 = $92 + 4 | 0; //@line 3745
    $99 = SAFE_HEAP_LOAD($98 | 0, 4, 0) | 0 | 0; //@line 3746
    $100 = ($99 | 0) == (0 | 0); //@line 3747
    if ($100) {
     $$1 = $16; //@line 3749
     $$1382 = $17; //@line 3749
     $114 = $16; //@line 3749
    } else {
     $101 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3751
     $102 = $101 >>> 0 > $99 >>> 0; //@line 3752
     if ($102) {
      _abort(); //@line 3754
     } else {
      $103 = $$3 + 20 | 0; //@line 3757
      SAFE_HEAP_STORE($103 | 0, $99 | 0, 4);
      $104 = $99 + 24 | 0; //@line 3759
      SAFE_HEAP_STORE($104 | 0, $$3 | 0, 4);
      $$1 = $16; //@line 3761
      $$1382 = $17; //@line 3761
      $114 = $16; //@line 3761
      break;
     }
    }
   }
  } else {
   $$1 = $2; //@line 3767
   $$1382 = $9; //@line 3767
   $114 = $2; //@line 3767
  }
 } while (0);
 $113 = $114 >>> 0 < $10 >>> 0; //@line 3770
 if (!$113) {
  _abort(); //@line 3772
 }
 $115 = $10 + 4 | 0; //@line 3775
 $116 = SAFE_HEAP_LOAD($115 | 0, 4, 0) | 0 | 0; //@line 3776
 $117 = $116 & 1; //@line 3777
 $118 = ($117 | 0) == 0; //@line 3778
 if ($118) {
  _abort(); //@line 3780
 }
 $119 = $116 & 2; //@line 3783
 $120 = ($119 | 0) == 0; //@line 3784
 if ($120) {
  $121 = SAFE_HEAP_LOAD(3976 | 0, 4, 0) | 0 | 0; //@line 3786
  $122 = ($121 | 0) == ($10 | 0); //@line 3787
  if ($122) {
   $123 = SAFE_HEAP_LOAD(3964 | 0, 4, 0) | 0 | 0; //@line 3789
   $124 = $123 + $$1382 | 0; //@line 3790
   SAFE_HEAP_STORE(3964 | 0, $124 | 0, 4);
   SAFE_HEAP_STORE(3976 | 0, $$1 | 0, 4);
   $125 = $124 | 1; //@line 3793
   $126 = $$1 + 4 | 0; //@line 3794
   SAFE_HEAP_STORE($126 | 0, $125 | 0, 4);
   $127 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 3796
   $128 = ($$1 | 0) == ($127 | 0); //@line 3797
   if (!$128) {
    return;
   }
   SAFE_HEAP_STORE(3972 | 0, 0 | 0, 4);
   SAFE_HEAP_STORE(3960 | 0, 0 | 0, 4);
   return;
  }
  $129 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 3805
  $130 = ($129 | 0) == ($10 | 0); //@line 3806
  if ($130) {
   $131 = SAFE_HEAP_LOAD(3960 | 0, 4, 0) | 0 | 0; //@line 3808
   $132 = $131 + $$1382 | 0; //@line 3809
   SAFE_HEAP_STORE(3960 | 0, $132 | 0, 4);
   SAFE_HEAP_STORE(3972 | 0, $114 | 0, 4);
   $133 = $132 | 1; //@line 3812
   $134 = $$1 + 4 | 0; //@line 3813
   SAFE_HEAP_STORE($134 | 0, $133 | 0, 4);
   $135 = $114 + $132 | 0; //@line 3815
   SAFE_HEAP_STORE($135 | 0, $132 | 0, 4);
   return;
  }
  $136 = $116 & -8; //@line 3819
  $137 = $136 + $$1382 | 0; //@line 3820
  $138 = $116 >>> 3; //@line 3821
  $139 = $116 >>> 0 < 256; //@line 3822
  L108 : do {
   if ($139) {
    $140 = $10 + 8 | 0; //@line 3825
    $141 = SAFE_HEAP_LOAD($140 | 0, 4, 0) | 0 | 0; //@line 3826
    $142 = $10 + 12 | 0; //@line 3827
    $143 = SAFE_HEAP_LOAD($142 | 0, 4, 0) | 0 | 0; //@line 3828
    $144 = $138 << 1; //@line 3829
    $145 = 3992 + ($144 << 2) | 0; //@line 3830
    $146 = ($141 | 0) == ($145 | 0); //@line 3831
    if (!$146) {
     $147 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3833
     $148 = $147 >>> 0 > $141 >>> 0; //@line 3834
     if ($148) {
      _abort(); //@line 3836
     }
     $149 = $141 + 12 | 0; //@line 3839
     $150 = SAFE_HEAP_LOAD($149 | 0, 4, 0) | 0 | 0; //@line 3840
     $151 = ($150 | 0) == ($10 | 0); //@line 3841
     if (!$151) {
      _abort(); //@line 3843
     }
    }
    $152 = ($143 | 0) == ($141 | 0); //@line 3847
    if ($152) {
     $153 = 1 << $138; //@line 3849
     $154 = $153 ^ -1; //@line 3850
     $155 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 3851
     $156 = $155 & $154; //@line 3852
     SAFE_HEAP_STORE(988 * 4 | 0, $156 | 0, 4);
     break;
    }
    $157 = ($143 | 0) == ($145 | 0); //@line 3856
    if ($157) {
     $$pre441 = $143 + 8 | 0; //@line 3858
     $$pre$phi442Z2D = $$pre441; //@line 3859
    } else {
     $158 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3861
     $159 = $158 >>> 0 > $143 >>> 0; //@line 3862
     if ($159) {
      _abort(); //@line 3864
     }
     $160 = $143 + 8 | 0; //@line 3867
     $161 = SAFE_HEAP_LOAD($160 | 0, 4, 0) | 0 | 0; //@line 3868
     $162 = ($161 | 0) == ($10 | 0); //@line 3869
     if ($162) {
      $$pre$phi442Z2D = $160; //@line 3871
     } else {
      _abort(); //@line 3873
     }
    }
    $163 = $141 + 12 | 0; //@line 3877
    SAFE_HEAP_STORE($163 | 0, $143 | 0, 4);
    SAFE_HEAP_STORE($$pre$phi442Z2D | 0, $141 | 0, 4);
   } else {
    $164 = $10 + 24 | 0; //@line 3881
    $165 = SAFE_HEAP_LOAD($164 | 0, 4, 0) | 0 | 0; //@line 3882
    $166 = $10 + 12 | 0; //@line 3883
    $167 = SAFE_HEAP_LOAD($166 | 0, 4, 0) | 0 | 0; //@line 3884
    $168 = ($167 | 0) == ($10 | 0); //@line 3885
    do {
     if ($168) {
      $179 = $10 + 16 | 0; //@line 3888
      $180 = $179 + 4 | 0; //@line 3889
      $181 = SAFE_HEAP_LOAD($180 | 0, 4, 0) | 0 | 0; //@line 3890
      $182 = ($181 | 0) == (0 | 0); //@line 3891
      if ($182) {
       $183 = SAFE_HEAP_LOAD($179 | 0, 4, 0) | 0 | 0; //@line 3893
       $184 = ($183 | 0) == (0 | 0); //@line 3894
       if ($184) {
        $$3400 = 0; //@line 3896
        break;
       } else {
        $$1398 = $183; //@line 3899
        $$1402 = $179; //@line 3899
       }
      } else {
       $$1398 = $181; //@line 3902
       $$1402 = $180; //@line 3902
      }
      while (1) {
       $185 = $$1398 + 20 | 0; //@line 3905
       $186 = SAFE_HEAP_LOAD($185 | 0, 4, 0) | 0 | 0; //@line 3906
       $187 = ($186 | 0) == (0 | 0); //@line 3907
       if (!$187) {
        $$1398 = $186; //@line 3909
        $$1402 = $185; //@line 3909
        continue;
       }
       $188 = $$1398 + 16 | 0; //@line 3912
       $189 = SAFE_HEAP_LOAD($188 | 0, 4, 0) | 0 | 0; //@line 3913
       $190 = ($189 | 0) == (0 | 0); //@line 3914
       if ($190) {
        break;
       } else {
        $$1398 = $189; //@line 3918
        $$1402 = $188; //@line 3918
       }
      }
      $191 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3921
      $192 = $191 >>> 0 > $$1402 >>> 0; //@line 3922
      if ($192) {
       _abort(); //@line 3924
      } else {
       SAFE_HEAP_STORE($$1402 | 0, 0 | 0, 4);
       $$3400 = $$1398; //@line 3928
       break;
      }
     } else {
      $169 = $10 + 8 | 0; //@line 3932
      $170 = SAFE_HEAP_LOAD($169 | 0, 4, 0) | 0 | 0; //@line 3933
      $171 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3934
      $172 = $171 >>> 0 > $170 >>> 0; //@line 3935
      if ($172) {
       _abort(); //@line 3937
      }
      $173 = $170 + 12 | 0; //@line 3940
      $174 = SAFE_HEAP_LOAD($173 | 0, 4, 0) | 0 | 0; //@line 3941
      $175 = ($174 | 0) == ($10 | 0); //@line 3942
      if (!$175) {
       _abort(); //@line 3944
      }
      $176 = $167 + 8 | 0; //@line 3947
      $177 = SAFE_HEAP_LOAD($176 | 0, 4, 0) | 0 | 0; //@line 3948
      $178 = ($177 | 0) == ($10 | 0); //@line 3949
      if ($178) {
       SAFE_HEAP_STORE($173 | 0, $167 | 0, 4);
       SAFE_HEAP_STORE($176 | 0, $170 | 0, 4);
       $$3400 = $167; //@line 3953
       break;
      } else {
       _abort(); //@line 3956
      }
     }
    } while (0);
    $193 = ($165 | 0) == (0 | 0); //@line 3961
    if (!$193) {
     $194 = $10 + 28 | 0; //@line 3963
     $195 = SAFE_HEAP_LOAD($194 | 0, 4, 0) | 0 | 0; //@line 3964
     $196 = 4256 + ($195 << 2) | 0; //@line 3965
     $197 = SAFE_HEAP_LOAD($196 | 0, 4, 0) | 0 | 0; //@line 3966
     $198 = ($197 | 0) == ($10 | 0); //@line 3967
     do {
      if ($198) {
       SAFE_HEAP_STORE($196 | 0, $$3400 | 0, 4);
       $cond422 = ($$3400 | 0) == (0 | 0); //@line 3971
       if ($cond422) {
        $199 = 1 << $195; //@line 3973
        $200 = $199 ^ -1; //@line 3974
        $201 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 3975
        $202 = $201 & $200; //@line 3976
        SAFE_HEAP_STORE(3956 | 0, $202 | 0, 4);
        break L108;
       }
      } else {
       $203 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 3981
       $204 = $203 >>> 0 > $165 >>> 0; //@line 3982
       if ($204) {
        _abort(); //@line 3984
       } else {
        $205 = $165 + 16 | 0; //@line 3987
        $206 = SAFE_HEAP_LOAD($205 | 0, 4, 0) | 0 | 0; //@line 3988
        $207 = ($206 | 0) != ($10 | 0); //@line 3989
        $$sink5 = $207 & 1; //@line 3990
        $208 = ($165 + 16 | 0) + ($$sink5 << 2) | 0; //@line 3991
        SAFE_HEAP_STORE($208 | 0, $$3400 | 0, 4);
        $209 = ($$3400 | 0) == (0 | 0); //@line 3993
        if ($209) {
         break L108;
        } else {
         break;
        }
       }
      }
     } while (0);
     $210 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 4002
     $211 = $210 >>> 0 > $$3400 >>> 0; //@line 4003
     if ($211) {
      _abort(); //@line 4005
     }
     $212 = $$3400 + 24 | 0; //@line 4008
     SAFE_HEAP_STORE($212 | 0, $165 | 0, 4);
     $213 = $10 + 16 | 0; //@line 4010
     $214 = SAFE_HEAP_LOAD($213 | 0, 4, 0) | 0 | 0; //@line 4011
     $215 = ($214 | 0) == (0 | 0); //@line 4012
     do {
      if (!$215) {
       $216 = $210 >>> 0 > $214 >>> 0; //@line 4015
       if ($216) {
        _abort(); //@line 4017
       } else {
        $217 = $$3400 + 16 | 0; //@line 4020
        SAFE_HEAP_STORE($217 | 0, $214 | 0, 4);
        $218 = $214 + 24 | 0; //@line 4022
        SAFE_HEAP_STORE($218 | 0, $$3400 | 0, 4);
        break;
       }
      }
     } while (0);
     $219 = $213 + 4 | 0; //@line 4028
     $220 = SAFE_HEAP_LOAD($219 | 0, 4, 0) | 0 | 0; //@line 4029
     $221 = ($220 | 0) == (0 | 0); //@line 4030
     if (!$221) {
      $222 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 4032
      $223 = $222 >>> 0 > $220 >>> 0; //@line 4033
      if ($223) {
       _abort(); //@line 4035
      } else {
       $224 = $$3400 + 20 | 0; //@line 4038
       SAFE_HEAP_STORE($224 | 0, $220 | 0, 4);
       $225 = $220 + 24 | 0; //@line 4040
       SAFE_HEAP_STORE($225 | 0, $$3400 | 0, 4);
       break;
      }
     }
    }
   }
  } while (0);
  $226 = $137 | 1; //@line 4048
  $227 = $$1 + 4 | 0; //@line 4049
  SAFE_HEAP_STORE($227 | 0, $226 | 0, 4);
  $228 = $114 + $137 | 0; //@line 4051
  SAFE_HEAP_STORE($228 | 0, $137 | 0, 4);
  $229 = SAFE_HEAP_LOAD(3972 | 0, 4, 0) | 0 | 0; //@line 4053
  $230 = ($$1 | 0) == ($229 | 0); //@line 4054
  if ($230) {
   SAFE_HEAP_STORE(3960 | 0, $137 | 0, 4);
   return;
  } else {
   $$2 = $137; //@line 4059
  }
 } else {
  $231 = $116 & -2; //@line 4062
  SAFE_HEAP_STORE($115 | 0, $231 | 0, 4);
  $232 = $$1382 | 1; //@line 4064
  $233 = $$1 + 4 | 0; //@line 4065
  SAFE_HEAP_STORE($233 | 0, $232 | 0, 4);
  $234 = $114 + $$1382 | 0; //@line 4067
  SAFE_HEAP_STORE($234 | 0, $$1382 | 0, 4);
  $$2 = $$1382; //@line 4069
 }
 $235 = $$2 >>> 3; //@line 4071
 $236 = $$2 >>> 0 < 256; //@line 4072
 if ($236) {
  $237 = $235 << 1; //@line 4074
  $238 = 3992 + ($237 << 2) | 0; //@line 4075
  $239 = SAFE_HEAP_LOAD(988 * 4 | 0, 4, 0) | 0 | 0; //@line 4076
  $240 = 1 << $235; //@line 4077
  $241 = $239 & $240; //@line 4078
  $242 = ($241 | 0) == 0; //@line 4079
  if ($242) {
   $243 = $239 | $240; //@line 4081
   SAFE_HEAP_STORE(988 * 4 | 0, $243 | 0, 4);
   $$pre = $238 + 8 | 0; //@line 4083
   $$0403 = $238; //@line 4084
   $$pre$phiZ2D = $$pre; //@line 4084
  } else {
   $244 = $238 + 8 | 0; //@line 4086
   $245 = SAFE_HEAP_LOAD($244 | 0, 4, 0) | 0 | 0; //@line 4087
   $246 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 4088
   $247 = $246 >>> 0 > $245 >>> 0; //@line 4089
   if ($247) {
    _abort(); //@line 4091
   } else {
    $$0403 = $245; //@line 4094
    $$pre$phiZ2D = $244; //@line 4094
   }
  }
  SAFE_HEAP_STORE($$pre$phiZ2D | 0, $$1 | 0, 4);
  $248 = $$0403 + 12 | 0; //@line 4098
  SAFE_HEAP_STORE($248 | 0, $$1 | 0, 4);
  $249 = $$1 + 8 | 0; //@line 4100
  SAFE_HEAP_STORE($249 | 0, $$0403 | 0, 4);
  $250 = $$1 + 12 | 0; //@line 4102
  SAFE_HEAP_STORE($250 | 0, $238 | 0, 4);
  return;
 }
 $251 = $$2 >>> 8; //@line 4106
 $252 = ($251 | 0) == 0; //@line 4107
 if ($252) {
  $$0396 = 0; //@line 4109
 } else {
  $253 = $$2 >>> 0 > 16777215; //@line 4111
  if ($253) {
   $$0396 = 31; //@line 4113
  } else {
   $254 = $251 + 1048320 | 0; //@line 4115
   $255 = $254 >>> 16; //@line 4116
   $256 = $255 & 8; //@line 4117
   $257 = $251 << $256; //@line 4118
   $258 = $257 + 520192 | 0; //@line 4119
   $259 = $258 >>> 16; //@line 4120
   $260 = $259 & 4; //@line 4121
   $261 = $260 | $256; //@line 4122
   $262 = $257 << $260; //@line 4123
   $263 = $262 + 245760 | 0; //@line 4124
   $264 = $263 >>> 16; //@line 4125
   $265 = $264 & 2; //@line 4126
   $266 = $261 | $265; //@line 4127
   $267 = 14 - $266 | 0; //@line 4128
   $268 = $262 << $265; //@line 4129
   $269 = $268 >>> 15; //@line 4130
   $270 = $267 + $269 | 0; //@line 4131
   $271 = $270 << 1; //@line 4132
   $272 = $270 + 7 | 0; //@line 4133
   $273 = $$2 >>> $272; //@line 4134
   $274 = $273 & 1; //@line 4135
   $275 = $274 | $271; //@line 4136
   $$0396 = $275; //@line 4137
  }
 }
 $276 = 4256 + ($$0396 << 2) | 0; //@line 4140
 $277 = $$1 + 28 | 0; //@line 4141
 SAFE_HEAP_STORE($277 | 0, $$0396 | 0, 4);
 $278 = $$1 + 16 | 0; //@line 4143
 $279 = $$1 + 20 | 0; //@line 4144
 SAFE_HEAP_STORE($279 | 0, 0 | 0, 4);
 SAFE_HEAP_STORE($278 | 0, 0 | 0, 4);
 $280 = SAFE_HEAP_LOAD(3956 | 0, 4, 0) | 0 | 0; //@line 4147
 $281 = 1 << $$0396; //@line 4148
 $282 = $280 & $281; //@line 4149
 $283 = ($282 | 0) == 0; //@line 4150
 do {
  if ($283) {
   $284 = $280 | $281; //@line 4153
   SAFE_HEAP_STORE(3956 | 0, $284 | 0, 4);
   SAFE_HEAP_STORE($276 | 0, $$1 | 0, 4);
   $285 = $$1 + 24 | 0; //@line 4156
   SAFE_HEAP_STORE($285 | 0, $276 | 0, 4);
   $286 = $$1 + 12 | 0; //@line 4158
   SAFE_HEAP_STORE($286 | 0, $$1 | 0, 4);
   $287 = $$1 + 8 | 0; //@line 4160
   SAFE_HEAP_STORE($287 | 0, $$1 | 0, 4);
  } else {
   $288 = SAFE_HEAP_LOAD($276 | 0, 4, 0) | 0 | 0; //@line 4163
   $289 = ($$0396 | 0) == 31; //@line 4164
   $290 = $$0396 >>> 1; //@line 4165
   $291 = 25 - $290 | 0; //@line 4166
   $292 = $289 ? 0 : $291; //@line 4167
   $293 = $$2 << $292; //@line 4168
   $$0383 = $293; //@line 4169
   $$0384 = $288; //@line 4169
   while (1) {
    $294 = $$0384 + 4 | 0; //@line 4171
    $295 = SAFE_HEAP_LOAD($294 | 0, 4, 0) | 0 | 0; //@line 4172
    $296 = $295 & -8; //@line 4173
    $297 = ($296 | 0) == ($$2 | 0); //@line 4174
    if ($297) {
     label = 124; //@line 4176
     break;
    }
    $298 = $$0383 >>> 31; //@line 4179
    $299 = ($$0384 + 16 | 0) + ($298 << 2) | 0; //@line 4180
    $300 = $$0383 << 1; //@line 4181
    $301 = SAFE_HEAP_LOAD($299 | 0, 4, 0) | 0 | 0; //@line 4182
    $302 = ($301 | 0) == (0 | 0); //@line 4183
    if ($302) {
     label = 121; //@line 4185
     break;
    } else {
     $$0383 = $300; //@line 4188
     $$0384 = $301; //@line 4188
    }
   }
   if ((label | 0) == 121) {
    $303 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 4192
    $304 = $303 >>> 0 > $299 >>> 0; //@line 4193
    if ($304) {
     _abort(); //@line 4195
    } else {
     SAFE_HEAP_STORE($299 | 0, $$1 | 0, 4);
     $305 = $$1 + 24 | 0; //@line 4199
     SAFE_HEAP_STORE($305 | 0, $$0384 | 0, 4);
     $306 = $$1 + 12 | 0; //@line 4201
     SAFE_HEAP_STORE($306 | 0, $$1 | 0, 4);
     $307 = $$1 + 8 | 0; //@line 4203
     SAFE_HEAP_STORE($307 | 0, $$1 | 0, 4);
     break;
    }
   } else if ((label | 0) == 124) {
    $308 = $$0384 + 8 | 0; //@line 4209
    $309 = SAFE_HEAP_LOAD($308 | 0, 4, 0) | 0 | 0; //@line 4210
    $310 = SAFE_HEAP_LOAD(3968 | 0, 4, 0) | 0 | 0; //@line 4211
    $311 = $310 >>> 0 <= $$0384 >>> 0; //@line 4212
    $312 = $310 >>> 0 <= $309 >>> 0; //@line 4213
    $313 = $312 & $311; //@line 4214
    if ($313) {
     $314 = $309 + 12 | 0; //@line 4216
     SAFE_HEAP_STORE($314 | 0, $$1 | 0, 4);
     SAFE_HEAP_STORE($308 | 0, $$1 | 0, 4);
     $315 = $$1 + 8 | 0; //@line 4219
     SAFE_HEAP_STORE($315 | 0, $309 | 0, 4);
     $316 = $$1 + 12 | 0; //@line 4221
     SAFE_HEAP_STORE($316 | 0, $$0384 | 0, 4);
     $317 = $$1 + 24 | 0; //@line 4223
     SAFE_HEAP_STORE($317 | 0, 0 | 0, 4);
     break;
    } else {
     _abort(); //@line 4227
    }
   }
  }
 } while (0);
 $318 = SAFE_HEAP_LOAD(3984 | 0, 4, 0) | 0 | 0; //@line 4233
 $319 = $318 + -1 | 0; //@line 4234
 SAFE_HEAP_STORE(3984 | 0, $319 | 0, 4);
 $320 = ($319 | 0) == 0; //@line 4236
 if ($320) {
  $$0212$in$i = 4408; //@line 4238
 } else {
  return;
 }
 while (1) {
  $$0212$i = SAFE_HEAP_LOAD($$0212$in$i | 0, 4, 0) | 0 | 0; //@line 4243
  $321 = ($$0212$i | 0) == (0 | 0); //@line 4244
  $322 = $$0212$i + 8 | 0; //@line 4245
  if ($321) {
   break;
  } else {
   $$0212$in$i = $322; //@line 4249
  }
 }
 SAFE_HEAP_STORE(3984 | 0, -1 | 0, 4);
 return;
}
function _pop_arg($0, $1, $2) {
 $0 = $0 | 0; //@line 5524
 $1 = $1 | 0; //@line 5525
 $2 = $2 | 0; //@line 5526
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0; //@line 5527
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0; //@line 5529
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0; //@line 5530
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0; //@line 5531
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0; //@line 5532
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0; //@line 5533
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0; //@line 5534
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0; //@line 5535
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0; //@line 5536
 sp = STACKTOP; //@line 5537
 $3 = $1 >>> 0 > 20; //@line 5538
 L1 : do {
  if (!$3) {
   do {
    switch ($1 | 0) {
    case 9:
     {
      $arglist_current = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5544
      $4 = $arglist_current; //@line 5545
      $5 = 0 + 4 | 0; //@line 5546
      $expanded28 = $5; //@line 5547
      $expanded = $expanded28 - 1 | 0; //@line 5548
      $6 = $4 + $expanded | 0; //@line 5549
      $7 = 0 + 4 | 0; //@line 5550
      $expanded32 = $7; //@line 5551
      $expanded31 = $expanded32 - 1 | 0; //@line 5552
      $expanded30 = $expanded31 ^ -1; //@line 5553
      $8 = $6 & $expanded30; //@line 5554
      $9 = $8; //@line 5555
      $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 5556
      $arglist_next = $9 + 4 | 0; //@line 5557
      SAFE_HEAP_STORE($2 | 0, $arglist_next | 0, 4);
      SAFE_HEAP_STORE($0 | 0, $10 | 0, 4);
      break L1;
      break;
     }
    case 10:
     {
      $arglist_current2 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5564
      $11 = $arglist_current2; //@line 5565
      $12 = 0 + 4 | 0; //@line 5566
      $expanded35 = $12; //@line 5567
      $expanded34 = $expanded35 - 1 | 0; //@line 5568
      $13 = $11 + $expanded34 | 0; //@line 5569
      $14 = 0 + 4 | 0; //@line 5570
      $expanded39 = $14; //@line 5571
      $expanded38 = $expanded39 - 1 | 0; //@line 5572
      $expanded37 = $expanded38 ^ -1; //@line 5573
      $15 = $13 & $expanded37; //@line 5574
      $16 = $15; //@line 5575
      $17 = SAFE_HEAP_LOAD($16 | 0, 4, 0) | 0 | 0; //@line 5576
      $arglist_next3 = $16 + 4 | 0; //@line 5577
      SAFE_HEAP_STORE($2 | 0, $arglist_next3 | 0, 4);
      $18 = ($17 | 0) < 0; //@line 5579
      $19 = $18 << 31 >> 31; //@line 5580
      $20 = $0; //@line 5581
      $21 = $20; //@line 5582
      SAFE_HEAP_STORE($21 | 0, $17 | 0, 4);
      $22 = $20 + 4 | 0; //@line 5584
      $23 = $22; //@line 5585
      SAFE_HEAP_STORE($23 | 0, $19 | 0, 4);
      break L1;
      break;
     }
    case 11:
     {
      $arglist_current5 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5591
      $24 = $arglist_current5; //@line 5592
      $25 = 0 + 4 | 0; //@line 5593
      $expanded42 = $25; //@line 5594
      $expanded41 = $expanded42 - 1 | 0; //@line 5595
      $26 = $24 + $expanded41 | 0; //@line 5596
      $27 = 0 + 4 | 0; //@line 5597
      $expanded46 = $27; //@line 5598
      $expanded45 = $expanded46 - 1 | 0; //@line 5599
      $expanded44 = $expanded45 ^ -1; //@line 5600
      $28 = $26 & $expanded44; //@line 5601
      $29 = $28; //@line 5602
      $30 = SAFE_HEAP_LOAD($29 | 0, 4, 0) | 0 | 0; //@line 5603
      $arglist_next6 = $29 + 4 | 0; //@line 5604
      SAFE_HEAP_STORE($2 | 0, $arglist_next6 | 0, 4);
      $31 = $0; //@line 5606
      $32 = $31; //@line 5607
      SAFE_HEAP_STORE($32 | 0, $30 | 0, 4);
      $33 = $31 + 4 | 0; //@line 5609
      $34 = $33; //@line 5610
      SAFE_HEAP_STORE($34 | 0, 0 | 0, 4);
      break L1;
      break;
     }
    case 12:
     {
      $arglist_current8 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5616
      $35 = $arglist_current8; //@line 5617
      $36 = 0 + 8 | 0; //@line 5618
      $expanded49 = $36; //@line 5619
      $expanded48 = $expanded49 - 1 | 0; //@line 5620
      $37 = $35 + $expanded48 | 0; //@line 5621
      $38 = 0 + 8 | 0; //@line 5622
      $expanded53 = $38; //@line 5623
      $expanded52 = $expanded53 - 1 | 0; //@line 5624
      $expanded51 = $expanded52 ^ -1; //@line 5625
      $39 = $37 & $expanded51; //@line 5626
      $40 = $39; //@line 5627
      $41 = $40; //@line 5628
      $42 = $41; //@line 5629
      $43 = SAFE_HEAP_LOAD($42 | 0, 4, 0) | 0 | 0; //@line 5630
      $44 = $41 + 4 | 0; //@line 5631
      $45 = $44; //@line 5632
      $46 = SAFE_HEAP_LOAD($45 | 0, 4, 0) | 0 | 0; //@line 5633
      $arglist_next9 = $40 + 8 | 0; //@line 5634
      SAFE_HEAP_STORE($2 | 0, $arglist_next9 | 0, 4);
      $47 = $0; //@line 5636
      $48 = $47; //@line 5637
      SAFE_HEAP_STORE($48 | 0, $43 | 0, 4);
      $49 = $47 + 4 | 0; //@line 5639
      $50 = $49; //@line 5640
      SAFE_HEAP_STORE($50 | 0, $46 | 0, 4);
      break L1;
      break;
     }
    case 13:
     {
      $arglist_current11 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5646
      $51 = $arglist_current11; //@line 5647
      $52 = 0 + 4 | 0; //@line 5648
      $expanded56 = $52; //@line 5649
      $expanded55 = $expanded56 - 1 | 0; //@line 5650
      $53 = $51 + $expanded55 | 0; //@line 5651
      $54 = 0 + 4 | 0; //@line 5652
      $expanded60 = $54; //@line 5653
      $expanded59 = $expanded60 - 1 | 0; //@line 5654
      $expanded58 = $expanded59 ^ -1; //@line 5655
      $55 = $53 & $expanded58; //@line 5656
      $56 = $55; //@line 5657
      $57 = SAFE_HEAP_LOAD($56 | 0, 4, 0) | 0 | 0; //@line 5658
      $arglist_next12 = $56 + 4 | 0; //@line 5659
      SAFE_HEAP_STORE($2 | 0, $arglist_next12 | 0, 4);
      $58 = $57 & 65535; //@line 5661
      $59 = $58 << 16 >> 16; //@line 5662
      $60 = ($59 | 0) < 0; //@line 5663
      $61 = $60 << 31 >> 31; //@line 5664
      $62 = $0; //@line 5665
      $63 = $62; //@line 5666
      SAFE_HEAP_STORE($63 | 0, $59 | 0, 4);
      $64 = $62 + 4 | 0; //@line 5668
      $65 = $64; //@line 5669
      SAFE_HEAP_STORE($65 | 0, $61 | 0, 4);
      break L1;
      break;
     }
    case 14:
     {
      $arglist_current14 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5675
      $66 = $arglist_current14; //@line 5676
      $67 = 0 + 4 | 0; //@line 5677
      $expanded63 = $67; //@line 5678
      $expanded62 = $expanded63 - 1 | 0; //@line 5679
      $68 = $66 + $expanded62 | 0; //@line 5680
      $69 = 0 + 4 | 0; //@line 5681
      $expanded67 = $69; //@line 5682
      $expanded66 = $expanded67 - 1 | 0; //@line 5683
      $expanded65 = $expanded66 ^ -1; //@line 5684
      $70 = $68 & $expanded65; //@line 5685
      $71 = $70; //@line 5686
      $72 = SAFE_HEAP_LOAD($71 | 0, 4, 0) | 0 | 0; //@line 5687
      $arglist_next15 = $71 + 4 | 0; //@line 5688
      SAFE_HEAP_STORE($2 | 0, $arglist_next15 | 0, 4);
      $$mask31 = $72 & 65535; //@line 5690
      $73 = $0; //@line 5691
      $74 = $73; //@line 5692
      SAFE_HEAP_STORE($74 | 0, $$mask31 | 0, 4);
      $75 = $73 + 4 | 0; //@line 5694
      $76 = $75; //@line 5695
      SAFE_HEAP_STORE($76 | 0, 0 | 0, 4);
      break L1;
      break;
     }
    case 15:
     {
      $arglist_current17 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5701
      $77 = $arglist_current17; //@line 5702
      $78 = 0 + 4 | 0; //@line 5703
      $expanded70 = $78; //@line 5704
      $expanded69 = $expanded70 - 1 | 0; //@line 5705
      $79 = $77 + $expanded69 | 0; //@line 5706
      $80 = 0 + 4 | 0; //@line 5707
      $expanded74 = $80; //@line 5708
      $expanded73 = $expanded74 - 1 | 0; //@line 5709
      $expanded72 = $expanded73 ^ -1; //@line 5710
      $81 = $79 & $expanded72; //@line 5711
      $82 = $81; //@line 5712
      $83 = SAFE_HEAP_LOAD($82 | 0, 4, 0) | 0 | 0; //@line 5713
      $arglist_next18 = $82 + 4 | 0; //@line 5714
      SAFE_HEAP_STORE($2 | 0, $arglist_next18 | 0, 4);
      $84 = $83 & 255; //@line 5716
      $85 = $84 << 24 >> 24; //@line 5717
      $86 = ($85 | 0) < 0; //@line 5718
      $87 = $86 << 31 >> 31; //@line 5719
      $88 = $0; //@line 5720
      $89 = $88; //@line 5721
      SAFE_HEAP_STORE($89 | 0, $85 | 0, 4);
      $90 = $88 + 4 | 0; //@line 5723
      $91 = $90; //@line 5724
      SAFE_HEAP_STORE($91 | 0, $87 | 0, 4);
      break L1;
      break;
     }
    case 16:
     {
      $arglist_current20 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5730
      $92 = $arglist_current20; //@line 5731
      $93 = 0 + 4 | 0; //@line 5732
      $expanded77 = $93; //@line 5733
      $expanded76 = $expanded77 - 1 | 0; //@line 5734
      $94 = $92 + $expanded76 | 0; //@line 5735
      $95 = 0 + 4 | 0; //@line 5736
      $expanded81 = $95; //@line 5737
      $expanded80 = $expanded81 - 1 | 0; //@line 5738
      $expanded79 = $expanded80 ^ -1; //@line 5739
      $96 = $94 & $expanded79; //@line 5740
      $97 = $96; //@line 5741
      $98 = SAFE_HEAP_LOAD($97 | 0, 4, 0) | 0 | 0; //@line 5742
      $arglist_next21 = $97 + 4 | 0; //@line 5743
      SAFE_HEAP_STORE($2 | 0, $arglist_next21 | 0, 4);
      $$mask = $98 & 255; //@line 5745
      $99 = $0; //@line 5746
      $100 = $99; //@line 5747
      SAFE_HEAP_STORE($100 | 0, $$mask | 0, 4);
      $101 = $99 + 4 | 0; //@line 5749
      $102 = $101; //@line 5750
      SAFE_HEAP_STORE($102 | 0, 0 | 0, 4);
      break L1;
      break;
     }
    case 17:
     {
      $arglist_current23 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5756
      $103 = $arglist_current23; //@line 5757
      $104 = 0 + 8 | 0; //@line 5758
      $expanded84 = $104; //@line 5759
      $expanded83 = $expanded84 - 1 | 0; //@line 5760
      $105 = $103 + $expanded83 | 0; //@line 5761
      $106 = 0 + 8 | 0; //@line 5762
      $expanded88 = $106; //@line 5763
      $expanded87 = $expanded88 - 1 | 0; //@line 5764
      $expanded86 = $expanded87 ^ -1; //@line 5765
      $107 = $105 & $expanded86; //@line 5766
      $108 = $107; //@line 5767
      $109 = +(+SAFE_HEAP_LOAD_D($108 | 0, 8)); //@line 5768
      $arglist_next24 = $108 + 8 | 0; //@line 5769
      SAFE_HEAP_STORE($2 | 0, $arglist_next24 | 0, 4);
      SAFE_HEAP_STORE_D($0 | 0, +$109, 8);
      break L1;
      break;
     }
    case 18:
     {
      $arglist_current26 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5776
      $110 = $arglist_current26; //@line 5777
      $111 = 0 + 8 | 0; //@line 5778
      $expanded91 = $111; //@line 5779
      $expanded90 = $expanded91 - 1 | 0; //@line 5780
      $112 = $110 + $expanded90 | 0; //@line 5781
      $113 = 0 + 8 | 0; //@line 5782
      $expanded95 = $113; //@line 5783
      $expanded94 = $expanded95 - 1 | 0; //@line 5784
      $expanded93 = $expanded94 ^ -1; //@line 5785
      $114 = $112 & $expanded93; //@line 5786
      $115 = $114; //@line 5787
      $116 = +(+SAFE_HEAP_LOAD_D($115 | 0, 8)); //@line 5788
      $arglist_next27 = $115 + 8 | 0; //@line 5789
      SAFE_HEAP_STORE($2 | 0, $arglist_next27 | 0, 4);
      SAFE_HEAP_STORE_D($0 | 0, +$116, 8);
      break L1;
      break;
     }
    default:
     {
      break L1;
     }
    }
   } while (0);
  }
 } while (0);
 return;
}
function __ZNSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS3_RS5_EE($0, $1) {
 $0 = $0 | 0; //@line 571
 $1 = $1 | 0; //@line 572
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0; //@line 573
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0; //@line 574
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0; //@line 575
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0; //@line 576
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0; //@line 577
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0; //@line 578
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0; //@line 579
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0; //@line 580
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $27 = 0; //@line 581
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0; //@line 582
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0; //@line 583
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0; //@line 584
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0; //@line 585
 var sp = 0; //@line 586
 sp = STACKTOP; //@line 587
 STACKTOP = STACKTOP + 352 | 0; //@line 588
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(352 | 0); //@line 588
 $15 = sp + 288 | 0; //@line 589
 $21 = sp + 264 | 0; //@line 590
 $33 = sp + 216 | 0; //@line 591
 $86 = $0; //@line 592
 $87 = $1; //@line 593
 $88 = $86; //@line 594
 $85 = $88; //@line 595
 $89 = $85; //@line 596
 $84 = $89; //@line 597
 $90 = $84; //@line 598
 $91 = SAFE_HEAP_LOAD($90 | 0, 4, 0) | 0 | 0; //@line 599
 $83 = $91; //@line 600
 $92 = $83; //@line 601
 $62 = $89; //@line 602
 $93 = $62; //@line 603
 $94 = SAFE_HEAP_LOAD($93 | 0, 4, 0) | 0 | 0; //@line 604
 $61 = $94; //@line 605
 $95 = $61; //@line 606
 $67 = $89; //@line 607
 $96 = $67; //@line 608
 $66 = $96; //@line 609
 $97 = $66; //@line 610
 $65 = $97; //@line 611
 $98 = $65; //@line 612
 $99 = $98 + 8 | 0; //@line 613
 $64 = $99; //@line 614
 $100 = $64; //@line 615
 $63 = $100; //@line 616
 $101 = $63; //@line 617
 $102 = SAFE_HEAP_LOAD($101 | 0, 4, 0) | 0 | 0; //@line 618
 $103 = SAFE_HEAP_LOAD($97 | 0, 4, 0) | 0 | 0; //@line 619
 $104 = $102; //@line 620
 $105 = $103; //@line 621
 $106 = $104 - $105 | 0; //@line 622
 $107 = ($106 | 0) / 4 & -1; //@line 623
 $108 = $95 + ($107 << 2) | 0; //@line 624
 $69 = $89; //@line 625
 $109 = $69; //@line 626
 $110 = SAFE_HEAP_LOAD($109 | 0, 4, 0) | 0 | 0; //@line 627
 $68 = $110; //@line 628
 $111 = $68; //@line 629
 $70 = $89; //@line 630
 $112 = $70; //@line 631
 $113 = $112 + 4 | 0; //@line 632
 $114 = SAFE_HEAP_LOAD($113 | 0, 4, 0) | 0 | 0; //@line 633
 $115 = SAFE_HEAP_LOAD($112 | 0, 4, 0) | 0 | 0; //@line 634
 $116 = $114; //@line 635
 $117 = $115; //@line 636
 $118 = $116 - $117 | 0; //@line 637
 $119 = ($118 | 0) / 4 & -1; //@line 638
 $120 = $111 + ($119 << 2) | 0; //@line 639
 $72 = $89; //@line 640
 $121 = $72; //@line 641
 $122 = SAFE_HEAP_LOAD($121 | 0, 4, 0) | 0 | 0; //@line 642
 $71 = $122; //@line 643
 $123 = $71; //@line 644
 $77 = $89; //@line 645
 $124 = $77; //@line 646
 $76 = $124; //@line 647
 $125 = $76; //@line 648
 $75 = $125; //@line 649
 $126 = $75; //@line 650
 $127 = $126 + 8 | 0; //@line 651
 $74 = $127; //@line 652
 $128 = $74; //@line 653
 $73 = $128; //@line 654
 $129 = $73; //@line 655
 $130 = SAFE_HEAP_LOAD($129 | 0, 4, 0) | 0 | 0; //@line 656
 $131 = SAFE_HEAP_LOAD($125 | 0, 4, 0) | 0 | 0; //@line 657
 $132 = $130; //@line 658
 $133 = $131; //@line 659
 $134 = $132 - $133 | 0; //@line 660
 $135 = ($134 | 0) / 4 & -1; //@line 661
 $136 = $123 + ($135 << 2) | 0; //@line 662
 $78 = $89; //@line 663
 $79 = $92; //@line 664
 $80 = $108; //@line 665
 $81 = $120; //@line 666
 $82 = $136; //@line 667
 $4 = $88; //@line 668
 $137 = $4; //@line 669
 $138 = $137 + 8 | 0; //@line 670
 $3 = $138; //@line 671
 $139 = $3; //@line 672
 $2 = $139; //@line 673
 $140 = $2; //@line 674
 $141 = SAFE_HEAP_LOAD($88 | 0, 4, 0) | 0 | 0; //@line 675
 $142 = $88 + 4 | 0; //@line 676
 $143 = SAFE_HEAP_LOAD($142 | 0, 4, 0) | 0 | 0; //@line 677
 $144 = $87; //@line 678
 $145 = $144 + 4 | 0; //@line 679
 $5 = $140; //@line 680
 $6 = $141; //@line 681
 $7 = $143; //@line 682
 $8 = $145; //@line 683
 $146 = $7; //@line 684
 $147 = $6; //@line 685
 $148 = $146; //@line 686
 $149 = $147; //@line 687
 $150 = $148 - $149 | 0; //@line 688
 $151 = ($150 | 0) / 4 & -1; //@line 689
 $9 = $151; //@line 690
 $152 = $9; //@line 691
 $153 = $8; //@line 692
 $154 = SAFE_HEAP_LOAD($153 | 0, 4, 0) | 0 | 0; //@line 693
 $155 = 0 - $152 | 0; //@line 694
 $156 = $154 + ($155 << 2) | 0; //@line 695
 SAFE_HEAP_STORE($153 | 0, $156 | 0, 4);
 $157 = $9; //@line 697
 $158 = ($157 | 0) > 0; //@line 698
 if ($158) {
  $159 = $8; //@line 700
  $160 = SAFE_HEAP_LOAD($159 | 0, 4, 0) | 0 | 0; //@line 701
  $161 = $6; //@line 702
  $162 = $9; //@line 703
  $163 = $162 << 2; //@line 704
  _memcpy($160 | 0, $161 | 0, $163 | 0) | 0; //@line 705
 }
 $164 = $87; //@line 707
 $165 = $164 + 4 | 0; //@line 708
 $13 = $88; //@line 709
 $14 = $165; //@line 710
 $166 = $13; //@line 711
 $12 = $166; //@line 712
 $167 = $12; //@line 713
 $168 = SAFE_HEAP_LOAD($167 | 0, 4, 0) | 0 | 0; //@line 714
 SAFE_HEAP_STORE($15 | 0, $168 | 0, 4);
 $169 = $14; //@line 716
 $10 = $169; //@line 717
 $170 = $10; //@line 718
 $171 = SAFE_HEAP_LOAD($170 | 0, 4, 0) | 0 | 0; //@line 719
 $172 = $13; //@line 720
 SAFE_HEAP_STORE($172 | 0, $171 | 0, 4);
 $11 = $15; //@line 722
 $173 = $11; //@line 723
 $174 = SAFE_HEAP_LOAD($173 | 0, 4, 0) | 0 | 0; //@line 724
 $175 = $14; //@line 725
 SAFE_HEAP_STORE($175 | 0, $174 | 0, 4);
 $176 = $88 + 4 | 0; //@line 727
 $177 = $87; //@line 728
 $178 = $177 + 8 | 0; //@line 729
 $19 = $176; //@line 730
 $20 = $178; //@line 731
 $179 = $19; //@line 732
 $18 = $179; //@line 733
 $180 = $18; //@line 734
 $181 = SAFE_HEAP_LOAD($180 | 0, 4, 0) | 0 | 0; //@line 735
 SAFE_HEAP_STORE($21 | 0, $181 | 0, 4);
 $182 = $20; //@line 737
 $16 = $182; //@line 738
 $183 = $16; //@line 739
 $184 = SAFE_HEAP_LOAD($183 | 0, 4, 0) | 0 | 0; //@line 740
 $185 = $19; //@line 741
 SAFE_HEAP_STORE($185 | 0, $184 | 0, 4);
 $17 = $21; //@line 743
 $186 = $17; //@line 744
 $187 = SAFE_HEAP_LOAD($186 | 0, 4, 0) | 0 | 0; //@line 745
 $188 = $20; //@line 746
 SAFE_HEAP_STORE($188 | 0, $187 | 0, 4);
 $24 = $88; //@line 748
 $189 = $24; //@line 749
 $190 = $189 + 8 | 0; //@line 750
 $23 = $190; //@line 751
 $191 = $23; //@line 752
 $22 = $191; //@line 753
 $192 = $22; //@line 754
 $193 = $87; //@line 755
 $27 = $193; //@line 756
 $194 = $27; //@line 757
 $195 = $194 + 12 | 0; //@line 758
 $26 = $195; //@line 759
 $196 = $26; //@line 760
 $25 = $196; //@line 761
 $197 = $25; //@line 762
 $31 = $192; //@line 763
 $32 = $197; //@line 764
 $198 = $31; //@line 765
 $30 = $198; //@line 766
 $199 = $30; //@line 767
 $200 = SAFE_HEAP_LOAD($199 | 0, 4, 0) | 0 | 0; //@line 768
 SAFE_HEAP_STORE($33 | 0, $200 | 0, 4);
 $201 = $32; //@line 770
 $28 = $201; //@line 771
 $202 = $28; //@line 772
 $203 = SAFE_HEAP_LOAD($202 | 0, 4, 0) | 0 | 0; //@line 773
 $204 = $31; //@line 774
 SAFE_HEAP_STORE($204 | 0, $203 | 0, 4);
 $29 = $33; //@line 776
 $205 = $29; //@line 777
 $206 = SAFE_HEAP_LOAD($205 | 0, 4, 0) | 0 | 0; //@line 778
 $207 = $32; //@line 779
 SAFE_HEAP_STORE($207 | 0, $206 | 0, 4);
 $208 = $87; //@line 781
 $209 = $208 + 4 | 0; //@line 782
 $210 = SAFE_HEAP_LOAD($209 | 0, 4, 0) | 0 | 0; //@line 783
 $211 = $87; //@line 784
 SAFE_HEAP_STORE($211 | 0, $210 | 0, 4);
 $34 = $88; //@line 786
 $212 = $34; //@line 787
 $213 = $212 + 4 | 0; //@line 788
 $214 = SAFE_HEAP_LOAD($213 | 0, 4, 0) | 0 | 0; //@line 789
 $215 = SAFE_HEAP_LOAD($212 | 0, 4, 0) | 0 | 0; //@line 790
 $216 = $214; //@line 791
 $217 = $215; //@line 792
 $218 = $216 - $217 | 0; //@line 793
 $219 = ($218 | 0) / 4 & -1; //@line 794
 $58 = $88; //@line 795
 $59 = $219; //@line 796
 $220 = $58; //@line 797
 $57 = $220; //@line 798
 $221 = $57; //@line 799
 $222 = SAFE_HEAP_LOAD($221 | 0, 4, 0) | 0 | 0; //@line 800
 $56 = $222; //@line 801
 $223 = $56; //@line 802
 $36 = $220; //@line 803
 $224 = $36; //@line 804
 $225 = SAFE_HEAP_LOAD($224 | 0, 4, 0) | 0 | 0; //@line 805
 $35 = $225; //@line 806
 $226 = $35; //@line 807
 $41 = $220; //@line 808
 $227 = $41; //@line 809
 $40 = $227; //@line 810
 $228 = $40; //@line 811
 $39 = $228; //@line 812
 $229 = $39; //@line 813
 $230 = $229 + 8 | 0; //@line 814
 $38 = $230; //@line 815
 $231 = $38; //@line 816
 $37 = $231; //@line 817
 $232 = $37; //@line 818
 $233 = SAFE_HEAP_LOAD($232 | 0, 4, 0) | 0 | 0; //@line 819
 $234 = SAFE_HEAP_LOAD($228 | 0, 4, 0) | 0 | 0; //@line 820
 $235 = $233; //@line 821
 $236 = $234; //@line 822
 $237 = $235 - $236 | 0; //@line 823
 $238 = ($237 | 0) / 4 & -1; //@line 824
 $239 = $226 + ($238 << 2) | 0; //@line 825
 $43 = $220; //@line 826
 $240 = $43; //@line 827
 $241 = SAFE_HEAP_LOAD($240 | 0, 4, 0) | 0 | 0; //@line 828
 $42 = $241; //@line 829
 $242 = $42; //@line 830
 $48 = $220; //@line 831
 $243 = $48; //@line 832
 $47 = $243; //@line 833
 $244 = $47; //@line 834
 $46 = $244; //@line 835
 $245 = $46; //@line 836
 $246 = $245 + 8 | 0; //@line 837
 $45 = $246; //@line 838
 $247 = $45; //@line 839
 $44 = $247; //@line 840
 $248 = $44; //@line 841
 $249 = SAFE_HEAP_LOAD($248 | 0, 4, 0) | 0 | 0; //@line 842
 $250 = SAFE_HEAP_LOAD($244 | 0, 4, 0) | 0 | 0; //@line 843
 $251 = $249; //@line 844
 $252 = $250; //@line 845
 $253 = $251 - $252 | 0; //@line 846
 $254 = ($253 | 0) / 4 & -1; //@line 847
 $255 = $242 + ($254 << 2) | 0; //@line 848
 $50 = $220; //@line 849
 $256 = $50; //@line 850
 $257 = SAFE_HEAP_LOAD($256 | 0, 4, 0) | 0 | 0; //@line 851
 $49 = $257; //@line 852
 $258 = $49; //@line 853
 $259 = $59; //@line 854
 $260 = $258 + ($259 << 2) | 0; //@line 855
 $51 = $220; //@line 856
 $52 = $223; //@line 857
 $53 = $239; //@line 858
 $54 = $255; //@line 859
 $55 = $260; //@line 860
 $60 = $88; //@line 861
 STACKTOP = sp; //@line 862
 return;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
 $a$0 = $a$0 | 0; //@line 9051
 $a$1 = $a$1 | 0; //@line 9052
 $b$0 = $b$0 | 0; //@line 9053
 $b$1 = $b$1 | 0; //@line 9054
 $rem = $rem | 0; //@line 9055
 var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0; //@line 9056
 $n_sroa_0_0_extract_trunc = $a$0; //@line 9057
 $n_sroa_1_4_extract_shift$0 = $a$1; //@line 9058
 $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0; //@line 9059
 $d_sroa_0_0_extract_trunc = $b$0; //@line 9060
 $d_sroa_1_4_extract_shift$0 = $b$1; //@line 9061
 $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0; //@line 9062
 if (($n_sroa_1_4_extract_trunc | 0) == 0) {
  $4 = ($rem | 0) != 0; //@line 9064
  if (($d_sroa_1_4_extract_trunc | 0) == 0) {
   if ($4) {
    SAFE_HEAP_STORE($rem | 0, ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0) | 0, 4);
    SAFE_HEAP_STORE($rem + 4 | 0, 0 | 0, 4);
   }
   $_0$1 = 0; //@line 9070
   $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0; //@line 9071
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9072
  } else {
   if (!$4) {
    $_0$1 = 0; //@line 9075
    $_0$0 = 0; //@line 9076
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9077
   }
   SAFE_HEAP_STORE($rem | 0, $a$0 & -1 | 0, 4);
   SAFE_HEAP_STORE($rem + 4 | 0, $a$1 & 0 | 0, 4);
   $_0$1 = 0; //@line 9081
   $_0$0 = 0; //@line 9082
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9083
  }
 }
 $17 = ($d_sroa_1_4_extract_trunc | 0) == 0; //@line 9086
 do {
  if (($d_sroa_0_0_extract_trunc | 0) == 0) {
   if ($17) {
    if (($rem | 0) != 0) {
     SAFE_HEAP_STORE($rem | 0, ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0) | 0, 4);
     SAFE_HEAP_STORE($rem + 4 | 0, 0 | 0, 4);
    }
    $_0$1 = 0; //@line 9094
    $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0; //@line 9095
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9096
   }
   if (($n_sroa_0_0_extract_trunc | 0) == 0) {
    if (($rem | 0) != 0) {
     SAFE_HEAP_STORE($rem | 0, 0 | 0, 4);
     SAFE_HEAP_STORE($rem + 4 | 0, ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0) | 0, 4);
    }
    $_0$1 = 0; //@line 9103
    $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0; //@line 9104
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9105
   }
   $37 = $d_sroa_1_4_extract_trunc - 1 | 0; //@line 9107
   if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
    if (($rem | 0) != 0) {
     SAFE_HEAP_STORE($rem | 0, 0 | $a$0 & -1 | 0, 4);
     SAFE_HEAP_STORE($rem + 4 | 0, $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0 | 0, 4);
    }
    $_0$1 = 0; //@line 9113
    $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0); //@line 9114
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9115
   }
   $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0; //@line 9117
   $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 9118
   if ($51 >>> 0 <= 30) {
    $57 = $51 + 1 | 0; //@line 9120
    $58 = 31 - $51 | 0; //@line 9121
    $sr_1_ph = $57; //@line 9122
    $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0); //@line 9123
    $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0); //@line 9124
    $q_sroa_0_1_ph = 0; //@line 9125
    $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58; //@line 9126
    break;
   }
   if (($rem | 0) == 0) {
    $_0$1 = 0; //@line 9130
    $_0$0 = 0; //@line 9131
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9132
   }
   SAFE_HEAP_STORE($rem | 0, 0 | $a$0 & -1 | 0, 4);
   SAFE_HEAP_STORE($rem + 4 | 0, $n_sroa_1_4_extract_shift$0 | $a$1 & 0 | 0, 4);
   $_0$1 = 0; //@line 9136
   $_0$0 = 0; //@line 9137
   return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9138
  } else {
   if (!$17) {
    $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0; //@line 9141
    $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 9142
    if ($119 >>> 0 <= 31) {
     $125 = $119 + 1 | 0; //@line 9144
     $126 = 31 - $119 | 0; //@line 9145
     $130 = $119 - 31 >> 31; //@line 9146
     $sr_1_ph = $125; //@line 9147
     $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126; //@line 9148
     $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130; //@line 9149
     $q_sroa_0_1_ph = 0; //@line 9150
     $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126; //@line 9151
     break;
    }
    if (($rem | 0) == 0) {
     $_0$1 = 0; //@line 9155
     $_0$0 = 0; //@line 9156
     return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9157
    }
    SAFE_HEAP_STORE($rem | 0, 0 | $a$0 & -1 | 0, 4);
    SAFE_HEAP_STORE($rem + 4 | 0, $n_sroa_1_4_extract_shift$0 | $a$1 & 0 | 0, 4);
    $_0$1 = 0; //@line 9161
    $_0$0 = 0; //@line 9162
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9163
   }
   $66 = $d_sroa_0_0_extract_trunc - 1 | 0; //@line 9165
   if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
    $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0; //@line 9167
    $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0; //@line 9168
    $89 = 64 - $88 | 0; //@line 9169
    $91 = 32 - $88 | 0; //@line 9170
    $92 = $91 >> 31; //@line 9171
    $95 = $88 - 32 | 0; //@line 9172
    $105 = $95 >> 31; //@line 9173
    $sr_1_ph = $88; //@line 9174
    $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105; //@line 9175
    $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0); //@line 9176
    $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92; //@line 9177
    $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31; //@line 9178
    break;
   }
   if (($rem | 0) != 0) {
    SAFE_HEAP_STORE($rem | 0, $66 & $n_sroa_0_0_extract_trunc | 0, 4);
    SAFE_HEAP_STORE($rem + 4 | 0, 0 | 0, 4);
   }
   if (($d_sroa_0_0_extract_trunc | 0) == 1) {
    $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0; //@line 9186
    $_0$0 = 0 | $a$0 & -1; //@line 9187
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9188
   } else {
    $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0; //@line 9190
    $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0); //@line 9191
    $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0; //@line 9192
    return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9193
   }
  }
 } while (0);
 if (($sr_1_ph | 0) == 0) {
  $q_sroa_1_1_lcssa = $q_sroa_1_1_ph; //@line 9198
  $q_sroa_0_1_lcssa = $q_sroa_0_1_ph; //@line 9199
  $r_sroa_1_1_lcssa = $r_sroa_1_1_ph; //@line 9200
  $r_sroa_0_1_lcssa = $r_sroa_0_1_ph; //@line 9201
  $carry_0_lcssa$1 = 0; //@line 9202
  $carry_0_lcssa$0 = 0; //@line 9203
 } else {
  $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1; //@line 9205
  $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0; //@line 9206
  $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0; //@line 9207
  $137$1 = tempRet0; //@line 9208
  $q_sroa_1_1198 = $q_sroa_1_1_ph; //@line 9209
  $q_sroa_0_1199 = $q_sroa_0_1_ph; //@line 9210
  $r_sroa_1_1200 = $r_sroa_1_1_ph; //@line 9211
  $r_sroa_0_1201 = $r_sroa_0_1_ph; //@line 9212
  $sr_1202 = $sr_1_ph; //@line 9213
  $carry_0203 = 0; //@line 9214
  while (1) {
   $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1; //@line 9216
   $149 = $carry_0203 | $q_sroa_0_1199 << 1; //@line 9217
   $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31); //@line 9218
   $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0; //@line 9219
   _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0; //@line 9220
   $150$1 = tempRet0; //@line 9221
   $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1; //@line 9222
   $152 = $151$0 & 1; //@line 9223
   $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0; //@line 9224
   $r_sroa_0_0_extract_trunc = $154$0; //@line 9225
   $r_sroa_1_4_extract_trunc = tempRet0; //@line 9226
   $155 = $sr_1202 - 1 | 0; //@line 9227
   if (($155 | 0) == 0) {
    break;
   } else {
    $q_sroa_1_1198 = $147; //@line 9231
    $q_sroa_0_1199 = $149; //@line 9232
    $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc; //@line 9233
    $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc; //@line 9234
    $sr_1202 = $155; //@line 9235
    $carry_0203 = $152; //@line 9236
   }
  }
  $q_sroa_1_1_lcssa = $147; //@line 9239
  $q_sroa_0_1_lcssa = $149; //@line 9240
  $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc; //@line 9241
  $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc; //@line 9242
  $carry_0_lcssa$1 = 0; //@line 9243
  $carry_0_lcssa$0 = $152; //@line 9244
 }
 $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa; //@line 9246
 $q_sroa_0_0_insert_ext75$1 = 0; //@line 9247
 $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1; //@line 9248
 if (($rem | 0) != 0) {
  SAFE_HEAP_STORE($rem | 0, 0 | $r_sroa_0_1_lcssa | 0, 4);
  SAFE_HEAP_STORE($rem + 4 | 0, $r_sroa_1_1_lcssa | 0 | 0, 4);
 }
 $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1; //@line 9253
 $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0; //@line 9254
 return (tempRet0 = $_0$1, $_0$0) | 0; //@line 9255
}
function __ZNSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($0, $1) {
 $0 = $0 | 0; //@line 269
 $1 = $1 | 0; //@line 270
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0; //@line 271
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0; //@line 272
 var $136 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0; //@line 273
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0; //@line 274
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0; //@line 275
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0; //@line 276
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0; //@line 277
 sp = STACKTOP; //@line 278
 STACKTOP = STACKTOP + 208 | 0; //@line 279
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(208 | 0); //@line 279
 $10 = sp + 8 | 0; //@line 280
 $15 = sp + 201 | 0; //@line 281
 $24 = sp; //@line 282
 $27 = sp + 200 | 0; //@line 283
 $35 = sp + 80 | 0; //@line 284
 $38 = sp + 68 | 0; //@line 285
 $46 = sp + 20 | 0; //@line 286
 $43 = $0; //@line 287
 $44 = $1; //@line 288
 $49 = $43; //@line 289
 $42 = $49; //@line 290
 $50 = $42; //@line 291
 $51 = $50 + 8 | 0; //@line 292
 $41 = $51; //@line 293
 $52 = $41; //@line 294
 $40 = $52; //@line 295
 $53 = $40; //@line 296
 $45 = $53; //@line 297
 $39 = $49; //@line 298
 $54 = $39; //@line 299
 $55 = $54 + 4 | 0; //@line 300
 $56 = SAFE_HEAP_LOAD($55 | 0, 4, 0) | 0 | 0; //@line 301
 $57 = SAFE_HEAP_LOAD($54 | 0, 4, 0) | 0 | 0; //@line 302
 $58 = $56; //@line 303
 $59 = $57; //@line 304
 $60 = $58 - $59 | 0; //@line 305
 $61 = ($60 | 0) / 4 & -1; //@line 306
 $62 = $61 + 1 | 0; //@line 307
 $34 = $49; //@line 308
 SAFE_HEAP_STORE($35 | 0, $62 | 0, 4);
 $63 = $34; //@line 310
 $64 = __ZNKSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE8max_sizeEv($63) | 0; //@line 311
 $36 = $64; //@line 312
 $65 = SAFE_HEAP_LOAD($35 | 0, 4, 0) | 0 | 0; //@line 313
 $66 = $36; //@line 314
 $67 = $65 >>> 0 > $66 >>> 0; //@line 315
 if ($67) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($63); //@line 317
 }
 $32 = $63; //@line 320
 $68 = $32; //@line 321
 $31 = $68; //@line 322
 $69 = $31; //@line 323
 $30 = $69; //@line 324
 $70 = $30; //@line 325
 $71 = $70 + 8 | 0; //@line 326
 $29 = $71; //@line 327
 $72 = $29; //@line 328
 $28 = $72; //@line 329
 $73 = $28; //@line 330
 $74 = SAFE_HEAP_LOAD($73 | 0, 4, 0) | 0 | 0; //@line 331
 $75 = SAFE_HEAP_LOAD($69 | 0, 4, 0) | 0 | 0; //@line 332
 $76 = $74; //@line 333
 $77 = $75; //@line 334
 $78 = $76 - $77 | 0; //@line 335
 $79 = ($78 | 0) / 4 & -1; //@line 336
 $37 = $79; //@line 337
 $80 = $37; //@line 338
 $81 = $36; //@line 339
 $82 = ($81 >>> 0) / 2 & -1; //@line 340
 $83 = $80 >>> 0 >= $82 >>> 0; //@line 341
 if ($83) {
  $84 = $36; //@line 343
  $33 = $84; //@line 344
 } else {
  $85 = $37; //@line 346
  $86 = $85 << 1; //@line 347
  SAFE_HEAP_STORE($38 | 0, $86 | 0, 4);
  $25 = $38; //@line 349
  $26 = $35; //@line 350
  $87 = $25; //@line 351
  $88 = $26; //@line 352
  SAFE_HEAP_STORE($24 >> 0 | 0, SAFE_HEAP_LOAD($27 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
  $22 = $87; //@line 354
  $23 = $88; //@line 355
  $89 = $22; //@line 356
  $90 = $23; //@line 357
  $19 = $24; //@line 358
  $20 = $89; //@line 359
  $21 = $90; //@line 360
  $91 = $20; //@line 361
  $92 = SAFE_HEAP_LOAD($91 | 0, 4, 0) | 0 | 0; //@line 362
  $93 = $21; //@line 363
  $94 = SAFE_HEAP_LOAD($93 | 0, 4, 0) | 0 | 0; //@line 364
  $95 = $92 >>> 0 < $94 >>> 0; //@line 365
  $96 = $23; //@line 366
  $97 = $22; //@line 367
  $98 = $95 ? $96 : $97; //@line 368
  $99 = SAFE_HEAP_LOAD($98 | 0, 4, 0) | 0 | 0; //@line 369
  $33 = $99; //@line 370
 }
 $100 = $33; //@line 372
 $18 = $49; //@line 373
 $101 = $18; //@line 374
 $102 = $101 + 4 | 0; //@line 375
 $103 = SAFE_HEAP_LOAD($102 | 0, 4, 0) | 0 | 0; //@line 376
 $104 = SAFE_HEAP_LOAD($101 | 0, 4, 0) | 0 | 0; //@line 377
 $105 = $103; //@line 378
 $106 = $104; //@line 379
 $107 = $105 - $106 | 0; //@line 380
 $108 = ($107 | 0) / 4 & -1; //@line 381
 $109 = $45; //@line 382
 __ZNSt3__214__split_bufferIPN4Asam10HtmlCanvasERNS_9allocatorIS3_EEEC2EjjS6_($46, $100, $108, $109); //@line 383
 $110 = $45; //@line 384
 $111 = $46 + 8 | 0; //@line 385
 $112 = SAFE_HEAP_LOAD($111 | 0, 4, 0) | 0 | 0; //@line 386
 $17 = $112; //@line 387
 $113 = $17; //@line 388
 $114 = $44; //@line 389
 $16 = $114; //@line 390
 $115 = $16; //@line 391
 $12 = $110; //@line 392
 $13 = $113; //@line 393
 $14 = $115; //@line 394
 $116 = $12; //@line 395
 $117 = $13; //@line 396
 $118 = $14; //@line 397
 $11 = $118; //@line 398
 $119 = $11; //@line 399
 SAFE_HEAP_STORE($10 >> 0 | 0, SAFE_HEAP_LOAD($15 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
 $7 = $116; //@line 401
 $8 = $117; //@line 402
 $9 = $119; //@line 403
 $120 = $7; //@line 404
 $121 = $8; //@line 405
 $122 = $9; //@line 406
 $6 = $122; //@line 407
 $123 = $6; //@line 408
 $3 = $120; //@line 409
 $4 = $121; //@line 410
 $5 = $123; //@line 411
 $124 = $4; //@line 412
 $125 = $5; //@line 413
 $2 = $125; //@line 414
 $126 = $2; //@line 415
 $127 = SAFE_HEAP_LOAD($126 | 0, 4, 0) | 0 | 0; //@line 416
 SAFE_HEAP_STORE($124 | 0, $127 | 0, 4);
 $128 = $46 + 8 | 0; //@line 418
 $129 = SAFE_HEAP_LOAD($128 | 0, 4, 0) | 0 | 0; //@line 419
 $130 = $129 + 4 | 0; //@line 420
 SAFE_HEAP_STORE($128 | 0, $130 | 0, 4);
 __THREW__ = 0; //@line 422
 invoke_vii(25, $49 | 0, $46 | 0); //@line 423
 $131 = __THREW__; //@line 424
 __THREW__ = 0; //@line 424
 $132 = $131 & 1; //@line 425
 if ($132) {
  $133 = ___cxa_find_matching_catch_2() | 0; //@line 427
  $134 = tempRet0; //@line 428
  $47 = $133; //@line 429
  $48 = $134; //@line 430
  __ZNSt3__214__split_bufferIPN4Asam10HtmlCanvasERNS_9allocatorIS3_EEED2Ev($46); //@line 431
  $135 = $47; //@line 432
  $136 = $48; //@line 433
  ___resumeException($135 | 0); //@line 434
 } else {
  __ZNSt3__214__split_bufferIPN4Asam10HtmlCanvasERNS_9allocatorIS3_EEED2Ev($46); //@line 437
  STACKTOP = sp; //@line 438
  return;
 }
}
function ___stdio_write($0, $1, $2) {
 $0 = $0 | 0; //@line 4270
 $1 = $1 | 0; //@line 4271
 $2 = $2 | 0; //@line 4272
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0; //@line 4273
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0; //@line 4274
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0; //@line 4275
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0; //@line 4276
 sp = STACKTOP; //@line 4277
 STACKTOP = STACKTOP + 48 | 0; //@line 4278
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(48 | 0); //@line 4278
 $vararg_buffer3 = sp + 16 | 0; //@line 4279
 $vararg_buffer = sp; //@line 4280
 $3 = sp + 32 | 0; //@line 4281
 $4 = $0 + 28 | 0; //@line 4282
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 4283
 SAFE_HEAP_STORE($3 | 0, $5 | 0, 4);
 $6 = $3 + 4 | 0; //@line 4285
 $7 = $0 + 20 | 0; //@line 4286
 $8 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 4287
 $9 = $8 - $5 | 0; //@line 4288
 SAFE_HEAP_STORE($6 | 0, $9 | 0, 4);
 $10 = $3 + 8 | 0; //@line 4290
 SAFE_HEAP_STORE($10 | 0, $1 | 0, 4);
 $11 = $3 + 12 | 0; //@line 4292
 SAFE_HEAP_STORE($11 | 0, $2 | 0, 4);
 $12 = $9 + $2 | 0; //@line 4294
 $13 = $0 + 60 | 0; //@line 4295
 $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 4296
 $15 = $3; //@line 4297
 SAFE_HEAP_STORE($vararg_buffer | 0, $14 | 0, 4);
 $vararg_ptr1 = $vararg_buffer + 4 | 0; //@line 4299
 SAFE_HEAP_STORE($vararg_ptr1 | 0, $15 | 0, 4);
 $vararg_ptr2 = $vararg_buffer + 8 | 0; //@line 4301
 SAFE_HEAP_STORE($vararg_ptr2 | 0, 2 | 0, 4);
 $16 = ___syscall146(146, $vararg_buffer | 0) | 0; //@line 4303
 $17 = ___syscall_ret($16) | 0; //@line 4304
 $18 = ($12 | 0) == ($17 | 0); //@line 4305
 L1 : do {
  if ($18) {
   label = 3; //@line 4308
  } else {
   $$04756 = 2; //@line 4310
   $$04855 = $12; //@line 4310
   $$04954 = $3; //@line 4310
   $27 = $17; //@line 4310
   while (1) {
    $26 = ($27 | 0) < 0; //@line 4312
    if ($26) {
     break;
    }
    $35 = $$04855 - $27 | 0; //@line 4316
    $36 = $$04954 + 4 | 0; //@line 4317
    $37 = SAFE_HEAP_LOAD($36 | 0, 4, 0) | 0 | 0; //@line 4318
    $38 = $27 >>> 0 > $37 >>> 0; //@line 4319
    $39 = $$04954 + 8 | 0; //@line 4320
    $$150 = $38 ? $39 : $$04954; //@line 4321
    $40 = $38 << 31 >> 31; //@line 4322
    $$1 = $$04756 + $40 | 0; //@line 4323
    $41 = $38 ? $37 : 0; //@line 4324
    $$0 = $27 - $41 | 0; //@line 4325
    $42 = SAFE_HEAP_LOAD($$150 | 0, 4, 0) | 0 | 0; //@line 4326
    $43 = $42 + $$0 | 0; //@line 4327
    SAFE_HEAP_STORE($$150 | 0, $43 | 0, 4);
    $44 = $$150 + 4 | 0; //@line 4329
    $45 = SAFE_HEAP_LOAD($44 | 0, 4, 0) | 0 | 0; //@line 4330
    $46 = $45 - $$0 | 0; //@line 4331
    SAFE_HEAP_STORE($44 | 0, $46 | 0, 4);
    $47 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 4333
    $48 = $$150; //@line 4334
    SAFE_HEAP_STORE($vararg_buffer3 | 0, $47 | 0, 4);
    $vararg_ptr6 = $vararg_buffer3 + 4 | 0; //@line 4336
    SAFE_HEAP_STORE($vararg_ptr6 | 0, $48 | 0, 4);
    $vararg_ptr7 = $vararg_buffer3 + 8 | 0; //@line 4338
    SAFE_HEAP_STORE($vararg_ptr7 | 0, $$1 | 0, 4);
    $49 = ___syscall146(146, $vararg_buffer3 | 0) | 0; //@line 4340
    $50 = ___syscall_ret($49) | 0; //@line 4341
    $51 = ($35 | 0) == ($50 | 0); //@line 4342
    if ($51) {
     label = 3; //@line 4344
     break L1;
    } else {
     $$04756 = $$1; //@line 4347
     $$04855 = $35; //@line 4347
     $$04954 = $$150; //@line 4347
     $27 = $50; //@line 4347
    }
   }
   $28 = $0 + 16 | 0; //@line 4350
   SAFE_HEAP_STORE($28 | 0, 0 | 0, 4);
   SAFE_HEAP_STORE($4 | 0, 0 | 0, 4);
   SAFE_HEAP_STORE($7 | 0, 0 | 0, 4);
   $29 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 4354
   $30 = $29 | 32; //@line 4355
   SAFE_HEAP_STORE($0 | 0, $30 | 0, 4);
   $31 = ($$04756 | 0) == 2; //@line 4357
   if ($31) {
    $$051 = 0; //@line 4359
   } else {
    $32 = $$04954 + 4 | 0; //@line 4361
    $33 = SAFE_HEAP_LOAD($32 | 0, 4, 0) | 0 | 0; //@line 4362
    $34 = $2 - $33 | 0; //@line 4363
    $$051 = $34; //@line 4364
   }
  }
 } while (0);
 if ((label | 0) == 3) {
  $19 = $0 + 44 | 0; //@line 4369
  $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 4370
  $21 = $0 + 48 | 0; //@line 4371
  $22 = SAFE_HEAP_LOAD($21 | 0, 4, 0) | 0 | 0; //@line 4372
  $23 = $20 + $22 | 0; //@line 4373
  $24 = $0 + 16 | 0; //@line 4374
  SAFE_HEAP_STORE($24 | 0, $23 | 0, 4);
  $25 = $20; //@line 4376
  SAFE_HEAP_STORE($4 | 0, $25 | 0, 4);
  SAFE_HEAP_STORE($7 | 0, $25 | 0, 4);
  $$051 = $2; //@line 4379
 }
 STACKTOP = sp; //@line 4381
 return $$051 | 0; //@line 4381
}
function _memchr($0, $1, $2) {
 $0 = $0 | 0; //@line 5949
 $1 = $1 | 0; //@line 5950
 $2 = $2 | 0; //@line 5951
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0; //@line 5952
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0; //@line 5953
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0; //@line 5954
 sp = STACKTOP; //@line 5955
 $3 = $1 & 255; //@line 5956
 $4 = $0; //@line 5957
 $5 = $4 & 3; //@line 5958
 $6 = ($5 | 0) != 0; //@line 5959
 $7 = ($2 | 0) != 0; //@line 5960
 $or$cond53 = $7 & $6; //@line 5961
 L1 : do {
  if ($or$cond53) {
   $8 = $1 & 255; //@line 5964
   $$03555 = $0; //@line 5965
   $$03654 = $2; //@line 5965
   while (1) {
    $9 = SAFE_HEAP_LOAD($$03555 >> 0 | 0, 1, 0) | 0 | 0; //@line 5967
    $10 = $9 << 24 >> 24 == $8 << 24 >> 24; //@line 5968
    if ($10) {
     $$035$lcssa65 = $$03555; //@line 5970
     $$036$lcssa64 = $$03654; //@line 5970
     label = 6; //@line 5971
     break L1;
    }
    $11 = $$03555 + 1 | 0; //@line 5974
    $12 = $$03654 + -1 | 0; //@line 5975
    $13 = $11; //@line 5976
    $14 = $13 & 3; //@line 5977
    $15 = ($14 | 0) != 0; //@line 5978
    $16 = ($12 | 0) != 0; //@line 5979
    $or$cond = $16 & $15; //@line 5980
    if ($or$cond) {
     $$03555 = $11; //@line 5982
     $$03654 = $12; //@line 5982
    } else {
     $$035$lcssa = $11; //@line 5984
     $$036$lcssa = $12; //@line 5984
     $$lcssa = $16; //@line 5984
     label = 5; //@line 5985
     break;
    }
   }
  } else {
   $$035$lcssa = $0; //@line 5990
   $$036$lcssa = $2; //@line 5990
   $$lcssa = $7; //@line 5990
   label = 5; //@line 5991
  }
 } while (0);
 if ((label | 0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa; //@line 5996
   $$036$lcssa64 = $$036$lcssa; //@line 5996
   label = 6; //@line 5997
  } else {
   $$2 = $$035$lcssa; //@line 5999
   $$3 = 0; //@line 5999
  }
 }
 L8 : do {
  if ((label | 0) == 6) {
   $17 = SAFE_HEAP_LOAD($$035$lcssa65 >> 0 | 0, 1, 0) | 0 | 0; //@line 6004
   $18 = $1 & 255; //@line 6005
   $19 = $17 << 24 >> 24 == $18 << 24 >> 24; //@line 6006
   if ($19) {
    $$2 = $$035$lcssa65; //@line 6008
    $$3 = $$036$lcssa64; //@line 6008
   } else {
    $20 = Math_imul($3, 16843009) | 0; //@line 6010
    $21 = $$036$lcssa64 >>> 0 > 3; //@line 6011
    L11 : do {
     if ($21) {
      $$046 = $$035$lcssa65; //@line 6014
      $$13745 = $$036$lcssa64; //@line 6014
      while (1) {
       $22 = SAFE_HEAP_LOAD($$046 | 0, 4, 0) | 0 | 0; //@line 6016
       $23 = $22 ^ $20; //@line 6017
       $24 = $23 + -16843009 | 0; //@line 6018
       $25 = $23 & -2139062144; //@line 6019
       $26 = $25 ^ -2139062144; //@line 6020
       $27 = $26 & $24; //@line 6021
       $28 = ($27 | 0) == 0; //@line 6022
       if (!$28) {
        break;
       }
       $29 = $$046 + 4 | 0; //@line 6026
       $30 = $$13745 + -4 | 0; //@line 6027
       $31 = $30 >>> 0 > 3; //@line 6028
       if ($31) {
        $$046 = $29; //@line 6030
        $$13745 = $30; //@line 6030
       } else {
        $$0$lcssa = $29; //@line 6032
        $$137$lcssa = $30; //@line 6032
        label = 11; //@line 6033
        break L11;
       }
      }
      $$140 = $$046; //@line 6037
      $$23839 = $$13745; //@line 6037
     } else {
      $$0$lcssa = $$035$lcssa65; //@line 6039
      $$137$lcssa = $$036$lcssa64; //@line 6039
      label = 11; //@line 6040
     }
    } while (0);
    if ((label | 0) == 11) {
     $32 = ($$137$lcssa | 0) == 0; //@line 6044
     if ($32) {
      $$2 = $$0$lcssa; //@line 6046
      $$3 = 0; //@line 6046
      break;
     } else {
      $$140 = $$0$lcssa; //@line 6049
      $$23839 = $$137$lcssa; //@line 6049
     }
    }
    while (1) {
     $33 = SAFE_HEAP_LOAD($$140 >> 0 | 0, 1, 0) | 0 | 0; //@line 6053
     $34 = $33 << 24 >> 24 == $18 << 24 >> 24; //@line 6054
     if ($34) {
      $$2 = $$140; //@line 6056
      $$3 = $$23839; //@line 6056
      break L8;
     }
     $35 = $$140 + 1 | 0; //@line 6059
     $36 = $$23839 + -1 | 0; //@line 6060
     $37 = ($36 | 0) == 0; //@line 6061
     if ($37) {
      $$2 = $35; //@line 6063
      $$3 = 0; //@line 6063
      break;
     } else {
      $$140 = $35; //@line 6066
      $$23839 = $36; //@line 6066
     }
    }
   }
  }
 } while (0);
 $38 = ($$3 | 0) != 0; //@line 6072
 $39 = $38 ? $$2 : 0; //@line 6073
 return $39 | 0; //@line 6074
}
function ___mo_lookup($0, $1, $2) {
 $0 = $0 | 0; //@line 7345
 $1 = $1 | 0; //@line 7346
 $2 = $2 | 0; //@line 7347
 var $$ = 0, $$090 = 0, $$094 = 0, $$191 = 0, $$195 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0; //@line 7348
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0; //@line 7349
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0; //@line 7350
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond102 = 0, $or$cond104 = 0, label = 0, sp = 0; //@line 7351
 sp = STACKTOP; //@line 7352
 $3 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 7353
 $4 = $3 + 1794895138 | 0; //@line 7354
 $5 = $0 + 8 | 0; //@line 7355
 $6 = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 7356
 $7 = _swapc($6, $4) | 0; //@line 7357
 $8 = $0 + 12 | 0; //@line 7358
 $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 7359
 $10 = _swapc($9, $4) | 0; //@line 7360
 $11 = $0 + 16 | 0; //@line 7361
 $12 = SAFE_HEAP_LOAD($11 | 0, 4, 0) | 0 | 0; //@line 7362
 $13 = _swapc($12, $4) | 0; //@line 7363
 $14 = $1 >>> 2; //@line 7364
 $15 = $7 >>> 0 < $14 >>> 0; //@line 7365
 L1 : do {
  if ($15) {
   $16 = $7 << 2; //@line 7368
   $17 = $1 - $16 | 0; //@line 7369
   $18 = $10 >>> 0 < $17 >>> 0; //@line 7370
   $19 = $13 >>> 0 < $17 >>> 0; //@line 7371
   $or$cond = $18 & $19; //@line 7372
   if ($or$cond) {
    $20 = $13 | $10; //@line 7374
    $21 = $20 & 3; //@line 7375
    $22 = ($21 | 0) == 0; //@line 7376
    if ($22) {
     $23 = $10 >>> 2; //@line 7378
     $24 = $13 >>> 2; //@line 7379
     $$090 = 0; //@line 7380
     $$094 = $7; //@line 7380
     while (1) {
      $25 = $$094 >>> 1; //@line 7382
      $26 = $$090 + $25 | 0; //@line 7383
      $27 = $26 << 1; //@line 7384
      $28 = $27 + $23 | 0; //@line 7385
      $29 = $0 + ($28 << 2) | 0; //@line 7386
      $30 = SAFE_HEAP_LOAD($29 | 0, 4, 0) | 0 | 0; //@line 7387
      $31 = _swapc($30, $4) | 0; //@line 7388
      $32 = $28 + 1 | 0; //@line 7389
      $33 = $0 + ($32 << 2) | 0; //@line 7390
      $34 = SAFE_HEAP_LOAD($33 | 0, 4, 0) | 0 | 0; //@line 7391
      $35 = _swapc($34, $4) | 0; //@line 7392
      $36 = $35 >>> 0 < $1 >>> 0; //@line 7393
      $37 = $1 - $35 | 0; //@line 7394
      $38 = $31 >>> 0 < $37 >>> 0; //@line 7395
      $or$cond102 = $36 & $38; //@line 7396
      if (!$or$cond102) {
       $$4 = 0; //@line 7398
       break L1;
      }
      $39 = $35 + $31 | 0; //@line 7401
      $40 = $0 + $39 | 0; //@line 7402
      $41 = SAFE_HEAP_LOAD($40 >> 0 | 0, 1, 0) | 0 | 0; //@line 7403
      $42 = $41 << 24 >> 24 == 0; //@line 7404
      if (!$42) {
       $$4 = 0; //@line 7406
       break L1;
      }
      $43 = $0 + $35 | 0; //@line 7409
      $44 = _strcmp($2, $43) | 0; //@line 7410
      $45 = ($44 | 0) == 0; //@line 7411
      if ($45) {
       break;
      }
      $62 = ($$094 | 0) == 1; //@line 7415
      $63 = ($44 | 0) < 0; //@line 7416
      $64 = $$094 - $25 | 0; //@line 7417
      $$195 = $63 ? $25 : $64; //@line 7418
      $$191 = $63 ? $$090 : $26; //@line 7419
      if ($62) {
       $$4 = 0; //@line 7421
       break L1;
      } else {
       $$090 = $$191; //@line 7424
       $$094 = $$195; //@line 7424
      }
     }
     $46 = $27 + $24 | 0; //@line 7427
     $47 = $0 + ($46 << 2) | 0; //@line 7428
     $48 = SAFE_HEAP_LOAD($47 | 0, 4, 0) | 0 | 0; //@line 7429
     $49 = _swapc($48, $4) | 0; //@line 7430
     $50 = $46 + 1 | 0; //@line 7431
     $51 = $0 + ($50 << 2) | 0; //@line 7432
     $52 = SAFE_HEAP_LOAD($51 | 0, 4, 0) | 0 | 0; //@line 7433
     $53 = _swapc($52, $4) | 0; //@line 7434
     $54 = $53 >>> 0 < $1 >>> 0; //@line 7435
     $55 = $1 - $53 | 0; //@line 7436
     $56 = $49 >>> 0 < $55 >>> 0; //@line 7437
     $or$cond104 = $54 & $56; //@line 7438
     if ($or$cond104) {
      $57 = $0 + $53 | 0; //@line 7440
      $58 = $53 + $49 | 0; //@line 7441
      $59 = $0 + $58 | 0; //@line 7442
      $60 = SAFE_HEAP_LOAD($59 >> 0 | 0, 1, 0) | 0 | 0; //@line 7443
      $61 = $60 << 24 >> 24 == 0; //@line 7444
      $$ = $61 ? $57 : 0; //@line 7445
      $$4 = $$; //@line 7446
     } else {
      $$4 = 0; //@line 7448
     }
    } else {
     $$4 = 0; //@line 7451
    }
   } else {
    $$4 = 0; //@line 7454
   }
  } else {
   $$4 = 0; //@line 7457
  }
 } while (0);
 return $$4 | 0; //@line 7460
}
function __ZNSt3__214__split_bufferIPN4Asam10HtmlCanvasERNS_9allocatorIS3_EEEC2EjjS6_($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 442
 $1 = $1 | 0; //@line 443
 $2 = $2 | 0; //@line 444
 $3 = $3 | 0; //@line 445
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0; //@line 446
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0; //@line 447
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0; //@line 448
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0; //@line 449
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, label = 0, sp = 0; //@line 450
 sp = STACKTOP; //@line 451
 STACKTOP = STACKTOP + 128 | 0; //@line 452
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(128 | 0); //@line 452
 $26 = sp + 36 | 0; //@line 453
 $30 = sp + 20 | 0; //@line 454
 $32 = $0; //@line 455
 $33 = $1; //@line 456
 $34 = $2; //@line 457
 $35 = $3; //@line 458
 $36 = $32; //@line 459
 $37 = $36 + 12 | 0; //@line 460
 $38 = $35; //@line 461
 $29 = $37; //@line 462
 SAFE_HEAP_STORE($30 | 0, 0 | 0, 4);
 $31 = $38; //@line 464
 $39 = $29; //@line 465
 $28 = $30; //@line 466
 $40 = $28; //@line 467
 $41 = SAFE_HEAP_LOAD($40 | 0, 4, 0) | 0 | 0; //@line 468
 $42 = $31; //@line 469
 $22 = $42; //@line 470
 $43 = $22; //@line 471
 $25 = $39; //@line 472
 SAFE_HEAP_STORE($26 | 0, $41 | 0, 4);
 $27 = $43; //@line 474
 $44 = $25; //@line 475
 $24 = $26; //@line 476
 $45 = $24; //@line 477
 $46 = SAFE_HEAP_LOAD($45 | 0, 4, 0) | 0 | 0; //@line 478
 SAFE_HEAP_STORE($44 | 0, $46 | 0, 4);
 $47 = $44 + 4 | 0; //@line 480
 $48 = $27; //@line 481
 $23 = $48; //@line 482
 $49 = $23; //@line 483
 SAFE_HEAP_STORE($47 | 0, $49 | 0, 4);
 $50 = $33; //@line 485
 $51 = ($50 | 0) != 0; //@line 486
 do {
  if ($51) {
   $6 = $36; //@line 489
   $52 = $6; //@line 490
   $53 = $52 + 12 | 0; //@line 491
   $5 = $53; //@line 492
   $54 = $5; //@line 493
   $4 = $54; //@line 494
   $55 = $4; //@line 495
   $56 = $55 + 4 | 0; //@line 496
   $57 = SAFE_HEAP_LOAD($56 | 0, 4, 0) | 0 | 0; //@line 497
   $58 = $33; //@line 498
   $17 = $57; //@line 499
   $18 = $58; //@line 500
   $59 = $17; //@line 501
   $60 = $18; //@line 502
   $14 = $59; //@line 503
   $15 = $60; //@line 504
   $16 = 0; //@line 505
   $61 = $14; //@line 506
   $62 = $15; //@line 507
   $13 = $61; //@line 508
   $63 = $62 >>> 0 > 1073741823; //@line 509
   if (!$63) {
    $74 = $15; //@line 511
    $75 = $74 << 2; //@line 512
    $12 = $75; //@line 513
    $76 = $12; //@line 514
    $77 = __Znwj($76) | 0; //@line 515
    $78 = $77; //@line 516
    break;
   }
   $9 = 796; //@line 519
   $64 = ___cxa_allocate_exception(8) | 0; //@line 520
   $65 = $9; //@line 521
   $7 = $64; //@line 522
   $8 = $65; //@line 523
   $66 = $7; //@line 524
   $67 = $8; //@line 525
   __THREW__ = 0; //@line 526
   invoke_vii(26, $66 | 0, $67 | 0); //@line 527
   $68 = __THREW__; //@line 528
   __THREW__ = 0; //@line 528
   $69 = $68 & 1; //@line 529
   if ($69) {
    $70 = ___cxa_find_matching_catch_2() | 0; //@line 531
    $71 = tempRet0; //@line 532
    $10 = $70; //@line 533
    $11 = $71; //@line 534
    ___cxa_free_exception($64 | 0); //@line 535
    $72 = $10; //@line 536
    $73 = $11; //@line 537
    ___resumeException($72 | 0); //@line 538
   } else {
    SAFE_HEAP_STORE($66 | 0, 784 | 0, 4);
    ___cxa_throw($64 | 0, 104 | 0, 21 | 0); //@line 542
   }
  } else {
   $78 = 0; //@line 546
  }
 } while (0);
 SAFE_HEAP_STORE($36 | 0, $78 | 0, 4);
 $79 = SAFE_HEAP_LOAD($36 | 0, 4, 0) | 0 | 0; //@line 550
 $80 = $34; //@line 551
 $81 = $79 + ($80 << 2) | 0; //@line 552
 $82 = $36 + 8 | 0; //@line 553
 SAFE_HEAP_STORE($82 | 0, $81 | 0, 4);
 $83 = $36 + 4 | 0; //@line 555
 SAFE_HEAP_STORE($83 | 0, $81 | 0, 4);
 $84 = SAFE_HEAP_LOAD($36 | 0, 4, 0) | 0 | 0; //@line 557
 $85 = $33; //@line 558
 $86 = $84 + ($85 << 2) | 0; //@line 559
 $21 = $36; //@line 560
 $87 = $21; //@line 561
 $88 = $87 + 12 | 0; //@line 562
 $20 = $88; //@line 563
 $89 = $20; //@line 564
 $19 = $89; //@line 565
 $90 = $19; //@line 566
 SAFE_HEAP_STORE($90 | 0, $86 | 0, 4);
 STACKTOP = sp; //@line 568
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0; //@line 8619
 $1 = $1 | 0; //@line 8620
 $2 = $2 | 0; //@line 8621
 $3 = $3 | 0; //@line 8622
 $4 = $4 | 0; //@line 8623
 var $$037$off038 = 0, $$037$off039 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0; //@line 8624
 var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0; //@line 8625
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8626
 sp = STACKTOP; //@line 8627
 $5 = $1 + 8 | 0; //@line 8628
 $6 = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 8629
 $7 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $6, $4) | 0; //@line 8630
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0, $1, $2, $3); //@line 8633
  } else {
   $8 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 8635
   $9 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $8, $4) | 0; //@line 8636
   if (!$9) {
    $43 = $0 + 8 | 0; //@line 8638
    $44 = SAFE_HEAP_LOAD($43 | 0, 4, 0) | 0 | 0; //@line 8639
    $45 = SAFE_HEAP_LOAD($44 | 0, 4, 0) | 0 | 0; //@line 8640
    $46 = $45 + 24 | 0; //@line 8641
    $47 = SAFE_HEAP_LOAD($46 | 0, 4, 0) | 0 | 0; //@line 8642
    FUNCTION_TABLE_viiiii[(SAFE_FT_MASK($47 | 0, 31 | 0) | 0) & 31]($44, $1, $2, $3, $4); //@line 8643
    break;
   }
   $10 = $1 + 16 | 0; //@line 8646
   $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8647
   $12 = ($11 | 0) == ($2 | 0); //@line 8648
   if (!$12) {
    $13 = $1 + 20 | 0; //@line 8650
    $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 8651
    $15 = ($14 | 0) == ($2 | 0); //@line 8652
    if (!$15) {
     $18 = $1 + 32 | 0; //@line 8654
     SAFE_HEAP_STORE($18 | 0, $3 | 0, 4);
     $19 = $1 + 44 | 0; //@line 8656
     $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 8657
     $21 = ($20 | 0) == 4; //@line 8658
     if ($21) {
      break;
     }
     $22 = $1 + 52 | 0; //@line 8662
     SAFE_HEAP_STORE($22 >> 0 | 0, 0 | 0, 1);
     $23 = $1 + 53 | 0; //@line 8664
     SAFE_HEAP_STORE($23 >> 0 | 0, 0 | 0, 1);
     $24 = $0 + 8 | 0; //@line 8666
     $25 = SAFE_HEAP_LOAD($24 | 0, 4, 0) | 0 | 0; //@line 8667
     $26 = SAFE_HEAP_LOAD($25 | 0, 4, 0) | 0 | 0; //@line 8668
     $27 = $26 + 20 | 0; //@line 8669
     $28 = SAFE_HEAP_LOAD($27 | 0, 4, 0) | 0 | 0; //@line 8670
     FUNCTION_TABLE_viiiiii[(SAFE_FT_MASK($28 | 0, 15 | 0) | 0) & 15]($25, $1, $2, $2, 1, $4); //@line 8671
     $29 = SAFE_HEAP_LOAD($23 >> 0 | 0, 1, 0) | 0 | 0; //@line 8672
     $30 = $29 << 24 >> 24 == 0; //@line 8673
     if ($30) {
      $$037$off038 = 4; //@line 8675
      label = 11; //@line 8676
     } else {
      $31 = SAFE_HEAP_LOAD($22 >> 0 | 0, 1, 0) | 0 | 0; //@line 8678
      $32 = $31 << 24 >> 24 == 0; //@line 8679
      if ($32) {
       $$037$off038 = 3; //@line 8681
       label = 11; //@line 8682
      } else {
       $$037$off039 = 3; //@line 8684
      }
     }
     if ((label | 0) == 11) {
      SAFE_HEAP_STORE($13 | 0, $2 | 0, 4);
      $33 = $1 + 40 | 0; //@line 8689
      $34 = SAFE_HEAP_LOAD($33 | 0, 4, 0) | 0 | 0; //@line 8690
      $35 = $34 + 1 | 0; //@line 8691
      SAFE_HEAP_STORE($33 | 0, $35 | 0, 4);
      $36 = $1 + 36 | 0; //@line 8693
      $37 = SAFE_HEAP_LOAD($36 | 0, 4, 0) | 0 | 0; //@line 8694
      $38 = ($37 | 0) == 1; //@line 8695
      if ($38) {
       $39 = $1 + 24 | 0; //@line 8697
       $40 = SAFE_HEAP_LOAD($39 | 0, 4, 0) | 0 | 0; //@line 8698
       $41 = ($40 | 0) == 2; //@line 8699
       if ($41) {
        $42 = $1 + 54 | 0; //@line 8701
        SAFE_HEAP_STORE($42 >> 0 | 0, 1 | 0, 1);
        $$037$off039 = $$037$off038; //@line 8703
       } else {
        $$037$off039 = $$037$off038; //@line 8705
       }
      } else {
       $$037$off039 = $$037$off038; //@line 8708
      }
     }
     SAFE_HEAP_STORE($19 | 0, $$037$off039 | 0, 4);
     break;
    }
   }
   $16 = ($3 | 0) == 1; //@line 8715
   if ($16) {
    $17 = $1 + 32 | 0; //@line 8717
    SAFE_HEAP_STORE($17 | 0, 1 | 0, 4);
   }
  }
 } while (0);
 return;
}
function ___dynamic_cast($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 8490
 $1 = $1 | 0; //@line 8491
 $2 = $2 | 0; //@line 8492
 $3 = $3 | 0; //@line 8493
 var $$ = 0, $$0 = 0, $$33 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0; //@line 8494
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0; //@line 8495
 var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, dest = 0, label = 0, sp = 0, stop = 0; //@line 8496
 sp = STACKTOP; //@line 8497
 STACKTOP = STACKTOP + 64 | 0; //@line 8498
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(64 | 0); //@line 8498
 $4 = sp; //@line 8499
 $5 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8500
 $6 = $5 + -8 | 0; //@line 8501
 $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8502
 $8 = $0 + $7 | 0; //@line 8503
 $9 = $5 + -4 | 0; //@line 8504
 $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 8505
 SAFE_HEAP_STORE($4 | 0, $2 | 0, 4);
 $11 = $4 + 4 | 0; //@line 8507
 SAFE_HEAP_STORE($11 | 0, $0 | 0, 4);
 $12 = $4 + 8 | 0; //@line 8509
 SAFE_HEAP_STORE($12 | 0, $1 | 0, 4);
 $13 = $4 + 12 | 0; //@line 8511
 SAFE_HEAP_STORE($13 | 0, $3 | 0, 4);
 $14 = $4 + 16 | 0; //@line 8513
 $15 = $4 + 20 | 0; //@line 8514
 $16 = $4 + 24 | 0; //@line 8515
 $17 = $4 + 28 | 0; //@line 8516
 $18 = $4 + 32 | 0; //@line 8517
 $19 = $4 + 40 | 0; //@line 8518
 dest = $14; //@line 8519
 stop = dest + 36 | 0; //@line 8519
 do {
  SAFE_HEAP_STORE(dest | 0, 0 | 0 | 0, 4);
  dest = dest + 4 | 0; //@line 8519
 } while ((dest | 0) < (stop | 0));
 SAFE_HEAP_STORE($14 + 36 | 0, 0 | 0 | 0, 2);
 SAFE_HEAP_STORE($14 + 38 >> 0 | 0, 0 | 0 | 0, 1);
 $20 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($10, $2, 0) | 0; //@line 8520
 L1 : do {
  if ($20) {
   $21 = $4 + 48 | 0; //@line 8523
   SAFE_HEAP_STORE($21 | 0, 1 | 0, 4);
   $22 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8525
   $23 = $22 + 20 | 0; //@line 8526
   $24 = SAFE_HEAP_LOAD($23 | 0, 4, 0) | 0 | 0; //@line 8527
   FUNCTION_TABLE_viiiiii[(SAFE_FT_MASK($24 | 0, 15 | 0) | 0) & 15]($10, $4, $8, $8, 1, 0); //@line 8528
   $25 = SAFE_HEAP_LOAD($16 | 0, 4, 0) | 0 | 0; //@line 8529
   $26 = ($25 | 0) == 1; //@line 8530
   $$ = $26 ? $8 : 0; //@line 8531
   $$0 = $$; //@line 8532
  } else {
   $27 = $4 + 36 | 0; //@line 8534
   $28 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8535
   $29 = $28 + 24 | 0; //@line 8536
   $30 = SAFE_HEAP_LOAD($29 | 0, 4, 0) | 0 | 0; //@line 8537
   FUNCTION_TABLE_viiiii[(SAFE_FT_MASK($30 | 0, 31 | 0) | 0) & 31]($10, $4, $8, 1, 0); //@line 8538
   $31 = SAFE_HEAP_LOAD($27 | 0, 4, 0) | 0 | 0; //@line 8539
   switch ($31 | 0) {
   case 0:
    {
     $32 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 8542
     $33 = ($32 | 0) == 1; //@line 8543
     $34 = SAFE_HEAP_LOAD($17 | 0, 4, 0) | 0 | 0; //@line 8544
     $35 = ($34 | 0) == 1; //@line 8545
     $or$cond = $33 & $35; //@line 8546
     $36 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 8547
     $37 = ($36 | 0) == 1; //@line 8548
     $or$cond28 = $or$cond & $37; //@line 8549
     $38 = SAFE_HEAP_LOAD($15 | 0, 4, 0) | 0 | 0; //@line 8550
     $$33 = $or$cond28 ? $38 : 0; //@line 8551
     $$0 = $$33; //@line 8552
     break L1;
     break;
    }
   case 1:
    {
     break;
    }
   default:
    {
     $$0 = 0; //@line 8560
     break L1;
    }
   }
   $39 = SAFE_HEAP_LOAD($16 | 0, 4, 0) | 0 | 0; //@line 8564
   $40 = ($39 | 0) == 1; //@line 8565
   if (!$40) {
    $41 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 8567
    $42 = ($41 | 0) == 0; //@line 8568
    $43 = SAFE_HEAP_LOAD($17 | 0, 4, 0) | 0 | 0; //@line 8569
    $44 = ($43 | 0) == 1; //@line 8570
    $or$cond30 = $42 & $44; //@line 8571
    $45 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 8572
    $46 = ($45 | 0) == 1; //@line 8573
    $or$cond32 = $or$cond30 & $46; //@line 8574
    if (!$or$cond32) {
     $$0 = 0; //@line 8576
     break;
    }
   }
   $47 = SAFE_HEAP_LOAD($14 | 0, 4, 0) | 0 | 0; //@line 8580
   $$0 = $47; //@line 8581
  }
 } while (0);
 STACKTOP = sp; //@line 8584
 return $$0 | 0; //@line 8584
}
function __ZNSt3__214__split_bufferIPN4Asam10HtmlCanvasERNS_9allocatorIS3_EEED2Ev($0) {
 $0 = $0 | 0; //@line 865
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0; //@line 866
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0; //@line 867
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0; //@line 868
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0; //@line 869
 var $82 = 0, $83 = 0, $84 = 0, $9 = 0, label = 0, sp = 0; //@line 870
 sp = STACKTOP; //@line 871
 STACKTOP = STACKTOP + 144 | 0; //@line 872
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(144 | 0); //@line 872
 $19 = sp + 8 | 0; //@line 873
 $22 = sp + 133 | 0; //@line 874
 $29 = sp; //@line 875
 $32 = sp + 132 | 0; //@line 876
 $34 = $0; //@line 877
 $35 = $34; //@line 878
 $33 = $35; //@line 879
 $36 = $33; //@line 880
 $37 = $36 + 4 | 0; //@line 881
 $38 = SAFE_HEAP_LOAD($37 | 0, 4, 0) | 0 | 0; //@line 882
 $30 = $36; //@line 883
 $31 = $38; //@line 884
 $39 = $30; //@line 885
 $40 = $31; //@line 886
 SAFE_HEAP_STORE($29 >> 0 | 0, SAFE_HEAP_LOAD($32 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
 $27 = $39; //@line 888
 $28 = $40; //@line 889
 $41 = $27; //@line 890
 while (1) {
  $42 = $28; //@line 892
  $43 = $41 + 8 | 0; //@line 893
  $44 = SAFE_HEAP_LOAD($43 | 0, 4, 0) | 0 | 0; //@line 894
  $45 = ($42 | 0) != ($44 | 0); //@line 895
  if (!$45) {
   break;
  }
  $26 = $41; //@line 899
  $46 = $26; //@line 900
  $47 = $46 + 12 | 0; //@line 901
  $25 = $47; //@line 902
  $48 = $25; //@line 903
  $24 = $48; //@line 904
  $49 = $24; //@line 905
  $50 = $49 + 4 | 0; //@line 906
  $51 = SAFE_HEAP_LOAD($50 | 0, 4, 0) | 0 | 0; //@line 907
  $52 = $41 + 8 | 0; //@line 908
  $53 = SAFE_HEAP_LOAD($52 | 0, 4, 0) | 0 | 0; //@line 909
  $54 = $53 + -4 | 0; //@line 910
  SAFE_HEAP_STORE($52 | 0, $54 | 0, 4);
  $23 = $54; //@line 912
  $55 = $23; //@line 913
  $20 = $51; //@line 914
  $21 = $55; //@line 915
  $56 = $20; //@line 916
  $57 = $21; //@line 917
  SAFE_HEAP_STORE($19 >> 0 | 0, SAFE_HEAP_LOAD($22 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
  $17 = $56; //@line 919
  $18 = $57; //@line 920
  $58 = $17; //@line 921
  $59 = $18; //@line 922
  $15 = $58; //@line 923
  $16 = $59; //@line 924
 }
 $60 = SAFE_HEAP_LOAD($35 | 0, 4, 0) | 0 | 0; //@line 926
 $61 = ($60 | 0) != (0 | 0); //@line 927
 if (!$61) {
  STACKTOP = sp; //@line 929
  return;
 }
 $14 = $35; //@line 931
 $62 = $14; //@line 932
 $63 = $62 + 12 | 0; //@line 933
 $13 = $63; //@line 934
 $64 = $13; //@line 935
 $12 = $64; //@line 936
 $65 = $12; //@line 937
 $66 = $65 + 4 | 0; //@line 938
 $67 = SAFE_HEAP_LOAD($66 | 0, 4, 0) | 0 | 0; //@line 939
 $68 = SAFE_HEAP_LOAD($35 | 0, 4, 0) | 0 | 0; //@line 940
 $4 = $35; //@line 941
 $69 = $4; //@line 942
 $3 = $69; //@line 943
 $70 = $3; //@line 944
 $71 = $70 + 12 | 0; //@line 945
 $2 = $71; //@line 946
 $72 = $2; //@line 947
 $1 = $72; //@line 948
 $73 = $1; //@line 949
 $74 = SAFE_HEAP_LOAD($73 | 0, 4, 0) | 0 | 0; //@line 950
 $75 = SAFE_HEAP_LOAD($69 | 0, 4, 0) | 0 | 0; //@line 951
 $76 = $74; //@line 952
 $77 = $75; //@line 953
 $78 = $76 - $77 | 0; //@line 954
 $79 = ($78 | 0) / 4 & -1; //@line 955
 $9 = $67; //@line 956
 $10 = $68; //@line 957
 $11 = $79; //@line 958
 $80 = $9; //@line 959
 $81 = $10; //@line 960
 $82 = $11; //@line 961
 $6 = $80; //@line 962
 $7 = $81; //@line 963
 $8 = $82; //@line 964
 $83 = $7; //@line 965
 $5 = $83; //@line 966
 $84 = $5; //@line 967
 __ZdlPv($84); //@line 968
 STACKTOP = sp; //@line 969
 return;
}
function _wcrtomb($0, $1, $2) {
 $0 = $0 | 0; //@line 7123
 $1 = $1 | 0; //@line 7124
 $2 = $2 | 0; //@line 7125
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0; //@line 7126
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0; //@line 7127
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0; //@line 7128
 sp = STACKTOP; //@line 7129
 $3 = ($0 | 0) == (0 | 0); //@line 7130
 do {
  if ($3) {
   $$0 = 1; //@line 7133
  } else {
   $4 = $1 >>> 0 < 128; //@line 7135
   if ($4) {
    $5 = $1 & 255; //@line 7137
    SAFE_HEAP_STORE($0 >> 0 | 0, $5 | 0, 1);
    $$0 = 1; //@line 7139
    break;
   }
   $6 = ___pthread_self_443() | 0; //@line 7142
   $7 = $6 + 188 | 0; //@line 7143
   $8 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 7144
   $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 7145
   $10 = ($9 | 0) == (0 | 0); //@line 7146
   if ($10) {
    $11 = $1 & -128; //@line 7148
    $12 = ($11 | 0) == 57216; //@line 7149
    if ($12) {
     $14 = $1 & 255; //@line 7151
     SAFE_HEAP_STORE($0 >> 0 | 0, $14 | 0, 1);
     $$0 = 1; //@line 7153
     break;
    } else {
     $13 = ___errno_location() | 0; //@line 7156
     SAFE_HEAP_STORE($13 | 0, 84 | 0, 4);
     $$0 = -1; //@line 7158
     break;
    }
   }
   $15 = $1 >>> 0 < 2048; //@line 7162
   if ($15) {
    $16 = $1 >>> 6; //@line 7164
    $17 = $16 | 192; //@line 7165
    $18 = $17 & 255; //@line 7166
    $19 = $0 + 1 | 0; //@line 7167
    SAFE_HEAP_STORE($0 >> 0 | 0, $18 | 0, 1);
    $20 = $1 & 63; //@line 7169
    $21 = $20 | 128; //@line 7170
    $22 = $21 & 255; //@line 7171
    SAFE_HEAP_STORE($19 >> 0 | 0, $22 | 0, 1);
    $$0 = 2; //@line 7173
    break;
   }
   $23 = $1 >>> 0 < 55296; //@line 7176
   $24 = $1 & -8192; //@line 7177
   $25 = ($24 | 0) == 57344; //@line 7178
   $or$cond = $23 | $25; //@line 7179
   if ($or$cond) {
    $26 = $1 >>> 12; //@line 7181
    $27 = $26 | 224; //@line 7182
    $28 = $27 & 255; //@line 7183
    $29 = $0 + 1 | 0; //@line 7184
    SAFE_HEAP_STORE($0 >> 0 | 0, $28 | 0, 1);
    $30 = $1 >>> 6; //@line 7186
    $31 = $30 & 63; //@line 7187
    $32 = $31 | 128; //@line 7188
    $33 = $32 & 255; //@line 7189
    $34 = $0 + 2 | 0; //@line 7190
    SAFE_HEAP_STORE($29 >> 0 | 0, $33 | 0, 1);
    $35 = $1 & 63; //@line 7192
    $36 = $35 | 128; //@line 7193
    $37 = $36 & 255; //@line 7194
    SAFE_HEAP_STORE($34 >> 0 | 0, $37 | 0, 1);
    $$0 = 3; //@line 7196
    break;
   }
   $38 = $1 + -65536 | 0; //@line 7199
   $39 = $38 >>> 0 < 1048576; //@line 7200
   if ($39) {
    $40 = $1 >>> 18; //@line 7202
    $41 = $40 | 240; //@line 7203
    $42 = $41 & 255; //@line 7204
    $43 = $0 + 1 | 0; //@line 7205
    SAFE_HEAP_STORE($0 >> 0 | 0, $42 | 0, 1);
    $44 = $1 >>> 12; //@line 7207
    $45 = $44 & 63; //@line 7208
    $46 = $45 | 128; //@line 7209
    $47 = $46 & 255; //@line 7210
    $48 = $0 + 2 | 0; //@line 7211
    SAFE_HEAP_STORE($43 >> 0 | 0, $47 | 0, 1);
    $49 = $1 >>> 6; //@line 7213
    $50 = $49 & 63; //@line 7214
    $51 = $50 | 128; //@line 7215
    $52 = $51 & 255; //@line 7216
    $53 = $0 + 3 | 0; //@line 7217
    SAFE_HEAP_STORE($48 >> 0 | 0, $52 | 0, 1);
    $54 = $1 & 63; //@line 7219
    $55 = $54 | 128; //@line 7220
    $56 = $55 & 255; //@line 7221
    SAFE_HEAP_STORE($53 >> 0 | 0, $56 | 0, 1);
    $$0 = 4; //@line 7223
    break;
   } else {
    $57 = ___errno_location() | 0; //@line 7226
    SAFE_HEAP_STORE($57 | 0, 84 | 0, 4);
    $$0 = -1; //@line 7228
    break;
   }
  }
 } while (0);
 return $$0 | 0; //@line 7233
}
function _vfprintf($0, $1, $2) {
 $0 = $0 | 0; //@line 4512
 $1 = $1 | 0; //@line 4513
 $2 = $2 | 0; //@line 4514
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0; //@line 4515
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0; //@line 4516
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0; //@line 4517
 sp = STACKTOP; //@line 4518
 STACKTOP = STACKTOP + 224 | 0; //@line 4519
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(224 | 0); //@line 4519
 $3 = sp + 120 | 0; //@line 4520
 $4 = sp + 80 | 0; //@line 4521
 $5 = sp; //@line 4522
 $6 = sp + 136 | 0; //@line 4523
 dest = $4; //@line 4524
 stop = dest + 40 | 0; //@line 4524
 do {
  SAFE_HEAP_STORE(dest | 0, 0 | 0 | 0, 4);
  dest = dest + 4 | 0; //@line 4524
 } while ((dest | 0) < (stop | 0));
 $vacopy_currentptr = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 4525
 SAFE_HEAP_STORE($3 | 0, $vacopy_currentptr | 0, 4);
 $7 = _printf_core(0, $1, $3, $5, $4) | 0; //@line 4527
 $8 = ($7 | 0) < 0; //@line 4528
 if ($8) {
  $$0 = -1; //@line 4530
 } else {
  $9 = $0 + 76 | 0; //@line 4532
  $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 4533
  $11 = ($10 | 0) > -1; //@line 4534
  if ($11) {
   $12 = ___lockfile($0) | 0; //@line 4536
   $40 = $12; //@line 4537
  } else {
   $40 = 0; //@line 4539
  }
  $13 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 4541
  $14 = $13 & 32; //@line 4542
  $15 = $0 + 74 | 0; //@line 4543
  $16 = SAFE_HEAP_LOAD($15 >> 0 | 0, 1, 0) | 0 | 0; //@line 4544
  $17 = $16 << 24 >> 24 < 1; //@line 4545
  if ($17) {
   $18 = $13 & -33; //@line 4547
   SAFE_HEAP_STORE($0 | 0, $18 | 0, 4);
  }
  $19 = $0 + 48 | 0; //@line 4550
  $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 4551
  $21 = ($20 | 0) == 0; //@line 4552
  if ($21) {
   $23 = $0 + 44 | 0; //@line 4554
   $24 = SAFE_HEAP_LOAD($23 | 0, 4, 0) | 0 | 0; //@line 4555
   SAFE_HEAP_STORE($23 | 0, $6 | 0, 4);
   $25 = $0 + 28 | 0; //@line 4557
   SAFE_HEAP_STORE($25 | 0, $6 | 0, 4);
   $26 = $0 + 20 | 0; //@line 4559
   SAFE_HEAP_STORE($26 | 0, $6 | 0, 4);
   SAFE_HEAP_STORE($19 | 0, 80 | 0, 4);
   $27 = $6 + 80 | 0; //@line 4562
   $28 = $0 + 16 | 0; //@line 4563
   SAFE_HEAP_STORE($28 | 0, $27 | 0, 4);
   $29 = _printf_core($0, $1, $3, $5, $4) | 0; //@line 4565
   $30 = ($24 | 0) == (0 | 0); //@line 4566
   if ($30) {
    $$1 = $29; //@line 4568
   } else {
    $31 = $0 + 36 | 0; //@line 4570
    $32 = SAFE_HEAP_LOAD($31 | 0, 4, 0) | 0 | 0; //@line 4571
    FUNCTION_TABLE_iiii[(SAFE_FT_MASK($32 | 0, 15 | 0) | 0) & 15]($0, 0, 0) | 0; //@line 4572
    $33 = SAFE_HEAP_LOAD($26 | 0, 4, 0) | 0 | 0; //@line 4573
    $34 = ($33 | 0) == (0 | 0); //@line 4574
    $$ = $34 ? -1 : $29; //@line 4575
    SAFE_HEAP_STORE($23 | 0, $24 | 0, 4);
    SAFE_HEAP_STORE($19 | 0, 0 | 0, 4);
    SAFE_HEAP_STORE($28 | 0, 0 | 0, 4);
    SAFE_HEAP_STORE($25 | 0, 0 | 0, 4);
    SAFE_HEAP_STORE($26 | 0, 0 | 0, 4);
    $$1 = $$; //@line 4581
   }
  } else {
   $22 = _printf_core($0, $1, $3, $5, $4) | 0; //@line 4584
   $$1 = $22; //@line 4585
  }
  $35 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 4587
  $36 = $35 & 32; //@line 4588
  $37 = ($36 | 0) == 0; //@line 4589
  $$1$ = $37 ? $$1 : -1; //@line 4590
  $38 = $35 | $14; //@line 4591
  SAFE_HEAP_STORE($0 | 0, $38 | 0, 4);
  $39 = ($40 | 0) == 0; //@line 4593
  if (!$39) {
   ___unlockfile($0); //@line 4595
  }
  $$0 = $$1$; //@line 4597
 }
 STACKTOP = sp; //@line 4599
 return $$0 | 0; //@line 4599
}
function __ZN4Asam4Root12CreateCanvasEPKc($0, $1) {
 $0 = $0 | 0; //@line 154
 $1 = $1 | 0; //@line 155
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0; //@line 156
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0; //@line 157
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0; //@line 158
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 159
 sp = STACKTOP; //@line 160
 STACKTOP = STACKTOP + 128 | 0; //@line 161
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(128 | 0); //@line 161
 $14 = sp; //@line 162
 $19 = sp + 117 | 0; //@line 163
 $29 = sp + 116 | 0; //@line 164
 $32 = sp + 4 | 0; //@line 165
 $30 = $0; //@line 166
 $31 = $1; //@line 167
 $33 = $30; //@line 168
 $34 = __ZN4Asam17WebGLRenderSystem11GetInstanceEv() | 0; //@line 169
 $35 = $31; //@line 170
 $36 = __ZN4Asam17WebGLRenderSystem16CreateHtmlCanvasEPKc($34, $35) | 0; //@line 171
 SAFE_HEAP_STORE($32 | 0, $36 | 0, 4);
 $27 = $33; //@line 173
 $28 = $32; //@line 174
 $37 = $27; //@line 175
 $38 = $37 + 4 | 0; //@line 176
 $39 = SAFE_HEAP_LOAD($38 | 0, 4, 0) | 0 | 0; //@line 177
 $26 = $37; //@line 178
 $40 = $26; //@line 179
 $41 = $40 + 8 | 0; //@line 180
 $25 = $41; //@line 181
 $42 = $25; //@line 182
 $24 = $42; //@line 183
 $43 = $24; //@line 184
 $44 = SAFE_HEAP_LOAD($43 | 0, 4, 0) | 0 | 0; //@line 185
 $45 = ($39 | 0) != ($44 | 0); //@line 186
 if ($45) {
  $21 = $29; //@line 188
  $22 = $37; //@line 189
  $23 = 1; //@line 190
  $4 = $37; //@line 191
  $46 = $4; //@line 192
  $47 = $46 + 8 | 0; //@line 193
  $3 = $47; //@line 194
  $48 = $3; //@line 195
  $2 = $48; //@line 196
  $49 = $2; //@line 197
  $50 = $37 + 4 | 0; //@line 198
  $51 = SAFE_HEAP_LOAD($50 | 0, 4, 0) | 0 | 0; //@line 199
  $5 = $51; //@line 200
  $52 = $5; //@line 201
  $53 = $28; //@line 202
  $16 = $49; //@line 203
  $17 = $52; //@line 204
  $18 = $53; //@line 205
  $54 = $16; //@line 206
  $55 = $17; //@line 207
  $56 = $18; //@line 208
  $15 = $56; //@line 209
  $57 = $15; //@line 210
  SAFE_HEAP_STORE($14 >> 0 | 0, SAFE_HEAP_LOAD($19 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
  $11 = $54; //@line 212
  $12 = $55; //@line 213
  $13 = $57; //@line 214
  $58 = $11; //@line 215
  $59 = $12; //@line 216
  $60 = $13; //@line 217
  $10 = $60; //@line 218
  $61 = $10; //@line 219
  $7 = $58; //@line 220
  $8 = $59; //@line 221
  $9 = $61; //@line 222
  $62 = $8; //@line 223
  $63 = $9; //@line 224
  $6 = $63; //@line 225
  $64 = $6; //@line 226
  $65 = SAFE_HEAP_LOAD($64 | 0, 4, 0) | 0 | 0; //@line 227
  SAFE_HEAP_STORE($62 | 0, $65 | 0, 4);
  $20 = $29; //@line 229
  $66 = $37 + 4 | 0; //@line 230
  $67 = SAFE_HEAP_LOAD($66 | 0, 4, 0) | 0 | 0; //@line 231
  $68 = $67 + 4 | 0; //@line 232
  SAFE_HEAP_STORE($66 | 0, $68 | 0, 4);
  $70 = SAFE_HEAP_LOAD($32 | 0, 4, 0) | 0 | 0; //@line 234
  STACKTOP = sp; //@line 235
  return $70 | 0; //@line 235
 } else {
  $69 = $28; //@line 237
  __ZNSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($37, $69); //@line 238
  $70 = SAFE_HEAP_LOAD($32 | 0, 4, 0) | 0 | 0; //@line 239
  STACKTOP = sp; //@line 240
  return $70 | 0; //@line 240
 }
 return 0 | 0; //@line 242
}
function _memcpy(dest, src, num) {
 dest = dest | 0; //@line 9306
 src = src | 0; //@line 9306
 num = num | 0; //@line 9306
 var ret = 0; //@line 9307
 var aligned_dest_end = 0; //@line 9308
 var block_aligned_dest_end = 0; //@line 9309
 var dest_end = 0; //@line 9310
 if ((num | 0) >= 8192) {
  return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0; //@line 9315
 }
 ret = dest | 0; //@line 9318
 dest_end = dest + num | 0; //@line 9319
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if ((num | 0) == 0) return ret | 0; //@line 9323
   SAFE_HEAP_STORE(dest | 0, SAFE_HEAP_LOAD(src | 0, 1, 0) | 0 | 0, 1); //@line 9324
   dest = dest + 1 | 0; //@line 9325
   src = src + 1 | 0; //@line 9326
   num = num - 1 | 0; //@line 9327
  }
  aligned_dest_end = dest_end & -4 | 0; //@line 9329
  block_aligned_dest_end = aligned_dest_end - 64 | 0; //@line 9330
  while ((dest | 0) <= (block_aligned_dest_end | 0)) {
   SAFE_HEAP_STORE(dest | 0, SAFE_HEAP_LOAD(src | 0, 4, 0) | 0 | 0, 4); //@line 9332
   SAFE_HEAP_STORE(dest + 4 | 0, SAFE_HEAP_LOAD(src + 4 | 0, 4, 0) | 0 | 0, 4); //@line 9333
   SAFE_HEAP_STORE(dest + 8 | 0, SAFE_HEAP_LOAD(src + 8 | 0, 4, 0) | 0 | 0, 4); //@line 9334
   SAFE_HEAP_STORE(dest + 12 | 0, SAFE_HEAP_LOAD(src + 12 | 0, 4, 0) | 0 | 0, 4); //@line 9335
   SAFE_HEAP_STORE(dest + 16 | 0, SAFE_HEAP_LOAD(src + 16 | 0, 4, 0) | 0 | 0, 4); //@line 9336
   SAFE_HEAP_STORE(dest + 20 | 0, SAFE_HEAP_LOAD(src + 20 | 0, 4, 0) | 0 | 0, 4); //@line 9337
   SAFE_HEAP_STORE(dest + 24 | 0, SAFE_HEAP_LOAD(src + 24 | 0, 4, 0) | 0 | 0, 4); //@line 9338
   SAFE_HEAP_STORE(dest + 28 | 0, SAFE_HEAP_LOAD(src + 28 | 0, 4, 0) | 0 | 0, 4); //@line 9339
   SAFE_HEAP_STORE(dest + 32 | 0, SAFE_HEAP_LOAD(src + 32 | 0, 4, 0) | 0 | 0, 4); //@line 9340
   SAFE_HEAP_STORE(dest + 36 | 0, SAFE_HEAP_LOAD(src + 36 | 0, 4, 0) | 0 | 0, 4); //@line 9341
   SAFE_HEAP_STORE(dest + 40 | 0, SAFE_HEAP_LOAD(src + 40 | 0, 4, 0) | 0 | 0, 4); //@line 9342
   SAFE_HEAP_STORE(dest + 44 | 0, SAFE_HEAP_LOAD(src + 44 | 0, 4, 0) | 0 | 0, 4); //@line 9343
   SAFE_HEAP_STORE(dest + 48 | 0, SAFE_HEAP_LOAD(src + 48 | 0, 4, 0) | 0 | 0, 4); //@line 9344
   SAFE_HEAP_STORE(dest + 52 | 0, SAFE_HEAP_LOAD(src + 52 | 0, 4, 0) | 0 | 0, 4); //@line 9345
   SAFE_HEAP_STORE(dest + 56 | 0, SAFE_HEAP_LOAD(src + 56 | 0, 4, 0) | 0 | 0, 4); //@line 9346
   SAFE_HEAP_STORE(dest + 60 | 0, SAFE_HEAP_LOAD(src + 60 | 0, 4, 0) | 0 | 0, 4); //@line 9347
   dest = dest + 64 | 0; //@line 9348
   src = src + 64 | 0; //@line 9349
  }
  while ((dest | 0) < (aligned_dest_end | 0)) {
   SAFE_HEAP_STORE(dest | 0, SAFE_HEAP_LOAD(src | 0, 4, 0) | 0 | 0, 4); //@line 9352
   dest = dest + 4 | 0; //@line 9353
   src = src + 4 | 0; //@line 9354
  }
 } else {
  aligned_dest_end = dest_end - 4 | 0; //@line 9358
  while ((dest | 0) < (aligned_dest_end | 0)) {
   SAFE_HEAP_STORE(dest | 0, SAFE_HEAP_LOAD(src | 0, 1, 0) | 0 | 0, 1); //@line 9360
   SAFE_HEAP_STORE(dest + 1 | 0, SAFE_HEAP_LOAD(src + 1 | 0, 1, 0) | 0 | 0, 1); //@line 9361
   SAFE_HEAP_STORE(dest + 2 | 0, SAFE_HEAP_LOAD(src + 2 | 0, 1, 0) | 0 | 0, 1); //@line 9362
   SAFE_HEAP_STORE(dest + 3 | 0, SAFE_HEAP_LOAD(src + 3 | 0, 1, 0) | 0 | 0, 1); //@line 9363
   dest = dest + 4 | 0; //@line 9364
   src = src + 4 | 0; //@line 9365
  }
 }
 while ((dest | 0) < (dest_end | 0)) {
  SAFE_HEAP_STORE(dest | 0, SAFE_HEAP_LOAD(src | 0, 1, 0) | 0 | 0, 1); //@line 9370
  dest = dest + 1 | 0; //@line 9371
  src = src + 1 | 0; //@line 9372
 }
 return ret | 0; //@line 9374
}
function __ZL25default_terminate_handlerv() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0; //@line 8070
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer10 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr1 = 0; //@line 8071
 var $vararg_ptr2 = 0, $vararg_ptr6 = 0, label = 0, sp = 0; //@line 8072
 sp = STACKTOP; //@line 8073
 STACKTOP = STACKTOP + 48 | 0; //@line 8074
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(48 | 0); //@line 8074
 $vararg_buffer10 = sp + 32 | 0; //@line 8075
 $vararg_buffer7 = sp + 24 | 0; //@line 8076
 $vararg_buffer3 = sp + 16 | 0; //@line 8077
 $vararg_buffer = sp; //@line 8078
 $0 = sp + 36 | 0; //@line 8079
 $1 = ___cxa_get_globals_fast() | 0; //@line 8080
 $2 = ($1 | 0) == (0 | 0); //@line 8081
 if (!$2) {
  $3 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 8083
  $4 = ($3 | 0) == (0 | 0); //@line 8084
  if (!$4) {
   $5 = $3 + 80 | 0; //@line 8086
   $6 = $3 + 48 | 0; //@line 8087
   $7 = $6; //@line 8088
   $8 = $7; //@line 8089
   $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 8090
   $10 = $7 + 4 | 0; //@line 8091
   $11 = $10; //@line 8092
   $12 = SAFE_HEAP_LOAD($11 | 0, 4, 0) | 0 | 0; //@line 8093
   $13 = $9 & -256; //@line 8094
   $14 = ($13 | 0) == 1126902528; //@line 8095
   $15 = ($12 | 0) == 1129074247; //@line 8096
   $16 = $14 & $15; //@line 8097
   if (!$16) {
    SAFE_HEAP_STORE($vararg_buffer7 | 0, 3433 | 0, 4);
    _abort_message(3383, $vararg_buffer7); //@line 8100
   }
   $17 = ($9 | 0) == 1126902529; //@line 8103
   $18 = ($12 | 0) == 1129074247; //@line 8104
   $19 = $17 & $18; //@line 8105
   if ($19) {
    $20 = $3 + 44 | 0; //@line 8107
    $21 = SAFE_HEAP_LOAD($20 | 0, 4, 0) | 0 | 0; //@line 8108
    $22 = $21; //@line 8109
   } else {
    $22 = $5; //@line 8111
   }
   SAFE_HEAP_STORE($0 | 0, $22 | 0, 4);
   $23 = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 8114
   $24 = $23 + 4 | 0; //@line 8115
   $25 = SAFE_HEAP_LOAD($24 | 0, 4, 0) | 0 | 0; //@line 8116
   $26 = SAFE_HEAP_LOAD(2 * 4 | 0, 4, 0) | 0 | 0; //@line 8117
   $27 = $26 + 16 | 0; //@line 8118
   $28 = SAFE_HEAP_LOAD($27 | 0, 4, 0) | 0 | 0; //@line 8119
   $29 = FUNCTION_TABLE_iiii[(SAFE_FT_MASK($28 | 0, 15 | 0) | 0) & 15](8, $23, $0) | 0; //@line 8120
   if ($29) {
    $30 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8122
    $31 = SAFE_HEAP_LOAD($30 | 0, 4, 0) | 0 | 0; //@line 8123
    $32 = $31 + 8 | 0; //@line 8124
    $33 = SAFE_HEAP_LOAD($32 | 0, 4, 0) | 0 | 0; //@line 8125
    $34 = FUNCTION_TABLE_ii[(SAFE_FT_MASK($33 | 0, 31 | 0) | 0) & 31]($30) | 0; //@line 8126
    SAFE_HEAP_STORE($vararg_buffer | 0, 3433 | 0, 4);
    $vararg_ptr1 = $vararg_buffer + 4 | 0; //@line 8128
    SAFE_HEAP_STORE($vararg_ptr1 | 0, $25 | 0, 4);
    $vararg_ptr2 = $vararg_buffer + 8 | 0; //@line 8130
    SAFE_HEAP_STORE($vararg_ptr2 | 0, $34 | 0, 4);
    _abort_message(3297, $vararg_buffer); //@line 8132
   } else {
    SAFE_HEAP_STORE($vararg_buffer3 | 0, 3433 | 0, 4);
    $vararg_ptr6 = $vararg_buffer3 + 4 | 0; //@line 8136
    SAFE_HEAP_STORE($vararg_ptr6 | 0, $25 | 0, 4);
    _abort_message(3342, $vararg_buffer3); //@line 8138
   }
  }
 }
 _abort_message(3421, $vararg_buffer10); //@line 8143
}
function ___fwritex($0, $1, $2) {
 $0 = $0 | 0; //@line 7473
 $1 = $1 | 0; //@line 7474
 $2 = $2 | 0; //@line 7475
 var $$038 = 0, $$042 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $$pre = 0, $$pre47 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0; //@line 7476
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0; //@line 7477
 var label = 0, sp = 0; //@line 7478
 sp = STACKTOP; //@line 7479
 $3 = $2 + 16 | 0; //@line 7480
 $4 = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 7481
 $5 = ($4 | 0) == (0 | 0); //@line 7482
 if ($5) {
  $7 = ___towrite($2) | 0; //@line 7484
  $8 = ($7 | 0) == 0; //@line 7485
  if ($8) {
   $$pre = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 7487
   $12 = $$pre; //@line 7488
   label = 5; //@line 7489
  } else {
   $$1 = 0; //@line 7491
  }
 } else {
  $6 = $4; //@line 7494
  $12 = $6; //@line 7495
  label = 5; //@line 7496
 }
 L5 : do {
  if ((label | 0) == 5) {
   $9 = $2 + 20 | 0; //@line 7500
   $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 7501
   $11 = $12 - $10 | 0; //@line 7502
   $13 = $11 >>> 0 < $1 >>> 0; //@line 7503
   $14 = $10; //@line 7504
   if ($13) {
    $15 = $2 + 36 | 0; //@line 7506
    $16 = SAFE_HEAP_LOAD($15 | 0, 4, 0) | 0 | 0; //@line 7507
    $17 = FUNCTION_TABLE_iiii[(SAFE_FT_MASK($16 | 0, 15 | 0) | 0) & 15]($2, $0, $1) | 0; //@line 7508
    $$1 = $17; //@line 7509
    break;
   }
   $18 = $2 + 75 | 0; //@line 7512
   $19 = SAFE_HEAP_LOAD($18 >> 0 | 0, 1, 0) | 0 | 0; //@line 7513
   $20 = $19 << 24 >> 24 > -1; //@line 7514
   L10 : do {
    if ($20) {
     $$038 = $1; //@line 7517
     while (1) {
      $21 = ($$038 | 0) == 0; //@line 7519
      if ($21) {
       $$139 = 0; //@line 7521
       $$141 = $0; //@line 7521
       $$143 = $1; //@line 7521
       $31 = $14; //@line 7521
       break L10;
      }
      $22 = $$038 + -1 | 0; //@line 7524
      $23 = $0 + $22 | 0; //@line 7525
      $24 = SAFE_HEAP_LOAD($23 >> 0 | 0, 1, 0) | 0 | 0; //@line 7526
      $25 = $24 << 24 >> 24 == 10; //@line 7527
      if ($25) {
       break;
      } else {
       $$038 = $22; //@line 7531
      }
     }
     $26 = $2 + 36 | 0; //@line 7534
     $27 = SAFE_HEAP_LOAD($26 | 0, 4, 0) | 0 | 0; //@line 7535
     $28 = FUNCTION_TABLE_iiii[(SAFE_FT_MASK($27 | 0, 15 | 0) | 0) & 15]($2, $0, $$038) | 0; //@line 7536
     $29 = $28 >>> 0 < $$038 >>> 0; //@line 7537
     if ($29) {
      $$1 = $28; //@line 7539
      break L5;
     }
     $30 = $0 + $$038 | 0; //@line 7542
     $$042 = $1 - $$038 | 0; //@line 7543
     $$pre47 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 7544
     $$139 = $$038; //@line 7545
     $$141 = $30; //@line 7545
     $$143 = $$042; //@line 7545
     $31 = $$pre47; //@line 7545
    } else {
     $$139 = 0; //@line 7547
     $$141 = $0; //@line 7547
     $$143 = $1; //@line 7547
     $31 = $14; //@line 7547
    }
   } while (0);
   _memcpy($31 | 0, $$141 | 0, $$143 | 0) | 0; //@line 7550
   $32 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 7551
   $33 = $32 + $$143 | 0; //@line 7552
   SAFE_HEAP_STORE($9 | 0, $33 | 0, 4);
   $34 = $$139 + $$143 | 0; //@line 7554
   $$1 = $34; //@line 7555
  }
 } while (0);
 return $$1 | 0; //@line 7558
}
function _fflush($0) {
 $0 = $0 | 0; //@line 7749
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0; //@line 7750
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0; //@line 7751
 sp = STACKTOP; //@line 7752
 $1 = ($0 | 0) == (0 | 0); //@line 7753
 do {
  if ($1) {
   $8 = SAFE_HEAP_LOAD(101 * 4 | 0, 4, 0) | 0 | 0; //@line 7756
   $9 = ($8 | 0) == (0 | 0); //@line 7757
   if ($9) {
    $29 = 0; //@line 7759
   } else {
    $10 = SAFE_HEAP_LOAD(101 * 4 | 0, 4, 0) | 0 | 0; //@line 7761
    $11 = _fflush($10) | 0; //@line 7762
    $29 = $11; //@line 7763
   }
   $12 = ___ofl_lock() | 0; //@line 7765
   $$02325 = SAFE_HEAP_LOAD($12 | 0, 4, 0) | 0 | 0; //@line 7766
   $13 = ($$02325 | 0) == (0 | 0); //@line 7767
   if ($13) {
    $$024$lcssa = $29; //@line 7769
   } else {
    $$02327 = $$02325; //@line 7771
    $$02426 = $29; //@line 7771
    while (1) {
     $14 = $$02327 + 76 | 0; //@line 7773
     $15 = SAFE_HEAP_LOAD($14 | 0, 4, 0) | 0 | 0; //@line 7774
     $16 = ($15 | 0) > -1; //@line 7775
     if ($16) {
      $17 = ___lockfile($$02327) | 0; //@line 7777
      $26 = $17; //@line 7778
     } else {
      $26 = 0; //@line 7780
     }
     $18 = $$02327 + 20 | 0; //@line 7782
     $19 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 7783
     $20 = $$02327 + 28 | 0; //@line 7784
     $21 = SAFE_HEAP_LOAD($20 | 0, 4, 0) | 0 | 0; //@line 7785
     $22 = $19 >>> 0 > $21 >>> 0; //@line 7786
     if ($22) {
      $23 = ___fflush_unlocked($$02327) | 0; //@line 7788
      $24 = $23 | $$02426; //@line 7789
      $$1 = $24; //@line 7790
     } else {
      $$1 = $$02426; //@line 7792
     }
     $25 = ($26 | 0) == 0; //@line 7794
     if (!$25) {
      ___unlockfile($$02327); //@line 7796
     }
     $27 = $$02327 + 56 | 0; //@line 7798
     $$023 = SAFE_HEAP_LOAD($27 | 0, 4, 0) | 0 | 0; //@line 7799
     $28 = ($$023 | 0) == (0 | 0); //@line 7800
     if ($28) {
      $$024$lcssa = $$1; //@line 7802
      break;
     } else {
      $$02327 = $$023; //@line 7805
      $$02426 = $$1; //@line 7805
     }
    }
   }
   ___ofl_unlock(); //@line 7809
   $$0 = $$024$lcssa; //@line 7810
  } else {
   $2 = $0 + 76 | 0; //@line 7812
   $3 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 7813
   $4 = ($3 | 0) > -1; //@line 7814
   if (!$4) {
    $5 = ___fflush_unlocked($0) | 0; //@line 7816
    $$0 = $5; //@line 7817
    break;
   }
   $6 = ___lockfile($0) | 0; //@line 7820
   $phitmp = ($6 | 0) == 0; //@line 7821
   $7 = ___fflush_unlocked($0) | 0; //@line 7822
   if ($phitmp) {
    $$0 = $7; //@line 7824
   } else {
    ___unlockfile($0); //@line 7826
    $$0 = $7; //@line 7827
   }
  }
 } while (0);
 return $$0 | 0; //@line 7831
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0, $1, $2, $3, $4) {
 $0 = $0 | 0; //@line 8419
 $1 = $1 | 0; //@line 8420
 $2 = $2 | 0; //@line 8421
 $3 = $3 | 0; //@line 8422
 $4 = $4 | 0; //@line 8423
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0; //@line 8424
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0; //@line 8425
 sp = STACKTOP; //@line 8426
 $5 = $1 + 53 | 0; //@line 8427
 SAFE_HEAP_STORE($5 >> 0 | 0, 1 | 0, 1);
 $6 = $1 + 4 | 0; //@line 8429
 $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8430
 $8 = ($7 | 0) == ($3 | 0); //@line 8431
 do {
  if ($8) {
   $9 = $1 + 52 | 0; //@line 8434
   SAFE_HEAP_STORE($9 >> 0 | 0, 1 | 0, 1);
   $10 = $1 + 16 | 0; //@line 8436
   $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8437
   $12 = ($11 | 0) == (0 | 0); //@line 8438
   if ($12) {
    SAFE_HEAP_STORE($10 | 0, $2 | 0, 4);
    $13 = $1 + 24 | 0; //@line 8441
    SAFE_HEAP_STORE($13 | 0, $4 | 0, 4);
    $14 = $1 + 36 | 0; //@line 8443
    SAFE_HEAP_STORE($14 | 0, 1 | 0, 4);
    $15 = $1 + 48 | 0; //@line 8445
    $16 = SAFE_HEAP_LOAD($15 | 0, 4, 0) | 0 | 0; //@line 8446
    $17 = ($16 | 0) == 1; //@line 8447
    $18 = ($4 | 0) == 1; //@line 8448
    $or$cond = $17 & $18; //@line 8449
    if (!$or$cond) {
     break;
    }
    $19 = $1 + 54 | 0; //@line 8453
    SAFE_HEAP_STORE($19 >> 0 | 0, 1 | 0, 1);
    break;
   }
   $20 = ($11 | 0) == ($2 | 0); //@line 8457
   if (!$20) {
    $30 = $1 + 36 | 0; //@line 8459
    $31 = SAFE_HEAP_LOAD($30 | 0, 4, 0) | 0 | 0; //@line 8460
    $32 = $31 + 1 | 0; //@line 8461
    SAFE_HEAP_STORE($30 | 0, $32 | 0, 4);
    $33 = $1 + 54 | 0; //@line 8463
    SAFE_HEAP_STORE($33 >> 0 | 0, 1 | 0, 1);
    break;
   }
   $21 = $1 + 24 | 0; //@line 8467
   $22 = SAFE_HEAP_LOAD($21 | 0, 4, 0) | 0 | 0; //@line 8468
   $23 = ($22 | 0) == 2; //@line 8469
   if ($23) {
    SAFE_HEAP_STORE($21 | 0, $4 | 0, 4);
    $28 = $4; //@line 8472
   } else {
    $28 = $22; //@line 8474
   }
   $24 = $1 + 48 | 0; //@line 8476
   $25 = SAFE_HEAP_LOAD($24 | 0, 4, 0) | 0 | 0; //@line 8477
   $26 = ($25 | 0) == 1; //@line 8478
   $27 = ($28 | 0) == 1; //@line 8479
   $or$cond22 = $26 & $27; //@line 8480
   if ($or$cond22) {
    $29 = $1 + 54 | 0; //@line 8482
    SAFE_HEAP_STORE($29 >> 0 | 0, 1 | 0, 1);
   }
  }
 } while (0);
 return;
}
function _fputc($0, $1) {
 $0 = $0 | 0; //@line 7882
 $1 = $1 | 0; //@line 7883
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0; //@line 7884
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 7885
 sp = STACKTOP; //@line 7886
 $2 = $1 + 76 | 0; //@line 7887
 $3 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 7888
 $4 = ($3 | 0) < 0; //@line 7889
 if ($4) {
  label = 3; //@line 7891
 } else {
  $5 = ___lockfile($1) | 0; //@line 7893
  $6 = ($5 | 0) == 0; //@line 7894
  if ($6) {
   label = 3; //@line 7896
  } else {
   $20 = $0 & 255; //@line 7898
   $21 = $0 & 255; //@line 7899
   $22 = $1 + 75 | 0; //@line 7900
   $23 = SAFE_HEAP_LOAD($22 >> 0 | 0, 1, 0) | 0 | 0; //@line 7901
   $24 = $23 << 24 >> 24; //@line 7902
   $25 = ($21 | 0) == ($24 | 0); //@line 7903
   if ($25) {
    label = 10; //@line 7905
   } else {
    $26 = $1 + 20 | 0; //@line 7907
    $27 = SAFE_HEAP_LOAD($26 | 0, 4, 0) | 0 | 0; //@line 7908
    $28 = $1 + 16 | 0; //@line 7909
    $29 = SAFE_HEAP_LOAD($28 | 0, 4, 0) | 0 | 0; //@line 7910
    $30 = $27 >>> 0 < $29 >>> 0; //@line 7911
    if ($30) {
     $31 = $27 + 1 | 0; //@line 7913
     SAFE_HEAP_STORE($26 | 0, $31 | 0, 4);
     SAFE_HEAP_STORE($27 >> 0 | 0, $20 | 0, 1);
     $33 = $21; //@line 7916
    } else {
     label = 10; //@line 7918
    }
   }
   if ((label | 0) == 10) {
    $32 = ___overflow($1, $0) | 0; //@line 7922
    $33 = $32; //@line 7923
   }
   ___unlockfile($1); //@line 7925
   $$0 = $33; //@line 7926
  }
 }
 do {
  if ((label | 0) == 3) {
   $7 = $0 & 255; //@line 7931
   $8 = $0 & 255; //@line 7932
   $9 = $1 + 75 | 0; //@line 7933
   $10 = SAFE_HEAP_LOAD($9 >> 0 | 0, 1, 0) | 0 | 0; //@line 7934
   $11 = $10 << 24 >> 24; //@line 7935
   $12 = ($8 | 0) == ($11 | 0); //@line 7936
   if (!$12) {
    $13 = $1 + 20 | 0; //@line 7938
    $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 7939
    $15 = $1 + 16 | 0; //@line 7940
    $16 = SAFE_HEAP_LOAD($15 | 0, 4, 0) | 0 | 0; //@line 7941
    $17 = $14 >>> 0 < $16 >>> 0; //@line 7942
    if ($17) {
     $18 = $14 + 1 | 0; //@line 7944
     SAFE_HEAP_STORE($13 | 0, $18 | 0, 4);
     SAFE_HEAP_STORE($14 >> 0 | 0, $7 | 0, 1);
     $$0 = $8; //@line 7947
     break;
    }
   }
   $19 = ___overflow($1, $0) | 0; //@line 7951
   $$0 = $19; //@line 7952
  }
 } while (0);
 return $$0 | 0; //@line 7955
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0; //@line 8274
 $1 = $1 | 0; //@line 8275
 $2 = $2 | 0; //@line 8276
 $3 = $3 | 0; //@line 8277
 $4 = $4 | 0; //@line 8278
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0; //@line 8279
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8280
 sp = STACKTOP; //@line 8281
 $5 = $1 + 8 | 0; //@line 8282
 $6 = SAFE_HEAP_LOAD($5 | 0, 4, 0) | 0 | 0; //@line 8283
 $7 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $6, $4) | 0; //@line 8284
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0, $1, $2, $3); //@line 8287
  } else {
   $8 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 8289
   $9 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $8, $4) | 0; //@line 8290
   if ($9) {
    $10 = $1 + 16 | 0; //@line 8292
    $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8293
    $12 = ($11 | 0) == ($2 | 0); //@line 8294
    if (!$12) {
     $13 = $1 + 20 | 0; //@line 8296
     $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 8297
     $15 = ($14 | 0) == ($2 | 0); //@line 8298
     if (!$15) {
      $18 = $1 + 32 | 0; //@line 8300
      SAFE_HEAP_STORE($18 | 0, $3 | 0, 4);
      SAFE_HEAP_STORE($13 | 0, $2 | 0, 4);
      $19 = $1 + 40 | 0; //@line 8303
      $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 8304
      $21 = $20 + 1 | 0; //@line 8305
      SAFE_HEAP_STORE($19 | 0, $21 | 0, 4);
      $22 = $1 + 36 | 0; //@line 8307
      $23 = SAFE_HEAP_LOAD($22 | 0, 4, 0) | 0 | 0; //@line 8308
      $24 = ($23 | 0) == 1; //@line 8309
      if ($24) {
       $25 = $1 + 24 | 0; //@line 8311
       $26 = SAFE_HEAP_LOAD($25 | 0, 4, 0) | 0 | 0; //@line 8312
       $27 = ($26 | 0) == 2; //@line 8313
       if ($27) {
        $28 = $1 + 54 | 0; //@line 8315
        SAFE_HEAP_STORE($28 >> 0 | 0, 1 | 0, 1);
       }
      }
      $29 = $1 + 44 | 0; //@line 8319
      SAFE_HEAP_STORE($29 | 0, 4 | 0, 4);
      break;
     }
    }
    $16 = ($3 | 0) == 1; //@line 8324
    if ($16) {
     $17 = $1 + 32 | 0; //@line 8326
     SAFE_HEAP_STORE($17 | 0, 1 | 0, 4);
    }
   }
  }
 } while (0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0, $1, $2) {
 $0 = $0 | 0; //@line 8204
 $1 = $1 | 0; //@line 8205
 $2 = $2 | 0; //@line 8206
 var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0; //@line 8207
 var dest = 0, label = 0, sp = 0, stop = 0; //@line 8208
 sp = STACKTOP; //@line 8209
 STACKTOP = STACKTOP + 64 | 0; //@line 8210
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(64 | 0); //@line 8210
 $3 = sp; //@line 8211
 $4 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $1, 0) | 0; //@line 8212
 if ($4) {
  $$2 = 1; //@line 8214
 } else {
  $5 = ($1 | 0) == (0 | 0); //@line 8216
  if ($5) {
   $$2 = 0; //@line 8218
  } else {
   $6 = ___dynamic_cast($1, 32, 16, 0) | 0; //@line 8220
   $7 = ($6 | 0) == (0 | 0); //@line 8221
   if ($7) {
    $$2 = 0; //@line 8223
   } else {
    $8 = $3 + 4 | 0; //@line 8225
    dest = $8; //@line 8226
    stop = dest + 52 | 0; //@line 8226
    do {
     SAFE_HEAP_STORE(dest | 0, 0 | 0 | 0, 4);
     dest = dest + 4 | 0; //@line 8226
    } while ((dest | 0) < (stop | 0));
    SAFE_HEAP_STORE($3 | 0, $6 | 0, 4);
    $9 = $3 + 8 | 0; //@line 8228
    SAFE_HEAP_STORE($9 | 0, $0 | 0, 4);
    $10 = $3 + 12 | 0; //@line 8230
    SAFE_HEAP_STORE($10 | 0, -1 | 0, 4);
    $11 = $3 + 48 | 0; //@line 8232
    SAFE_HEAP_STORE($11 | 0, 1 | 0, 4);
    $12 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8234
    $13 = $12 + 28 | 0; //@line 8235
    $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 8236
    $15 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 8237
    FUNCTION_TABLE_viiii[(SAFE_FT_MASK($14 | 0, 31 | 0) | 0) & 31]($6, $3, $15, 1); //@line 8238
    $16 = $3 + 24 | 0; //@line 8239
    $17 = SAFE_HEAP_LOAD($16 | 0, 4, 0) | 0 | 0; //@line 8240
    $18 = ($17 | 0) == 1; //@line 8241
    if ($18) {
     $19 = $3 + 16 | 0; //@line 8243
     $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 8244
     SAFE_HEAP_STORE($2 | 0, $20 | 0, 4);
     $$0 = 1; //@line 8246
    } else {
     $$0 = 0; //@line 8248
    }
    $$2 = $$0; //@line 8250
   }
  }
 }
 STACKTOP = sp; //@line 8254
 return $$2 | 0; //@line 8254
}
function _fmt_u($0, $1, $2) {
 $0 = $0 | 0; //@line 5878
 $1 = $1 | 0; //@line 5879
 $2 = $2 | 0; //@line 5880
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0; //@line 5881
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 5882
 sp = STACKTOP; //@line 5883
 $3 = $1 >>> 0 > 0; //@line 5884
 $4 = $0 >>> 0 > 4294967295; //@line 5885
 $5 = ($1 | 0) == 0; //@line 5886
 $6 = $5 & $4; //@line 5887
 $7 = $3 | $6; //@line 5888
 if ($7) {
  $$0914 = $2; //@line 5890
  $8 = $0; //@line 5890
  $9 = $1; //@line 5890
  while (1) {
   $10 = ___uremdi3($8 | 0, $9 | 0, 10, 0) | 0; //@line 5892
   $11 = tempRet0; //@line 5893
   $12 = $10 & 255; //@line 5894
   $13 = $12 | 48; //@line 5895
   $14 = $$0914 + -1 | 0; //@line 5896
   SAFE_HEAP_STORE($14 >> 0 | 0, $13 | 0, 1);
   $15 = ___udivdi3($8 | 0, $9 | 0, 10, 0) | 0; //@line 5898
   $16 = tempRet0; //@line 5899
   $17 = $9 >>> 0 > 9; //@line 5900
   $18 = $8 >>> 0 > 4294967295; //@line 5901
   $19 = ($9 | 0) == 9; //@line 5902
   $20 = $19 & $18; //@line 5903
   $21 = $17 | $20; //@line 5904
   if ($21) {
    $$0914 = $14; //@line 5906
    $8 = $15; //@line 5906
    $9 = $16; //@line 5906
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15; //@line 5911
  $$09$lcssa = $14; //@line 5911
 } else {
  $$010$lcssa$off0 = $0; //@line 5913
  $$09$lcssa = $2; //@line 5913
 }
 $22 = ($$010$lcssa$off0 | 0) == 0; //@line 5915
 if ($22) {
  $$1$lcssa = $$09$lcssa; //@line 5917
 } else {
  $$012 = $$010$lcssa$off0; //@line 5919
  $$111 = $$09$lcssa; //@line 5919
  while (1) {
   $23 = ($$012 >>> 0) % 10 & -1; //@line 5921
   $24 = $23 | 48; //@line 5922
   $25 = $24 & 255; //@line 5923
   $26 = $$111 + -1 | 0; //@line 5924
   SAFE_HEAP_STORE($26 >> 0 | 0, $25 | 0, 1);
   $27 = ($$012 >>> 0) / 10 & -1; //@line 5926
   $28 = $$012 >>> 0 < 10; //@line 5927
   if ($28) {
    $$1$lcssa = $26; //@line 5929
    break;
   } else {
    $$012 = $27; //@line 5932
    $$111 = $26; //@line 5932
   }
  }
 }
 return $$1$lcssa | 0; //@line 5936
}
function _strlen($0) {
 $0 = $0 | 0; //@line 7601
 var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0; //@line 7602
 var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 7603
 sp = STACKTOP; //@line 7604
 $1 = $0; //@line 7605
 $2 = $1 & 3; //@line 7606
 $3 = ($2 | 0) == 0; //@line 7607
 L1 : do {
  if ($3) {
   $$015$lcssa = $0; //@line 7610
   label = 4; //@line 7611
  } else {
   $$01519 = $0; //@line 7613
   $23 = $1; //@line 7613
   while (1) {
    $4 = SAFE_HEAP_LOAD($$01519 >> 0 | 0, 1, 0) | 0 | 0; //@line 7615
    $5 = $4 << 24 >> 24 == 0; //@line 7616
    if ($5) {
     $$sink = $23; //@line 7618
     break L1;
    }
    $6 = $$01519 + 1 | 0; //@line 7621
    $7 = $6; //@line 7622
    $8 = $7 & 3; //@line 7623
    $9 = ($8 | 0) == 0; //@line 7624
    if ($9) {
     $$015$lcssa = $6; //@line 7626
     label = 4; //@line 7627
     break;
    } else {
     $$01519 = $6; //@line 7630
     $23 = $7; //@line 7630
    }
   }
  }
 } while (0);
 if ((label | 0) == 4) {
  $$0 = $$015$lcssa; //@line 7636
  while (1) {
   $10 = SAFE_HEAP_LOAD($$0 | 0, 4, 0) | 0 | 0; //@line 7638
   $11 = $10 + -16843009 | 0; //@line 7639
   $12 = $10 & -2139062144; //@line 7640
   $13 = $12 ^ -2139062144; //@line 7641
   $14 = $13 & $11; //@line 7642
   $15 = ($14 | 0) == 0; //@line 7643
   $16 = $$0 + 4 | 0; //@line 7644
   if ($15) {
    $$0 = $16; //@line 7646
   } else {
    break;
   }
  }
  $17 = $10 & 255; //@line 7651
  $18 = $17 << 24 >> 24 == 0; //@line 7652
  if ($18) {
   $$1$lcssa = $$0; //@line 7654
  } else {
   $$pn = $$0; //@line 7656
   while (1) {
    $19 = $$pn + 1 | 0; //@line 7658
    $$pre = SAFE_HEAP_LOAD($19 >> 0 | 0, 1, 0) | 0 | 0; //@line 7659
    $20 = $$pre << 24 >> 24 == 0; //@line 7660
    if ($20) {
     $$1$lcssa = $19; //@line 7662
     break;
    } else {
     $$pn = $19; //@line 7665
    }
   }
  }
  $21 = $$1$lcssa; //@line 7669
  $$sink = $21; //@line 7670
 }
 $22 = $$sink - $1 | 0; //@line 7672
 return $22 | 0; //@line 7673
}
function ___overflow($0, $1) {
 $0 = $0 | 0; //@line 7676
 $1 = $1 | 0; //@line 7677
 var $$0 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0; //@line 7678
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 7679
 sp = STACKTOP; //@line 7680
 STACKTOP = STACKTOP + 16 | 0; //@line 7681
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 7681
 $2 = sp; //@line 7682
 $3 = $1 & 255; //@line 7683
 SAFE_HEAP_STORE($2 >> 0 | 0, $3 | 0, 1);
 $4 = $0 + 16 | 0; //@line 7685
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 7686
 $6 = ($5 | 0) == (0 | 0); //@line 7687
 if ($6) {
  $7 = ___towrite($0) | 0; //@line 7689
  $8 = ($7 | 0) == 0; //@line 7690
  if ($8) {
   $$pre = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 7692
   $12 = $$pre; //@line 7693
   label = 4; //@line 7694
  } else {
   $$0 = -1; //@line 7696
  }
 } else {
  $12 = $5; //@line 7699
  label = 4; //@line 7700
 }
 do {
  if ((label | 0) == 4) {
   $9 = $0 + 20 | 0; //@line 7704
   $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 7705
   $11 = $10 >>> 0 < $12 >>> 0; //@line 7706
   if ($11) {
    $13 = $1 & 255; //@line 7708
    $14 = $0 + 75 | 0; //@line 7709
    $15 = SAFE_HEAP_LOAD($14 >> 0 | 0, 1, 0) | 0 | 0; //@line 7710
    $16 = $15 << 24 >> 24; //@line 7711
    $17 = ($13 | 0) == ($16 | 0); //@line 7712
    if (!$17) {
     $18 = $10 + 1 | 0; //@line 7714
     SAFE_HEAP_STORE($9 | 0, $18 | 0, 4);
     SAFE_HEAP_STORE($10 >> 0 | 0, $3 | 0, 1);
     $$0 = $13; //@line 7717
     break;
    }
   }
   $19 = $0 + 36 | 0; //@line 7721
   $20 = SAFE_HEAP_LOAD($19 | 0, 4, 0) | 0 | 0; //@line 7722
   $21 = FUNCTION_TABLE_iiii[(SAFE_FT_MASK($20 | 0, 15 | 0) | 0) & 15]($0, $2, 1) | 0; //@line 7723
   $22 = ($21 | 0) == 1; //@line 7724
   if ($22) {
    $23 = SAFE_HEAP_LOAD($2 >> 0 | 0, 1, 0) | 0 | 0; //@line 7726
    $24 = $23 & 255; //@line 7727
    $$0 = $24; //@line 7728
   } else {
    $$0 = -1; //@line 7730
   }
  }
 } while (0);
 STACKTOP = sp; //@line 7734
 return $$0 | 0; //@line 7734
}
function __ZNKSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE8max_sizeEv($0) {
 $0 = $0 | 0; //@line 972
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0; //@line 973
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0; //@line 974
 var label = 0, sp = 0; //@line 975
 sp = STACKTOP; //@line 976
 STACKTOP = STACKTOP + 80 | 0; //@line 977
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(80 | 0); //@line 977
 $6 = sp + 8 | 0; //@line 978
 $9 = sp + 77 | 0; //@line 979
 $12 = sp; //@line 980
 $14 = sp + 76 | 0; //@line 981
 $19 = sp + 16 | 0; //@line 982
 $20 = sp + 12 | 0; //@line 983
 $18 = $0; //@line 984
 $21 = $18; //@line 985
 $17 = $21; //@line 986
 $22 = $17; //@line 987
 $23 = $22 + 8 | 0; //@line 988
 $16 = $23; //@line 989
 $24 = $16; //@line 990
 $15 = $24; //@line 991
 $25 = $15; //@line 992
 $13 = $25; //@line 993
 $26 = $13; //@line 994
 SAFE_HEAP_STORE($12 >> 0 | 0, SAFE_HEAP_LOAD($14 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
 $11 = $26; //@line 996
 $27 = $11; //@line 997
 $10 = $27; //@line 998
 SAFE_HEAP_STORE($19 | 0, 1073741823 | 0, 4);
 SAFE_HEAP_STORE($20 | 0, 2147483647 | 0, 4);
 $7 = $19; //@line 1001
 $8 = $20; //@line 1002
 $28 = $7; //@line 1003
 $29 = $8; //@line 1004
 SAFE_HEAP_STORE($6 >> 0 | 0, SAFE_HEAP_LOAD($9 >> 0 | 0, 1, 0) | 0 | 0 | 0, 1);
 $4 = $28; //@line 1006
 $5 = $29; //@line 1007
 $30 = $5; //@line 1008
 $31 = $4; //@line 1009
 $1 = $6; //@line 1010
 $2 = $30; //@line 1011
 $3 = $31; //@line 1012
 $32 = $2; //@line 1013
 $33 = SAFE_HEAP_LOAD($32 | 0, 4, 0) | 0 | 0; //@line 1014
 $34 = $3; //@line 1015
 $35 = SAFE_HEAP_LOAD($34 | 0, 4, 0) | 0 | 0; //@line 1016
 $36 = $33 >>> 0 < $35 >>> 0; //@line 1017
 $37 = $5; //@line 1018
 $38 = $4; //@line 1019
 $39 = $36 ? $37 : $38; //@line 1020
 $40 = SAFE_HEAP_LOAD($39 | 0, 4, 0) | 0 | 0; //@line 1021
 STACKTOP = sp; //@line 1022
 return $40 | 0; //@line 1022
}
function _memset(ptr, value, num) {
 ptr = ptr | 0; //@line 9377
 value = value | 0; //@line 9377
 num = num | 0; //@line 9377
 var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0; //@line 9378
 end = ptr + num | 0; //@line 9379
 value = value & 255; //@line 9381
 if ((num | 0) >= 67) {
  while ((ptr & 3) != 0) {
   SAFE_HEAP_STORE(ptr | 0, value | 0, 1); //@line 9384
   ptr = ptr + 1 | 0; //@line 9385
  }
  aligned_end = end & -4 | 0; //@line 9388
  block_aligned_end = aligned_end - 64 | 0; //@line 9389
  value4 = value | value << 8 | value << 16 | value << 24; //@line 9390
  while ((ptr | 0) <= (block_aligned_end | 0)) {
   SAFE_HEAP_STORE(ptr | 0, value4 | 0, 4); //@line 9393
   SAFE_HEAP_STORE(ptr + 4 | 0, value4 | 0, 4); //@line 9394
   SAFE_HEAP_STORE(ptr + 8 | 0, value4 | 0, 4); //@line 9395
   SAFE_HEAP_STORE(ptr + 12 | 0, value4 | 0, 4); //@line 9396
   SAFE_HEAP_STORE(ptr + 16 | 0, value4 | 0, 4); //@line 9397
   SAFE_HEAP_STORE(ptr + 20 | 0, value4 | 0, 4); //@line 9398
   SAFE_HEAP_STORE(ptr + 24 | 0, value4 | 0, 4); //@line 9399
   SAFE_HEAP_STORE(ptr + 28 | 0, value4 | 0, 4); //@line 9400
   SAFE_HEAP_STORE(ptr + 32 | 0, value4 | 0, 4); //@line 9401
   SAFE_HEAP_STORE(ptr + 36 | 0, value4 | 0, 4); //@line 9402
   SAFE_HEAP_STORE(ptr + 40 | 0, value4 | 0, 4); //@line 9403
   SAFE_HEAP_STORE(ptr + 44 | 0, value4 | 0, 4); //@line 9404
   SAFE_HEAP_STORE(ptr + 48 | 0, value4 | 0, 4); //@line 9405
   SAFE_HEAP_STORE(ptr + 52 | 0, value4 | 0, 4); //@line 9406
   SAFE_HEAP_STORE(ptr + 56 | 0, value4 | 0, 4); //@line 9407
   SAFE_HEAP_STORE(ptr + 60 | 0, value4 | 0, 4); //@line 9408
   ptr = ptr + 64 | 0; //@line 9409
  }
  while ((ptr | 0) < (aligned_end | 0)) {
   SAFE_HEAP_STORE(ptr | 0, value4 | 0, 4); //@line 9413
   ptr = ptr + 4 | 0; //@line 9414
  }
 }
 while ((ptr | 0) < (end | 0)) {
  SAFE_HEAP_STORE(ptr | 0, value | 0, 1); //@line 9419
  ptr = ptr + 1 | 0; //@line 9420
 }
 return end - num | 0; //@line 9422
}
function ___strerror_l($0, $1) {
 $0 = $0 | 0; //@line 7253
 $1 = $1 | 0; //@line 7254
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0; //@line 7255
 var label = 0, sp = 0; //@line 7256
 sp = STACKTOP; //@line 7257
 $$016 = 0; //@line 7258
 while (1) {
  $3 = 1398 + $$016 | 0; //@line 7260
  $4 = SAFE_HEAP_LOAD($3 >> 0 | 0, 1, 0) | 0 | 0; //@line 7261
  $5 = $4 & 255; //@line 7262
  $6 = ($5 | 0) == ($0 | 0); //@line 7263
  if ($6) {
   label = 2; //@line 7265
   break;
  }
  $7 = $$016 + 1 | 0; //@line 7268
  $8 = ($7 | 0) == 87; //@line 7269
  if ($8) {
   $$01214 = 1486; //@line 7271
   $$115 = 87; //@line 7271
   label = 5; //@line 7272
   break;
  } else {
   $$016 = $7; //@line 7275
  }
 }
 if ((label | 0) == 2) {
  $2 = ($$016 | 0) == 0; //@line 7279
  if ($2) {
   $$012$lcssa = 1486; //@line 7281
  } else {
   $$01214 = 1486; //@line 7283
   $$115 = $$016; //@line 7283
   label = 5; //@line 7284
  }
 }
 if ((label | 0) == 5) {
  while (1) {
   label = 0; //@line 7289
   $$113 = $$01214; //@line 7290
   while (1) {
    $9 = SAFE_HEAP_LOAD($$113 >> 0 | 0, 1, 0) | 0 | 0; //@line 7292
    $10 = $9 << 24 >> 24 == 0; //@line 7293
    $11 = $$113 + 1 | 0; //@line 7294
    if ($10) {
     break;
    } else {
     $$113 = $11; //@line 7298
    }
   }
   $12 = $$115 + -1 | 0; //@line 7301
   $13 = ($12 | 0) == 0; //@line 7302
   if ($13) {
    $$012$lcssa = $11; //@line 7304
    break;
   } else {
    $$01214 = $11; //@line 7307
    $$115 = $12; //@line 7307
    label = 5; //@line 7308
   }
  }
 }
 $14 = $1 + 20 | 0; //@line 7312
 $15 = SAFE_HEAP_LOAD($14 | 0, 4, 0) | 0 | 0; //@line 7313
 $16 = ___lctrans($$012$lcssa, $15) | 0; //@line 7314
 return $16 | 0; //@line 7315
}
function ___fflush_unlocked($0) {
 $0 = $0 | 0; //@line 7834
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0; //@line 7835
 var $9 = 0, label = 0, sp = 0; //@line 7836
 sp = STACKTOP; //@line 7837
 $1 = $0 + 20 | 0; //@line 7838
 $2 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 7839
 $3 = $0 + 28 | 0; //@line 7840
 $4 = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 7841
 $5 = $2 >>> 0 > $4 >>> 0; //@line 7842
 if ($5) {
  $6 = $0 + 36 | 0; //@line 7844
  $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 7845
  FUNCTION_TABLE_iiii[(SAFE_FT_MASK($7 | 0, 15 | 0) | 0) & 15]($0, 0, 0) | 0; //@line 7846
  $8 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 7847
  $9 = ($8 | 0) == (0 | 0); //@line 7848
  if ($9) {
   $$0 = -1; //@line 7850
  } else {
   label = 3; //@line 7852
  }
 } else {
  label = 3; //@line 7855
 }
 if ((label | 0) == 3) {
  $10 = $0 + 4 | 0; //@line 7858
  $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 7859
  $12 = $0 + 8 | 0; //@line 7860
  $13 = SAFE_HEAP_LOAD($12 | 0, 4, 0) | 0 | 0; //@line 7861
  $14 = $11 >>> 0 < $13 >>> 0; //@line 7862
  if ($14) {
   $15 = $11; //@line 7864
   $16 = $13; //@line 7865
   $17 = $15 - $16 | 0; //@line 7866
   $18 = $0 + 40 | 0; //@line 7867
   $19 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 7868
   FUNCTION_TABLE_iiii[(SAFE_FT_MASK($19 | 0, 15 | 0) | 0) & 15]($0, $17, 1) | 0; //@line 7869
  }
  $20 = $0 + 16 | 0; //@line 7871
  SAFE_HEAP_STORE($20 | 0, 0 | 0, 4);
  SAFE_HEAP_STORE($3 | 0, 0 | 0, 4);
  SAFE_HEAP_STORE($1 | 0, 0 | 0, 4);
  SAFE_HEAP_STORE($12 | 0, 0 | 0, 4);
  SAFE_HEAP_STORE($10 | 0, 0 | 0, 4);
  $$0 = 0; //@line 7877
 }
 return $$0 | 0; //@line 7879
}
function _frexp($0, $1) {
 $0 = +$0; //@line 7079
 $1 = $1 | 0; //@line 7080
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0; //@line 7082
 sp = STACKTOP; //@line 7083
 SAFE_HEAP_STORE_D(tempDoublePtr | 0, +$0, 8);
 $2 = SAFE_HEAP_LOAD(tempDoublePtr | 0, 4, 0) | 0 | 0; //@line 7084
 $3 = SAFE_HEAP_LOAD(tempDoublePtr + 4 | 0, 4, 0) | 0 | 0; //@line 7085
 $4 = _bitshift64Lshr($2 | 0, $3 | 0, 52) | 0; //@line 7086
 $5 = tempRet0; //@line 7087
 $6 = $4 & 65535; //@line 7088
 $trunc$clear = $6 & 2047; //@line 7089
 switch ($trunc$clear << 16 >> 16) {
 case 0:
  {
   $7 = $0 != 0.0; //@line 7092
   if ($7) {
    $8 = $0 * 18446744073709552000.0; //@line 7094
    $9 = +_frexp($8, $1); //@line 7095
    $10 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 7096
    $11 = $10 + -64 | 0; //@line 7097
    $$016 = $9; //@line 7098
    $storemerge = $11; //@line 7098
   } else {
    $$016 = $0; //@line 7100
    $storemerge = 0; //@line 7100
   }
   SAFE_HEAP_STORE($1 | 0, $storemerge | 0, 4);
   $$0 = $$016; //@line 7103
   break;
  }
 case 2047:
  {
   $$0 = $0; //@line 7107
   break;
  }
 default:
  {
   $12 = $4 & 2047; //@line 7111
   $13 = $12 + -1022 | 0; //@line 7112
   SAFE_HEAP_STORE($1 | 0, $13 | 0, 4);
   $14 = $3 & -2146435073; //@line 7114
   $15 = $14 | 1071644672; //@line 7115
   SAFE_HEAP_STORE(tempDoublePtr | 0, $2 | 0, 4);
   SAFE_HEAP_STORE(tempDoublePtr + 4 | 0, $15 | 0, 4);
   $16 = +(+SAFE_HEAP_LOAD_D(tempDoublePtr | 0, 8)); //@line 7116
   $$0 = $16; //@line 7117
  }
 }
 return +$$0;
}
function __ZSt11__terminatePFvvE($0) {
 $0 = $0 | 0; //@line 8826
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0; //@line 8827
 sp = STACKTOP; //@line 8828
 STACKTOP = STACKTOP + 16 | 0; //@line 8829
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8829
 $vararg_buffer1 = sp + 8 | 0; //@line 8830
 $vararg_buffer = sp; //@line 8831
 __THREW__ = 0; //@line 8832
 invoke_v($0 | 0); //@line 8833
 $1 = __THREW__; //@line 8834
 __THREW__ = 0; //@line 8834
 $2 = $1 & 1; //@line 8835
 if (!$2) {
  __THREW__ = 0; //@line 8837
  invoke_vii(33, 3724 | 0, $vararg_buffer | 0); //@line 8838
  $3 = __THREW__; //@line 8839
  __THREW__ = 0; //@line 8839
 }
 $4 = ___cxa_find_matching_catch_3(0 | 0) | 0; //@line 8841
 $5 = tempRet0; //@line 8842
 ___cxa_begin_catch($4 | 0) | 0; //@line 8843
 __THREW__ = 0; //@line 8844
 invoke_vii(33, 3764 | 0, $vararg_buffer1 | 0); //@line 8845
 $6 = __THREW__; //@line 8846
 __THREW__ = 0; //@line 8846
 $7 = ___cxa_find_matching_catch_3(0 | 0) | 0; //@line 8847
 $8 = tempRet0; //@line 8848
 __THREW__ = 0; //@line 8849
 invoke_v(34); //@line 8850
 $9 = __THREW__; //@line 8851
 __THREW__ = 0; //@line 8851
 $10 = $9 & 1; //@line 8852
 if ($10) {
  $11 = ___cxa_find_matching_catch_3(0 | 0) | 0; //@line 8854
  $12 = tempRet0; //@line 8855
  ___clang_call_terminate($11); //@line 8856
 } else {
  ___clang_call_terminate($7); //@line 8859
 }
}
function ___towrite($0) {
 $0 = $0 | 0; //@line 7561
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0; //@line 7562
 var $8 = 0, $9 = 0, label = 0, sp = 0; //@line 7563
 sp = STACKTOP; //@line 7564
 $1 = $0 + 74 | 0; //@line 7565
 $2 = SAFE_HEAP_LOAD($1 >> 0 | 0, 1, 0) | 0 | 0; //@line 7566
 $3 = $2 << 24 >> 24; //@line 7567
 $4 = $3 + 255 | 0; //@line 7568
 $5 = $4 | $3; //@line 7569
 $6 = $5 & 255; //@line 7570
 SAFE_HEAP_STORE($1 >> 0 | 0, $6 | 0, 1);
 $7 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 7572
 $8 = $7 & 8; //@line 7573
 $9 = ($8 | 0) == 0; //@line 7574
 if ($9) {
  $11 = $0 + 8 | 0; //@line 7576
  SAFE_HEAP_STORE($11 | 0, 0 | 0, 4);
  $12 = $0 + 4 | 0; //@line 7578
  SAFE_HEAP_STORE($12 | 0, 0 | 0, 4);
  $13 = $0 + 44 | 0; //@line 7580
  $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 7581
  $15 = $0 + 28 | 0; //@line 7582
  SAFE_HEAP_STORE($15 | 0, $14 | 0, 4);
  $16 = $0 + 20 | 0; //@line 7584
  SAFE_HEAP_STORE($16 | 0, $14 | 0, 4);
  $17 = $14; //@line 7586
  $18 = $0 + 48 | 0; //@line 7587
  $19 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 7588
  $20 = $17 + $19 | 0; //@line 7589
  $21 = $0 + 16 | 0; //@line 7590
  SAFE_HEAP_STORE($21 | 0, $20 | 0, 4);
  $$0 = 0; //@line 7592
 } else {
  $10 = $7 | 32; //@line 7594
  SAFE_HEAP_STORE($0 | 0, $10 | 0, 4);
  $$0 = -1; //@line 7596
 }
 return $$0 | 0; //@line 7598
}
function ___stdio_seek($0, $1, $2) {
 $0 = $0 | 0; //@line 4384
 $1 = $1 | 0; //@line 4385
 $2 = $2 | 0; //@line 4386
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0; //@line 4387
 sp = STACKTOP; //@line 4388
 STACKTOP = STACKTOP + 32 | 0; //@line 4389
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(32 | 0); //@line 4389
 $vararg_buffer = sp; //@line 4390
 $3 = sp + 20 | 0; //@line 4391
 $4 = $0 + 60 | 0; //@line 4392
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 4393
 $6 = $3; //@line 4394
 SAFE_HEAP_STORE($vararg_buffer | 0, $5 | 0, 4);
 $vararg_ptr1 = $vararg_buffer + 4 | 0; //@line 4396
 SAFE_HEAP_STORE($vararg_ptr1 | 0, 0 | 0, 4);
 $vararg_ptr2 = $vararg_buffer + 8 | 0; //@line 4398
 SAFE_HEAP_STORE($vararg_ptr2 | 0, $1 | 0, 4);
 $vararg_ptr3 = $vararg_buffer + 12 | 0; //@line 4400
 SAFE_HEAP_STORE($vararg_ptr3 | 0, $6 | 0, 4);
 $vararg_ptr4 = $vararg_buffer + 16 | 0; //@line 4402
 SAFE_HEAP_STORE($vararg_ptr4 | 0, $2 | 0, 4);
 $7 = ___syscall140(140, $vararg_buffer | 0) | 0; //@line 4404
 $8 = ___syscall_ret($7) | 0; //@line 4405
 $9 = ($8 | 0) < 0; //@line 4406
 if ($9) {
  SAFE_HEAP_STORE($3 | 0, -1 | 0, 4);
  $10 = -1; //@line 4409
 } else {
  $$pre = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 4411
  $10 = $$pre; //@line 4412
 }
 STACKTOP = sp; //@line 4414
 return $10 | 0; //@line 4414
}
function __ZSt9terminatev() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0; //@line 8784
 var $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8785
 sp = STACKTOP; //@line 8786
 __THREW__ = 0; //@line 8787
 $0 = invoke_i(32) | 0; //@line 8788
 $1 = __THREW__; //@line 8789
 __THREW__ = 0; //@line 8789
 $2 = $1 & 1; //@line 8790
 if ($2) {
  $19 = ___cxa_find_matching_catch_3(0 | 0) | 0; //@line 8792
  $20 = tempRet0; //@line 8793
  ___clang_call_terminate($19); //@line 8794
 }
 $3 = ($0 | 0) == (0 | 0); //@line 8797
 if (!$3) {
  $4 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8799
  $5 = ($4 | 0) == (0 | 0); //@line 8800
  if (!$5) {
   $6 = $4 + 48 | 0; //@line 8802
   $7 = $6; //@line 8803
   $8 = $7; //@line 8804
   $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 8805
   $10 = $7 + 4 | 0; //@line 8806
   $11 = $10; //@line 8807
   $12 = SAFE_HEAP_LOAD($11 | 0, 4, 0) | 0 | 0; //@line 8808
   $13 = $9 & -256; //@line 8809
   $14 = ($13 | 0) == 1126902528; //@line 8810
   $15 = ($12 | 0) == 1129074247; //@line 8811
   $16 = $14 & $15; //@line 8812
   if ($16) {
    $17 = $4 + 12 | 0; //@line 8814
    $18 = SAFE_HEAP_LOAD($17 | 0, 4, 0) | 0 | 0; //@line 8815
    __ZSt11__terminatePFvvE($18); //@line 8816
   }
  }
 }
 $21 = __ZSt13get_terminatev() | 0; //@line 8821
 __ZSt11__terminatePFvvE($21); //@line 8822
}
function ___stdout_write($0, $1, $2) {
 $0 = $0 | 0; //@line 4443
 $1 = $1 | 0; //@line 4444
 $2 = $2 | 0; //@line 4445
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0; //@line 4446
 sp = STACKTOP; //@line 4447
 STACKTOP = STACKTOP + 32 | 0; //@line 4448
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(32 | 0); //@line 4448
 $vararg_buffer = sp; //@line 4449
 $3 = sp + 16 | 0; //@line 4450
 $4 = $0 + 36 | 0; //@line 4451
 SAFE_HEAP_STORE($4 | 0, 2 | 0, 4);
 $5 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 4453
 $6 = $5 & 64; //@line 4454
 $7 = ($6 | 0) == 0; //@line 4455
 if ($7) {
  $8 = $0 + 60 | 0; //@line 4457
  $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 4458
  $10 = $3; //@line 4459
  SAFE_HEAP_STORE($vararg_buffer | 0, $9 | 0, 4);
  $vararg_ptr1 = $vararg_buffer + 4 | 0; //@line 4461
  SAFE_HEAP_STORE($vararg_ptr1 | 0, 21523 | 0, 4);
  $vararg_ptr2 = $vararg_buffer + 8 | 0; //@line 4463
  SAFE_HEAP_STORE($vararg_ptr2 | 0, $10 | 0, 4);
  $11 = ___syscall54(54, $vararg_buffer | 0) | 0; //@line 4465
  $12 = ($11 | 0) == 0; //@line 4466
  if (!$12) {
   $13 = $0 + 75 | 0; //@line 4468
   SAFE_HEAP_STORE($13 >> 0 | 0, -1 | 0, 1);
  }
 }
 $14 = ___stdio_write($0, $1, $2) | 0; //@line 4472
 STACKTOP = sp; //@line 4473
 return $14 | 0; //@line 4473
}
function _strcmp($0, $1) {
 $0 = $0 | 0; //@line 4476
 $1 = $1 | 0; //@line 4477
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0; //@line 4478
 var sp = 0; //@line 4479
 sp = STACKTOP; //@line 4480
 $2 = SAFE_HEAP_LOAD($0 >> 0 | 0, 1, 0) | 0 | 0; //@line 4481
 $3 = SAFE_HEAP_LOAD($1 >> 0 | 0, 1, 0) | 0 | 0; //@line 4482
 $4 = $2 << 24 >> 24 != $3 << 24 >> 24; //@line 4483
 $5 = $2 << 24 >> 24 == 0; //@line 4484
 $or$cond9 = $5 | $4; //@line 4485
 if ($or$cond9) {
  $$lcssa = $3; //@line 4487
  $$lcssa8 = $2; //@line 4487
 } else {
  $$011 = $1; //@line 4489
  $$0710 = $0; //@line 4489
  while (1) {
   $6 = $$0710 + 1 | 0; //@line 4491
   $7 = $$011 + 1 | 0; //@line 4492
   $8 = SAFE_HEAP_LOAD($6 >> 0 | 0, 1, 0) | 0 | 0; //@line 4493
   $9 = SAFE_HEAP_LOAD($7 >> 0 | 0, 1, 0) | 0 | 0; //@line 4494
   $10 = $8 << 24 >> 24 != $9 << 24 >> 24; //@line 4495
   $11 = $8 << 24 >> 24 == 0; //@line 4496
   $or$cond = $11 | $10; //@line 4497
   if ($or$cond) {
    $$lcssa = $9; //@line 4499
    $$lcssa8 = $8; //@line 4499
    break;
   } else {
    $$011 = $7; //@line 4502
    $$0710 = $6; //@line 4502
   }
  }
 }
 $12 = $$lcssa8 & 255; //@line 4506
 $13 = $$lcssa & 255; //@line 4507
 $14 = $12 - $13 | 0; //@line 4508
 return $14 | 0; //@line 4509
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 8359
 $1 = $1 | 0; //@line 8360
 $2 = $2 | 0; //@line 8361
 $3 = $3 | 0; //@line 8362
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8363
 sp = STACKTOP; //@line 8364
 $4 = $1 + 16 | 0; //@line 8365
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 8366
 $6 = ($5 | 0) == (0 | 0); //@line 8367
 do {
  if ($6) {
   SAFE_HEAP_STORE($4 | 0, $2 | 0, 4);
   $7 = $1 + 24 | 0; //@line 8371
   SAFE_HEAP_STORE($7 | 0, $3 | 0, 4);
   $8 = $1 + 36 | 0; //@line 8373
   SAFE_HEAP_STORE($8 | 0, 1 | 0, 4);
  } else {
   $9 = ($5 | 0) == ($2 | 0); //@line 8376
   if (!$9) {
    $13 = $1 + 36 | 0; //@line 8378
    $14 = SAFE_HEAP_LOAD($13 | 0, 4, 0) | 0 | 0; //@line 8379
    $15 = $14 + 1 | 0; //@line 8380
    SAFE_HEAP_STORE($13 | 0, $15 | 0, 4);
    $16 = $1 + 24 | 0; //@line 8382
    SAFE_HEAP_STORE($16 | 0, 2 | 0, 4);
    $17 = $1 + 54 | 0; //@line 8384
    SAFE_HEAP_STORE($17 >> 0 | 0, 1 | 0, 1);
    break;
   }
   $10 = $1 + 24 | 0; //@line 8388
   $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8389
   $12 = ($11 | 0) == 2; //@line 8390
   if ($12) {
    SAFE_HEAP_STORE($10 | 0, $3 | 0, 4);
   }
  }
 } while (0);
 return;
}
function _pad_669($0, $1, $2, $3, $4) {
 $0 = $0 | 0; //@line 6077
 $1 = $1 | 0; //@line 6078
 $2 = $2 | 0; //@line 6079
 $3 = $3 | 0; //@line 6080
 $4 = $4 | 0; //@line 6081
 var $$0$lcssa = 0, $$011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0; //@line 6082
 sp = STACKTOP; //@line 6083
 STACKTOP = STACKTOP + 256 | 0; //@line 6084
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(256 | 0); //@line 6084
 $5 = sp; //@line 6085
 $6 = $4 & 73728; //@line 6086
 $7 = ($6 | 0) == 0; //@line 6087
 $8 = ($2 | 0) > ($3 | 0); //@line 6088
 $or$cond = $8 & $7; //@line 6089
 if ($or$cond) {
  $9 = $2 - $3 | 0; //@line 6091
  $10 = $9 >>> 0 < 256; //@line 6092
  $11 = $10 ? $9 : 256; //@line 6093
  _memset($5 | 0, $1 | 0, $11 | 0) | 0; //@line 6094
  $12 = $9 >>> 0 > 255; //@line 6095
  if ($12) {
   $13 = $2 - $3 | 0; //@line 6097
   $$011 = $9; //@line 6098
   while (1) {
    _out($0, $5, 256); //@line 6100
    $14 = $$011 + -256 | 0; //@line 6101
    $15 = $14 >>> 0 > 255; //@line 6102
    if ($15) {
     $$011 = $14; //@line 6104
    } else {
     break;
    }
   }
   $16 = $13 & 255; //@line 6109
   $$0$lcssa = $16; //@line 6110
  } else {
   $$0$lcssa = $9; //@line 6112
  }
  _out($0, $5, $$0$lcssa); //@line 6114
 }
 STACKTOP = sp; //@line 6116
 return;
}
function _fmt_x($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 5805
 $1 = $1 | 0; //@line 5806
 $2 = $2 | 0; //@line 5807
 $3 = $3 | 0; //@line 5808
 var $$05$lcssa = 0, $$056 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0; //@line 5809
 var sp = 0; //@line 5810
 sp = STACKTOP; //@line 5811
 $4 = ($0 | 0) == 0; //@line 5812
 $5 = ($1 | 0) == 0; //@line 5813
 $6 = $4 & $5; //@line 5814
 if ($6) {
  $$05$lcssa = $2; //@line 5816
 } else {
  $$056 = $2; //@line 5818
  $15 = $1; //@line 5818
  $8 = $0; //@line 5818
  while (1) {
   $7 = $8 & 15; //@line 5820
   $9 = 1380 + $7 | 0; //@line 5821
   $10 = SAFE_HEAP_LOAD($9 >> 0 | 0, 1, 0) | 0 | 0; //@line 5822
   $11 = $10 & 255; //@line 5823
   $12 = $11 | $3; //@line 5824
   $13 = $12 & 255; //@line 5825
   $14 = $$056 + -1 | 0; //@line 5826
   SAFE_HEAP_STORE($14 >> 0 | 0, $13 | 0, 1);
   $16 = _bitshift64Lshr($8 | 0, $15 | 0, 4) | 0; //@line 5828
   $17 = tempRet0; //@line 5829
   $18 = ($16 | 0) == 0; //@line 5830
   $19 = ($17 | 0) == 0; //@line 5831
   $20 = $18 & $19; //@line 5832
   if ($20) {
    $$05$lcssa = $14; //@line 5834
    break;
   } else {
    $$056 = $14; //@line 5837
    $15 = $17; //@line 5837
    $8 = $16; //@line 5837
   }
  }
 }
 return $$05$lcssa | 0; //@line 5841
}
function __ZN4Asam11Application4InitEPKc($0) {
 $0 = $0 | 0; //@line 1035
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 1036
 sp = STACKTOP; //@line 1037
 STACKTOP = STACKTOP + 16 | 0; //@line 1038
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 1038
 $1 = $0; //@line 1039
 $4 = SAFE_HEAP_LOAD(__ZN4Asam11Application10s_instanceE | 0, 4, 0) | 0 | 0; //@line 1040
 $5 = ($4 | 0) != (0 | 0); //@line 1041
 if ($5) {
  STACKTOP = sp; //@line 1043
  return;
 }
 $6 = __Znwj(4) | 0; //@line 1045
 __THREW__ = 0; //@line 1046
 invoke_vi(27, $6 | 0); //@line 1047
 $7 = __THREW__; //@line 1048
 __THREW__ = 0; //@line 1048
 $8 = $7 & 1; //@line 1049
 if ($8) {
  $11 = ___cxa_find_matching_catch_2() | 0; //@line 1051
  $12 = tempRet0; //@line 1052
  $2 = $11; //@line 1053
  $3 = $12; //@line 1054
  __ZdlPv($6); //@line 1055
  $13 = $2; //@line 1056
  $14 = $3; //@line 1057
  ___resumeException($13 | 0); //@line 1058
 }
 SAFE_HEAP_STORE(__ZN4Asam11Application10s_instanceE | 0, $6 | 0, 4);
 $9 = SAFE_HEAP_LOAD(__ZN4Asam11Application10s_instanceE | 0, 4, 0) | 0 | 0; //@line 1062
 $10 = $1; //@line 1063
 __ZN4Asam11Application4initEPKc($9, $10); //@line 1064
 STACKTOP = sp; //@line 1065
 return;
}
function __ZN4Asam4RootC2Ev($0) {
 $0 = $0 | 0; //@line 119
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0; //@line 120
 var $8 = 0, $9 = 0, label = 0, sp = 0; //@line 121
 sp = STACKTOP; //@line 122
 STACKTOP = STACKTOP + 48 | 0; //@line 123
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(48 | 0); //@line 123
 $4 = sp + 28 | 0; //@line 124
 $7 = sp + 16 | 0; //@line 125
 $11 = $0; //@line 126
 $12 = $11; //@line 127
 $10 = $12; //@line 128
 $13 = $10; //@line 129
 $9 = $13; //@line 130
 $14 = $9; //@line 131
 $8 = $14; //@line 132
 SAFE_HEAP_STORE($14 | 0, 0 | 0, 4);
 $15 = $14 + 4 | 0; //@line 134
 SAFE_HEAP_STORE($15 | 0, 0 | 0, 4);
 $16 = $14 + 8 | 0; //@line 136
 $6 = $16; //@line 137
 SAFE_HEAP_STORE($7 | 0, 0 | 0, 4);
 $17 = $6; //@line 139
 $5 = $7; //@line 140
 $18 = $5; //@line 141
 $19 = SAFE_HEAP_LOAD($18 | 0, 4, 0) | 0 | 0; //@line 142
 $3 = $17; //@line 143
 SAFE_HEAP_STORE($4 | 0, $19 | 0, 4);
 $20 = $3; //@line 145
 $2 = $20; //@line 146
 $1 = $4; //@line 147
 $21 = $1; //@line 148
 $22 = SAFE_HEAP_LOAD($21 | 0, 4, 0) | 0 | 0; //@line 149
 SAFE_HEAP_STORE($20 | 0, $22 | 0, 4);
 STACKTOP = sp; //@line 151
 return;
}
function _getint($0) {
 $0 = $0 | 0; //@line 5492
 var $$0$lcssa = 0, $$06 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $isdigit = 0, $isdigit5 = 0, $isdigittmp = 0, $isdigittmp4 = 0, $isdigittmp7 = 0, label = 0, sp = 0; //@line 5493
 sp = STACKTOP; //@line 5494
 $1 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 5495
 $2 = SAFE_HEAP_LOAD($1 >> 0 | 0, 1, 0) | 0 | 0; //@line 5496
 $3 = $2 << 24 >> 24; //@line 5497
 $isdigittmp4 = $3 + -48 | 0; //@line 5498
 $isdigit5 = $isdigittmp4 >>> 0 < 10; //@line 5499
 if ($isdigit5) {
  $$06 = 0; //@line 5501
  $7 = $1; //@line 5501
  $isdigittmp7 = $isdigittmp4; //@line 5501
  while (1) {
   $4 = $$06 * 10 | 0; //@line 5503
   $5 = $isdigittmp7 + $4 | 0; //@line 5504
   $6 = $7 + 1 | 0; //@line 5505
   SAFE_HEAP_STORE($0 | 0, $6 | 0, 4);
   $8 = SAFE_HEAP_LOAD($6 >> 0 | 0, 1, 0) | 0 | 0; //@line 5507
   $9 = $8 << 24 >> 24; //@line 5508
   $isdigittmp = $9 + -48 | 0; //@line 5509
   $isdigit = $isdigittmp >>> 0 < 10; //@line 5510
   if ($isdigit) {
    $$06 = $5; //@line 5512
    $7 = $6; //@line 5512
    $isdigittmp7 = $isdigittmp; //@line 5512
   } else {
    $$0$lcssa = $5; //@line 5514
    break;
   }
  }
 } else {
  $$0$lcssa = 0; //@line 5519
 }
 return $$0$lcssa | 0; //@line 5521
}
function __ZN4Asam11Application4initEPKc($0, $1) {
 $0 = $0 | 0; //@line 1078
 $1 = $1 | 0; //@line 1079
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 1080
 sp = STACKTOP; //@line 1081
 STACKTOP = STACKTOP + 16 | 0; //@line 1082
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 1082
 $2 = $0; //@line 1083
 $3 = $1; //@line 1084
 $6 = $2; //@line 1085
 $7 = __Znwj(12) | 0; //@line 1086
 __THREW__ = 0; //@line 1087
 invoke_vi(28, $7 | 0); //@line 1088
 $8 = __THREW__; //@line 1089
 __THREW__ = 0; //@line 1089
 $9 = $8 & 1; //@line 1090
 if ($9) {
  $12 = ___cxa_find_matching_catch_2() | 0; //@line 1092
  $13 = tempRet0; //@line 1093
  $4 = $12; //@line 1094
  $5 = $13; //@line 1095
  __ZdlPv($7); //@line 1096
  $14 = $4; //@line 1097
  $15 = $5; //@line 1098
  ___resumeException($14 | 0); //@line 1099
 } else {
  SAFE_HEAP_STORE($6 | 0, $7 | 0, 4);
  $10 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 1103
  $11 = $3; //@line 1104
  __ZN4Asam4Root12CreateCanvasEPKc($10, $11) | 0; //@line 1105
  STACKTOP = sp; //@line 1106
  return;
 }
}
function _fmt_o($0, $1, $2) {
 $0 = $0 | 0; //@line 5844
 $1 = $1 | 0; //@line 5845
 $2 = $2 | 0; //@line 5846
 var $$0$lcssa = 0, $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 5847
 sp = STACKTOP; //@line 5848
 $3 = ($0 | 0) == 0; //@line 5849
 $4 = ($1 | 0) == 0; //@line 5850
 $5 = $3 & $4; //@line 5851
 if ($5) {
  $$0$lcssa = $2; //@line 5853
 } else {
  $$06 = $2; //@line 5855
  $11 = $1; //@line 5855
  $7 = $0; //@line 5855
  while (1) {
   $6 = $7 & 255; //@line 5857
   $8 = $6 & 7; //@line 5858
   $9 = $8 | 48; //@line 5859
   $10 = $$06 + -1 | 0; //@line 5860
   SAFE_HEAP_STORE($10 >> 0 | 0, $9 | 0, 1);
   $12 = _bitshift64Lshr($7 | 0, $11 | 0, 3) | 0; //@line 5862
   $13 = tempRet0; //@line 5863
   $14 = ($12 | 0) == 0; //@line 5864
   $15 = ($13 | 0) == 0; //@line 5865
   $16 = $14 & $15; //@line 5866
   if ($16) {
    $$0$lcssa = $10; //@line 5868
    break;
   } else {
    $$06 = $10; //@line 5871
    $11 = $13; //@line 5871
    $7 = $12; //@line 5871
   }
  }
 }
 return $$0$lcssa | 0; //@line 5875
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0; //@line 8595
 $1 = $1 | 0; //@line 8596
 $2 = $2 | 0; //@line 8597
 $3 = $3 | 0; //@line 8598
 $4 = $4 | 0; //@line 8599
 $5 = $5 | 0; //@line 8600
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8601
 sp = STACKTOP; //@line 8602
 $6 = $1 + 8 | 0; //@line 8603
 $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8604
 $8 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $7, $5) | 0; //@line 8605
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $1, $2, $3, $4); //@line 8607
 } else {
  $9 = $0 + 8 | 0; //@line 8609
  $10 = SAFE_HEAP_LOAD($9 | 0, 4, 0) | 0 | 0; //@line 8610
  $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8611
  $12 = $11 + 20 | 0; //@line 8612
  $13 = SAFE_HEAP_LOAD($12 | 0, 4, 0) | 0 | 0; //@line 8613
  FUNCTION_TABLE_viiiiii[(SAFE_FT_MASK($13 | 0, 15 | 0) | 0) & 15]($10, $1, $2, $3, $4, $5); //@line 8614
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 8725
 $1 = $1 | 0; //@line 8726
 $2 = $2 | 0; //@line 8727
 $3 = $3 | 0; //@line 8728
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8729
 sp = STACKTOP; //@line 8730
 $4 = $1 + 8 | 0; //@line 8731
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 8732
 $6 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $5, 0) | 0; //@line 8733
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3); //@line 8735
 } else {
  $7 = $0 + 8 | 0; //@line 8737
  $8 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 8738
  $9 = SAFE_HEAP_LOAD($8 | 0, 4, 0) | 0 | 0; //@line 8739
  $10 = $9 + 28 | 0; //@line 8740
  $11 = SAFE_HEAP_LOAD($10 | 0, 4, 0) | 0 | 0; //@line 8741
  FUNCTION_TABLE_viiii[(SAFE_FT_MASK($11 | 0, 31 | 0) | 0) & 31]($8, $1, $2, $3); //@line 8742
 }
 return;
}
function _sbrk(increment) {
 increment = increment | 0; //@line 9425
 var oldDynamicTop = 0; //@line 9426
 var oldDynamicTopOnChange = 0; //@line 9427
 var newDynamicTop = 0; //@line 9428
 var totalMemory = 0; //@line 9429
 increment = increment + 15 & -16 | 0; //@line 9430
 oldDynamicTop = SAFE_HEAP_LOAD(DYNAMICTOP_PTR | 0, 4, 0) | 0 | 0; //@line 9431
 newDynamicTop = oldDynamicTop + increment | 0; //@line 9432
 if ((increment | 0) > 0 & (newDynamicTop | 0) < (oldDynamicTop | 0) | (newDynamicTop | 0) < 0) {
  abortOnCannotGrowMemory() | 0; //@line 9436
  ___setErrNo(12); //@line 9437
  return -1;
 }
 SAFE_HEAP_STORE(DYNAMICTOP_PTR | 0, newDynamicTop | 0, 4);
 totalMemory = getTotalMemory() | 0; //@line 9442
 if ((newDynamicTop | 0) > (totalMemory | 0)) {
  if ((enlargeMemory() | 0) == 0) {
   SAFE_HEAP_STORE(DYNAMICTOP_PTR | 0, oldDynamicTop | 0, 4);
   ___setErrNo(12); //@line 9446
   return -1;
  }
 }
 return oldDynamicTop | 0; //@line 9450
}
function ___cxa_can_catch($0, $1, $2) {
 $0 = $0 | 0; //@line 8982
 $1 = $1 | 0; //@line 8983
 $2 = $2 | 0; //@line 8984
 var $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8985
 sp = STACKTOP; //@line 8986
 STACKTOP = STACKTOP + 16 | 0; //@line 8987
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8987
 $3 = sp; //@line 8988
 $4 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 8989
 SAFE_HEAP_STORE($3 | 0, $4 | 0, 4);
 $5 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8991
 $6 = $5 + 16 | 0; //@line 8992
 $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8993
 $8 = FUNCTION_TABLE_iiii[(SAFE_FT_MASK($7 | 0, 15 | 0) | 0) & 15]($0, $1, $3) | 0; //@line 8994
 $9 = $8 & 1; //@line 8995
 if ($8) {
  $10 = SAFE_HEAP_LOAD($3 | 0, 4, 0) | 0 | 0; //@line 8997
  SAFE_HEAP_STORE($2 | 0, $10 | 0, 4);
 }
 STACKTOP = sp; //@line 9000
 return $9 | 0; //@line 9000
}
function __Znwj($0) {
 $0 = $0 | 0; //@line 7979
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0; //@line 7980
 sp = STACKTOP; //@line 7981
 $1 = ($0 | 0) == 0; //@line 7982
 $$ = $1 ? 1 : $0; //@line 7983
 while (1) {
  $2 = _malloc($$) | 0; //@line 7985
  $3 = ($2 | 0) == (0 | 0); //@line 7986
  if (!$3) {
   label = 6; //@line 7988
   break;
  }
  $4 = __ZSt15get_new_handlerv() | 0; //@line 7991
  $5 = ($4 | 0) == (0 | 0); //@line 7992
  if ($5) {
   label = 5; //@line 7994
   break;
  }
  FUNCTION_TABLE_v[(SAFE_FT_MASK($4 | 0, 63 | 0) | 0) & 63](); //@line 7997
 }
 if ((label | 0) == 5) {
  $6 = ___cxa_allocate_exception(4) | 0; //@line 8000
  __ZNSt9bad_allocC2Ev($6); //@line 8001
  ___cxa_throw($6 | 0, 72 | 0, 18 | 0); //@line 8002
 } else if ((label | 0) == 6) {
  return $2 | 0; //@line 8006
 }
 return 0 | 0; //@line 8008
}
function __ZNSt3__218__libcpp_refstringC2EPKc($0, $1) {
 $0 = $0 | 0; //@line 8018
 $1 = $1 | 0; //@line 8019
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0; //@line 8020
 sp = STACKTOP; //@line 8021
 $2 = _strlen($1) | 0; //@line 8022
 $3 = $2 + 13 | 0; //@line 8023
 $4 = __Znwj($3) | 0; //@line 8024
 SAFE_HEAP_STORE($4 | 0, $2 | 0, 4);
 $5 = $4 + 4 | 0; //@line 8026
 SAFE_HEAP_STORE($5 | 0, $2 | 0, 4);
 $6 = $4 + 8 | 0; //@line 8028
 SAFE_HEAP_STORE($6 | 0, 0 | 0, 4);
 $7 = __ZNSt3__215__refstring_imp12_GLOBAL__N_113data_from_repEPNS1_9_Rep_baseE($4) | 0; //@line 8030
 $8 = $2 + 1 | 0; //@line 8031
 _memcpy($7 | 0, $1 | 0, $8 | 0) | 0; //@line 8032
 SAFE_HEAP_STORE($0 | 0, $7 | 0, 4);
 return;
}
function __ZNSt3__218__libcpp_refstringD2Ev($0) {
 $0 = $0 | 0; //@line 8931
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0; //@line 8932
 sp = STACKTOP; //@line 8933
 $1 = __ZNKSt3__218__libcpp_refstring15__uses_refcountEv($0) | 0; //@line 8934
 if ($1) {
  $2 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8936
  $3 = __ZNSt3__215__refstring_imp12_GLOBAL__N_113rep_from_dataEPKc_276($2) | 0; //@line 8937
  $4 = $3 + 8 | 0; //@line 8938
  $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 8939
  $6 = $5 + -1 | 0; //@line 8940
  SAFE_HEAP_STORE($4 | 0, $6 | 0, 4);
  $7 = $5 + -1 | 0; //@line 8942
  $8 = ($7 | 0) < 0; //@line 8943
  if ($8) {
   __ZdlPv($3); //@line 8945
  }
 }
 return;
}
function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0) {
 $0 = $0 | 0; //@line 7958
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0; //@line 7959
 sp = STACKTOP; //@line 7960
 $1 = ___cxa_allocate_exception(8) | 0; //@line 7961
 __THREW__ = 0; //@line 7962
 invoke_vii(26, $1 | 0, 3290 | 0); //@line 7963
 $2 = __THREW__; //@line 7964
 __THREW__ = 0; //@line 7964
 $3 = $2 & 1; //@line 7965
 if ($3) {
  $4 = ___cxa_find_matching_catch_2() | 0; //@line 7967
  $5 = tempRet0; //@line 7968
  ___cxa_free_exception($1 | 0); //@line 7969
  ___resumeException($4 | 0); //@line 7970
 } else {
  SAFE_HEAP_STORE($1 | 0, 784 | 0, 4);
  ___cxa_throw($1 | 0, 104 | 0, 21 | 0); //@line 7974
 }
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0; //@line 8257
 $1 = $1 | 0; //@line 8258
 $2 = $2 | 0; //@line 8259
 $3 = $3 | 0; //@line 8260
 $4 = $4 | 0; //@line 8261
 $5 = $5 | 0; //@line 8262
 var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0; //@line 8263
 sp = STACKTOP; //@line 8264
 $6 = $1 + 8 | 0; //@line 8265
 $7 = SAFE_HEAP_LOAD($6 | 0, 4, 0) | 0 | 0; //@line 8266
 $8 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $7, $5) | 0; //@line 8267
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $1, $2, $3, $4); //@line 8269
 }
 return;
}
function ___cxa_get_globals_fast() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0; //@line 8147
 sp = STACKTOP; //@line 8148
 STACKTOP = STACKTOP + 16 | 0; //@line 8149
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8149
 $vararg_buffer = sp; //@line 8150
 $0 = _pthread_once(4528 | 0, 30 | 0) | 0; //@line 8151
 $1 = ($0 | 0) == 0; //@line 8152
 if ($1) {
  $2 = SAFE_HEAP_LOAD(1133 * 4 | 0, 4, 0) | 0 | 0; //@line 8154
  $3 = _pthread_getspecific($2 | 0) | 0; //@line 8155
  STACKTOP = sp; //@line 8156
  return $3 | 0; //@line 8156
 } else {
  _abort_message(3572, $vararg_buffer); //@line 8158
 }
 return 0 | 0; //@line 8161
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 8399
 $1 = $1 | 0; //@line 8400
 $2 = $2 | 0; //@line 8401
 $3 = $3 | 0; //@line 8402
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0; //@line 8403
 sp = STACKTOP; //@line 8404
 $4 = $1 + 4 | 0; //@line 8405
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 8406
 $6 = ($5 | 0) == ($2 | 0); //@line 8407
 if ($6) {
  $7 = $1 + 28 | 0; //@line 8409
  $8 = SAFE_HEAP_LOAD($7 | 0, 4, 0) | 0 | 0; //@line 8410
  $9 = ($8 | 0) == 1; //@line 8411
  if (!$9) {
   SAFE_HEAP_STORE($7 | 0, $3 | 0, 4);
  }
 }
 return;
}
function ___stdio_close($0) {
 $0 = $0 | 0; //@line 4256
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0; //@line 4257
 sp = STACKTOP; //@line 4258
 STACKTOP = STACKTOP + 16 | 0; //@line 4259
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 4259
 $vararg_buffer = sp; //@line 4260
 $1 = $0 + 60 | 0; //@line 4261
 $2 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 4262
 $3 = _dummy_733($2) | 0; //@line 4263
 SAFE_HEAP_STORE($vararg_buffer | 0, $3 | 0, 4);
 $4 = ___syscall6(6, $vararg_buffer | 0) | 0; //@line 4265
 $5 = ___syscall_ret($4) | 0; //@line 4266
 STACKTOP = sp; //@line 4267
 return $5 | 0; //@line 4267
}
function SAFE_HEAP_LOAD(dest, bytes, unsigned) {
 dest = dest | 0; //@line 70
 bytes = bytes | 0; //@line 71
 unsigned = unsigned | 0; //@line 72
 if ((dest | 0) <= 0) segfault(); //@line 73
 if ((dest + bytes | 0) > (HEAP32[DYNAMICTOP_PTR >> 2] | 0)) segfault(); //@line 74
 if ((bytes | 0) == 4) {
  if (dest & 3) alignfault(); //@line 76
  return HEAP32[dest >> 2] | 0; //@line 77
 } else if ((bytes | 0) == 1) {
  if (unsigned) {
   return HEAPU8[dest >> 0] | 0; //@line 80
  } else {
   return HEAP8[dest >> 0] | 0; //@line 82
  }
 }
 if (dest & 1) alignfault(); //@line 85
 if (unsigned) return HEAPU16[dest >> 1] | 0; //@line 86
 return HEAP16[dest >> 1] | 0; //@line 87
}
function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($0) {
 $0 = $0 | 0; //@line 8767
 var $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0; //@line 8768
 sp = STACKTOP; //@line 8769
 STACKTOP = STACKTOP + 16 | 0; //@line 8770
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8770
 $vararg_buffer = sp; //@line 8771
 _free($0); //@line 8772
 $1 = SAFE_HEAP_LOAD(1133 * 4 | 0, 4, 0) | 0 | 0; //@line 8773
 $2 = _pthread_setspecific($1 | 0, 0 | 0) | 0; //@line 8774
 $3 = ($2 | 0) == 0; //@line 8775
 if ($3) {
  STACKTOP = sp; //@line 8777
  return;
 } else {
  _abort_message(3671, $vararg_buffer); //@line 8779
 }
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0; //@line 8335
 $1 = $1 | 0; //@line 8336
 $2 = $2 | 0; //@line 8337
 $3 = $3 | 0; //@line 8338
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0; //@line 8339
 sp = STACKTOP; //@line 8340
 $4 = $1 + 8 | 0; //@line 8341
 $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 8342
 $6 = __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $5, 0) | 0; //@line 8343
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3); //@line 8345
 }
 return;
}
function ___lctrans_impl($0, $1) {
 $0 = $0 | 0; //@line 7326
 $1 = $1 | 0; //@line 7327
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0; //@line 7328
 sp = STACKTOP; //@line 7329
 $2 = ($1 | 0) == (0 | 0); //@line 7330
 if ($2) {
  $$0 = 0; //@line 7332
 } else {
  $3 = SAFE_HEAP_LOAD($1 | 0, 4, 0) | 0 | 0; //@line 7334
  $4 = $1 + 4 | 0; //@line 7335
  $5 = SAFE_HEAP_LOAD($4 | 0, 4, 0) | 0 | 0; //@line 7336
  $6 = ___mo_lookup($3, $5, $0) | 0; //@line 7337
  $$0 = $6; //@line 7338
 }
 $7 = ($$0 | 0) != (0 | 0); //@line 7340
 $8 = $7 ? $$0 : $0; //@line 7341
 return $8 | 0; //@line 7342
}
function __ZNSt11logic_errorC2EPKc($0, $1) {
 $0 = $0 | 0; //@line 8044
 $1 = $1 | 0; //@line 8045
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0; //@line 8046
 sp = STACKTOP; //@line 8047
 SAFE_HEAP_STORE($0 | 0, 764 | 0, 4);
 $2 = $0 + 4 | 0; //@line 8049
 __THREW__ = 0; //@line 8050
 invoke_vii(29, $2 | 0, $1 | 0); //@line 8051
 $3 = __THREW__; //@line 8052
 __THREW__ = 0; //@line 8052
 $4 = $3 & 1; //@line 8053
 if ($4) {
  $5 = ___cxa_find_matching_catch_2() | 0; //@line 8055
  $6 = tempRet0; //@line 8056
  ___resumeException($5 | 0); //@line 8057
 } else {
  return;
 }
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0; //@line 9267
 $a$1 = $a$1 | 0; //@line 9268
 $b$0 = $b$0 | 0; //@line 9269
 $b$1 = $b$1 | 0; //@line 9270
 var $rem = 0, __stackBase__ = 0; //@line 9271
 __stackBase__ = STACKTOP; //@line 9272
 STACKTOP = STACKTOP + 16 | 0; //@line 9273
 $rem = __stackBase__ | 0; //@line 9274
 ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0; //@line 9275
 STACKTOP = __stackBase__; //@line 9276
 return (tempRet0 = SAFE_HEAP_LOAD($rem + 4 | 0, 4, 0) | 0 | 0, SAFE_HEAP_LOAD($rem | 0, 4, 0) | 0 | 0) | 0; //@line 9277
}
function _llvm_cttz_i32(x) {
 x = x | 0; //@line 9040
 var ret = 0; //@line 9041
 ret = SAFE_HEAP_LOAD(cttz_i8 + (x & 255) | 0, 1, 0) | 0; //@line 9042
 if ((ret | 0) < 8) return ret | 0; //@line 9043
 ret = SAFE_HEAP_LOAD(cttz_i8 + (x >> 8 & 255) | 0, 1, 0) | 0; //@line 9044
 if ((ret | 0) < 8) return ret + 8 | 0; //@line 9045
 ret = SAFE_HEAP_LOAD(cttz_i8 + (x >> 16 & 255) | 0, 1, 0) | 0; //@line 9046
 if ((ret | 0) < 8) return ret + 16 | 0; //@line 9047
 return (SAFE_HEAP_LOAD(cttz_i8 + (x >>> 24) | 0, 1, 0) | 0) + 24 | 0; //@line 9048
}
function _abort_message($0, $varargs) {
 $0 = $0 | 0; //@line 8164
 $varargs = $varargs | 0; //@line 8165
 var $1 = 0, $2 = 0, label = 0, sp = 0; //@line 8166
 sp = STACKTOP; //@line 8167
 STACKTOP = STACKTOP + 16 | 0; //@line 8168
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8168
 $1 = sp; //@line 8169
 SAFE_HEAP_STORE($1 | 0, $varargs | 0, 4);
 $2 = SAFE_HEAP_LOAD(38 * 4 | 0, 4, 0) | 0 | 0; //@line 8171
 _vfprintf($2, $0, $1) | 0; //@line 8172
 _fputc(10, $2) | 0; //@line 8173
 _abort(); //@line 8174
}
function SAFE_HEAP_STORE(dest, value, bytes) {
 dest = dest | 0; //@line 40
 value = value | 0; //@line 41
 bytes = bytes | 0; //@line 42
 if ((dest | 0) <= 0) segfault(); //@line 43
 if ((dest + bytes | 0) > (HEAP32[DYNAMICTOP_PTR >> 2] | 0)) segfault(); //@line 44
 if ((bytes | 0) == 4) {
  if (dest & 3) alignfault(); //@line 46
  HEAP32[dest >> 2] = value; //@line 47
 } else if ((bytes | 0) == 1) {
  HEAP8[dest >> 0] = value; //@line 49
 } else {
  if (dest & 1) alignfault(); //@line 51
  HEAP16[dest >> 1] = value; //@line 52
 }
}
function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 var $0 = 0, $1 = 0, $vararg_buffer = 0, label = 0, sp = 0; //@line 8753
 sp = STACKTOP; //@line 8754
 STACKTOP = STACKTOP + 16 | 0; //@line 8755
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 8755
 $vararg_buffer = sp; //@line 8756
 $0 = _pthread_key_create(4532 | 0, 31 | 0) | 0; //@line 8757
 $1 = ($0 | 0) == 0; //@line 8758
 if ($1) {
  STACKTOP = sp; //@line 8760
  return;
 } else {
  _abort_message(3621, $vararg_buffer); //@line 8762
 }
}
function ___cxa_is_pointer_type($0) {
 $0 = $0 | 0; //@line 9003
 var $1 = 0, $2 = 0, $3 = 0, $phitmp = 0, $phitmp1 = 0, label = 0, sp = 0; //@line 9004
 sp = STACKTOP; //@line 9005
 $1 = ($0 | 0) == (0 | 0); //@line 9006
 if ($1) {
  $3 = 0; //@line 9008
 } else {
  $2 = ___dynamic_cast($0, 32, 136, 0) | 0; //@line 9010
  $phitmp = ($2 | 0) != (0 | 0); //@line 9011
  $phitmp1 = $phitmp & 1; //@line 9012
  $3 = $phitmp1; //@line 9013
 }
 return $3 | 0; //@line 9015
}
function SAFE_HEAP_STORE_D(dest, value, bytes) {
 dest = dest | 0; //@line 56
 value = +value; //@line 57
 bytes = bytes | 0; //@line 58
 if ((dest | 0) <= 0) segfault(); //@line 59
 if ((dest + bytes | 0) > (HEAP32[DYNAMICTOP_PTR >> 2] | 0)) segfault(); //@line 60
 if ((bytes | 0) == 8) {
  if (dest & 7) alignfault(); //@line 62
  HEAPF64[dest >> 3] = value; //@line 63
 } else {
  if (dest & 3) alignfault(); //@line 65
  HEAPF32[dest >> 2] = value; //@line 66
 }
}
function __ZN4Asam17WebGLRenderSystem16CreateHtmlCanvasEPKc($0, $1) {
 $0 = $0 | 0; //@line 251
 $1 = $1 | 0; //@line 252
 var $2 = 0, $3 = 0, label = 0, sp = 0; //@line 253
 sp = STACKTOP; //@line 254
 STACKTOP = STACKTOP + 16 | 0; //@line 255
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 255
 $2 = $0; //@line 256
 $3 = $1; //@line 257
 STACKTOP = sp; //@line 258
 return 0 | 0; //@line 258
}
function _bitshift64Shl(low, high, bits) {
 low = low | 0; //@line 9291
 high = high | 0; //@line 9291
 bits = bits | 0; //@line 9291
 var ander = 0; //@line 9292
 if ((bits | 0) < 32) {
  ander = (1 << bits) - 1 | 0; //@line 9294
  tempRet0 = high << bits | (low & ander << 32 - bits) >>> 32 - bits; //@line 9295
  return low << bits; //@line 9296
 }
 tempRet0 = low << bits - 32; //@line 9298
 return 0; //@line 9299
}
function ___syscall_ret($0) {
 $0 = $0 | 0; //@line 4417
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0; //@line 4418
 sp = STACKTOP; //@line 4419
 $1 = $0 >>> 0 > 4294963200; //@line 4420
 if ($1) {
  $2 = 0 - $0 | 0; //@line 4422
  $3 = ___errno_location() | 0; //@line 4423
  SAFE_HEAP_STORE($3 | 0, $2 | 0, 4);
  $$0 = -1; //@line 4425
 } else {
  $$0 = $0; //@line 4427
 }
 return $$0 | 0; //@line 4429
}
function _bitshift64Lshr(low, high, bits) {
 low = low | 0; //@line 9280
 high = high | 0; //@line 9280
 bits = bits | 0; //@line 9280
 var ander = 0; //@line 9281
 if ((bits | 0) < 32) {
  ander = (1 << bits) - 1 | 0; //@line 9283
  tempRet0 = high >>> bits; //@line 9284
  return low >>> bits | (high & ander) << 32 - bits; //@line 9285
 }
 tempRet0 = 0; //@line 9287
 return high >>> bits - 32 | 0; //@line 9288
}
function _asamCreateApplication($0) {
 $0 = $0 | 0; //@line 1025
 var $1 = 0, $2 = 0, label = 0, sp = 0; //@line 1026
 sp = STACKTOP; //@line 1027
 STACKTOP = STACKTOP + 16 | 0; //@line 1028
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 1028
 $1 = $0; //@line 1029
 $2 = $1; //@line 1030
 __ZN4Asam11Application4InitEPKc($2); //@line 1031
 STACKTOP = sp; //@line 1032
 return;
}
function SAFE_HEAP_LOAD_D(dest, bytes) {
 dest = dest | 0; //@line 90
 bytes = bytes | 0; //@line 91
 if ((dest | 0) <= 0) segfault(); //@line 92
 if ((dest + bytes | 0) > (HEAP32[DYNAMICTOP_PTR >> 2] | 0)) segfault(); //@line 93
 if ((bytes | 0) == 8) {
  if (dest & 7) alignfault(); //@line 95
  return +HEAPF64[dest >> 3];
 }
 if (dest & 3) alignfault(); //@line 98
 return +HEAPF32[dest >> 2];
}
function __ZN4Asam11ApplicationC2Ev($0) {
 $0 = $0 | 0; //@line 1068
 var $1 = 0, $2 = 0, label = 0, sp = 0; //@line 1069
 sp = STACKTOP; //@line 1070
 STACKTOP = STACKTOP + 16 | 0; //@line 1071
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(16 | 0); //@line 1071
 $1 = $0; //@line 1072
 $2 = $1; //@line 1073
 SAFE_HEAP_STORE($2 | 0, 0 | 0, 4);
 STACKTOP = sp; //@line 1075
 return;
}
function ___DOUBLE_BITS_670($0) {
 $0 = +$0; //@line 7062
 var $1 = 0, $2 = 0, label = 0, sp = 0; //@line 7063
 sp = STACKTOP; //@line 7064
 SAFE_HEAP_STORE_D(tempDoublePtr | 0, +$0, 8);
 $1 = SAFE_HEAP_LOAD(tempDoublePtr | 0, 4, 0) | 0 | 0; //@line 7065
 $2 = SAFE_HEAP_LOAD(tempDoublePtr + 4 | 0, 4, 0) | 0 | 0; //@line 7066
 tempRet0 = $2; //@line 7067
 return $1 | 0; //@line 7068
}
function _out($0, $1, $2) {
 $0 = $0 | 0; //@line 5478
 $1 = $1 | 0; //@line 5479
 $2 = $2 | 0; //@line 5480
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0; //@line 5481
 sp = STACKTOP; //@line 5482
 $3 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 5483
 $4 = $3 & 32; //@line 5484
 $5 = ($4 | 0) == 0; //@line 5485
 if ($5) {
  ___fwritex($1, $2, $0) | 0; //@line 5487
 }
 return;
}
function dynCall_viiiiii(index, a1, a2, a3, a4, a5, a6) {
 index = index | 0; //@line 9511
 a1 = a1 | 0; //@line 9512
 a2 = a2 | 0; //@line 9512
 a3 = a3 | 0; //@line 9512
 a4 = a4 | 0; //@line 9512
 a5 = a5 | 0; //@line 9512
 a6 = a6 | 0; //@line 9512
 FUNCTION_TABLE_viiiiii[(SAFE_FT_MASK(index | 0, 15 | 0) | 0) & 15](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0); //@line 9513
}
function _strerror($0) {
 $0 = $0 | 0; //@line 5939
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0; //@line 5940
 sp = STACKTOP; //@line 5941
 $1 = ___pthread_self_105() | 0; //@line 5942
 $2 = $1 + 188 | 0; //@line 5943
 $3 = SAFE_HEAP_LOAD($2 | 0, 4, 0) | 0 | 0; //@line 5944
 $4 = ___strerror_l($0, $3) | 0; //@line 5945
 return $4 | 0; //@line 5946
}
function _wctomb($0, $1) {
 $0 = $0 | 0; //@line 6119
 $1 = $1 | 0; //@line 6120
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0; //@line 6121
 sp = STACKTOP; //@line 6122
 $2 = ($0 | 0) == (0 | 0); //@line 6123
 if ($2) {
  $$0 = 0; //@line 6125
 } else {
  $3 = _wcrtomb($0, $1, 0) | 0; //@line 6127
  $$0 = $3; //@line 6128
 }
 return $$0 | 0; //@line 6130
}
function dynCall_viiiii(index, a1, a2, a3, a4, a5) {
 index = index | 0; //@line 9504
 a1 = a1 | 0; //@line 9505
 a2 = a2 | 0; //@line 9505
 a3 = a3 | 0; //@line 9505
 a4 = a4 | 0; //@line 9505
 a5 = a5 | 0; //@line 9505
 FUNCTION_TABLE_viiiii[(SAFE_FT_MASK(index | 0, 31 | 0) | 0) & 31](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0); //@line 9506
}
function _i64Subtract(a, b, c, d) {
 a = a | 0; //@line 9032
 b = b | 0; //@line 9032
 c = c | 0; //@line 9032
 d = d | 0; //@line 9032
 var l = 0, h = 0; //@line 9033
 l = a - c >>> 0; //@line 9034
 h = b - d >>> 0; //@line 9035
 h = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0; //@line 9036
 return (tempRet0 = h, l | 0) | 0; //@line 9037
}
function runPostSets() {}
function _i64Add(a, b, c, d) {
 a = a | 0; //@line 9025
 b = b | 0; //@line 9025
 c = c | 0; //@line 9025
 d = d | 0; //@line 9025
 var l = 0, h = 0; //@line 9026
 l = a + c >>> 0; //@line 9027
 h = b + d + (l >>> 0 < a >>> 0 | 0) >>> 0; //@line 9028
 return (tempRet0 = h, l | 0) | 0; //@line 9029
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0; //@line 8973
 sp = STACKTOP; //@line 8974
 $0 = SAFE_HEAP_LOAD(1134 * 4 | 0, 4, 0) | 0 | 0; //@line 8975
 $1 = $0 + 0 | 0; //@line 8976
 SAFE_HEAP_STORE(1134 * 4 | 0, $1 | 0, 4);
 $2 = $0; //@line 8978
 return $2 | 0; //@line 8979
}
function _swapc($0, $1) {
 $0 = $0 | 0; //@line 7463
 $1 = $1 | 0; //@line 7464
 var $$ = 0, $2 = 0, $3 = 0, label = 0, sp = 0; //@line 7465
 sp = STACKTOP; //@line 7466
 $2 = ($1 | 0) == 0; //@line 7467
 $3 = _llvm_bswap_i32($0 | 0) | 0; //@line 7468
 $$ = $2 ? $0 : $3; //@line 7469
 return $$ | 0; //@line 7470
}
function __ZSt13get_terminatev() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0; //@line 8864
 sp = STACKTOP; //@line 8865
 $0 = SAFE_HEAP_LOAD(163 * 4 | 0, 4, 0) | 0 | 0; //@line 8866
 $1 = $0 + 0 | 0; //@line 8867
 SAFE_HEAP_STORE(163 * 4 | 0, $1 | 0, 4);
 $2 = $0; //@line 8869
 return $2 | 0; //@line 8870
}
function dynCall_viiii(index, a1, a2, a3, a4) {
 index = index | 0; //@line 9497
 a1 = a1 | 0; //@line 9498
 a2 = a2 | 0; //@line 9498
 a3 = a3 | 0; //@line 9498
 a4 = a4 | 0; //@line 9498
 FUNCTION_TABLE_viiii[(SAFE_FT_MASK(index | 0, 31 | 0) | 0) & 31](a1 | 0, a2 | 0, a3 | 0, a4 | 0); //@line 9499
}
function stackAlloc(size) {
 size = size | 0; //@line 2
 var ret = 0; //@line 3
 ret = STACKTOP; //@line 4
 STACKTOP = STACKTOP + size | 0; //@line 5
 STACKTOP = STACKTOP + 15 & -16; //@line 6
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abortStackOverflow(size | 0); //@line 7
 return ret | 0; //@line 9
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0; //@line 9258
 $a$1 = $a$1 | 0; //@line 9259
 $b$0 = $b$0 | 0; //@line 9260
 $b$1 = $b$1 | 0; //@line 9261
 var $1$0 = 0; //@line 9262
 $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0; //@line 9263
 return $1$0 | 0; //@line 9264
}
function __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0, $1, $2) {
 $0 = $0 | 0; //@line 8350
 $1 = $1 | 0; //@line 8351
 $2 = $2 | 0; //@line 8352
 var $3 = 0, label = 0, sp = 0; //@line 8353
 sp = STACKTOP; //@line 8354
 $3 = ($0 | 0) == ($1 | 0); //@line 8355
 return $3 | 0; //@line 8356
}
function __ZNKSt11logic_error4whatEv($0) {
 $0 = $0 | 0; //@line 8916
 var $1 = 0, $2 = 0, label = 0, sp = 0; //@line 8917
 sp = STACKTOP; //@line 8918
 $1 = $0 + 4 | 0; //@line 8919
 $2 = __ZNKSt3__218__libcpp_refstring5c_strEv($1) | 0; //@line 8920
 return $2 | 0; //@line 8921
}
function __ZNSt11logic_errorD2Ev($0) {
 $0 = $0 | 0; //@line 8899
 var $1 = 0, label = 0, sp = 0; //@line 8900
 sp = STACKTOP; //@line 8901
 SAFE_HEAP_STORE($0 | 0, 764 | 0, 4);
 $1 = $0 + 4 | 0; //@line 8903
 __ZNSt3__218__libcpp_refstringD2Ev($1); //@line 8904
 return;
}
function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0; //@line 9469
 a1 = a1 | 0; //@line 9470
 a2 = a2 | 0; //@line 9470
 a3 = a3 | 0; //@line 9470
 return FUNCTION_TABLE_iiii[(SAFE_FT_MASK(index | 0, 15 | 0) | 0) & 15](a1 | 0, a2 | 0, a3 | 0) | 0; //@line 9471
}
function __ZN4Asam17WebGLRenderSystem11GetInstanceEv() {
 var $0 = 0, label = 0, sp = 0; //@line 245
 sp = STACKTOP; //@line 246
 $0 = SAFE_HEAP_LOAD(__ZN4Asam17WebGLRenderSystem10s_instanceE | 0, 4, 0) | 0 | 0; //@line 247
 return $0 | 0; //@line 248
}
function __ZNSt3__215__refstring_imp12_GLOBAL__N_113data_from_repEPNS1_9_Rep_baseE($0) {
 $0 = $0 | 0; //@line 8037
 var $1 = 0, label = 0, sp = 0; //@line 8038
 sp = STACKTOP; //@line 8039
 $1 = $0 + 12 | 0; //@line 8040
 return $1 | 0; //@line 8041
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0 | 0; //@line 8587
 var label = 0, sp = 0; //@line 8588
 sp = STACKTOP; //@line 8589
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0); //@line 8590
 __ZdlPv($0); //@line 8591
 return;
}
function __ZNSt3__215__refstring_imp12_GLOBAL__N_113rep_from_dataEPKc_276($0) {
 $0 = $0 | 0; //@line 8951
 var $1 = 0, label = 0, sp = 0; //@line 8952
 sp = STACKTOP; //@line 8953
 $1 = $0 + -12 | 0; //@line 8954
 return $1 | 0; //@line 8955
}
function __ZNKSt3__218__libcpp_refstring5c_strEv($0) {
 $0 = $0 | 0; //@line 8924
 var $1 = 0, label = 0, sp = 0; //@line 8925
 sp = STACKTOP; //@line 8926
 $1 = SAFE_HEAP_LOAD($0 | 0, 4, 0) | 0 | 0; //@line 8927
 return $1 | 0; //@line 8928
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0 | 0; //@line 8184
 var label = 0, sp = 0; //@line 8185
 sp = STACKTOP; //@line 8186
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0); //@line 8187
 __ZdlPv($0); //@line 8188
 return;
}
function SAFE_FT_MASK(value, mask) {
 value = value | 0; //@line 102
 mask = mask | 0; //@line 103
 var ret = 0; //@line 104
 ret = value & mask; //@line 105
 if ((ret | 0) != (value | 0)) ftfault(); //@line 106
 return ret | 0; //@line 107
}
function b8(p0, p1, p2, p3, p4, p5) {
 p0 = p0 | 0; //@line 9544
 p1 = p1 | 0; //@line 9544
 p2 = p2 | 0; //@line 9544
 p3 = p3 | 0; //@line 9544
 p4 = p4 | 0; //@line 9544
 p5 = p5 | 0; //@line 9544
 nullFunc_viiiiii(8); //@line 9544
}
function ___lctrans($0, $1) {
 $0 = $0 | 0; //@line 7318
 $1 = $1 | 0; //@line 7319
 var $2 = 0, label = 0, sp = 0; //@line 7320
 sp = STACKTOP; //@line 7321
 $2 = ___lctrans_impl($0, $1) | 0; //@line 7322
 return $2 | 0; //@line 7323
}
function dynCall_vii(index, a1, a2) {
 index = index | 0; //@line 9490
 a1 = a1 | 0; //@line 9491
 a2 = a2 | 0; //@line 9491
 FUNCTION_TABLE_vii[(SAFE_FT_MASK(index | 0, 63 | 0) | 0) & 63](a1 | 0, a2 | 0); //@line 9492
}
function __ZNSt12length_errorD0Ev($0) {
 $0 = $0 | 0; //@line 8958
 var label = 0, sp = 0; //@line 8959
 sp = STACKTOP; //@line 8960
 __ZNSt11logic_errorD2Ev($0); //@line 8961
 __ZdlPv($0); //@line 8962
 return;
}
function __ZNSt11logic_errorD0Ev($0) {
 $0 = $0 | 0; //@line 8908
 var label = 0, sp = 0; //@line 8909
 sp = STACKTOP; //@line 8910
 __ZNSt11logic_errorD2Ev($0); //@line 8911
 __ZdlPv($0); //@line 8912
 return;
}
function ___clang_call_terminate($0) {
 $0 = $0 | 0; //@line 261
 var label = 0, sp = 0; //@line 262
 sp = STACKTOP; //@line 263
 ___cxa_begin_catch($0 | 0) | 0; //@line 264
 __ZSt9terminatev(); //@line 265
}
function __ZNSt9bad_allocD0Ev($0) {
 $0 = $0 | 0; //@line 8879
 var label = 0, sp = 0; //@line 8880
 sp = STACKTOP; //@line 8881
 __ZNSt9bad_allocD2Ev($0); //@line 8882
 __ZdlPv($0); //@line 8883
 return;
}
function b7(p0, p1, p2, p3, p4) {
 p0 = p0 | 0; //@line 9541
 p1 = p1 | 0; //@line 9541
 p2 = p2 | 0; //@line 9541
 p3 = p3 | 0; //@line 9541
 p4 = p4 | 0; //@line 9541
 nullFunc_viiiii(7); //@line 9541
}
function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0; //@line 19
 stackMax = stackMax | 0; //@line 20
 STACKTOP = stackBase; //@line 21
 STACK_MAX = stackMax; //@line 22
}
function setThrew(threw, value) {
 threw = threw | 0; //@line 26
 value = value | 0; //@line 27
 if ((__THREW__ | 0) == 0) {
  __THREW__ = threw; //@line 29
  threwValue = value; //@line 30
 }
}
function _frexpl($0, $1) {
 $0 = +$0; //@line 7071
 $1 = $1 | 0; //@line 7072
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP; //@line 7074
 $2 = +_frexp($0, $1); //@line 7075
 return +$2;
}
function dynCall_ii(index, a1) {
 index = index | 0; //@line 9462
 a1 = a1 | 0; //@line 9463
 return FUNCTION_TABLE_ii[(SAFE_FT_MASK(index | 0, 31 | 0) | 0) & 31](a1 | 0) | 0; //@line 9464
}
function __ZNKSt3__218__libcpp_refstring15__uses_refcountEv($0) {
 $0 = $0 | 0; //@line 8064
 var label = 0, sp = 0; //@line 8065
 sp = STACKTOP; //@line 8066
 return 1; //@line 8067
}
function dynCall_vi(index, a1) {
 index = index | 0; //@line 9483
 a1 = a1 | 0; //@line 9484
 FUNCTION_TABLE_vi[(SAFE_FT_MASK(index | 0, 31 | 0) | 0) & 31](a1 | 0); //@line 9485
}
function ___pthread_self_443() {
 var $0 = 0, label = 0, sp = 0; //@line 7236
 sp = STACKTOP; //@line 7237
 $0 = _pthread_self() | 0; //@line 7238
 return $0 | 0; //@line 7239
}
function ___pthread_self_105() {
 var $0 = 0, label = 0, sp = 0; //@line 7247
 sp = STACKTOP; //@line 7248
 $0 = _pthread_self() | 0; //@line 7249
 return $0 | 0; //@line 7250
}
function __ZNSt9bad_allocC2Ev($0) {
 $0 = $0 | 0; //@line 8966
 var label = 0, sp = 0; //@line 8967
 sp = STACKTOP; //@line 8968
 SAFE_HEAP_STORE($0 | 0, 744 | 0, 4);
 return;
}
function b6(p0, p1, p2, p3) {
 p0 = p0 | 0; //@line 9538
 p1 = p1 | 0; //@line 9538
 p2 = p2 | 0; //@line 9538
 p3 = p3 | 0; //@line 9538
 nullFunc_viiii(6); //@line 9538
}
function __ZNKSt9bad_alloc4whatEv($0) {
 $0 = $0 | 0; //@line 8887
 var label = 0, sp = 0; //@line 8888
 sp = STACKTOP; //@line 8889
 return 3814 | 0; //@line 8890
}
function b2(p0, p1, p2) {
 p0 = p0 | 0; //@line 9523
 p1 = p1 | 0; //@line 9523
 p2 = p2 | 0; //@line 9523
 nullFunc_iiii(2); //@line 9523
 return 0; //@line 9523
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0 | 0; //@line 8198
 var label = 0, sp = 0; //@line 8199
 sp = STACKTOP; //@line 8200
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0 | 0; //@line 8192
 var label = 0, sp = 0; //@line 8193
 sp = STACKTOP; //@line 8194
 return;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0 | 0; //@line 8178
 var label = 0, sp = 0; //@line 8179
 sp = STACKTOP; //@line 8180
 return;
}
function ___ofl_lock() {
 var label = 0, sp = 0; //@line 7737
 sp = STACKTOP; //@line 7738
 ___lock(4516 | 0); //@line 7739
 return 4524 | 0; //@line 7740
}
function _llvm_bswap_i32(x) {
 x = x | 0; //@line 9302
 return (x & 255) << 24 | (x >> 8 & 255) << 16 | (x >> 16 & 255) << 8 | x >>> 24 | 0; //@line 9303
}
function dynCall_i(index) {
 index = index | 0; //@line 9455
 return FUNCTION_TABLE_i[(SAFE_FT_MASK(index | 0, 63 | 0) | 0) & 63]() | 0; //@line 9457
}
function __ZdlPv($0) {
 $0 = $0 | 0; //@line 8011
 var label = 0, sp = 0; //@line 8012
 sp = STACKTOP; //@line 8013
 _free($0); //@line 8014
 return;
}
function _dummy_733($0) {
 $0 = $0 | 0; //@line 4437
 var label = 0, sp = 0; //@line 4438
 sp = STACKTOP; //@line 4439
 return $0 | 0; //@line 4440
}
function ___lockfile($0) {
 $0 = $0 | 0; //@line 5466
 var label = 0, sp = 0; //@line 5467
 sp = STACKTOP; //@line 5468
 return 0; //@line 5469
}
function dynCall_v(index) {
 index = index | 0; //@line 9476
 FUNCTION_TABLE_v[(SAFE_FT_MASK(index | 0, 63 | 0) | 0) & 63](); //@line 9478
}
function __ZNSt9type_infoD2Ev($0) {
 $0 = $0 | 0; //@line 8747
 var label = 0, sp = 0; //@line 8748
 sp = STACKTOP; //@line 8749
 return;
}
function __ZNSt9exceptionD2Ev($0) {
 $0 = $0 | 0; //@line 8893
 var label = 0, sp = 0; //@line 8894
 sp = STACKTOP; //@line 8895
 return;
}
function __ZNSt9bad_allocD2Ev($0) {
 $0 = $0 | 0; //@line 8873
 var label = 0, sp = 0; //@line 8874
 sp = STACKTOP; //@line 8875
 return;
}
function ___ofl_unlock() {
 var label = 0, sp = 0; //@line 7743
 sp = STACKTOP; //@line 7744
 ___unlock(4516 | 0); //@line 7745
 return;
}
function ___unlockfile($0) {
 $0 = $0 | 0; //@line 5472
 var label = 0, sp = 0; //@line 5473
 sp = STACKTOP; //@line 5474
 return;
}
function ___errno_location() {
 var label = 0, sp = 0; //@line 4432
 sp = STACKTOP; //@line 4433
 return 4512 | 0; //@line 4434
}
function _pthread_self() {
 var label = 0, sp = 0; //@line 7242
 sp = STACKTOP; //@line 7243
 return 408 | 0; //@line 7244
}
function setDynamicTop(value) {
 value = value | 0; //@line 35
 SAFE_HEAP_STORE(DYNAMICTOP_PTR | 0, value | 0, 4);
}
function b5(p0, p1) {
 p0 = p0 | 0; //@line 9535
 p1 = p1 | 0; //@line 9535
 nullFunc_vii(5); //@line 9535
}
function b1(p0) {
 p0 = p0 | 0; //@line 9520
 nullFunc_ii(1); //@line 9520
 return 0; //@line 9520
}
function setTempRet0(value) {
 value = value | 0; //@line 111
 tempRet0 = value; //@line 112
}
function stackRestore(top) {
 top = top | 0; //@line 15
 STACKTOP = top; //@line 16
}
function b4(p0) {
 p0 = p0 | 0; //@line 9532
 nullFunc_vi(4); //@line 9532
}
function ___cxa_end_catch__wrapper() {
 ___cxa_end_catch(); //@line 9529
}
function b0() {
 nullFunc_i(0); //@line 9517
 return 0; //@line 9517
}
function getTempRet0() {
 return tempRet0 | 0; //@line 115
}
function stackSave() {
 return STACKTOP | 0; //@line 12
}
function b3() {
 nullFunc_v(3); //@line 9526
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_i = [b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,___cxa_get_globals_fast,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0];
var FUNCTION_TABLE_ii = [b1,___stdio_close,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZNKSt9bad_alloc4whatEv,b1,b1,__ZNKSt11logic_error4whatEv,b1,b1,b1,b1,b1
,b1,b1,b1];
var FUNCTION_TABLE_iiii = [b2,b2,___stdio_write,___stdio_seek,___stdout_write,b2,b2,b2,b2,b2,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,b2,b2,b2,b2,b2];
var FUNCTION_TABLE_v = [b3,b3,b3,b3,b3,__ZL25default_terminate_handlerv,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b3,b3,b3,___cxa_end_catch__wrapper,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3];
var FUNCTION_TABLE_vi = [b4,b4,b4,b4,b4,b4,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,b4,b4,b4,b4,__ZN10__cxxabiv120__si_class_type_infoD0Ev,b4,b4,b4,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,b4,__ZNSt11logic_errorD2Ev,__ZNSt11logic_errorD0Ev,b4,__ZNSt12length_errorD0Ev,b4,b4,__ZN4Asam11ApplicationC2Ev,__ZN4Asam4RootC2Ev
,b4,b4,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv];
var FUNCTION_TABLE_vii = [b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,__ZNSt3__26vectorIPN4Asam10HtmlCanvasENS_9allocatorIS3_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS3_RS5_EE,__ZNSt11logic_errorC2EPKc,b5,b5
,__ZNSt3__218__libcpp_refstringC2EPKc,b5,b5,b5,_abort_message,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5];
var FUNCTION_TABLE_viiii = [b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b6,b6,b6,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6];
var FUNCTION_TABLE_viiiii = [b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b7,b7,b7,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,b7,b7,b7];
var FUNCTION_TABLE_viiiiii = [b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b8,b8,b8,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib];

  return { ___cxa_can_catch: ___cxa_can_catch, ___cxa_is_pointer_type: ___cxa_is_pointer_type, ___errno_location: ___errno_location, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, _asamCreateApplication: _asamCreateApplication, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _fflush: _fflush, _free: _free, _i64Add: _i64Add, _i64Subtract: _i64Subtract, _llvm_bswap_i32: _llvm_bswap_i32, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_i: dynCall_i, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_v: dynCall_v, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_viiii: dynCall_viiii, dynCall_viiiii: dynCall_viiiii, dynCall_viiiiii: dynCall_viiiiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setDynamicTop: setDynamicTop, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____cxa_can_catch = asm["___cxa_can_catch"]; asm["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"]; asm["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____udivdi3.apply(null, arguments);
};

var real____uremdi3 = asm["___uremdi3"]; asm["___uremdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____uremdi3.apply(null, arguments);
};

var real__asamCreateApplication = asm["_asamCreateApplication"]; asm["_asamCreateApplication"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__asamCreateApplication.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Subtract.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setDynamicTop = asm["setDynamicTop"]; asm["setDynamicTop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setDynamicTop.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var _asamCreateApplication = Module["_asamCreateApplication"] = asm["_asamCreateApplication"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setDynamicTop = Module["setDynamicTop"] = asm["setDynamicTop"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    if (typeof Module['locateFile'] === 'function') {
      memoryInitializer = Module['locateFile'](memoryInitializer);
    } else if (Module['memoryInitializerPrefixURL']) {
      memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
    }
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
            // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
            // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = Module['print'];
  var printErr = Module['printErr'];
  var has = false;
  Module['print'] = Module['printErr'] = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  Module['print'] = print;
  Module['printErr'] = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      Module.printErr('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}






//# sourceMappingURL=asam.js.map