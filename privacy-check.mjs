import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_FILES = [
  '_headers',
  'HOMEL0ME-NETWORK.md',
  'assets/homelome-topology.svg',
  'explore.html',
  'explorer-data.json',
  'explorer.css',
  'explorer.js',
  'homelome-topology.svg',
  'homelome.html',
  'index.html'
];

const APPROVED_CONTACT = 'aortizco@outlook.com';
const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PRIVATE_PATTERNS = [
  ['private hostname', /\b(?:homelome\.webalome\.link|lunalome-home\.pages\.dev)\b/i],
  ['private address', /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?:\/\d{1,2})?\b/i],
  ['private filesystem path', /(?:[A-Z]:\\(?:Users|ProgramData|opt|mnt|data)\\|\/(?:opt|mnt|data|etc|home|root)\/)[^\s"'<>`]*/i],
  ['local hostname', /\b[a-z0-9.-]+\.(?:local|lan|internal)\b/i],
  ['private key material', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/i],
  ['API token', /\bPVEAPIToken\s*=\s*[^\s<]+/i],
  ['bearer credential', /\bBearer\s+[A-Za-z0-9._-]{20,}/i],
  ['credential field', /"(?:password|secret|api_key|access_token)"\s*:\s*"[^"\s]{8,}"/i],
  ['source map reference', /(?:\/\/[#@]\s*sourceMappingURL=|\/\*#\s*sourceMappingURL=)[^\s*]+/i]
];

function listFiles(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    const fullPath = path.join(root, relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symbolic links are not allowed.');
    if (entry.isDirectory()) return listFiles(root, name);
    if (!entry.isFile()) throw new Error('Unsupported output entry.');
    return [name];
  });
}

export function inspect(files) {
  const findings = [];
  for (const [file, value] of Object.entries(files)) {
    if (!ALLOWED_FILES.includes(file)) {
      findings.push({ file, rule: 'not in deployment allowlist' });
      continue;
    }
    const content = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
    if (!content.trim()) findings.push({ file, rule: 'empty file' });
    for (const email of content.matchAll(EMAIL)) {
      if (file !== 'index.html' || email[0].toLowerCase() !== APPROVED_CONTACT) {
        findings.push({ file, rule: 'unapproved email address' });
      }
    }
    for (const [rule, pattern] of PRIVATE_PATTERNS) {
      if (pattern.test(content)) findings.push({ file, rule });
    }
  }
  for (const file of ALLOWED_FILES) {
    if (!Object.hasOwn(files, file)) findings.push({ file, rule: 'missing from deployment' });
  }
  return findings;
}

function readFiles(root) {
  return Object.fromEntries(listFiles(root).map(file => [file, fs.readFileSync(path.join(root, ...file.split('/')))]));
}

export function validate(root) {
  const actual = listFiles(root).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...ALLOWED_FILES].sort())) {
    throw new Error('Output file set differs from deployment allowlist.');
  }
  const files = readFiles(root);
  const index = files['index.html'].toString('utf8');
  const approvedOccurrences = [...index.matchAll(EMAIL)].filter(match => match[0].toLowerCase() === APPROVED_CONTACT);
  if (approvedOccurrences.length !== 1) throw new Error('Expected exactly one approved public contact in index.html.');
  const findings = inspect(files);
  if (findings.length) throw new Error(`Privacy validation failed: ${findings.map(item => `${item.file}: ${item.rule}`).join('; ')}`);
}

function runNegativeTests(root) {
  const baseline = Object.fromEntries(Object.entries(readFiles(root)).map(([file, data]) => [file, data.toString('utf8')]));
  const expectFailure = (file, injection) => {
    const fixture = { ...baseline, [file]: `${baseline[file]}${injection}` };
    if (!inspect(fixture).length) throw new Error('A privacy regression fixture was not rejected.');
  };
  expectFailure('homelome.html', ' recipient@example.invalid');
  expectFailure('homelome.html', ` ${APPROVED_CONTACT}`);
  expectFailure('explorer-data.json', ' 192.168.10.20');
  expectFailure('assets/homelome-topology.svg', '<metadata>/mnt/private/archive</metadata>');
  expectFailure('explorer.js', ' PVEAPIToken=fixture-secret');
  expectFailure('explorer.css', ' /*# sourceMappingURL=private.css.map */');
  expectFailure('search-index.json', '{}');
  console.log('PASS privacy regression tests: unapproved contacts, private patterns, and unlisted assets rejected.');
}

const root = path.dirname(fileURLToPath(import.meta.url));
const artifactArgument = process.argv.slice(2).find(argument => !argument.startsWith('--')) || 'dist';
const artifact = path.resolve(root, artifactArgument);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validate(artifact);
  if (process.argv.includes('--self-test')) runNegativeTests(artifact);
  else console.log(`PASS privacy scan: ${ALLOWED_FILES.length} allowlisted files; no findings.`);
}
