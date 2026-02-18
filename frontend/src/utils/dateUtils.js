// dateUtils.js

/**
 * Converts a number of days into a formatted string like:
 * "1y 2m 3w 4d ago"
 *
 * @param {number} days - Number of days ago (can be negative or positive).
 * @returns {string} - A human-readable relative time string.
 */
export function formatDaysAgo(days) {
  if (typeof days !== 'number' || isNaN(days)) return '';

  const absDays = Math.abs(days);
  const years = Math.floor(absDays / 365);
  const months = Math.floor((absDays % 365) / 30);
  const weeks = Math.floor((absDays % 30) / 7);
  const remainingDays = absDays % 7;

  const parts = [];

  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}m`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays}d`);

  return parts.join(' ') + ' ago';
}
