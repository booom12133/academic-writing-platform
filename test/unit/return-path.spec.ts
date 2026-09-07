import { sanitizeReturnPath } from '../../client/src/auth/return-path';

describe('sanitizeReturnPath', () => {
  it.each([
    ['//evil.example', '/'],
    ['\\\\evil.example', '/'],
    ['http://evil.example/path', '/'],
    ['https://evil.example/path', '/'],
    ['javascript:alert(1)', '/'],
    ['data:text/html,evil', '/'],
  ])('rejects unsafe return path %s', (value, expected) => {
    expect(sanitizeReturnPath(value)).toBe(expected);
  });

  it.each(['/', '/tools', '/tasks/123?x=1#section'])
    ('preserves the internal path %s', (value) => {
      expect(sanitizeReturnPath(value)).toBe(value);
    });

  it('uses the home path for an absent return path', () => {
    expect(sanitizeReturnPath(null)).toBe('/');
    expect(sanitizeReturnPath(undefined)).toBe('/');
  });
});
