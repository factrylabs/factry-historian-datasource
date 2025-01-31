// Define the semVerRegex as a TypeScript regular expression
const semVerRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9a-zA-Z-]+)(?:\.(?:0|[1-9]\d*|[0-9a-zA-Z-]+))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

// Define types for semantic version components
type SemVer = {
  major: number
  minor: number
  patch: number
  preRelease?: string
  buildMetadata?: string
  isDebug?: boolean
}

// Helper function to parse a semantic version string
function parseSemVer(version: string): SemVer {
  // remove leading 'v' if present
  if (version.startsWith('v')) {
    version = version.slice(1)
  }
  const matches = version.match(semVerRegex)
  if (!matches) {
    return {
      major: Number.MAX_SAFE_INTEGER,
      minor: Number.MAX_SAFE_INTEGER,
      patch: Number.MAX_SAFE_INTEGER,
      isDebug: true,
    }
  }

  return {
    major: parseInt(matches[1], 10),
    minor: parseInt(matches[2], 10),
    patch: parseInt(matches[3], 10),
    preRelease: matches[4],
    buildMetadata: matches[5],
    isDebug: false,
  }
}

// Helper function to convert a SemVer object to a string
function toStringSemVer(semVer: SemVer): string {
  if (semVer.isDebug) {
    return 'debug'
  }

  let version = `${semVer.major}.${semVer.minor}.${semVer.patch}`

  if (semVer.preRelease) {
    version += `-${semVer.preRelease}`
  }

  if (semVer.buildMetadata) {
    version += `+${semVer.buildMetadata}`
  }

  return version
}

// Helper function to compare two pre-release components
function comparePreRelease(a: string, b: string): number {
  const aParts = a.split('.')
  const bParts = b.split('.')

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''

    // Compare numeric parts
    const aIsNum = /^\d+$/.test(aPart)
    const bIsNum = /^\d+$/.test(bPart)

    if (aIsNum && bIsNum) {
      const diff = parseInt(aPart, 10) - parseInt(bPart, 10)
      if (diff !== 0) {
        return diff
      }
    } else if (aIsNum) {
      return -1 // Numeric identifiers are less than non-numeric
    } else if (bIsNum) {
      return 1
    } else {
      // Lexicographical comparison for strings
      if (aPart !== bPart) {
        return aPart < bPart ? -1 : 1
      }
    }
  }

  return 0
}

// Helper function to compare two semantic version strings
export function semverCompare(a: string, b: string): number {
  const aSemVer = parseSemVer(a)
  const bSemVer = parseSemVer(b)

  // Check for debug versions
  if (aSemVer.isDebug && bSemVer.isDebug) {
    return 0
  } else if (aSemVer.isDebug) {
    return 1
  } else if (bSemVer.isDebug) {
    return -1
  }

  // Compare the major, minor, and patch versions
  if (aSemVer.major !== bSemVer.major) {
    return aSemVer.major - bSemVer.major
  }

  if (aSemVer.minor !== bSemVer.minor) {
    return aSemVer.minor - bSemVer.minor
  }

  if (aSemVer.patch !== bSemVer.patch) {
    return aSemVer.patch - bSemVer.patch
  }

  // Compare the pre-release versions if both exist
  if (aSemVer.preRelease && bSemVer.preRelease) {
    return comparePreRelease(aSemVer.preRelease, bSemVer.preRelease)
  } else if (aSemVer.preRelease) {
    return -1 // Pre-release versions are considered less than normal versions
  } else if (bSemVer.preRelease) {
    return 1
  }

  // Ignore build metadata; versions are equal
  return 0
}

// Helper function to check if a version is greater than or equal to a target version, excluding pre-releases by default
export function isFeatureEnabled(version: string, targetVersion: string, includePreReleases = false): boolean {
  if (includePreReleases) {
    let versionSemVer = parseSemVer(version)
    versionSemVer.preRelease = undefined
    version = toStringSemVer(versionSemVer)
  }

  return semverCompare(version, targetVersion) >= 0
}
