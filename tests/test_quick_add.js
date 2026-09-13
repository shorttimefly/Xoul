const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');

assert.match(html, /id="quickAddTrigger"/);
assert.match(html, /id="quickAddUpload"[^>]*type="file"/);
assert.match(html, /id="quickAddCamera"[^>]*type="file"[^>]+capture="environment"/);
assert.match(html, /最大 5MB/);
assert.match(html, /id="quickAddForm"/);
assert.match(source, /quickAddImageData/);
assert.match(source, /5\*1024\*1024/);
assert.match(source, /image\/webp/);
assert.match(source, /quality/);
assert.match(source, /api\/v1\/admin\/products\/'.*type-assignment/);
assert.match(source, /product_prompt/);
assert.match(source, /quickAddUrl/);
console.log('PASS: quick add creates an image-backed Agent and polls prompt/type assignment status');
