# Public Homelome companion release

This release integrates the reviewed public guide and Architecture Explorer
into the existing `TheLunalome/aortizco-site` repository without replacing its
portfolio baseline.

## Reconciliation

- Starting `main` and release-branch base:
  `4bcf7d9722976321c6ef3935fc7b62057960529f`.
- The connected repository already included the portfolio's Homelome link,
  modern visual design, portfolio content, project tracker, and public contact
  configuration. These were retained; the public explorer link was added to
  the existing navigation.
- The remote Homelome guide, notes, and topology included named systems and
  dated operational claims. Those specific guide assets were replaced with
  the reviewed generic, sanitized guide, documentation, and diagrams. No
  private model, inventory, internal URL, local path, or screenshot is a
  release input.
- The public explorer is generated from the explicit generic public projection
  reviewed for this release and does not consume private inventory at build
  time.

## Artifact and packaging

`release-manifest.json` enumerates and pins the ten deployment files and their
SHA-256 hashes. `npm run build` normalizes allowlisted text to LF, copies only
those files to `dist/`, verifies source and output hashes, then scans the
complete output. Cloudflare Pages is configured to run `npm run build` from
repository root and publish `dist/`.

The owner approved the portfolio's existing contact address for publication.
Privacy validation permits that exact address only in `index.html`, requires
the approved contact to occur exactly once there, and rejects other email
addresses or its occurrence in any other deployment file.

- Reconciled ZIP: `homelome-public-companion-reconciled-2026-10-20.zip`
- ZIP SHA-256: `57effbca17ca31a233506a865c9497452bccc011c62ddde5dab2338f7058205d`
- Previous candidate SHA-256:
  `a84dfa0c3b174749847f85377a6f5f27e881716bd06dba8cd7a26492514c272a`
  (**superseded** by this main-based reconciliation)
- Intermediate reconciliation archive SHA-256:
  `df0507f94c009f8739a318327764f71b2bfb18f0fda2eb33f003ca3032067b94`
  (**superseded** after the final portfolio navigation file was pinned)
- Windows archive SHA-256:
  `405252bd885f5b6daf8ef9b86b3a5a06b00c0d211192c917692cb2390faedc9c`
  (**superseded** after canonical LF packaging was added)
- The first Pages preview build (`bc8a6fce-8c68-41a0-b53c-18eeac5ad581`)
  failed before deployment because Windows line endings differed from the
  Linux build environment. The package now canonicalizes line endings before
  hashing and output; no preview content was served by that failed build.

## Publication record

- Pages project: `aortizco-site`
- Connected repository: `TheLunalome/aortizco-site`
- Production branch: `main`
- Release branch: `release/homelome-public-companion-2026-10-20`
- Release commit: `f9b190bf363909eb8085e7c1be288208c4c4c3d2`
- Branch-preview deployment:
  `79186394-dda0-42a5-b12a-2f81eb3f38c8`
  (`https://79186394.aortizco-site.pages.dev`), successful.
- Production merge commit: `b70cb1aa343beffb39e4b1f65460cde1612dca04`
- Production deployment:
  `f3f10b70-93e5-4b40-b899-18a7d83af6c8`
  (`https://f3f10b70.aortizco-site.pages.dev`), successful on October 20,
  2026; source branch `main`, source commit `b70cb1a`.
- Verified prior production rollback: `308ed3db-cc6d-4e9b-a035-ea9464af810e`
  (`https://308ed3db.aortizco-site.pages.dev`), the active production
  deployment immediately before the release.

## Production verification

- Custom domain routes `/`, `/homelome`, and `/explore` loaded successfully.
- Production browser checks passed at 390px, 768px, and 1440px for the
  portfolio, guide, and explorer: no horizontal overflow; portfolio and guide
  navigation present; explorer roles, search, lens selection, detail panel,
  and keyboard focus worked.
- All nine fetchable deployment files returned HTTP 200 and matched their
  `release-manifest.json` SHA-256 values. `_headers` is applied by Pages and
  is not served as an asset. Production response headers included
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, and the restricted permissions policy.
- The complete ten-file artifact passed the allowlist/privacy validation and
  matched the reviewed ZIP:
  `homelome-public-companion-reconciled-2026-10-20.zip`,
  SHA-256
  `57effbca17ca31a233506a865c9497452bccc011c62ddde5dab2338f7058205d`.
- Browser and automated accessibility results are recorded for the local
  preview validation; production verification above covers rendered routes,
  responsive overflow, navigation, and explorer interactions. No production
  Axe scan was run.

No private-site or LAN dashboard deployment is included.
