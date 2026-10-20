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
SHA-256 hashes. `npm run build` copies only those files to `dist/`, verifies
source and output hashes, then scans the complete output. Cloudflare Pages is
configured to run `npm run build` from repository root and publish `dist/`.

The owner approved the portfolio's existing contact address for publication.
Privacy validation permits that exact address only in `index.html`, requires
the approved contact to occur exactly once there, and rejects other email
addresses or its occurrence in any other deployment file.

- Reconciled ZIP: `homelome-public-companion-reconciled-2026-10-20.zip`
- ZIP SHA-256: `405252bd885f5b6daf8ef9b86b3a5a06b00c0d211192c917692cb2390faedc9c`
- Previous candidate SHA-256:
  `a84dfa0c3b174749847f85377a6f5f27e881716bd06dba8cd7a26492514c272a`
  (**superseded** by this main-based reconciliation)
- Intermediate reconciliation archive SHA-256:
  `df0507f94c009f8739a318327764f71b2bfb18f0fda2eb33f003ca3032067b94`
  (**superseded** after the final portfolio navigation file was pinned)

## Publication record

- Pages project: `aortizco-site`
- Connected repository: `TheLunalome/aortizco-site`
- Production branch: `main`
- Release branch: `release/homelome-public-companion-2026-10-20`
- Release commit: pending
- Branch-preview URL/deployment: pending
- Production merge commit/deployment: pending
- Verified prior production rollback: `308ed3db-cc6d-4e9b-a035-ea9464af810e`
  (`https://308ed3db.aortizco-site.pages.dev`); re-confirm before merge.

No private-site or LAN dashboard deployment is included.
