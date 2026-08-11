package main

import (
	"os"
	"runtime/coverage"
	"time"
)

// startCoverageFlusher periodically writes coverage counter data to
// GOCOVERDIR. It is a no-op unless the binary was built with `go build
// -cover` AND GOCOVERDIR is set (the e2e suite does both; production builds
// never set GOCOVERDIR). The periodic flush is needed because Grafana kills
// the plugin subprocess on shutdown, so the usual write-at-exit never runs.
func startCoverageFlusher() {
	dir := os.Getenv("GOCOVERDIR")
	if dir == "" {
		return
	}

	go func() {
		// WriteMetaDir/WriteCountersDir return an error when the binary is not
		// built with -cover; ignoring it keeps this dormant in normal builds.
		_ = coverage.WriteMetaDir(dir)
		for range time.Tick(15 * time.Second) {
			_ = coverage.WriteCountersDir(dir)
		}
	}()
}
