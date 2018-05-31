/* eslint-disable node-core/crypto-check */

'use strict';

const common = require('../common');

const http = require('http');
const modules = { http };

if (common.hasCrypto) {
  const https = require('https');
  modules.https = https;
}

Object.keys(modules).forEach((module) => {
  common.expectWarning(
    'DeprecationWarning',
    `The provided URL ${module}://[www.nodejs.org] is not a valid URL, and ` +
    `is supported in the ${module} module solely for compatibility.`,
    'DEP0109');
  const doNotCall = common.mustNotCall(
    `${module}.request should not connect to ${module}://[www.nodejs.org]`
  );
  modules[module].request(`${module}://[www.nodejs.org]`, doNotCall).abort();
});
