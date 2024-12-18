package util

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
)

// SemVer represents a semantic version
type SemVer struct {
	Major         int
	Minor         int
	Patch         int
	PreRelease    string
	BuildMetadata string
	IsDebug       bool
}

var semVerRegex = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9a-zA-Z-]+)(?:\.(?:0|[1-9]\d*|[0-9a-zA-Z-]+))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

func parseSemVer(version string) (SemVer, error) {
	if version == "debug" {
		return SemVer{
			Major:   int(^uint(0) >> 1), // Maximum integer value
			Minor:   int(^uint(0) >> 1),
			Patch:   int(^uint(0) >> 1),
			IsDebug: true,
		}, nil
	}

	matches := semVerRegex.FindStringSubmatch(version)
	if matches == nil {
		return SemVer{}, errors.New("invalid semantic version string")
	}

	major, _ := strconv.Atoi(matches[1])
	minor, _ := strconv.Atoi(matches[2])
	patch, _ := strconv.Atoi(matches[3])

	return SemVer{
		Major:         major,
		Minor:         minor,
		Patch:         patch,
		PreRelease:    matches[4],
		BuildMetadata: matches[5],
		IsDebug:       false,
	}, nil
}

func toStringSemVer(semVer SemVer) string {
	if semVer.IsDebug {
		return "debug"
	}

	version := strconv.Itoa(semVer.Major) + "." + strconv.Itoa(semVer.Minor) + "." + strconv.Itoa(semVer.Patch)

	if semVer.PreRelease != "" {
		version += "-" + semVer.PreRelease
	}

	if semVer.BuildMetadata != "" {
		version += "+" + semVer.BuildMetadata
	}

	return version
}

func comparePreRelease(a, b string) int {
	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")

	maxLen := len(aParts)
	if len(bParts) > maxLen {
		maxLen = len(bParts)
	}

	for i := 0; i < maxLen; i++ {
		var aPart, bPart string
		if i < len(aParts) {
			aPart = aParts[i]
		}
		if i < len(bParts) {
			bPart = bParts[i]
		}

		aIsNum := isNumeric(aPart)
		bIsNum := isNumeric(bPart)

		switch {
		case aIsNum && bIsNum:
			aNum, _ := strconv.Atoi(aPart)
			bNum, _ := strconv.Atoi(bPart)
			if aNum != bNum {
				return aNum - bNum
			}
		case aIsNum:
			return -1
		case bIsNum:
			return 1
		case aPart != bPart:
			if aPart < bPart {
				return -1
			}
			return 1
		}
	}

	return 0
}

// SemverCompare compares two semantic versions
func SemverCompare(a, b string) int {
	aSemVer, err := parseSemVer(a)
	if err != nil {
		return 1
	}

	bSemVer, err := parseSemVer(b)
	if err != nil {
		return -1
	}

	switch {
	case aSemVer.IsDebug && bSemVer.IsDebug:
		return 0
	case aSemVer.IsDebug:
		return 1
	case bSemVer.IsDebug:
		return -1
	case aSemVer.Major != bSemVer.Major:
		return aSemVer.Major - bSemVer.Major
	case aSemVer.Minor != bSemVer.Minor:
		return aSemVer.Minor - bSemVer.Minor
	case aSemVer.Patch != bSemVer.Patch:
		return aSemVer.Patch - bSemVer.Patch
	case aSemVer.PreRelease != "" && bSemVer.PreRelease != "":
		return comparePreRelease(aSemVer.PreRelease, bSemVer.PreRelease)
	case aSemVer.PreRelease != "":
		return -1
	case bSemVer.PreRelease != "":
		return 1
	}

	return 0
}

func isNumeric(s string) bool {
	_, err := strconv.Atoi(s)
	return err == nil
}

// IsValidSemver checks if a string is a valid semver. Example: 1.2.3-beta.1
func IsValidSemver(version string) bool {
	return semVerRegex.MatchString(version)
}

// CheckMinimumVersion checks if the historian version is not less than minVersion
func CheckMinimumVersion(info *schemas.HistorianInfo, minVersion string, includePreReleases bool) bool {
	if info == nil {
		return false
	}

	historianVersion, _ := strings.CutPrefix(info.Version, "v")

	if includePreReleases {
		semVer, err := parseSemVer(historianVersion)
		if err != nil {
			return true // Assume invalid version is greater than minVersion
		}
		semVer.PreRelease = ""
		historianVersion = toStringSemVer(semVer)
	}

	return SemverCompare(historianVersion, minVersion) >= 0
}
