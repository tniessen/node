// Flags: --experimental-secure-heap
'use strict';
const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');

const assert = require('assert');
const { alloc } = require('crypto');

const buf = alloc(500);
assert(buf instanceof Buffer);
assert.strictEqual(buf.length, 500);
