# Homelome network field guide

**Audience:** portfolio reviewers, future Alex, and anyone inheriting the lab.  
**Scope:** public-safe topology and operating notes. No addresses, hostnames, credentials, API keys, serial numbers, raw logs, or private service URLs belong in this document.  
**Evidence refresh:** 2026-10-19, using read-only control-plane queries and a local documentation review.

## One-minute overview

Homelome is a single-node Proxmox homelab that separates firewall, backup, remote-inspection, game, and application workloads into named virtual machines. Public access follows an identity-aware, outbound-only pattern: an approved request reaches the edge first, a tunnel carries it inward, and a portal exposes narrowly scoped inspection tools to selected services.

The purpose is practical: make a home system useful without making its management plane public, and make its current state explainable without pretending that every signal is a guarantee.

## Start with the atlas

| Lens | What it explains |
|---|---|
| Architecture | The route from an approved request to a scoped internal service. |
| Fleet | The role of each named workload and why those roles stay separate. |
| Storage | The distinction between online capacity, backup coverage, and restore evidence. |
| Access | Identity, outbound transport, separate service authentication, and read-first tooling. |
| Evidence | What the latest control-plane check actually confirmed. |
| Field notes | The operating principles formed by real failure and recovery work. |

## Topology

Approved user or agent  
↓ authenticated request  
Identity-aware edge and MCP portal  
↓ outbound tunnel from the lab  
mcplome — scoped integration host  
↓ service-specific authentication  
Proxmox · Portainer · Uptime Kuma

OPNsensalome is the firewall and routing boundary for the isolated integration segment.

The public diagram describes trust boundaries and traffic direction, not a route map. The tunnel originates inside Homelome; it is not a port forward.

## Current evidence snapshot

The latest read-only discovery confirmed:

| Area | Finding | Confidence |
|---|---|---|
| Hypervisor | One Proxmox node is online with 20 logical CPU cores reported. | validated |
| Workloads | BackupalomeServer, OPNsensalome, mcplome, Gamelome, and Arralome were running. Medialome was stopped. | validated |
| Storage | Backupalome, RAIDZalome, local, and local-lvm reported online. | validated |
| MCP portal | Proxmox, Portainer, and Uptime Kuma were enabled in the portal. | observed |
| Proxmox path | The inventory, VM, and storage requests completed. | validated |
| Portainer path | A fresh sign-in is required before its endpoint inventory can be read. | needs review |
| Uptime Kuma path | The monitor-summary request returned an upstream HTTP 502. | needs review |

This is a dated infrastructure snapshot, not an uptime claim. It does not prove application health, alert delivery, successful backups, or restore readiness.

## Workload roles

| Workload | Job | Boundary |
|---|---|---|
| OPNsensalome | Firewall and routing | Controls the isolated integration segment's path to internal services and the internet. |
| BackupalomeServer | Backup role | Keeps backup storage distinct from primary workloads. |
| mcplome | Scoped integration host | Runs the tunnel and service-specific inspection containers. |
| Gamelome | Game workloads | Keeps game resource use away from the application stack. |
| Arralome | Docker automation and media services | Hosts the active application ecosystem. |
| Medialome | Retained media workload | Preserved in a stopped state while its role is refined. |

## Security model

1. **Identity gate:** Access is verified before a request reaches the home environment.
2. **No direct inbound management exposure:** the tunnel starts from inside the lab.
3. **Two boundaries per service:** portal access is separate from each service's own authentication and permissions.
4. **Least privilege:** the current MCP workflow is read-first. Inspect, diagnose, present evidence, then make any change authority explicit.
5. **Network separation:** integrations are segmented and routed through the firewall rather than given broad LAN access.
6. **Public/private split:** this guide explains the design while private operations documentation holds implementation details.

## Data and recovery model

The current control plane reports ZFS capacity, a Proxmox Backup Server target, and local storage online. That gives the lab a useful foundation, but it does not make the phrase "fully backed up" true by itself.

The working standard is simple:

- An online pool is not a verified backup.
- A completed backup is not a proven recovery until a restore is tested.
- Large data stores may need protection that differs from VM operating-system disks.
- Capacity and recovery deserve separate, dated evidence.

## Maintenance rhythm

| When | Practice |
|---|---|
| Before a change | Capture evidence, back up or snapshot where appropriate, and state the rollback point. |
| After a change | Check a real service path, not just whether a dashboard looks green. |
| Monthly | Review updates, remote-access boundaries, storage headroom, and documentation drift. |
| After an incident | Record the symptom, the root cause, alert behavior, repair, and permanent guardrail. |

## Public documentation rules

Keep the public version focused on role, design, risk decisions, and verified outcomes. Keep operational configuration private. Never publish network addresses, private hostnames, access-policy details, tokens, raw logs, hardware identifiers, or service credentials.

The accompanying visual guide is available at [Homelome field guide](homelome.html).
