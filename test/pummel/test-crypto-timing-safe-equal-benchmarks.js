'use strict';
const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');

if (!common.enoughTestMem)
  common.skip('memory-intensive test');

const assert = require('assert');
const crypto = require('crypto');

const numTrials = 1e5;
const bufSize = 16384;
const readOnlyTestBuffer = crypto.randomBytes(bufSize);

function getTValue(compareFunc) {
  // Perform benchmarks to verify that timingSafeEqual is actually timing-safe.

  // Store all results in a single array and separate it later to avoid
  // branching in the benchmark loop.
  const measurements = Array(2 * numTrials).fill(0);
  const testBuffer = Buffer.from(readOnlyTestBuffer);

  // Run the actual benchmark. Avoid all branching (except the loop condition)
  // to avoid conditional V8 optimizations.
  let n = 0;
  for (let i = 0; i < 2 * numTrials; i++) {
    // Modify either the first or last byte of the copy of the test buffer.
    const j = (bufSize - 1) * (i % 2);
    testBuffer[j] ^= 1 | (i & 0xff);
    // Call the comparison function and coerce the result into a number.
    const startTime = process.hrtime.bigint();
    n += compareFunc(testBuffer, readOnlyTestBuffer);
    const endTime = process.hrtime.bigint();
    measurements[i] = Number(endTime - startTime);
    // Restore the original byte.
    testBuffer[j] = readOnlyTestBuffer[j];
  }

  // The comparison function should have returned false in every iteration, but
  // we only check that here to avoid explicit branching above.
  assert.strictEqual(n, 0);

  // A simple comparison would be fast for even i and slow for odd i.
  const rawFastBenches = measurements.filter((_, i) => i % 2 === 0);
  const rawSlowBenches = measurements.filter((_, i) => i % 2 !== 0);
  const fastBenches = filterOutliers(rawFastBenches);
  const slowBenches = filterOutliers(rawSlowBenches);

  // Use a two-sample t-test to determine whether the timing difference between
  // the benchmarks is statistically significant.
  // https://wikipedia.org/wiki/Student%27s_t-test#Independent_two-sample_t-test

  const fastMean = mean(fastBenches);
  const slowMean = mean(slowBenches);

  const fastLen = fastBenches.length;
  const slowLen = slowBenches.length;

  const combinedStd = combinedStandardDeviation(fastBenches, slowBenches);
  const standardErr = combinedStd * Math.sqrt(1 / fastLen + 1 / slowLen);

  console.log(JSON.stringify({ rawFastBenches, rawSlowBenches, fastMean, slowMean, t: (fastMean - slowMean) / standardErr }));

  return (fastMean - slowMean) / standardErr;
}

// Returns the mean of an array
function mean(array) {
  return array.reduce((sum, val) => sum + val, 0) / array.length;
}

// Returns the sample standard deviation of an array
function standardDeviation(array) {
  const arrMean = mean(array);
  const total = array.reduce((sum, val) => sum + Math.pow(val - arrMean, 2), 0);
  return Math.sqrt(total / (array.length - 1));
}

// Returns the common standard deviation of two arrays
function combinedStandardDeviation(array1, array2) {
  const sum1 = Math.pow(standardDeviation(array1), 2) * (array1.length - 1);
  const sum2 = Math.pow(standardDeviation(array2), 2) * (array2.length - 1);
  return Math.sqrt((sum1 + sum2) / (array1.length + array2.length - 2));
}

// Filter large outliers from an array. A 'large outlier' is a value that is at
// least 50 times larger than the mean. This prevents the tests from failing
// due to the standard deviation increase when a function unexpectedly takes
// a very long time to execute.
function filterOutliers(array) {
  const arrMean = mean(array);
  return array.filter((value) => value / arrMean < 50);
}

// t_(0.99995, ∞)
// i.e. If a given comparison function is indeed timing-safe, the t-test result
// has a 99.99% chance to be below this threshold. Unfortunately, this means
// that this test will be a bit flakey and will fail 0.01% of the time even if
// crypto.timingSafeEqual is working properly.
// t-table ref: http://www.sjsu.edu/faculty/gerstman/StatPrimer/t-table.pdf
// Note that in reality there are roughly `2 * numTrials - 2` degrees of
// freedom, not ∞. However, assuming `numTrials` is large, this doesn't
// significantly affect the threshold.
const T_THRESHOLD = 3.892;

const t = getTValue(crypto.timingSafeEqual);
assert(
  Math.abs(t) < T_THRESHOLD,
  `timingSafeEqual should not leak information from its execution time (t=${t})`
);

// As a coherence check to make sure the statistical tests are working, run the
// same benchmarks again, this time with an unsafe comparison function. In this
// case the t-value should be above the threshold.
const unsafeCompare = (bufA, bufB) => bufA.equals(bufB);
const t2 = getTValue(unsafeCompare);
assert(
  Math.abs(t2) > T_THRESHOLD,
  `Buffer#equals should leak information from its execution time (t=${t2})`
);
