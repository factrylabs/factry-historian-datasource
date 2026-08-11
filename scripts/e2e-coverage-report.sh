#!/usr/bin/env bash
# Renders the e2e coverage reports after a `pnpm e2e:coverage` run:
#
#   frontend  coverage/e2e-frontend/   (written by monocart via tests/fixtures.ts)
#   backend   coverage/e2e-backend-raw (GOCOVERDIR counters flushed by the plugin
#                                       binary, which must be built with -cover)
#
# Produces coverage/e2e-backend.cov (textfmt), coverage/e2e-backend.html and a
# combined summary on stdout. When GITHUB_STEP_SUMMARY is set (CI), the same
# summary is appended there as markdown.
set -euo pipefail

BACKEND_RAW="coverage/e2e-backend-raw"
FRONTEND_SUMMARY="coverage/e2e-frontend/coverage-summary.json"

summary() {
  echo "$1"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >>"$GITHUB_STEP_SUMMARY"
  fi
}

summary "## E2E coverage"
summary ""

# --- Backend (Go) ---------------------------------------------------------
if compgen -G "$BACKEND_RAW/covcounters.*" >/dev/null; then
  go tool covdata textfmt -i="$BACKEND_RAW" -o coverage/e2e-backend.cov
  go tool cover -html=coverage/e2e-backend.cov -o coverage/e2e-backend.html

  echo "--- backend per-package coverage ---"
  go tool covdata percent -i="$BACKEND_RAW"

  BACKEND_TOTAL=$(go tool cover -func=coverage/e2e-backend.cov | awk '/^total:/ {print $3}')
  summary "- **Backend (Go, pkg/...)**: ${BACKEND_TOTAL} of statements (report: coverage/e2e-backend.html)"
else
  summary "- **Backend (Go, pkg/...)**: no coverage data found in ${BACKEND_RAW} (was the plugin built with \`go build -cover\`?)"
fi

# --- Frontend (TypeScript) ------------------------------------------------
if [ -f "$FRONTEND_SUMMARY" ]; then
  FRONTEND_LINES=$(jq -r '.total.lines.pct' "$FRONTEND_SUMMARY")
  FRONTEND_BRANCHES=$(jq -r '.total.branches.pct' "$FRONTEND_SUMMARY")
  summary "- **Frontend (TypeScript, src/...)**: ${FRONTEND_LINES}% lines, ${FRONTEND_BRANCHES}% branches (report: coverage/e2e-frontend/index.html)"
else
  summary "- **Frontend (TypeScript, src/...)**: no coverage data found (run with E2E_COVERAGE=true)"
fi
