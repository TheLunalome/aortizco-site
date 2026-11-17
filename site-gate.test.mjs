// Tests for site-gate.mjs. Run: node site-gate.test.mjs  (npm test runs it). Rules first, then real git repositories in a temporary folder
// (a bare "origin" and a clone), so the path, manifest, scan and cap rules are exercised the way the build runs them. No network.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPS, CONTENT_PATHS, EDITABLE, PROTECTED_PATH, addedLines, checkManifestEdit, checkPaths, listSite, runGate, scanAdded, sha256Lf } from './site-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass++;
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
};

// ---------- the scan: attacks that must be caught, ordinary additions that must pass ----------
const attacks = {
  'script tag': '<script>alert(1)</script>',
  'script upper case': '<SCRIPT SRC=x>',
  'script split by a tab': '<scr\tipt>',
  'closing script': '</script>',
  'javascript address': '<a href="javascript:void(0)">x</a>',
  'javascript with a character reference': '<a href="&#106;avascript:x">x</a>',
  'javascript with a hex reference': '<a href="&#x6A;avascript:x">x</a>',
  'javascript split by a newline': '<a href="java\nscript:x">x</a>',
  'event handler': '<img src="a.png" onerror="x()">',
  'event handler with spaces': '<body  onload = "x()">',
  'event handler after a slash': '<svg/onload=x>',
  'iframe': '<iframe src="x"></iframe>',
  'object': '<object data="x">',
  'embed': '<embed src="x">',
  'form': '<form action="x">',
  'base tag': '<base href="/x/">',
  'meta refresh': '<meta http-equiv="refresh" content="0;url=x">',
  'srcdoc': '<p srcdoc="x">',
  'css import': '<style>@import url(x);</style>',
  'css expression': '<p style="width:expression(x)">',
  'data address': '<img src="data:image/png;base64,AAAA">',
  'data html address': '<a href="data:text/html,x">x</a>',
  'image from another host': '<img src="https://example.invalid/a.png">',
  'protocol relative load': '<img src="//example.invalid/a.png">',
  'link to a new host': '<a href="https://example.invalid/page">x</a>',
  'eval': 'x = eval(y);',
  'new Function': 'x = new Function(y);',
  'document write': 'document.write(x);',
  'fetch': 'fetch(x);',
  'innerHTML assignment': 'el.innerHTML = x;',
  'location assignment': 'location = x;',
  'location href': 'location.href = x;',
  'cookie': 'x = document.cookie;',
  'base64 blob': `"${'QUJD'.repeat(40)}"`,
};
for (const [name, text] of Object.entries(attacks)) check(`scan catches: ${name}`, scanAdded(text, '').length > 0, JSON.stringify(scanAdded(text, '')));
const ordinary = {
  'a paragraph': '<p>Built a small lab with three virtual machines and a backup job.</p>',
  'a list item with a link to the same page': '<li><a href="#projects">Projects</a></li>',
  'a project card': '<article class="card"><h3>Lab notes</h3><p>Weekly backups, tested restore.</p></article>',
  'a data object in the page script': '  { title: "Backups", status: "done", tags: ["pbs", "zfs"] },',
  'a key named data': '  data: [1, 2, 3],',
  'prose with the word on': '<p>Working on a restore test = done.</p>',
  'a word that starts with on': '<p>the flag online = true is a name only in prose</p>',
  'an equation': '<p>2 + 2 == 4</p>',
};
for (const [name, text] of Object.entries(ordinary)) {
  const r = scanAdded(text, '');
  // the "online =" line is the one known strict case: an event-handler-shaped word is held, which is the safe side
  if (name === 'a word that starts with on') check(`scan: known strict case is held (safe side): ${name}`, r.length > 0);
  else check(`scan passes: ${name}`, r.length === 0, JSON.stringify(r));
}
check('scan: a host the file already uses is not a new host', scanAdded('<a href="https://www.example.invalid/x">x</a>', '<link href="https://www.example.invalid/y">').length === 0);
check('scan: a different host is a new host', scanAdded('<a href="https://other.example.invalid/x">x</a>', '<link href="https://www.example.invalid/y">').includes('link to a new host'));
check('scan: findings are rule names and never carry the offending text', JSON.stringify(scanAdded('<script>SECRETWORD</script>', '')).indexOf('SECRETWORD') === -1);

// ---------- added lines, including the "++" case ----------
const patch = ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -1,0 +2,2 @@', '+++ looks like a header', '+plain', '@@ -9 +10 @@', '-old', '+new'].join('\n');
check('added lines: a content line that starts with ++ is an added line, the +++ header is not', JSON.stringify(addedLines(patch)) === JSON.stringify(['++ looks like a header', 'plain', 'new']), JSON.stringify(addedLines(patch)));
check('added lines: a line re-added with only its line ending changed is not new content, a changed line is', JSON.stringify(addedLines('@@ -5 +5,2 @@\n-</x>\n+</x>\n+<new>\n')) === JSON.stringify(['<new>']));
check('added lines: a removed line that starts with -- is not an added line', addedLines('@@ -1 +1,0 @@\n--- gone\n').length === 0);

// ---------- paths ----------
const m = (p, status = 'M', om = '100644', nm = '100644') => ({ path: p, status, oldMode: om, newMode: nm });
check('paths: an edit of each content page and of the manifest passes', checkPaths(EDITABLE.map((p) => m(p))).length === 0);
for (const p of ['explorer.js', 'explorer.css', '_headers', 'package.json', 'package-release.mjs', 'privacy-check.mjs', 'site-gate.mjs', 'site-gate.test.mjs', 'protected-manifest.json', '.github/copilot-instructions.md', '.github/workflows/x.yml', 'functions/x.js', '_redirects', 'README.md', 'explorer-data.json', 'HOMEL0ME-NETWORK.md', 'new-page.html', 'a/../index.html']) {
  check(`paths: ${p} is refused`, checkPaths([m(p)]).length > 0);
}
check('paths: an added content file is refused', checkPaths([m('index.html', 'A', '000000', '100644')]).length > 0);
check('paths: a deleted content file is refused', checkPaths([m('index.html', 'D', '100644', '000000')]).length > 0);
check('paths: a mode change is refused', checkPaths([m('index.html', 'M', '100644', '100755')]).length > 0);
check('paths: a symlink is refused', checkPaths([m('index.html', 'M', '100644', '120000')]).length > 0);
check('paths: more than the file cap is refused', checkPaths(Array.from({ length: CAPS.files + 1 }, () => m('index.html'))).length > 0);

// ---------- the manifest edit ----------
const H = (c) => c.repeat(64);
const man = (over = {}) => JSON.stringify({ files: ['_headers', 'index.html'], sha256: { _headers: H('a'), 'index.html': H('b') }, ...over });
check('manifest: a new pin of a content page passes', checkManifestEdit(man(), man({ sha256: { _headers: H('a'), 'index.html': H('c') } })).length === 0);
check('manifest: a new pin of a protected file is refused', checkManifestEdit(man(), man({ sha256: { _headers: H('c'), 'index.html': H('b') } })).length > 0);
check('manifest: a changed file list is refused', checkManifestEdit(man(), man({ files: ['index.html'] })).length > 0);
check('manifest: a new pinned file is refused', checkManifestEdit(man(), man({ sha256: { _headers: H('a'), 'index.html': H('b'), 'x.js': H('d') } })).length > 0);
check('manifest: a value that is not a sha256 is refused', checkManifestEdit(man(), man({ sha256: { _headers: H('a'), 'index.html': 'zz' } })).length > 0);
check('manifest: an extra key is refused', checkManifestEdit(man(), man({ extra: 1 })).length > 0);
check('manifest: broken JSON is refused', checkManifestEdit(man(), '{ nope').length > 0);

// ---------- real git repositories ----------
const git = (cwd, args, input) => {
  const r = spawnSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', input });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-gate-'));
const copySite = (to) => {
  for (const f of listSite(here)) {
    if (f === PROTECTED_PATH) continue;
    fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
    fs.copyFileSync(path.join(here, ...f.split('/')), path.join(to, ...f.split('/')));
  }
};
const pin = (dir) => {
  const open = new Set([...EDITABLE, PROTECTED_PATH]);
  const files = Object.fromEntries(listSite(dir).filter((f) => !open.has(f)).sort().map((f) => [f, sha256Lf(fs.readFileSync(path.join(dir, ...f.split('/'))))]));
  fs.writeFileSync(path.join(dir, PROTECTED_PATH), JSON.stringify({ files }, null, 2));
};
const origin = path.join(tmp, 'origin.git');
git(tmp, ['init', '--bare', '-q', '-b', 'main', origin]);
const seed = path.join(tmp, 'seed');
git(tmp, ['clone', '-q', origin, seed]);
copySite(seed);
// a manifest-less main first (the bootstrap case), then a main that has the gate
git(seed, ['add', '-A']);
git(seed, ['commit', '-q', '-m', 'before the gate']);
git(seed, ['push', '-q', 'origin', 'HEAD:main']);
const bootstrapClone = path.join(tmp, 'bootstrap');
git(tmp, ['clone', '-q', origin, bootstrapClone]);
git(bootstrapClone, ['checkout', '-q', '-b', 'gate-intro']);
pin(bootstrapClone);
git(bootstrapClone, ['add', '-A']);
git(bootstrapClone, ['commit', '-q', '-m', 'the gate']);
let r = runGate(bootstrapClone, { CF_PAGES_BRANCH: 'gate-intro' });
check('bootstrap: while main has no protected manifest the introducing change passes and says so', r.problems.length === 0 && r.notes.some((n) => /BOOTSTRAP/.test(n)), JSON.stringify(r));
fs.appendFileSync(path.join(bootstrapClone, 'explorer.js'), '\n// changed\n');
git(bootstrapClone, ['commit', '-q', '-am', 'tamper']);
r = runGate(bootstrapClone, { CF_PAGES_BRANCH: 'gate-intro' });
check('bootstrap: even then a file that is not pinned the way it is on disk fails the hash check', r.problems.some((p) => /protected file changed: explorer\.js/.test(p)), JSON.stringify(r));

// main with the gate
pin(seed);
git(seed, ['add', '-A']);
git(seed, ['commit', '-q', '-m', 'the gate']);
git(seed, ['push', '-q', 'origin', 'HEAD:main']);
let n = 0;
const branchFrom = (mutate) => {
  const dir = path.join(tmp, `c${++n}`);
  git(tmp, ['clone', '-q', origin, dir]);
  git(dir, ['checkout', '-q', '-b', `work-${n}`]);
  mutate(dir);
  git(dir, ['add', '-A']);
  try { git(dir, ['commit', '-q', '-m', 'work']); } catch { /* an empty change */ }
  return dir;
};
const repin = (dir) => {
  const mf = JSON.parse(fs.readFileSync(path.join(dir, 'release-manifest.json'), 'utf8'));
  for (const f of CONTENT_PATHS) mf.sha256[f] = sha256Lf(fs.readFileSync(path.join(dir, f)));
  fs.writeFileSync(path.join(dir, 'release-manifest.json'), `${JSON.stringify(mf, null, 2)}\n`);
};
const edit = (dir, file, fn) => fs.writeFileSync(path.join(dir, file), fn(fs.readFileSync(path.join(dir, file), 'utf8')));
const run = (dir) => runGate(dir, { CF_PAGES_BRANCH: path.basename(dir) });
const ok = (name, mutate) => { const d = branchFrom(mutate); const x = run(d); check(`git: ${name}`, x.problems.length === 0, JSON.stringify(x)); };
const bad = (name, mutate, re) => { const d = branchFrom(mutate); const x = run(d); check(`git: ${name}`, x.problems.length > 0 && (!re || x.problems.some((p) => re.test(p))), JSON.stringify(x)); };
const addToIndex = (text) => (dir) => { edit(dir, 'index.html', (s) => `${s.trimEnd()}\n${text}\n`); repin(dir); };

ok('a paragraph added to a page, with its new pin, passes', addToIndex('<p>Backups restored in a test on 2026-11-16.</p>'));
ok('an edit of several content pages passes', (d) => { for (const f of CONTENT_PATHS) edit(d, f, (s) => `${s.trimEnd()}\n<p>note</p>\n`); repin(d); });
ok('an unchanged branch passes', () => {});
bad('a script tag is refused', addToIndex('<script>alert(1)</script>'), /script/);
bad('an event handler is refused', addToIndex('<img src="a.png" onerror="x()">'), /event handler/);
bad('an iframe is refused', addToIndex('<iframe src="x"></iframe>'), /iframe/);
bad('a load from another host is refused', addToIndex('<img src="https://example.invalid/a.png">'), /another host|new host/);
bad('a link to a new host is refused', addToIndex('<a href="https://example.invalid/p">x</a>'), /new host/);
bad('a base64 blob is refused', addToIndex(`<p>${'QUJD'.repeat(60)}</p>`), /base64/);
bad('a character-reference script address is refused', addToIndex('<a href="&#106;avascript:x">x</a>'), /script address/);
bad('a protected file edit is refused even with a fresh pin', (d) => { edit(d, 'explorer.js', (s) => `${s}\n// x\n`); pin(d); }, /path not allowed: explorer\.js/);
bad('an edit of the gate itself, with a fresh pin, is refused', (d) => { edit(d, 'site-gate.mjs', (s) => `${s}\n// x\n`); pin(d); }, /path not allowed: site-gate\.mjs/);
bad('an edit of the protected manifest is refused', (d) => { edit(d, PROTECTED_PATH, (s) => s.replace('"files"', '"files" ')); }, /path not allowed: protected-manifest/);
bad('a file under .github is refused', (d) => { fs.mkdirSync(path.join(d, '.github', 'workflows'), { recursive: true }); fs.writeFileSync(path.join(d, '.github', 'workflows', 'x.yml'), 'on: push\n'); }, /path not allowed/);
bad('a new file is refused', (d) => fs.writeFileSync(path.join(d, 'extra.html'), '<p>x</p>'), /path not allowed: extra\.html/);
bad('a deleted content page is refused', (d) => fs.rmSync(path.join(d, 'homelome.html')), /only an edit|required file removed/);
bad('a mode change is refused', (d) => git(d, ['update-index', '--chmod=+x', 'index.html']) && undefined, /mode/);
bad('a changed file list in the manifest is refused', (d) => { const mf = JSON.parse(fs.readFileSync(path.join(d, 'release-manifest.json'), 'utf8')); mf.files.push('x.js'); fs.writeFileSync(path.join(d, 'release-manifest.json'), JSON.stringify(mf, null, 2)); }, /file list/);
bad('a changed pin of a protected file in the manifest is refused', (d) => { const mf = JSON.parse(fs.readFileSync(path.join(d, 'release-manifest.json'), 'utf8')); mf.sha256['explorer.js'] = 'f'.repeat(64); fs.writeFileSync(path.join(d, 'release-manifest.json'), JSON.stringify(mf, null, 2)); }, /protected file changed/);
bad('too many changed lines is refused', addToIndex(Array.from({ length: CAPS.changedLines + 5 }, (_, i) => `<p>line ${i}</p>`).join('\n')), /too many changed lines/);
bad('a very long added line is refused', addToIndex(`<p>${'word '.repeat(700)}</p>`), /longer than/);
bad('a file over the size cap is refused', (d) => { edit(d, 'index.html', (s) => `${s}\n<p>${'x '.repeat(CAPS.fileBytes)}</p>`); repin(d); }, /too big|longer than/);

// no way to compare with main: fail closed
const lone = path.join(tmp, 'lone');
fs.mkdirSync(lone);
copySite(lone);
pin(lone);
git(lone, ['init', '-q', '-b', 'topic']);
git(lone, ['add', '-A']);
git(lone, ['commit', '-q', '-m', 'x']);
r = runGate(lone, { CF_PAGES_BRANCH: 'topic' });
check('fail closed: without a way to reach main the build fails', r.problems.some((p) => /could not fetch main/.test(p)), JSON.stringify(r));
// main builds check hashes and sizes only
const mainClone = path.join(tmp, 'mainclone');
git(tmp, ['clone', '-q', origin, mainClone]);
r = runGate(mainClone, { CF_PAGES_BRANCH: 'main' });
check('main build: passes on an untouched main and does not need the network', r.problems.length === 0 && r.notes.some((x) => /main build/.test(x)), JSON.stringify(r));
fs.appendFileSync(path.join(mainClone, 'explorer.js'), '\n// tampered\n');
r = runGate(mainClone, { CF_PAGES_BRANCH: 'main' });
check('main build: a tampered protected file fails on its hash', r.problems.some((p) => /protected file changed: explorer\.js/.test(p)), JSON.stringify(r));
fs.writeFileSync(path.join(mainClone, 'explorer.js'), fs.readFileSync(path.join(here, 'explorer.js')));
fs.writeFileSync(path.join(mainClone, 'new-script.js'), 'x');
r = runGate(mainClone, { CF_PAGES_BRANCH: 'main' });
check('main build: an unpinned new file fails', r.problems.some((p) => /file not pinned: new-script\.js/.test(p)), JSON.stringify(r));

// the site as it is in this checkout must pass its own hash and size rules
r = runGate(here, { CF_PAGES_BRANCH: 'main' });
check('this checkout: hashes and sizes pass', r.problems.length === 0, JSON.stringify(r));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`passed ${pass}, failed ${fail}`);
process.exit(fail ? 1 : 0);
