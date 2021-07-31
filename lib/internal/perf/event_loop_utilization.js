'use strict';

const nodeTiming = require('internal/perf/nodetiming');

const { now } = require('internal/perf/utils');

function eventLoopUtilization(util1, util2) {
  const ls = nodeTiming.loopStart;
  let idle = 0, active = 0;

  if (util2) {
    ({ idle, active } = util1);
    util1 = util2;
  } else if (ls > 0) {
    idle = nodeTiming.idleTime;
    active = now() - ls - idle;
  }

  if (util1) {
    idle -= util1.idle;
    active -= util1.active;
  }

  return { idle, active, utilization: active / (idle + active) || 0 };
}

module.exports = eventLoopUtilization;
