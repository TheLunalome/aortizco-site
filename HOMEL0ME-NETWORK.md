# Homelome public architecture guide

**Audience:** portfolio readers and people interested in clear home-technology design.
**Scope:** generic roles, boundaries, and relationship types. This is not a private inventory, implementation guide, or live status report.

## One-minute overview

A home-technology environment can separate network policy, compute, applications, storage, backups, and inspection tools into roles with clear boundaries. Public explanations are most useful when they describe those roles without publishing machine names, addresses, counts, configuration, or current state.

This guide is conceptual. It does not document the exact systems, routes, identities, or health of any private environment.

## Start with the public guide

| Page | What it explains |
|---|---|
| [Homelome guide](homelome.html) | Generic roles, boundaries, and recovery principles. |
| [Public Architecture Explorer](explore.html) | A sanitized, interactive map of generic roles and typed relationships. |
| [Portfolio](index.html) | The public project portfolio. |

## Illustrative topology

```text
Approved client
↓ identity-aware boundary
Controlled connection
↓ scoped inspection layer
Generic service roles
```

This sequence illustrates possible trust boundaries, not actual routes or deployment settings. It contains no private hostnames, service URLs, or infrastructure identifiers.

## Generic roles

| Role | Responsibility | Boundary to consider |
|---|---|---|
| Compute host | Provides resources for virtual machines or containers. | Host availability is different from application health. |
| Application service | Performs a user-facing or background task. | Dependencies and permissions should be explicit. |
| Network boundary | Filters or routes traffic between zones. | A role description does not disclose policy or routes. |
| Data storage | Holds application data or shared files. | Declared paths do not prove actual access. |
| Backup copy | Supports recovery from a separate copy. | Coverage and restore evidence are separate questions. |
| Inspection tool | Helps observe or administer other roles. | Keep access narrowly scoped and distinguish read from write. |

## Relationship types are not interchangeable

Hosting, application/API communication, VPN routing, filesystem access, import behavior, identity, and backup coverage describe different relationships. A diagram should label each relationship rather than implying that every component shares one network path. A declared or proposed relationship is not proof that it is active, healthy, or recoverable.

## Data and recovery principles

- Storage capacity is not the same as a backup copy.
- Backup configuration is not proof that all needed data is covered.
- A readable catalog is not chunk verification.
- A verified backup is not a tested restore.
- Recovery claims should identify their evidence and limits.

## Maintenance principles

| When | Practice |
|---|---|
| Before a change | Record the intended effect and a rollback option. |
| After a change | Validate the specific behavior that changed. |
| Periodically | Review access boundaries, data coverage, and documentation drift. |
| After an incident | Separate symptoms, causes, repairs, and follow-up actions. |

## Public documentation boundary

This companion intentionally omits private inventory, internal links, personal infrastructure details, operational status, addresses, hostnames, access-policy settings, credentials, raw logs, and hardware identifiers. It is not evidence of current service health.
