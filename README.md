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
