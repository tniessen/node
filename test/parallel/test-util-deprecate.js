'use strict';

const common = require('../common');

// Tests basic functionality of util.deprecate().

const util = require('util');

const expectedWarnings = new Map();

// Emits deprecation only once if same function is called.
{
  const msg = 'fhqwhgads';
  const fn = util.deprecate(() => {}, msg);
  common.expectWarning('DeprecationWarning', msg, common.noWarnCode);
  expectedWarnings.set(msg, { code: undefined, count: 1 });
  fn();
  fn();
}

// Emits deprecation twice for different functions.
{
  const msg = 'sterrance';
  const fn1 = util.deprecate(() => {}, msg);
  const fn2 = util.deprecate(() => {}, msg);
  common.expectWarning('DeprecationWarning', msg, common.noWarnCode);
  fn1();
  common.expectWarning('DeprecationWarning', msg, common.noWarnCode);
  fn2();
}

// Emits deprecation only once if optional code is the same, even for different
// functions.
{
  const msg = 'cannonmouth';
  const code = 'deprecatesque';
  const fn1 = util.deprecate(() => {}, msg, code);
  const fn2 = util.deprecate(() => {}, msg, code);
  expectedWarnings.set(msg, { code, count: 1 });
  common.expectWarning('DeprecationWarning', msg, code);
  fn1();
  fn2();
  fn1();
  fn2();
}
