const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.existsSync(path.join(__dirname, '..', 'admin.js')) ? path.join(__dirname, '..') : __dirname;
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
assert.match(source, /function syncBackend\(products\)\{return fetch\(/);
assert.match(source, /syncBackend\(products\)\.then\(\(\)=>\{refreshImageUnderstanding\(\);return true;\}\)/);
assert.match(source, /明显文字.*result\.visible_text/);
assert.match(source, /result\.brand/);
console.log('PASS: saving a product refreshes asynchronous image understanding');
