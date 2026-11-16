const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('local control API binds to loopback only', () => {
  assert.match(source, /controlServer\.listen\(CONTROL_PORT,\s*['"]127\.0\.0\.1['"]/);
});

test('local control API requires bearer token and bounds request body', () => {
  assert.match(source, /req\.headers\.authorization\s*!==\s*'Bearer '\s*\+\s*controlToken/);
  assert.match(source, /size\s*>\s*16384/);
});

test('generic browser control fails closed on all form submissions', () => {
  assert.match(source, /if\s*\(isSubmitAction\s*\|\|\s*isPublishing\)\s*return\s*\{ok:false,error:'Form submission is blocked/);
  assert.doesNotMatch(source, /browser\.avito-publish/);
  assert.match(source, /Boolean\(el\.closest\('form'\)\)/);
  assert.doesNotMatch(source, /if\s*\(isAvito\s*&&\s*\(isSubmitAction\s*\|\|\s*isPublishing\)\)/);
});

test('consequential non-submit clicks require a native one-time confirmation', () => {
  assert.match(source, /requiresConfirmation/);
  assert.match(source, /dialog\.showMessageBox\(win/);
  assert.match(source, /'Разрешить один раз'/);
  assert.match(source, /'Действие отменено пользователем\.'/);
});

test('Core pairing token is stored through OS secure storage', () => {
  assert.match(source, /safeStorage\.encryptString\(data\.deviceToken\)/);
  assert.match(source, /\/functions\/v1\/qun-agent-core\/pult\/pair/);
  assert.match(source, /\/functions\/v1\/qun-agent-core\/pult\/heartbeat/);
});
