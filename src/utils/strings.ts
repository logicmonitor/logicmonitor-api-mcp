/**
 * Shared string utility functions
 */

/**
 * Capitalize the first character of a string.
 * Returns the original string unchanged if empty.
 */
export function capitalizeFirst(value: string): string {
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
