'use strict';
const common = require('../common');

common.expectWarning('DeprecationWarning',
                     'Unhandled promise rejections are deprecated. In the ' +
                     'future, promise rejections that are not handled will ' +
                     'terminate the Node.js process with a non-zero exit code.',
                     'DEP0018');
common.expectWarning('UnhandledPromiseRejectionWarning',
                     'Unhandled promise rejection. This error originated ' +
                     'either by throwing inside of an async function without ' +
                     'a catch block, or by rejecting a promise which was ' +
                     'not handled with .catch(). (rejection id: 1)',
                     common.noWarnCode);
common.expectWarning('UnhandledPromiseRejectionWarning', 'Symbol()',
                     common.noWarnCode);

// ensure this doesn't crash
Promise.reject(Symbol());
