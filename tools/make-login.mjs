// Make a new login. Usage:  node tools/make-login.mjs "MY_ID" "My#Password"
// Copy the printed text into src/auth/creds.js (replace the whole file), then rebuild.
// The password itself is never stored. Only a salted hash is.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
const [id, pw] = process.argv.slice(2);
if (!id || !pw) { console.error('Usage: node tools/make-login.mjs "ID" "PASSWORD"'); process.exit(1); }
const ITER = 150000;
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(`${id.trim().toLowerCase()}\n${pw}`, Buffer.from(salt, 'hex'), ITER, 32, 'sha256').toString('hex');
console.log(`// Login check values (salted hash only, no plain text). Made by tools/make-login.mjs\nexport const ITER = ${ITER};\nexport const SALT = '${salt}';\nexport const HASH = '${hash}';`);
