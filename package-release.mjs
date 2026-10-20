import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_FILES, validate } from './privacy-check.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));

function filesUnder(directory, relative = '') {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symbolic links are not allowed in the package.');
    if (entry.isDirectory()) return filesUnder(fullPath, name);
    if (!entry.isFile()) throw new Error('Unsupported package entry.');
    return [name];
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!Array.isArray(manifest.files) || JSON.stringify([...manifest.files].sort()) !== JSON.stringify([...ALLOWED_FILES].sort())) {
  throw new Error('Manifest file list differs from the fixed deployment allowlist.');
}
if (!manifest.sha256 || JSON.stringify(Object.keys(manifest.sha256).sort()) !== JSON.stringify([...ALLOWED_FILES].sort())) {
  throw new Error('Manifest hashes do not exactly cover the deployment allowlist.');
}

const existing = filesUnder(output);
if (existing.some(file => !ALLOWED_FILES.includes(file))) throw new Error('Unexpected file exists in dist/.');

for (const file of ALLOWED_FILES) {
  const source = path.join(root, ...file.split('/'));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error('An allowlisted source file is missing.');
  if (sha256(source) !== manifest.sha256[file]) throw new Error('Source content differs from the reviewed manifest.');
  const destination = path.join(output, ...file.split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

if (JSON.stringify(filesUnder(output).sort()) !== JSON.stringify([...ALLOWED_FILES].sort())) {
  throw new Error('Packaged file set differs from the deployment allowlist.');
}
for (const file of ALLOWED_FILES) {
  if (sha256(path.join(output, ...file.split('/'))) !== manifest.sha256[file]) {
    throw new Error('Packaged content differs from the reviewed manifest.');
  }
}
validate(output);

console.log(`Built and privacy-checked ${ALLOWED_FILES.length} manifest-pinned public files in dist/.`);
