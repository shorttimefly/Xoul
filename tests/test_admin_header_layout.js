const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'admin.css'), 'utf8');

assert.match(
  css,
  /\.top-actions\{[^}]*white-space:\s*nowrap/,
  'admin header actions should keep each entry label on one line',
);
assert.match(
  css,
  /\.top-actions>\.ghost\{[^}]*flex-shrink:\s*0/,
  'admin header entry buttons should not shrink into wrapped labels',
);

console.log('PASS: admin header entry buttons stay readable without wrapping');
