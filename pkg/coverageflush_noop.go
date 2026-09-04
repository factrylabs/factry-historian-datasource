//go:build !e2ecover

package main

// startCoverageFlusher does nothing in a released build. The coverage
// flusher lives in coverageflush.go behind the e2ecover build tag.
func startCoverageFlusher() {}
