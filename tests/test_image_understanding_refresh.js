const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
assert.match(source, /function syncBackend\(products\)\{return fetch\(/);
assert.match(source, /syncBackend\(products\)\.then\(\(\)=>refreshImageUnderstanding\(\)\)/);
console.log('PASS: saving a product refreshes asynchronous image understanding');
