# End-to-end tests

Playwright suite that exercises the datasource against a real Grafana and a
mock Factry Historian API.

## Layout

| Path | Purpose |
| --- | --- |
| `mockhistorian/` | Go mock of the Historian REST API. Reuses `pkg/schemas` and `pkg/proto` so JSON shapes and the protobuf/Arrow query responses stay byte-faithful to what the backend decodes. Covered by its own unit tests, plus integration tests (`datasource_integration_test.go`) that drive the real plugin backend against the mock with the same query payloads as the provisioned dashboards. |
| `provisioning/` | Grafana provisioning used only for e2e: one datasource pointing at the mock, plus one dashboard per query type (measurements, assets, events, raw). |
| `*.spec.ts` | The Playwright specs. They import `test`/`expect` from `./fixtures` (not `@grafana/plugin-e2e`) so coverage collection hooks into every test. |
| `fixtures.ts`, `utils.ts`, `coverage/` | Shared fixtures, selector helpers and coverage plumbing. |

## Fixture dataset

The mock serves a small deterministic plant:

- Database `historian` (QuestDB)
- Measurements `e2e.motor.speed` and `e2e.motor.temperature`, with tags `location` and `unit`
- Asset tree `Site \\ Line 1 \\ Motor`, Motor has properties `Speed` and `Temperature`
- Event type `Batch` (simple properties `code`, `good`, `yield`) configured on Motor
- Three batch events (`batch-41`..`batch-43`, the last one still open), generated relative to the queried time range so they always fall inside the dashboard window

## Running locally

```sh
# 1. Build the plugin (backend + frontend) into dist/
mage buildAll && pnpm build

# 2. Start Grafana + mock Historian (Grafana on http://localhost:3001)
pnpm server:e2e

# 3. Run the suite
pnpm e2e
```

## Coverage

`pnpm e2e:coverage` runs the same suite with coverage reporting on both sides
of the plugin:

- **Frontend**: every test collects V8 coverage from Chromium
  (`tests/fixtures.ts`), and the global teardown maps it back to `src/`
  through the production source map using `monocart-coverage-reports`.
  Output: console summary + `coverage/e2e-frontend/` (HTML, lcov,
  `coverage-summary.json`).
- **Backend**: build the plugin binary with coverage instrumentation first:

  ```sh
  go build -cover -covermode=atomic -coverpkg=./pkg/... \
    -o dist/gpx_factry-historian-datasource_linux_amd64 ./pkg
  mkdir -p coverage/e2e-backend-raw && chmod 777 coverage/e2e-backend-raw
  ```

  `docker-compose.e2e.yaml` sets `GOCOVERDIR` and forwards it to the plugin
  subprocess; `pkg/coverageflush.go` flushes counters every 15s (Grafana kills
  the plugin on shutdown, so the usual write-at-exit never runs). Raw counter
  files land in `coverage/e2e-backend-raw/`.

Render the combined report (also used by CI for the job summary):

```sh
bash scripts/e2e-coverage-report.sh
```

This writes `coverage/e2e-backend.cov`, `coverage/e2e-backend.html` and prints
per-package backend percentages plus the frontend totals.

In CI the `playwright-tests` job does all of the above per Grafana version and
uploads `e2e-coverage-*` artifacts with the HTML reports.
