'use strict';

const common = require('../common');
const assert = require('assert');
const fs = require('fs');
const { O_RDONLY, O_WRONLY, O_RDWR, O_APPEND, O_CREAT, O_TRUNC } = fs.constants;
const path = require('path');

assert.strictEqual(O_RDONLY, 0);
assert.strictEqual(O_WRONLY, 1);
assert.strictEqual(O_RDWR, 2);

const tmpdir = require('../common/tmpdir');
tmpdir.refresh();

const existingFile = path.join(tmpdir.path, 'existing');
fs.writeFileSync(existingFile, 'test');
const nonexistentFile = path.join(tmpdir.path, 'nonexistent');

const O_TEMPORARY = 0x40 * common.isWindows;

function testReadOnlyExisting(flags) {
  fs.writeSync(process.stdout.fd, `${(flags >>> 0).toString(16)}: open existing file read-only: `);
  let fd;
  try {
    fd = fs.openSync(existingFile, flags);
  } catch (err) {
    console.log(err.message);
    return;
  }
  assert.throws(() => {
    fs.writeSync(fd, 'a');
  }, {
    code: 'EBADF'
  });
  fs.closeSync(fd);
  if ((flags & O_TEMPORARY) !== 0) {
    console.log('windows is stupid');
    assert.strictEqual(fs.existsSync(existingFile), false);
    fs.writeFileSync(existingFile, 'test');
  } else {
    console.log('open');
    assert.strictEqual(fs.readFileSync(existingFile, 'utf8'), 'test');
  }
}

function testReadOnlyNonexistent(flags) {
  fs.writeSync(process.stdout.fd, `${(flags >>> 0).toString(16)}: open nonexistent file read-only: `);
  let fd;
  try {
    fd = fs.openSync(nonexistentFile, flags);
  } catch (err) {
    console.log(err.message);
    return;
  }
  assert.throws(() => {
    fs.writeSync(fd, 'a');
  }, {
    code: 'EBADF'
  });
  fs.closeSync(fd);
  console.log('open');
  assert.strictEqual(fs.existsSync(nonexistentFile), false);
}

function testWriteOnlyExisting(flags) {
  fs.writeSync(process.stdout.fd, `${(flags >>> 0).toString(16)}: open existing file write-only: `);
  let fd;
  try {
    fd = fs.openSync(existingFile, flags);
  } catch (err) {
    console.log(err.message);
    return;
  }
  assert.throws(() => {
    fs.readSync(fd, Buffer.alloc(1));
  }, {
    code: 'EBADF'
  });
  fs.closeSync(fd);
  if ((flags & O_TEMPORARY) !== 0) {
    console.log('windows is stupid');
    assert.strictEqual(fs.existsSync(existingFile), false);
  } else {
    console.log('open');
  }
  fs.writeFileSync(existingFile, 'test');
}

function testWriteOnlyNonexistent(flags) {
  fs.writeSync(process.stdout.fd, `${(flags >>> 0).toString(16)}: open nonexistent file write-only: `);
  let fd;
  try {
    fd = fs.openSync(nonexistentFile, flags);
  } catch (err) {
    console.log(err.message);
    return;
  }
  assert.throws(() => {
    fs.readSync(fd, Buffer.alloc(1));
  }, {
    code: 'EBADF'
  });
  fs.closeSync(fd);
  if ((flags & O_TEMPORARY) === 0) {
    console.log('open');
    assert.strictEqual(fs.existsSync(nonexistentFile), true);
    fs.unlinkSync(nonexistentFile);
  } else {
    console.log('windows is stupid');
    assert.strictEqual(fs.existsSync(nonexistentFile), false);
  }
}

const allFlags = new Set();

for (let bit1 = 3; bit1 < 32; bit1++) {
  for (let bit2 = bit1; bit2 < 32; bit2++) {
    for (let bit3 = bit2; bit3 < 32; bit3++) {
      {
        const flags = O_RDONLY | (1 << bit1) | (1 << bit2) | (1 << bit3);
        allFlags.add(flags);
        if (!common.isWindows || (flags & O_APPEND) === 0) {
          if ((flags & O_CREAT) === 0) testReadOnlyNonexistent(flags);
          if ((flags & O_TRUNC) === 0) testReadOnlyExisting(flags);
        }
      }
      {
        const flags = O_WRONLY | (1 << bit1) | (1 << bit2) | (1 << bit3);
        allFlags.add(flags);
        testWriteOnlyNonexistent(flags);
        testWriteOnlyExisting(flags);
      }
    }
  }
}

console.log(allFlags.size);
