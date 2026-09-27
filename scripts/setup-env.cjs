// Creates server/.env from server/.env.example on first install so a fresh
// clone works with `npm install && npm run seed && npm run dev`.
const fs = require('fs');
const path = require('path');

const example = path.join(__dirname, '..', 'server', '.env.example');
const target = path.join(__dirname, '..', 'server', '.env');

if (!fs.existsSync(target) && fs.existsSync(example)) {
  fs.copyFileSync(example, target);
  console.log('[relay] Created server/.env from server/.env.example');
}
