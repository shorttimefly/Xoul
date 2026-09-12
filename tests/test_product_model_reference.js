const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'admin.html'), 'utf8');
assert.match(html, /id="modelProfile"/);
assert.match(html, /公共模型库/);
assert.doesNotMatch(html, /id="modelApiKey"/);
assert.doesNotMatch(html, /id="modelBaseUrl"/);
console.log('PASS: product editor references shared model profile without connection fields');
