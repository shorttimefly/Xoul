const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');

assert.match(html, /id="deleteProduct"/);
assert.match(html, /id="deleteProduct"[^>]*>删除产品</);
assert.match(source, /function deleteCurrentProduct\(\)/);
assert.match(source, /至少保留一个产品/);
assert.match(source, /syncBackend\(products\)/);
assert.match(source, /已删除产品/);
console.log('PASS: product editor exposes a protected delete action and syncs the reduced list');
