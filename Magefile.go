//go:build mage
// +build mage

package main

import (
	"fmt"

	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Hello prints a message (shows that you can define custom Mage targets).
func Hello() {
	fmt.Println("hello plugin developer!")
}

// Default configures the default target.
var Default = build.BuildAll

// Build_debug_linux_amd64 builds the debug version for linux/amd64.
func BuildDebugLinux() error {
	build.SetBeforeBuildCallback(EnableDebug)
	b := build.Build{}
	return b.Linux()
}

// Build_debug_linux_arm64 builds the debug version for linux/arm64.
func BuildDebugLinuxArm64() error {
	build.SetBeforeBuildCallback(EnableDebug)
	b := build.Build{}
	return b.LinuxARM64()
}

func EnableDebug(cfg build.Config) (build.Config, error) {
	cfg.EnableDebug = true
	return cfg, nil
}
