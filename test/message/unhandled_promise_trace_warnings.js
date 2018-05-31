// Flags: --trace-warnings
'use strict';
const common = require('../common');
common.expectWarning('UnhandledPromiseRejectionWarning',
                     /^Error: This was rejected\n.*/);
common.expectWarning(
  'UnhandledPromiseRejectionWarning',
  'Unhandled promise rejection. This error originated either by throwing ' +
  'inside of an async function without a catch block, or by rejecting a ' +
  'promise which was not handled with .catch(). (rejection id: 1)');
common.expectWarning(
  'DeprecationWarning',
  'Unhandled promise rejections are deprecated. In the future, promise ' +
  'rejections that are not handled will terminate the Node.js process with a ' +
  'non-zero exit code.',
  'DEP0018');
common.expectWarning(
  'PromiseRejectionHandledWarning',
  'Promise rejection was handled asynchronously (rejection id: 1)');

const p = Promise.reject(new Error('This was rejected'));
setImmediate(() => p.catch(() => {}));
