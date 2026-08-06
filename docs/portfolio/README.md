![tvkodbdi — media tracker & reminders](../tvkodbdi_white.jpg)

# tvkodbdi — Engineering Portfolio

This is the portfolio index for **tvkodbdi (TheTVDBKodi)**, a self-hosted TV-show tracker that aggregates TheTVDB, TMDb, and a local Kodi library into a single dashboard. These documents describe how the project is built and why, grounded in the actual source in this repository.

The project is intentionally small and single-purpose: a Node.js + Express aggregation backend, a React frontend served by Nginx, a file-based cache (no database), and a Kubernetes/Jenkins deployment targeting arm64 hardware. It uses **no AI/ML services**.

## Documents

| # | Document | What it covers |
|---|---|---|
| 0 | [Product design brief](0-product-design-brief.md) | The problem, what the app does, and what it deliberately does not do |
| 1 | [Pre-development phase](1-pre-development-phase.md) | Why three separate data sources, and how each was evaluated |
| 2 | [System architecture](2-system-architecture.md) | Full request flow, cache strategy, and file-based storage rationale |
| 3 | [Data model reference](3-data-model-reference.md) | What each API returns, how it is merged, and the cache file format |
| 4 | [Testing strategy](4-testing-strategy.md) | What is tested, what is not, and why |
| 5 | [API integration deep dive](5-api-integration-deep-dive.md) | TheTVDB v4 auth, TMDb lookup, Kodi JSON-RPC, and per-show joining |
| 6 | [Security considerations](6-security-considerations.md) | Credential handling, network exposure, and the no-auth decision |
| 7 | [Caching and performance](7-caching-and-performance.md) | The TTL / stale-while-revalidate cache and bounded concurrency |
| 8 | [Deployment architecture](8-deployment-architecture.md) | Docker Compose, Kubernetes, Nginx proxy, and arm64 builds |
| 9 | [Engineering decision log](9-engineering-decision-log.md) | Key decisions and their trade-offs |

## Quick reference

- **Architecture diagram:** [`../diagrams/architecture.puml`](../diagrams/architecture.puml)
- **Source specs:** [`../../specs/`](../../specs/) (product overview, user flows, data models, architecture, tech stack)
- **Backend entry point:** [`../../backend/src/server.js`](../../backend/src/server.js)
- **Cache implementation:** [`../../backend/src/cache.js`](../../backend/src/cache.js)
- **CI:** [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) · **CD:** [`../../Jenkinsfile`](../../Jenkinsfile)
