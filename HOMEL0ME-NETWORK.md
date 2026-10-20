# Homelome network field guide

**Audience:** portfolio reviewers, future Alex, and anyone inheriting the lab.  
**Scope:** public-safe topology and operating notes. No addresses, hostnames, credentials, API keys, serial numbers, or private service URLs belong in this document.

## One-minute overview

Homelome is a single-node Proxmox homelab that separates firewall, backup, remote-inspection, game, and Docker automation workloads into named virtual machines. Public access follows an identity-aware, outbound-only pattern: Cloudflare Access authenticates the request, Cloudflare Tunnel carries it inward, and the MCP portal exposes narrowly scoped, read-only tools to selected upstream services.

## Topology

```text
Approved user / Codex
        |
        | authenticated HTTPS
        v
Cloudflare Access + MCP portal
        |
        | Cloudflare Tunnel (outbound from the lab)
        v
mcplome — isolated MCP service VM
        |
        | service-specific auth + firewall policy
        v
Proxmox · Portainer · Uptime Kuma

OPNsensalome is the firewall and routing boundary for the isolated MCP segment.
```

## Verified October 19, 2026

| Area | Finding |
|---|---|
| Hypervisor | One online Proxmox node with 20 logical CPU cores and 46.67 GiB available memory. |
| Virtual machines | BackupalomeServer, OPNsensalome, mcplome, Gamelome, and Arralome were running. Medialome was stopped. |
| Storage | Backupalome (PBS), RAIDZalome (ZFS), local, and local-lvm were online. |
| Segmentation | A dedicated bridge exists for the MCP island with no physical bridge ports; OPNsense is the only intended router. |
| MCP portal | Portainer, Proxmox, and Uptime Kuma are enabled in the portal. |

## Workload roles

| Workload | Job | Boundary |
|---|---|---|
| OPNsensalome | Firewall and routing | Controls the MCP segment's path to internal services and the internet. |
| BackupalomeServer | Backup target | Keeps backup storage distinct from primary workloads. |
| mcplome | MCP service host | Runs the tunnel and service-specific MCP containers. |
| Gamelome | Game workloads | Keeps game resource use from colliding with automation services. |
| Arralome | Docker automation and media services | Hosts the active container ecosystem. |
| Medialome | Dedicated media workload | Present but currently stopped while its role is refined. |

## Security model

1. **Identity gate:** Cloudflare Access restricts portal access before a request enters the home environment.
2. **No direct inbound management exposure:** Cloudflare Tunnel originates inside the lab.
3. **Two boundaries per service:** access to the portal is separate from each service's own authentication.
4. **Least privilege:** current MCP use is read-first. The intended workflow is inspect, diagnose, present evidence, then require deliberate authority for changes.
5. **Network separation:** MCP containers operate on a separate segment, routed through the firewall rather than granted broad LAN access.

## Current operational notes

- The Proxmox MCP path was reachable during the live review.
- Portainer required a portal re-authentication after an earlier successful read.
- The Uptime Kuma MCP path timed out while authenticating to its upstream service and later returned HTTP 502. This proves an MCP-to-upstream problem, not that Uptime Kuma itself is offline.
- One Docker-focused VM is using a high proportion of its assigned RAM. Confirm trends and container limits before adding workload.

## Evidence and maintenance cadence

| Cadence | Action |
|---|---|
| Daily | Check backup job outcomes and monitoring state. |
| Monthly | Review image and service updates intentionally; rotate/review remote-access credentials according to the operational runbook. |
| Per change | Snapshot or back up first, apply one scoped change, then verify with a real service check. |
| Per outage | Record the symptom, the actual cause, the alert behavior, and the permanent guardrail added afterward. |

## Public documentation rules

Keep the portfolio version focused on design, risk decisions, and verified outcomes. Keep the operational runbook private. Never publish LAN addresses, access-policy details, Cloudflare service tokens, private hostnames, raw logs, hardware identifiers, or service credentials.

