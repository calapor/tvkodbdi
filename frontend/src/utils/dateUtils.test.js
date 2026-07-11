import { formatDaysAgo } from './dateUtils';

// formatDaysAgo uses non-cascading modulo: weeks = floor((absDays % 30) / 7),
// remainingDays = absDays % 7. Units don't cascade, so e.g. 30 days = "1m 2d".
// Test cases are chosen to produce clean, unambiguous outputs.
describe('formatDaysAgo', () => {
  test('zero days',               () => expect(formatDaysAgo(0)).toBe('0d ago'));
  test('single day',              () => expect(formatDaysAgo(1)).toBe('1d ago'));
  test('exact week (7)',          () => expect(formatDaysAgo(7)).toBe('1w ago'));
  test('week plus a day (8)',     () => expect(formatDaysAgo(8)).toBe('1w 1d ago'));
  // 35: months=1 (floor(35/30)), weeks=0 (floor(5/7)), remainingDays=0 (35%7)
  test('exact month (35)',        () => expect(formatDaysAgo(35)).toBe('1m ago'));
  // 42: months=1, weeks=1 (floor(12/7)), remainingDays=0 (42%7)
  test('month plus week (42)',    () => expect(formatDaysAgo(42)).toBe('1m 1w ago'));
  // 365: years=1, months=0, weeks=0, remainingDays=1 (365%7)
  test('a year (365)',            () => expect(formatDaysAgo(365)).toBe('1y 1d ago'));
  // 400: years=1, months=1, weeks=1 (floor(10/7)), remainingDays=1 (400%7)
  test('compound (400)',          () => expect(formatDaysAgo(400)).toBe('1y 1m 1w 1d ago'));
  test('negative treated as abs', () => expect(formatDaysAgo(-5)).toBe('5d ago'));
  test('non-number returns empty',() => expect(formatDaysAgo('bad')).toBe(''));
  test('NaN returns empty',       () => expect(formatDaysAgo(NaN)).toBe(''));
});
