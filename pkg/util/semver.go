package util

import (
	"strconv"
	"strings"
)

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SemverCompare compares two semver strings, returns true if a is less than b
func SemverCompare(a string, b string) bool {
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
