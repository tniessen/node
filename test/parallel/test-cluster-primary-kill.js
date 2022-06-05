// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';
const common = require('../common');
const assert = require('assert');
const cluster = require('cluster');
const fs = require('fs');

function log(...args) {
  console.log(new Date().toISOString(), `${process.pid}`.padStart(10), ...args);
}

if (cluster.isWorker) {

  log('cluster.isWorker', { pid: process.pid });
  // Keep the worker alive
  const http = require('http');
  http.Server().listen(0, '127.0.0.1');
  setInterval(() => log('cluster.isWorker', 'still alive'), 500);

} else if (process.argv[2] === 'cluster') {

  log('cluster process', { pid: process.pid });
  const worker = cluster.fork();

  // send PID info to testcase process
  log('cluster process', { workerPid: worker.process.pid });
  process.send({
    pid: worker.process.pid
  });

  // Terminate the cluster process
  worker.once('listening', common.mustCall(() => {
    log('cluster process', 'worker is listening');
    setTimeout(() => {
      log('cluster process', 'process.exit(0)');
      process.exit(0);
    }, 1000);
  }));

} else {

  log('test process', { pid: process.pid});
  // This is the testcase
  const fork = require('child_process').fork;

  // Spawn a cluster process
  log('test process', 'spawn cluster', { script: process.argv[1] });
  const primary = fork(process.argv[1], ['cluster']);

  // get pid info
  let pid = null;
  primary.once('message', (data) => {
    pid = data.pid;
    log('test process', 'message from primary', { pid });
  });

  // When primary is dead
  let alive = true;
  primary.on('exit', common.mustCall((code) => {
    log('test process', 'primary has exited', { code });

    // Make sure that the primary died on purpose
    assert.strictEqual(code, 0);

    // Check worker process status
    const pollWorker = () => {
      alive = common.isAlive(pid);
      log('test process', 'pollWorker', { alive, pid });
      if (alive) {
        log('test process', 'pollWorker: alive', {
          cmdline: fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')
        });
        setTimeout(pollWorker, 50);
      }
    };
    // Loop indefinitely until worker exit.
    pollWorker();
  }));

  process.once('exit', () => {
    log('test process', 'exit', { pid, alive });
    assert.strictEqual(typeof pid, 'number',
                       `got ${pid} instead of a worker pid`);
    assert.strictEqual(alive, false,
                       `worker was alive after primary died (alive = ${alive})`
    );
  });

}
