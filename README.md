# aortizco-site

The source for [aortizco.webalome.link](https://aortizco.webalome.link): the
portfolio and project tracker, with the public Homelome guide and Architecture
Explorer.

## Build and validate

- `npm run build` verifies source hashes against `release-manifest.json`, copies
  exactly the ten approved deployment files to `dist/`, and runs the privacy
  scan. Text file line endings are normalized to LF so Windows and Cloudflare
  produce identical bytes. It does not publish.
- `npm run check` checks the existing `dist/` file set and scans the complete
  artifact without modifying it.
- `npm test` runs negative privacy fixtures against the complete artifact.
- Preview `dist/` with a local static server to test the exact output.

The Pages build is configured at repository root with `npm run build` and
output directory `dist`.

The portfolio retains its approved public contact configuration in
`index.html`. Privacy validation permits its exact address only in that file;
other email-shaped values and occurrences elsewhere fail.

## The gate for automatic changes

`npm run build` runs `site-gate.mjs` before it packages anything, so a change
that breaks a rule fails the required "Cloudflare Pages" check and cannot merge.
The existing build checks (manifest hashes, the ten-file deployment list, the
privacy scan) are unchanged and still run.

- **Content paths.** A change against `main` may only edit `index.html`,
  `homelome.html`, `explore.html` and `release-manifest.json`. It may not add,
  delete, rename or change the mode of any file, and may not touch anything
  else (scripts, styles, `_headers`, `package.json`, `.github/`, the gate, or
  `protected-manifest.json`).
- **Release manifest.** Only the sha256 value of a content page may change. The
  file list and every other pin stay as they are.
- **Added text.** The lines a change adds may not hold script, an event
  handler, an iframe, object, embed, base or form, a script or data address,
  a script sink (`eval`, `fetch`, `innerHTML =` and similar), a base64 blob, or
  a link or load to a host the file did not already use.
- **Caps.** At most 4 files and 400 changed lines, 3000 characters in an added
  line, 150000 bytes per file and 600000 for the site.
- **Hashes.** Every file that is not a content file is pinned in
  `protected-manifest.json`; a changed, removed or unlisted file fails, also on
  `main`.
- **Fail closed.** If the build cannot fetch `main` to compare with, it fails.

To change a protected file on purpose (a human change): the pull request will
fail the path rule by design. Review it, then either temporarily relax the
required check on the ruleset or merge with the owner's override, and run
`npm run pin` to refresh `protected-manifest.json` in the same change.
`npm test` runs the privacy fixtures and the gate tests.

Limit: the gate runs from the checkout under test, so a change that rewrites
the gate is stopped only by its own path rule. A human reads every change to a
protected file.
