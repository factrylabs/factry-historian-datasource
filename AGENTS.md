# AGENTS.md — Factry Historian Datasource

This file provides guidance for AI assistants working on the **Factry Historian Datasource** — a Grafana datasource plugin for Factry Historian (an industrial time-series data platform).

---

## Keeping This File Updated

When making changes that affect how future agents should operate in this repo, update this file as part of that task. This includes:

- New tools, scripts, or commands being added or changed
- Changes to project structure or conventions
- Updated workflows or deployment procedures
- New environment variables or configuration requirements

Treat `AGENTS.md` as living documentation — leave it better than you found it.

---

## Project Overview

This is a **hybrid Go/TypeScript Grafana datasource plugin** that connects Grafana to Factry Historian. It supports:

- Querying time-series data by asset tree or measurement
- Querying industrial events (batches, CIP cycles, etc.)
- Raw database queries
- Dashboard variable support (assets, measurements, events, databases, properties)
- Annotations using event data
- Alerting

**Grafana requirement:** >=11.6.0
**Plugin ID:** `factry-historian-datasource`
**Plugin executable:** `gpx_factry-historian-datasource`

---

## Repository Structure

```
factry-historian-datasource/
├── src/                        # Frontend (TypeScript/React)
│   ├── plugin.json             # Grafana plugin metadata (uses %VERSION%, %TODAY% templates)
│   ├── module.ts               # Plugin entry point — exports DataSourcePlugin
│   ├── datasource.ts           # DataSource class (extends DataSourceWithBackend)
│   ├── types.ts                # All TypeScript interfaces and enums
│   ├── QueryEditor.tsx         # Top-level query editor (tabs into sub-editors)
│   ├── ConfigEditor.tsx        # Datasource configuration UI
│   ├── variable_support.ts     # VariableSupport class for dashboard variables
│   ├── AnnotationsQueryEditor/ # Annotations feature
│   ├── CustomVariableEditor/   # Per-variable-type editors (Asset, Measurement, Event, etc.)
│   ├── QueryEditor/            # Query sub-editors: Assets.tsx, Measurements.tsx, Events.tsx, etc.
│   ├── components/             # Reusable UI components (Autocomplete, Cascader, MultiComboBox, etc.)
│   └── util/                   # Frontend utilities (util.ts, eventFilter.ts, migration.ts, semver.ts)
├── pkg/                        # Backend (Go)
│   ├── main.go                 # Plugin entry point
│   ├── datasource/             # Core plugin logic
│   ├── api/                    # Historian REST API client
│   ├── schemas/                # Go data structures for API responses
│   ├── util/                   # Go utilities (semver, periodic properties)
│   └── proto/                  # Protocol buffers (Arrow format)
├── .config/                    # Build tooling configuration 
├── .github/                    # CID workflows and GitHub Actions
├── provisioning/               # Grafana provisioning configs for local dev
├── dist/                       # Build output (gitignored, created by build commands)
├── Makefile                    # Primary developer interface for all tasks
├── Magefile.go                 # Mage build config for Go backend
├── docker-compose.yaml         # Local dev: Grafana on :3001, Delve debugger on :2345
├── package.json                # Frontend deps (pnpm, Node >=20)
├── go.mod                      # Go module (go 1.26)
├── SCHEMA.md                   # Documents query JSON structures and response formats
└── .bra.toml                   # BRA file watcher config for Go hot-reload in dev
```

---

## Architecture

### Query Types (TabIndex enum)

The plugin supports four query modes, selected via tabs in the Query Editor:

| Tab | TypeScript type | Description |
|-----|----------------|-------------|
| `TabIndex.Assets` (0) | `AssetMeasurementQuery` | Query by asset path and asset properties |
| `TabIndex.Measurements` (1) | `MeasurementQuery` | Query by database and measurement name (supports regex) |
| `TabIndex.Events` (2) | `EventQuery` | Query event data with property filtering |
| `TabIndex.RawQuery` (3) | `RawQuery` | Raw query string against a specific database |


### Variable Query Types (VariableQueryType enum)

- `MeasurementQuery` — list measurements
- `AssetQuery` — list assets
- `EventTypeQuery` — list event types
- `DatabaseQuery` — list databases
- `EventTypePropertyQuery` — list event type properties
- `AssetPropertyQuery` — list asset properties
- `PropertyValuesQuery` — list property values for filtering

---

## Development Setup

### Prerequisites

- **Go** 1.23.2+ (the go.mod specifies 1.26 syntax)
- **Mage** — Go build tool (`go install github.com/magefile/mage@latest`)
- **Node.js** 20 LTS (see `.nvmrc`)
- **pnpm** 9.6.0+ (`npm install -g pnpm`)
- **Docker** — for running local Grafana instance

### Local Development

**Debug mode (hot-reload for both frontend and backend):**

```bash
make clean && make run_debug
```

- Grafana available at http://localhost:3001
- Delve Go debugger available at :2345
- Frontend changes hot-reload via webpack watch
- Backend changes hot-reload via BRA watcher → Mage rebuild

**Production mode:**

```bash
make clean && make build_all && make run_server
```

---

## Build Commands

All primary tasks go through `make`. Run `make help` to see all targets.

| Command | Description |
|---------|-------------|
| `make build_all` | Build frontend (webpack) + backend (mage buildAll) |
| `make build_web` | Frontend only: `pnpm install && pnpm run build` |
| `make build_web_dev` | Frontend dev build (no minification) |
| `make run_server` | Run production Grafana via docker-compose |
| `make run_debug` | Run dev Grafana with hot-reload (builds dev frontend first) |
| `make clean` | Remove dist/, stop containers, remove images/volumes |
| `make validate` | Run `@grafana/plugin-validator` against built zip |
| `make package` | Build zip + sign plugin (requires GRAFANA_API_KEY) |
| `make gen_proto` | Regenerate `pkg/proto/arrow.pb.go` from `arrow.proto` |
| `make version` | Print current version (e.g. `v3.0.0`) |
| `make version_bump_patch` | Bump patch version, update package.json, commit, tag |
| `make version_bump_minor` | Bump minor version, update package.json, commit, tag |
| `make version_bump_major` | Bump major version, update package.json, commit, tag |

### Frontend-only scripts (via pnpm)

```bash
pnpm run build        # Production webpack build → dist/
pnpm run dev          # Webpack watch mode
pnpm run test         # Jest (watch mode)
pnpm run test:ci      # Jest (CI mode, 4 workers)
pnpm run typecheck    # TypeScript type checking (no emit)
pnpm run lint         # ESLint with cache
pnpm run lint:fix     # ESLint with auto-fix
pnpm run e2e          # Playwright end-to-end tests
```

### Backend-only commands (via mage)

```bash
mage buildAll         # Build for all platforms (linux/amd64, linux/arm64, etc.)
mage build:debug      # Debug build
mage coverage         # Run Go tests with coverage
mage clean            # Clean Go build artifacts
```

---

## Testing

### Frontend Tests

- **Framework:** Jest with jsdom environment
- **Transpiler:** @swc/jest
- **Test location:** `src/**/__tests__/` or files matching `*.{spec,test,jest}.{ts,tsx}`
- **Time zone:** Tests run with `TZ=UTC` (set in `jest-setup.js`)

```bash
pnpm run test:ci     # Run all tests (CI mode)
pnpm run test        # Watch mode for development
```

### Backend Tests

- **Framework:** Go's `testing` package + `stretchr/testify`
- **Command:** `mage coverage`
- **Test files:** `pkg/**/*_test.go`

```bash
mage coverage        # Run tests with coverage report
go test ./...        # Run tests without coverage
```

### E2E Tests

Playwright tests exist but are currently commented out in CI. Infrastructure uses `pnpm run e2e` and tests against multiple Grafana versions.

---

## Git Commit Conventions

This project uses **Conventional Commits** for all commit messages.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, missing semicolons, etc. (no logic change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling changes |
| `perf` | Performance improvements |
| `ci` | CI/CD configuration changes |
| `revert` | Reverts a previous commit |

### Scopes (optional but encouraged)

Use scopes to indicate the area of the codebase affected:

- `frontend` — TypeScript/React changes in `src/`
- `backend` — Go changes in `pkg/`
- `api` — Historian API client (`pkg/api/`)
- `query` — Query handling logic
- `events` — Event query handling
- `config` — Configuration/settings
- `deps` — Dependency updates
- `ci` — CI/CD workflows

### Examples

```
feat(frontend): add multi-select support to asset picker
fix(backend): handle empty measurement list in query handler
docs: update SCHEMA.md with new event query fields
chore(deps): bump grafana/grafana-plugin-sdk-go to v0.250.0
refactor(api): extract pagination logic into helper function
test(backend): add unit tests for event property filtering
ci: add Go security scan step to CI workflow
```

### Breaking Changes

For breaking changes, add `!` after the type/scope and include a `BREAKING CHANGE:` footer:

```
feat(backend)!: remove deprecated OldEventTypePropertiesValuesFilter

BREAKING CHANGE: OldEventTypePropertiesValuesFilter has been removed.
Use EventTypePropertiesValuesFilter instead.
```

---

## Code Conventions

### TypeScript / React

- **No semicolons** — Prettier is configured with `semi: false`
- **JSX transform:** Modern React 18 (no `import React` needed in JSX files)
- **Linting:** `@grafana/eslint-config` base; `react/react-in-jsx-scope` is disabled
- **Naming:** PascalCase for components and interfaces; camelCase for functions/variables
- **Types:** All shared types live in `src/types.ts`; keep it as the single source of truth
- **Interfaces use PascalCase fields** (e.g., `Measurement.UUID`, `Asset.Name`) to match the Go API response casing

### Go

- **Module:** `github.com/factrylabs/factry-historian-datasource.git`
- **Linting:** golangci-lint v2.10.1 (config in `.golangci.yml`)
- **Error handling:** Use `github.com/pkg/errors` for wrapping errors with context
- **Testing:** Use `github.com/stretchr/testify` assertions
- **Generated files:** `pkg/proto/arrow.pb.go` is generated — never edit manually; regenerate with `make gen_proto`

### Plugin Metadata Templates

`src/plugin.json` uses template strings replaced during webpack build:
- `%VERSION%` → version from `package.json`
- `%TODAY%` → build date
- `%PLUGIN_ID%` → `factry-historian-datasource`

### Version Management

The canonical version is defined in `Makefile` (`major`, `minor`, `patch` variables). The `package.json` version is kept in sync via `make set_frontend_version`. Always use the `make version_bump_*` targets to update versions — do not manually edit version numbers in multiple files.

---

## DataSource Caching

The `DataSource` class uses a 5-second TTL in-memory cache for metadata requests (assets, measurements, databases, etc.) to avoid redundant network calls during rapid UI interactions. The cache is keyed by request parameters and deduplicates concurrent requests for the same key.

Cache-related fields in `datasource.ts`:
- `metadataCache: Map<string, {data, timestamp, timeoutId}>` — stores responses
- `cacheTTL = 5000` — cache lifetime in milliseconds
- `pendingRequests: Map<string, Promise<unknown>>` — in-flight request deduplication

---

## CI/CD Pipeline

### CI (`.github/workflows/ci.yml`)

Runs on push to `main` and PRs to `main`:

1. **Frontend checks:** typecheck → lint → test:ci → build
2. **Go lint:** golangci-lint v2.10.1
3. **Go security:** gosec
4. **Go tests:** `mage coverage`
5. **Go build:** `mage buildAll`
6. **Plugin validation:** `@grafana/plugin-validator`
7. **Sign plugin** (if `GRAFANA_ACCESS_POLICY_TOKEN` is set)
8. Package and archive

### Release (`.github/workflows/release.yml`)

Triggered by tags matching `v*`:

1. Build + sign + package plugin
2. Upload to Factry Portal (uses `FACTRY_PORTAL_PRODUCT_UPDATES_JWT_TOKEN` and `FACTRY_PORTAL_PRODUCT_UPDATES_URL` secrets)
3. Create GitHub draft release

### Release Process

```bash
# 1. Update version
make version_bump_patch   # or minor / major
# This commits Makefile, package.json, pnpm-lock.yaml and creates a git tag

# 2. Push tag to trigger release workflow
git push origin main --tags
```

---

## Docker Development Environment

`docker-compose.yaml` runs a Grafana OSS container with:

- **Port 3001** → Grafana web UI
- **Port 2345** → Delve remote debugger
- **Volumes:**
  - `./dist/` → Grafana plugin directory
  - `./provisioning/` → Grafana provisioning
- **Environment:** unsigned plugins allowed, development logging, SQL expressions feature flag

The dev Docker image (`.config/Dockerfile`) includes:
- Go 1.23.2 for in-container compilation
- Delve debugger
- Mage build tool
- BRA file watcher (`.bra.toml`) for Go hot-reload
- Supervisord to manage Grafana + BRA processes
- Livereload for frontend

---

## Protocol Buffers

The backend uses Apache Arrow format (via protobuf) for efficient data frame serialization between the Historian API and Grafana.

- **Definition:** `pkg/proto/arrow.proto`
- **Generated:** `pkg/proto/arrow.pb.go` (do not edit)
- **Regenerate:** `make gen_proto` (requires `protoc` with Go plugins installed)

---

## Common Pitfalls

- **pnpm only:** This project uses pnpm 9.6.0 (locked). Do not use npm or yarn.
- **Node 20:** Required. Check `.nvmrc`.
- **dist/ is gitignored:** Always build before running `make run_server`. The `run_debug` target builds automatically.
- **plugin.json templates:** If you need the actual version string in plugin.json, look at `dist/plugin.json` (after build), not `src/plugin.json`.
- **Go field casing:** API response structs use PascalCase (e.g., `Measurement.UUID`). TypeScript interfaces mirror this convention intentionally.
- **`OldEventTypePropertiesValuesFilter`** is `@deprecated` — use `EventTypePropertiesValuesFilter` instead.
- **proto file changes:** After modifying `arrow.proto`, always run `make gen_proto` to regenerate `arrow.pb.go`.

---

## Documentation

- `README.md` — User-facing setup and feature overview
- `SCHEMA.md` — Detailed JSON schema for all query types and response data frame formats
- `src/util/README.md` — Notes on frontend utility functions
