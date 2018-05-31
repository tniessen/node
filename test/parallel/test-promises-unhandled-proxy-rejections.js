'use strict';
const common = require('../common');

function throwErr() {
  throw new Error('Error from proxy');
}

const thorny = new Proxy({}, {
  getPrototypeOf: throwErr,
  setPrototypeOf: throwErr,
  isExtensible: throwErr,
  preventExtensions: throwErr,
  getOwnPropertyDescriptor: throwErr,
  defineProperty: throwErr,
  has: throwErr,
  get: throwErr,
  set: throwErr,
  deleteProperty: throwErr,
  ownKeys: throwErr,
  apply: throwErr,
  construct: throwErr
});

common.expectWarning('DeprecationWarning',
                     'Unnhandled promise rejections are deprecated. In the ' +
                     'future, promise rejections that are not handled will ' +
                     'terminate the Node.js process with a non-zero exit ' +
                     'code.', 'DEP0018');
common.expectWarning('UnhandledPromiseRejectionWarning',
                     'This error originated either by throwing inside of an ' +
                     'async function without a catch block, or by rejecting ' +
                     'a promise which was not handled with .catch(). ' +
                     '(rejection id: 1)', common.noWarnCode);

// ensure this doesn't crash
Promise.reject(thorny);
