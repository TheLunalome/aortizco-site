// The gate for automatic changes (dispatch step 2, S5). `npm run build` runs it before the packaging, so a failing gate is a failing "Cloudflare Pages"
// check, and that check is required on main.
//
// What it enforces, on top of the existing build gate (manifest hashes, deployment file list, privacy scan; those stay in package-release.mjs):
//   1. HASHES   every file that is not a content file is pinned in protected-manifest.json; a changed, removed or unlisted file fails the build.
//   2. PATHS    a change against main may only EDIT (never add, delete, rename or change the mode of) the content pages and release-manifest.json.
//   3. MANIFEST release-manifest.json may only change the sha256 value of a content page; its file list and every other key stay as they are.
//   4. SCAN     the lines a change ADDS may not hold script, an event handler, an iframe or similar, a script sink, a base64 blob, or a load from
//               another host that the file did not already use.
//   5. CAPS     at most 4 files, 400 changed lines, 3000 characters in an added line, a size cap per file and for the whole site.
// Fail closed: if the comparison with main cannot be made, the build fails.
//
// Honest limit: the gate runs from the checkout under test, so a change that also rewrites this file is stopped only by rules 1 and 2 (which this
// same file evaluates). Its real protection is that a human reads every change to a protected file; see README.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CONTENT_PATHS = Object.freeze(['index.html', 'homelome.html', 'explore.html']);
export const MANIFEST_PATH = 'release-manifest.json';
export const PROTECTED_PATH = 'protected-manifest.json';
export const EDITABLE = Object.freeze([...CONTENT_PATHS, MANIFEST_PATH]);
export const CAPS = Object.freeze({ files: 4, changedLines: 400, lineLength: 3000, fileBytes: 150_000, siteBytes: 600_000 });

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
// `npm install` in the Cloudflare build writes this file into the working tree (the package has no dependencies). It is not part of the change, so the
// hash and size checks skip it; a change that COMMITS it is still refused by the path rule.
const GENERATED = new Set(['package-lock.json']);

// ---------- pure rules (no git, no disk) ----------
const DECODE = (t) => t.replace(/&#x([0-9a-f]{1,6});?/gi, (_m, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff))).replace(/&#([0-9]{1,7});?/g, (_m, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)));
const STRIP = /[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;
const HOST = /(?:https?:)?\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])(?=[:/?#"'\s)>]|$)/gi;

export function hostsIn(text) {
  const out = new Set();
  const t = DECODE(String(text ?? ''));
  for (const m of t.matchAll(HOST)) out.add(m[1].toLowerCase());
  return out;
}

// Returns a list of rule names (never the offending text). `baseText` is the file as it is on main (hosts it already uses are allowed).
export function scanAdded(added, baseText = '') {
  const t = DECODE(String(added ?? ''));
  const compact = t.replace(STRIP, '').toLowerCase();
  const found = new Set();
  if (/<\/?script/.test(compact)) found.add('script');
  if (/(?:javascript|vbscript|livescript):/.test(compact)) found.add('script address');
  if (/<\/?(?:iframe|frame|frameset|object|embed|applet|base|form)/.test(compact)) found.add('iframe or embedded content');
  if (/<meta[^>]*http-equiv/.test(compact)) found.add('meta refresh');
  if (/srcdoc=|@import|expression\(|-moz-binding|behavior:/.test(compact)) found.add('code in markup or css');
  if (/data:(?:[a-z0-9.+-]+\/[a-z0-9.+-]+|;|,)/.test(compact)) found.add('data address');
  if (/(?:^|[\s"'\/])on[a-z]{2,25}\s*=/i.test(t)) found.add('event handler');
  if (/\b(?:src|srcset|poster|data|formaction|action)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(t)) found.add('load from another host');
  if (/\beval\s*\(|new\s+Function\b|document\s*\.\s*(?:write|cookie)|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\bimport\s*\(|importScripts|\.\s*(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML|\blocation\s*(?:\.\s*(?:href|assign|replace)\s*)?=(?!=)|window\s*\.\s*open\s*\(/.test(t)) found.add('script sink');
  if (/[A-Za-z0-9+/]{120,}={0,2}/.test(t.replace(/\s/g, ' '))) found.add('base64 blob');
  const known = hostsIn(baseText);
  for (const h of hostsIn(t)) if (!known.has(h)) { found.add('link to a new host'); break; }
  return [...found];
}

// entries: [{ path, status, oldMode, newMode }]
export function checkPaths(entries) {
  const bad = [];
  if (entries.length > CAPS.files) bad.push(`too many files changed (${entries.length}, at most ${CAPS.files})`);
  for (const e of entries) {
    if (!EDITABLE.includes(e.path)) bad.push(`path not allowed: ${e.path}`);
    else if (e.status !== 'M') bad.push(`only an edit is allowed (not ${e.status}): ${e.path}`);
    else if (e.oldMode !== '100644' || e.newMode !== '100644') bad.push(`file mode or type changed: ${e.path}`);
  }
  return bad;
}

const HEX64 = /^[0-9a-f]{64}$/;
export function checkManifestEdit(baseJson, headJson) {
  let a;
  let b;
  try { a = JSON.parse(baseJson); b = JSON.parse(headJson); } catch { return ['release-manifest.json is not valid JSON']; }
  const bad = [];
  if (JSON.stringify(a.files) !== JSON.stringify(b.files)) bad.push('release-manifest.json: the file list changed');
  if (Object.keys(a).sort().join() !== Object.keys(b).sort().join()) bad.push('release-manifest.json: its keys changed');
  const ka = Object.keys(a.sha256 || {}).sort().join();
  const kb = Object.keys(b.sha256 || {}).sort().join();
  if (ka !== kb) bad.push('release-manifest.json: the set of pinned files changed');
  else {
    for (const k of Object.keys(b.sha256)) {
      if (!HEX64.test(String(b.sha256[k]))) bad.push(`release-manifest.json: not a sha256 value for ${k}`);
      else if (a.sha256[k] !== b.sha256[k] && !CONTENT_PATHS.includes(k)) bad.push(`release-manifest.json: the pin of a protected file changed: ${k}`);
    }
  }
  return bad;
}

// `patch` is the output of `git diff -U0` for ONE file. Lines before the first hunk header (the --- and +++ lines) are not content, and a content
// line that itself starts with "++" is still an added line.
export function addedLines(patch) {
  const added = [];
  const removed = new Map();
  let inHunk = false;
  for (const l of String(patch ?? '').split('\n')) {
    if (l.startsWith('@@')) { inHunk = true; continue; }
    if (!inHunk) continue;
    if (l.startsWith('+')) added.push(l.slice(1));
    else if (l.startsWith('-')) { const k = l.slice(1).trimEnd(); removed.set(k, (removed.get(k) || 0) + 1); }
  }
  // A line that only changed its line ending (for example the last line of a file with no final newline) is removed and added again with the same
  // text: it was already there, so it is not new content. Anything else that is added stays.
  return added.filter((a) => {
    const k = a.trimEnd();
    const n = removed.get(k) || 0;
    if (n > 0) { removed.set(k, n - 1); return false; }
    return true;
  });
}

export function sha256Lf(buf) {
  const lf = Buffer.from(buf.toString('latin1').replace(/\r\n?/g, '\n'), 'latin1');
  return crypto.createHash('sha256').update(lf).digest('hex');
}

// ---------- disk ----------
export function listSite(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic link not allowed: ${name}`);
    if (relative === '' && entry.isFile() && GENERATED.has(entry.name)) return [];
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) && relative === '' ? [] : listSite(root, name);
    if (!entry.isFile()) throw new Error(`unsupported entry: ${name}`);
    return [name];
  });
}

export function checkHashes(root) {
  const bad = [];
  let pinned;
  try { pinned = JSON.parse(fs.readFileSync(path.join(root, PROTECTED_PATH), 'utf8')); } catch { return [`${PROTECTED_PATH} is missing or not valid JSON`]; }
  const map = pinned && typeof pinned.files === 'object' && pinned.files ? pinned.files : null;
  if (!map) return [`${PROTECTED_PATH} has no files table`];
  const files = listSite(root);
  const open = new Set([...EDITABLE, PROTECTED_PATH]);
  for (const f of files) {
    if (open.has(f)) continue;
    if (!Object.hasOwn(map, f)) bad.push(`file not pinned: ${f}`);
    else if (sha256Lf(fs.readFileSync(path.join(root, ...f.split('/')))) !== map[f]) bad.push(`protected file changed: ${f}`);
  }
  for (const k of Object.keys(map)) if (!files.includes(k)) bad.push(`protected file removed: ${k}`);
  for (const k of EDITABLE) if (!files.includes(k)) bad.push(`required file removed: ${k}`);
  return bad;
}

export function checkSizes(root) {
  const bad = [];
  let total = 0;
  for (const f of listSite(root)) {
    const size = fs.statSync(path.join(root, ...f.split('/'))).size;
    total += size;
    if (size > CAPS.fileBytes) bad.push(`file too big: ${f} (${size} bytes, at most ${CAPS.fileBytes})`);
  }
  if (total > CAPS.siteBytes) bad.push(`site too big (${total} bytes, at most ${CAPS.siteBytes})`);
  return bad;
}

// ---------- git ----------
function git(root, args, opts = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', '-c', 'core.pager=cat', ...args], { cwd: root, encoding: opts.buffer ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EXTERNAL_DIFF: '', GIT_PAGER: 'cat' } });
  return { ok: r.status === 0, out: r.stdout, err: String(r.stderr ?? '') };
}

export function parseRaw(raw) {
  const parts = String(raw).split('\0');
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const m = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/.exec(parts[i]);
    if (!m) return null;
    out.push({ oldMode: m[1], newMode: m[2], status: m[3], path: parts[i + 1] });
  }
  return out;
}

// The change between `base` and `head` (commits). Returns a list of problems.
export function checkChange(root, base, head) {
  const raw = git(root, ['diff', '--raw', '--no-renames', '--no-ext-diff', '--no-textconv', '-z', base, head]);
  if (!raw.ok) return ['could not read the change against main'];
  const entries = parseRaw(raw.out);
  if (!entries) return ['could not read the change against main (unexpected diff output)'];
  const bad = checkPaths(entries);
  if (bad.length) return bad;
  const num = git(root, ['diff', '--numstat', '--no-renames', '--no-ext-diff', base, head]);
  if (!num.ok) return ['could not count the changed lines'];
  let lines = 0;
  for (const l of num.out.split('\n').filter(Boolean)) {
    const [a, d] = l.split('\t');
    if (a === '-' || d === '-') bad.push('a binary file changed');
    else lines += Number(a) + Number(d);
  }
  if (lines > CAPS.changedLines) bad.push(`too many changed lines (${lines}, at most ${CAPS.changedLines})`);
  for (const e of entries) {
    const p = e.path;
    if (p === MANIFEST_PATH) {
      const a = git(root, ['show', `${base}:${p}`]);
      const b = git(root, ['show', `${head}:${p}`]);
      if (!a.ok || !b.ok) bad.push('could not read release-manifest.json on both sides');
      else bad.push(...checkManifestEdit(a.out, b.out));
      continue;
    }
    const patch = git(root, ['diff', '-U0', '--no-renames', '--no-ext-diff', '--no-textconv', base, head, '--', p]);
    const baseText = git(root, ['show', `${base}:${p}`]);
    if (!patch.ok || !baseText.ok) { bad.push(`could not read the change in ${p}`); continue; }
    const added = addedLines(patch.out);
    for (const rule of scanAdded(added.join('\n'), baseText.out)) bad.push(`${p}: added text has ${rule}`);
    if (added.some((l) => l.length > CAPS.lineLength)) bad.push(`${p}: an added line is longer than ${CAPS.lineLength} characters`);
  }
  return bad;
}

// Make `origin/main` available (a Cloudflare build clone may be shallow and may not have it). Returns the merge base commit or null.
const PUBLIC_REPO = 'https://github.com/TheLunalome/aortizco-site.git';
const redact = (t) => String(t).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>').replace(/\s+/g, ' ').trim().slice(0, 240);

// Make main available as refs/remotes/origin/main (a Cloudflare build clone may be shallow and may not have it). Tries the clone's own remote,
// then the public repository address (it is public, so no credential is needed). Returns { sha, mainTip } or { error } with a redacted reason.
export function mainBase(root) {
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']).out.trim() === 'true';
  const spec = '+refs/heads/main:refs/remotes/origin/main';
  const tried = [];
  for (const remote of ['origin', PUBLIC_REPO]) {
    if (shallow) git(root, ['fetch', '--no-tags', '--unshallow', remote]);
    const f = git(root, ['fetch', '--no-tags', remote, spec]);
    if (f.ok) {
      const mb = git(root, ['merge-base', 'refs/remotes/origin/main', 'HEAD']);
      if (mb.ok && /^[0-9a-f]{40}$/.test(mb.out.trim())) return { sha: mb.out.trim(), mainTip: git(root, ['rev-parse', 'refs/remotes/origin/main']).out.trim() };
      tried.push(`merge-base failed after fetching from ${remote === 'origin' ? 'origin' : 'the public address'} (shallow=${shallow}): ${redact(mb.err)}`);
    } else tried.push(`fetch from ${remote === 'origin' ? 'origin' : 'the public address'} failed (shallow=${shallow}): ${redact(f.err)}`);
  }
  return { error: `could not fetch main to compare with; ${tried.join('; ')}` };
}

export function runGate(root, env = process.env) {
  const problems = [];
  const notes = [];
  problems.push(...checkHashes(root), ...checkSizes(root));
  const branch = env.CF_PAGES_BRANCH || git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
  const head = git(root, ['rev-parse', 'HEAD']).out.trim();
  if (branch === 'main') {
    notes.push('main build: the change was checked when it was a pull request; hashes and sizes checked now');
  } else {
    const mb = mainBase(root);
    if (mb.error) problems.push(mb.error);
    else if (!git(root, ['cat-file', '-e', `${mb.sha}:${PROTECTED_PATH}`]).ok) {
      notes.push('BOOTSTRAP: main has no protected-manifest.json yet, so this one change that introduces the gate is not compared with main; hashes and sizes are checked');
    } else if (head === mb.mainTip) {
      notes.push('this commit is main itself: nothing to compare');
    } else {
      problems.push(...checkChange(root, mb.sha, head));
    }
  }
  return { problems, notes };
}

const here = path.dirname(fileURLToPath(import.meta.url));
// `node site-gate.mjs --pin` rewrites protected-manifest.json for the files as they are now (a human step, for a reviewed change to a protected file).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--pin')) {
  const open = new Set([...EDITABLE, PROTECTED_PATH]);
  const files = Object.fromEntries(listSite(here).filter((f) => !open.has(f)).sort().map((f) => [f, sha256Lf(fs.readFileSync(path.join(here, ...f.split('/'))))]));
  fs.writeFileSync(path.join(here, PROTECTED_PATH), `${JSON.stringify({ files }, null, 2)}
`);
  console.log(`pinned ${Object.keys(files).length} protected files in ${PROTECTED_PATH}`);
  process.exit(0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems, notes } = runGate(here);
  for (const n of notes) console.log(`gate: ${n}`);
  if (problems.length) {
    for (const p of problems) console.error(`gate FAIL: ${p}`);
    process.exit(1);
  }
  console.log('gate: PASS (protected files unchanged, paths and added text allowed, sizes within caps)');
}
