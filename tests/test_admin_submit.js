const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.existsSync(path.join(__dirname, '..', 'admin.js')) ? path.join(__dirname, '..') : __dirname;
const source = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
assert.match(source, /if\(!response\.ok\)throw new Error\('HTTP '\+response\.status\)/);
assert.match(source, /服务器保存失败，本地修改已保存，请重试/);
console.log('PASS: admin submit surfaces server sync failures instead of hiding them');
