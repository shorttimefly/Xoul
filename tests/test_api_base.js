const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'api-base.js'), 'utf8');

function resolve(protocol, origin, override) {
  const window = { location: { protocol, origin } };
  if (override !== undefined) window.XOUL_API_BASE = override;
  vm.runInNewContext(source, { window });
  return window.XoulApiBase();
}

assert.equal(resolve('https:', 'https://xoul.teamaihub.com'), 'https://xoul.teamaihub.com');
assert.equal(resolve('http:', 'http://127.0.0.1:8765'), 'http://127.0.0.1:8765');
assert.equal(resolve('file:', '', undefined), 'http://127.0.0.1:8780');
assert.equal(resolve('https:', 'https://xoul.teamaihub.com', 'https://gateway.example'), 'https://gateway.example');
console.log('PASS: API base resolves same-origin, local file fallback, and explicit override');
