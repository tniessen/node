'use strict';
const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');

const assert = require('assert');
const crypto = require('crypto');

assert.throws(() => crypto.diffieHellman(), {
  name: 'TypeError',
  code: 'ERR_INVALID_ARG_TYPE',
  message: 'The "options" argument must be of type object. Received undefined'
});

function test({ publicKey: alicePublicKey, privateKey: alicePrivateKey },
              { publicKey: bobPublicKey, privateKey: bobPrivateKey },
              expectedValue) {
  const buf1 = crypto.diffieHellman({
    privateKey: alicePrivateKey,
    publicKey: bobPublicKey
  });
  const buf2 = crypto.diffieHellman({
    privateKey: bobPrivateKey,
    publicKey: alicePublicKey
  });
  assert.deepStrictEqual(buf1, buf2);

  if (expectedValue !== undefined)
    assert.deepStrictEqual(buf1, expectedValue);
}

const alicePrivateKey = crypto.createPrivateKey({
  key: '-----BEGIN PRIVATE KEY-----\n' +
       'MIIBoQIBADCB1QYJKoZIhvcNAQMBMIHHAoHBAP//////////yQ/aoiFowjTExmKL\n' +
       'gNwc0SkCTgiKZ8x0Agu+pjsTmyJRSgh5jjQE3e+VGbPNOkMbMCsKbfJfFDdP4TVt\n' +
       'bVHCReSFtXZiXn7G9ExC6aY37WsL/1y29Aa37e44a/taiZ+lrp8kEXxLH+ZJKGZR\n' +
       '7ORbPcIAfLihY78FmNpINhxV05ppFj+o/STPX4NlXSPco62WHGLzViCFUrue1SkH\n' +
       'cJaWbWcMNU5KvJgE8XRsCMojcyf//////////wIBAgSBwwKBwEh82IAVnYNf0Kjb\n' +
       'qYSImDFyg9sH6CJ0GzRK05e6hM3dOSClFYi4kbA7Pr7zyfdn2SH6wSlNS14Jyrtt\n' +
       'HePrRSeYl1T+tk0AfrvaLmyM56F+9B3jwt/nzqr5YxmfVdXb2aQV53VS/mm3pB2H\n' +
       'iIt9FmvFaaOVe2DupqSr6xzbf/zyON+WF5B5HNVOWXswgpgdUsCyygs98hKy/Xje\n' +
       'TGzJUoWInW39t0YgMXenJrkS0m6wol8Rhxx81AGgELNV7EHZqg==\n' +
       '-----END PRIVATE KEY-----',
  format: 'pem'
});

const alicePublicKey = crypto.createPublicKey({
  key: '-----BEGIN PUBLIC KEY-----\n' +
       'MIIBnzCB1QYJKoZIhvcNAQMBMIHHAoHBAP//////////yQ/aoiFowjTExmKLgNwc\n' +
       '0SkCTgiKZ8x0Agu+pjsTmyJRSgh5jjQE3e+VGbPNOkMbMCsKbfJfFDdP4TVtbVHC\n' +
       'ReSFtXZiXn7G9ExC6aY37WsL/1y29Aa37e44a/taiZ+lrp8kEXxLH+ZJKGZR7ORb\n' +
       'PcIAfLihY78FmNpINhxV05ppFj+o/STPX4NlXSPco62WHGLzViCFUrue1SkHcJaW\n' +
       'bWcMNU5KvJgE8XRsCMojcyf//////////wIBAgOBxAACgcBR7+iL5qx7aOb9K+aZ\n' +
       'y2oLt7ST33sDKT+nxpag6cWDDWzPBKFDCJ8fr0v7yW453px8N4qi4R7SYYxFBaYN\n' +
       'Y3JvgDg1ct2JC9sxSuUOLqSFn3hpmAjW7cS0kExIVGfdLlYtIqbhhuo45cTEbVIM\n' +
       'rDEz8mjIlnvbWpKB9+uYmbjfVoc3leFvUBqfG2In2m23Md1swsPxr3n7g68H66JX\n' +
       'iBJKZLQMqNdbY14G9rdKmhhTJrQjC+i7Q/wI8JPhOFzHIGA=\n' +
       '-----END PUBLIC KEY-----',
  format: 'pem'
});

const bobPrivateKey = crypto.createPrivateKey({
  key: '-----BEGIN PRIVATE KEY-----\n' +
       'MIIBoQIBADCB1QYJKoZIhvcNAQMBMIHHAoHBAP//////////yQ/aoiFowjTExmKL\n' +
       'gNwc0SkCTgiKZ8x0Agu+pjsTmyJRSgh5jjQE3e+VGbPNOkMbMCsKbfJfFDdP4TVt\n' +
       'bVHCReSFtXZiXn7G9ExC6aY37WsL/1y29Aa37e44a/taiZ+lrp8kEXxLH+ZJKGZR\n' +
       '7ORbPcIAfLihY78FmNpINhxV05ppFj+o/STPX4NlXSPco62WHGLzViCFUrue1SkH\n' +
       'cJaWbWcMNU5KvJgE8XRsCMojcyf//////////wIBAgSBwwKBwHxnT7Zw2Ehh1vyw\n' +
       'eolzQFHQzyuT0y+3BF+FxK2Ox7VPguTp57wQfGHbORJ2cwCdLx2mFM7gk4tZ6COS\n' +
       'E3Vta85a/PuhKXNLRdP79JgLnNtVtKXB+ePDS5C2GgXH1RHvqEdJh7JYnMy7Zj4P\n' +
       'GagGtIy3dV5f4FA0B/2C97jQ1pO16ah8gSLQRKsNpTCw2rqsZusE0rK6RaYAef7H\n' +
       'y/0tmLIsHxLIn+WK9CANqMbCWoP4I178BQaqhiOBkNyNZ0ndqA==\n' +
       '-----END PRIVATE KEY-----',
  format: 'pem'
});

const bobPublicKey = crypto.createPublicKey({
  key: '-----BEGIN PUBLIC KEY-----\n' +
       'MIIBoDCB1QYJKoZIhvcNAQMBMIHHAoHBAP//////////yQ/aoiFowjTExmKLgNwc\n' +
       '0SkCTgiKZ8x0Agu+pjsTmyJRSgh5jjQE3e+VGbPNOkMbMCsKbfJfFDdP4TVtbVHC\n' +
       'ReSFtXZiXn7G9ExC6aY37WsL/1y29Aa37e44a/taiZ+lrp8kEXxLH+ZJKGZR7ORb\n' +
       'PcIAfLihY78FmNpINhxV05ppFj+o/STPX4NlXSPco62WHGLzViCFUrue1SkHcJaW\n' +
       'bWcMNU5KvJgE8XRsCMojcyf//////////wIBAgOBxQACgcEAi26oq8z/GNSBm3zi\n' +
       'gNt7SA7cArUBbTxINa9iLYWp6bxrvCKwDQwISN36/QUw8nUAe8aRyMt0oYn+y6vW\n' +
       'Pw5OlO+TLrUelMVFaADEzoYomH0zVGb0sW4aBN8haC0mbrPt9QshgCvjr1hEPEna\n' +
       'QFKfjzNaJRNMFFd4f2Dn8MSB4yu1xpA1T2i0JSk24vS2H55jx24xhUYtfhT2LJgK\n' +
       'JvnaODey/xtY4Kql10ZKf43Lw6gdQC3G8opC9OxVxt9oNR7Z\n' +
       '-----END PUBLIC KEY-----',
  format: 'pem'
});

assert.throws(() => crypto.diffieHellman({ privateKey: alicePrivateKey }), {
  name: 'TypeError',
  code: 'ERR_INVALID_OPT_VALUE',
  message: 'The value "undefined" is invalid for option "publicKey"'
});

assert.throws(() => crypto.diffieHellman({ publicKey: alicePublicKey }), {
  name: 'TypeError',
  code: 'ERR_INVALID_OPT_VALUE',
  message: 'The value "undefined" is invalid for option "privateKey"'
});

const privateKey = Buffer.from(
  '487CD880159D835FD0A8DBA9848898317283DB07E822741B344AD397BA84CDDD3920A51588' +
  'B891B03B3EBEF3C9F767D921FAC1294D4B5E09CABB6D1DE3EB4527989754FEB64D007EBBDA' +
  '2E6C8CE7A17EF41DE3C2DFE7CEAAF963199F55D5DBD9A415E77552FE69B7A41D87888B7D16' +
  '6BC569A3957B60EEA6A4ABEB1CDB7FFCF238DF961790791CD54E597B3082981D52C0B2CA0B' +
  '3DF212B2FD78DE4C6CC95285889D6DFDB746203177A726B912D26EB0A25F11871C7CD401A0' +
  '10B355EC41D9AA', 'hex');
const publicKey = Buffer.from(
  '8b6ea8abccff18d4819b7ce280db7b480edc02b5016d3c4835af622d85a9e9bc6bbc22b00d' +
  '0c0848ddfafd0530f275007bc691c8cb74a189fecbabd63f0e4e94ef932eb51e94c5456800' +
  'c4ce8628987d335466f4b16e1a04df21682d266eb3edf50b21802be3af58443c49da40529f' +
  '8f335a25134c1457787f60e7f0c481e32bb5c690354f68b4252936e2f4b61f9e63c76e3185' +
  '462d7e14f62c980a26f9da3837b2ff1b58e0aaa5d7464a7f8dcbc3a81d402dc6f28a42f4ec' +
  '55c6df68351ed9', 'hex');

const group = crypto.getDiffieHellman('modp5');
const dh = crypto.createDiffieHellman(group.getPrime(), group.getGenerator());
dh.setPrivateKey(privateKey);

// Test simple Diffie-Hellman, no curves involved.

test({ publicKey: alicePublicKey, privateKey: alicePrivateKey },
     { publicKey: bobPublicKey, privateKey: bobPrivateKey },
     dh.computeSecret(publicKey));

test(crypto.generateKeyPairSync('dh', { group: 'modp5' }),
     crypto.generateKeyPairSync('dh', { group: 'modp5' }));

test(crypto.generateKeyPairSync('dh', { group: 'modp5' }),
     crypto.generateKeyPairSync('dh', { prime: group.getPrime() }));

for (const [params1, params2] of [
  // Same generator, but different primes.
  [{ group: 'modp5' }, { group: 'modp18' }],
  // Same primes, but different generator.
  [{ group: 'modp5' }, { prime: group.getPrime(), generator: 5 }],
  // Same generator, but different primes.
  [{ primeLength: 1024 }, { primeLength: 1024 }]
]) {
  assert.throws(() => {
    test(crypto.generateKeyPairSync('dh', params1),
         crypto.generateKeyPairSync('dh', params2));
  }, {
    name: 'Error',
    code: 'ERR_OSSL_EVP_DIFFERENT_PARAMETERS'
  });
}

// Test ECDH.

test(crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }),
     crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }));

assert.throws(() => {
  test(crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }),
       crypto.generateKeyPairSync('ec', { namedCurve: 'secp224k1' }));
}, {
  name: 'Error',
  code: 'ERR_OSSL_EVP_DIFFERENT_PARAMETERS'
});

// Test ECDH-ES.

test(crypto.generateKeyPairSync('x448'),
     crypto.generateKeyPairSync('x448'));

test(crypto.generateKeyPairSync('x25519'),
     crypto.generateKeyPairSync('x25519'));

assert.throws(() => {
  test(crypto.generateKeyPairSync('x448'),
       crypto.generateKeyPairSync('x25519'));
}, {
  name: 'Error',
  code: 'ERR_CRYPTO_INCOMPATIBLE_KEY',
  message: 'Incompatible key types for Diffie-Hellman: x448 and x25519'
});
