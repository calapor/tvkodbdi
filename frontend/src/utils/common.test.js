import { slugify } from './common';

// Note: slugify's step 3 removes hyphens as special chars, so hyphens in input
// are stripped entirely. Step 4 converts spaces → hyphens, step 5 collapses them.
describe('slugify', () => {
  test('lowercases and hyphenates',  () => expect(slugify('Hello World')).toBe('hello-world'));
  test('strips special chars',       () => expect(slugify('Show: Season #1')).toBe('show-season-1'));
  test('trims surrounding spaces',   () => expect(slugify('  Spaces  ')).toBe('spaces'));
  test('collapses multiple spaces',  () => expect(slugify('a  b')).toBe('a-b'));
  test('hyphens in input are stripped', () => expect(slugify('a-b')).toBe('ab'));
});
