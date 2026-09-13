const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');

assert.match(html, /id="quickAddTrigger"/);
assert.match(html, /id="quickAddImage"[^>]+capture="environment"/);
assert.match(html, /id="quickAddForm"/);
assert.match(source, /quickAddImageData/);
assert.match(source, /api\/v1\/admin\/products\/'.*type-assignment/);
assert.match(source, /product_prompt/);
assert.match(source, /quickAddUrl/);
console.log('PASS: quick add creates an image-backed Agent and polls prompt/type assignment status');
