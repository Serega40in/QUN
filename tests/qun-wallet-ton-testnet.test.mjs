import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTonTestnetFriendlyAddress,
  normalizeTonTestnetAddress,
  parseTonNanoAmount,
  TON_TESTNET_MAX_NANO,
  TON_TESTNET_CHAIN,
} from '../docs/qun-wallet/ton-testnet.mjs';

const testnetBounceable = 'kQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi47nL';
const testnetNonBounceable = '0QAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4-QO';
const rawAddress = '0:2cf55953e92efbeadab7ba725c3f93a0b23f842cbba72d7b8e6f510a70e422e3';
const mainnetAddress = 'EQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4wJB';

test('network remains pinned to TON Testnet and one-transfer cap is explicit', () => {
  assert.equal(TON_TESTNET_CHAIN, '-3');
  assert.equal(TON_TESTNET_MAX_NANO, 100000000000n);
});

test('validates TON Testnet friendly address including CRC16', () => {
  assert.equal(isValidTonTestnetFriendlyAddress(testnetBounceable), true);
  assert.equal(isValidTonTestnetFriendlyAddress(testnetNonBounceable), true);
  assert.equal(isValidTonTestnetFriendlyAddress(mainnetAddress), false);
  assert.equal(isValidTonTestnetFriendlyAddress(testnetBounceable.slice(0, -1) + 'A'), false);
  assert.equal(isValidTonTestnetFriendlyAddress('kQ' + 'A'.repeat(46)), false);
});

test('normalizes raw address with test-only flag', () => {
  let received;
  const converted = normalizeTonTestnetAddress(rawAddress, (raw, testOnly) => {
    received = { raw, testOnly };
    return testnetBounceable;
  });
  assert.equal(converted, testnetBounceable);
  assert.deepEqual(received, { raw: rawAddress, testOnly: true });
});

test('accepts valid testnet-friendly address and refuses mainnet address', () => {
  assert.equal(normalizeTonTestnetAddress(testnetBounceable), testnetBounceable);
  assert.throws(() => normalizeTonTestnetAddress(mainnetAddress), /TON Mainnet/);
  assert.throws(() => normalizeTonTestnetAddress('not-an-address'), /корректный тестовый адрес/);
});

test('parses TON amount as integer nanograms, without floating-point conversion', () => {
  assert.equal(parseTonNanoAmount('0.1'), 100000000n);
  assert.equal(parseTonNanoAmount('0.000000001'), 1n);
  assert.equal(parseTonNanoAmount('100'), TON_TESTNET_MAX_NANO);
  assert.equal(parseTonNanoAmount('0,25'), 250000000n);
});

test('rejects zero, negative, exponent, excess precision and over-limit amounts', () => {
  for (const value of ['0', '-1', '1e3', '.1', '01', '1.0000000001', '100.000000001', '101']) {
    assert.throws(() => parseTonNanoAmount(value), undefined, value);
  }
});
