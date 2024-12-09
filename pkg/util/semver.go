package util

import (
	"strconv"
	"strings"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
)

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SemverCompare compares two semver strings, returns true if a is less than b
func SemverCompare(a string, b string) bool {
	if a == b {
		return false
	}

	// debug is always more than any other version
	if b == "debug" {
		return true
	}

	if a == "debug" {
		return false
	}

	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")
	length := min(len(aParts), len(bParts))
	for i := 0; i < length; i++ {
		ai, _ := strconv.Atoi(aParts[i])
		bi, _ := strconv.Atoi(bParts[i])
		if ai < bi {
			return true
		}
		if ai > bi {
			return false
		}
	}
	return false
}

// CheckMinimumVersion checks if the historian version is not less than minVersion
func CheckMinimumVersion(info *schemas.HistorianInfo, minVersion string) bool {
	if info == nil {
		return false
	}

	historianVersion, _ := strings.CutPrefix(info.Version, "v")
	// check if historian version is not less than minVersion
	return !SemverCompare(historianVersion, minVersion)
}
