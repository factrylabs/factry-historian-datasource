#!/usr/bin/env bash
# Prints the released Grafana versions the e2e jobs of a workflow run passed
# on, as a list for prose: "11.6.16, 12.3.11 and 13.1.9". The release workflow
# writes it into the Compatibility section of the Archbee changelog.
#
# Usage: scripts/tested-grafana-versions.sh <run-id>
#
# Needs an authenticated gh that can read the repository's Actions runs, and
# GITHUB_REPOSITORY (owner/repo), which GitHub Actions sets.
#
# Fails when the run has no e2e job on a released Grafana version, or when one
# of them did not pass: the changelog must not claim a version it was not
# tested with. The nightly job is left out, it is not a release.
set -euo pipefail

run_id=${1:?usage: $0 <run-id>}
repo=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set to owner/repo}

# filter=latest keeps the last attempt of each job, so a job re-run after a
# failure counts with its new result.
jobs=$(gh api --paginate "repos/${repo}/actions/runs/${run_id}/jobs?filter=latest&per_page=100" \
  --jq '.jobs[] | [.name, (.conclusion // "unfinished")] | @tsv')

# The CI workflow names these jobs "e2e test <image>@<version>". Called from
# another workflow, the name gets the caller's job name as a prefix.
e2e=$(printf '%s\n' "$jobs" | awk -F'\t' '
  match($1, /e2e test [^@]+@/) {
    version = substr($1, RSTART + RLENGTH)
    if (version != "nightly") print version "\t" $2
  }')

if [ -z "$e2e" ]; then
  echo "error: run ${run_id} has no e2e job on a released Grafana version" >&2
  exit 1
fi

failed=$(printf '%s\n' "$e2e" | awk -F'\t' '$2 != "success" { print $1 " (" $2 ")" }')
if [ -n "$failed" ]; then
  echo "error: e2e did not pass in run ${run_id} on Grafana:" >&2
  echo "$failed" >&2
  exit 1
fi

printf '%s\n' "$e2e" | cut -f1 | sort -u -V | awk '
  { v[NR] = $0 }
  END {
    for (i = 1; i <= NR; i++) {
      sep = (i < NR - 1) ? ", " : (i == NR - 1) ? " and " : "\n"
      printf "%s%s", v[i], sep
    }
  }'
