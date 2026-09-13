const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicSource = fs.readFileSync(path.join(root, 'public.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public.html'), 'utf8');
const profilePage = fs.readFileSync(path.join(root, 'profiles.html'), 'utf8');
assert.match(publicSource, /\/api\/v1\/public\/user-profiles/);
assert.match(publicSource, /profile_id:activeProfile\.id/);
assert.match(publicSource, /xoul:chat:v3:/);
assert.match(html, /profile-toggle/);
assert.match(html, /user-profile-data\.js/);
assert.match(profilePage, /用户画像/);
assert.match(profilePage, /profileForm/);
console.log('PASS: C-end profile switcher, per-profile chat history, and admin profile page are wired');
