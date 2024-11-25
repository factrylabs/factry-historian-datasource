/**
 * Checks if a given string is formatted as a regular expression.
 *
 * A string is considered a regular expression if it starts and ends with a '/' character.
 *
 * @param str - The string to check.
 * @returns `true` if the string is formatted as a regular expression, `false` otherwise.
 */
export function isRegex(str: string): boolean {
  return str.length >= 2 && str.startsWith('/') && str.endsWith('/')
}

/**
 * Checks if a given string is a valid regular expression.
 *
 * This function first checks if the string is a valid regex pattern by calling `isRegex`.
 * If it is, it attempts to create a new `RegExp` object from the string (excluding the first and last characters).
 * If the creation of the `RegExp` object succeeds, the function returns `true`.
 * If an error is thrown during the creation of the `RegExp` object, the function returns `false`.
 * If the string is not a valid regex pattern, the function returns `false`.
 *
 * @param str - The string to be checked.
 * @returns `true` if the string is a valid regular expression, `false` otherwise.
 */
export function isValidRegex(str: string): boolean {
  if (isRegex(str)) {
    try {
      new RegExp(str.slice(1, -1))
      return true
    } catch (e) {
      return false
    }
  }

  return false
}
