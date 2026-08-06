# 4 — Testing Strategy

## Principle

Unit tests cover **pure, deterministic logic only** — no network calls, no upstream API access, no cost to run. The aggregation code that talks to TheTVDB, TMDb, and Kodi is intentionally left out of the unit suite because exercising it would require live credentials and live services; that behaviour belongs in manual / integration verification, not in the fast test run that gates CI.

## What is tested

The frontend unit tests target the pure utility functions, which is where the fiddly, bug-prone logic lives:

### `frontend/src/utils/common.test.js` — `slugify`

Tests [`../../frontend/src/utils/common.js`](../../frontend/src/utils/common.js). Covers lowercasing + hyphenation, special-character stripping, surrounding-space trimming, multiple-space collapsing, and the (intentional, documented) quirk that literal hyphens in the input are stripped rather than preserved. The test file explicitly documents the ordering of the transform steps so the non-obvious hyphen behaviour is captured as intended, not accidental.

### `frontend/src/utils/dateUtils.test.js` — `formatDaysAgo`

Tests [`../../frontend/src/utils/dateUtils.js`](../../frontend/src/utils/dateUtils.js), the "1y 2m 3w 4d ago" relative-time formatter. This function uses **non-cascading modulo** arithmetic (weeks = `floor((days % 30) / 7)`, remainingDays = `days % 7`), which produces outputs that are easy to get wrong by intuition. The suite pins concrete cases — 0, 1, 7, 8, 35, 42, 365, 400 days — plus edge handling for negative numbers (treated as absolute), non-number input (returns `""`), and `NaN` (returns `""`). Each case comments the exact arithmetic that produces the expected string, so the tests double as executable documentation of the formatter's quirks.

These are exactly the right things to unit-test: pure functions with subtle, easy-to-regress behaviour and no I/O.

## What is not tested, and why

- **The aggregation backend** (`server.js`, `thetvdb-client.js`, `thetmdb-client.js`, `kodi-client.js`). The backend `test` script (`jest --testPathPattern='src/__tests__' --passWithNoTests`) is wired up with `supertest` available as a dev dependency, but there is currently **no `src/__tests__/` directory**, so the backend suite passes with no tests. This is a conscious gate-keeping choice: the backend's value is almost entirely in orchestrating three live external services, and meaningful coverage there needs either those services or a substantial mocking harness. Rather than ship brittle mock-heavy tests, the backend is verified manually / via the demo instance, and the CI gate relies on the frontend unit tests plus a successful frontend build.
- **React components / rendering.** No component tests exist. The components are thin presentational wrappers over the fetched payloads; the risk-carrying logic is the utilities, which are covered.
- **External API contracts.** By policy, nothing in the test run hits TheTVDB, TMDb, or Kodi — tests must be free and offline.

## How tests run

Both CI paths run the same suites:

- **GitHub Actions** ([`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) — on every push / PR to `main`: `pnpm install --frozen-lockfile`, then `react-scripts test --watchAll=false` for the frontend and `pnpm --filter ./backend run test` for the backend.
- **Jenkins** ([`../../Jenkinsfile`](../../Jenkinsfile)) — the `Verify` stage builds the frontend (`CI=false` so ESLint warnings do not fail the build) and runs the frontend tests with the `jest-junit` reporter (results published via `junit`), then runs the backend test script. This stage runs on **all branches**, so tests gate every build before any image is pushed.

## Extending the suite

The seams are already in place. Because each upstream client is a separate module with a narrow surface (`thetvdb-client.js`, `thetmdb-client.js`, `kodi-client.js`), integration-style tests could be added as clearly-named `*.integration.test.js` files, gated behind credentials and excluded from the default run — keeping the fast, free unit suite as the CI gate while allowing deeper checks on demand.
