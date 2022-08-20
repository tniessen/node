'use strict';

// This is a regression test for some scenarios in which node would pass
// unsanitized user input to a printf-like formatting function when dlopen
// fails, potentially crashing the process.

require('../common');
const tmpdir = require('../common/tmpdir');
tmpdir.refresh();

const assert = require('assert');
const fs = require('fs');

// This error message should not be passed to a printf-like function.
assert.throws(() => {
  process.dlopen({ exports: {} }, 'foo-%s.node');
}, {
  name: 'Error',
  code: 'ERR_DLOPEN_FAILED',
  message: /foo-%s\.node/
});

// This error message should also not be passed to a printf-like function.
const notBindingPath = './test/addons/not-a-binding/build/Release/binding.node';
const strangeBindingPath = `${tmpdir.path}/binding-%s.node`;
fs.copyFileSync(notBindingPath, strangeBindingPath);
assert.throws(() => {
  process.dlopen({ exports: {} }, strangeBindingPath);
}, {
  name: 'Error',
  code: 'ERR_DLOPEN_FAILED',
  message: /^Module did not self-register: '.*binding-%s\.node'\.$/
});
