//go:build e2ecover

package main

import (
	"runtime/coverage"
	"time"
)

// coverDir is where the e2e stack mounts the coverage output directory
// (docker-compose.e2e.yaml). It is a constant rather than an environment
// lookup: Grafana's plugin validator forbids plugins from reading
// environment variables.
const coverDir = "/coverage"

// startCoverageFlusher periodically writes coverage counter data to coverDir.
// It is only compiled into the binary the e2e suite builds
// (`go build -cover -tags e2ecover`); released builds get the no-op in
// coverageflush_noop.go. The periodic flush is needed because Grafana kills
// the plugin subprocess on shutdown, so the usual write-at-exit never runs.
func startCoverageFlusher() {
	go func() {
		// WriteMetaDir/WriteCountersDir return an error when the binary is not
		// built with -cover or the directory is missing; ignoring it keeps this
		// harmless outside the e2e stack.
		_ = coverage.WriteMetaDir(coverDir)
		for range time.Tick(15 * time.Second) {
			_ = coverage.WriteCountersDir(coverDir)
		}
	}()
}
