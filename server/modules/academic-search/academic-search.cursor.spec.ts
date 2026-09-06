import { AcademicSearchError } from './academic-search.errors';
import {
  AcademicSearchCursorCodec,
  HmacAcademicSearchCursorCodec,
} from './academic-search.cursor';
import type { AcademicSearchCursor } from './academic-search.types';

describe('AcademicSearchCursorCodec', () => {
  let codec: AcademicSearchCursorCodec;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    codec = new HmacAcademicSearchCursorCodec({ secret: 'cursor-secret-for-tests', ttlMs: 60_000 });
  });

  afterEach(() => jest.useRealTimers());

  it('round-trips an OpenAlex continuation as an opaque platform cursor', () => {
    const cursor = codec.encodeProviderCursor('https://api.openalex.org/cursor-value', 'query-fingerprint') as AcademicSearchCursor;

    expect(typeof cursor).toBe('string');
    expect(codec.validate(cursor, 'query-fingerprint')).toBeUndefined();
    expect(codec.decodeProviderCursor(cursor, 'query-fingerprint')).toBe('https://api.openalex.org/cursor-value');
  });

  it.each([
    ['tampered signature', (cursor: string) => `${cursor.slice(0, -1)}x`],
    ['wrong query fingerprint', (cursor: string) => cursor],
    ['empty token', () => ''],
    ['invalid encoding', () => 'not-a-valid-cursor'],
  ])('rejects %s with the frozen cursor error', (_name, transform) => {
    const cursor = codec.encodeProviderCursor('openalex-next', 'query-fingerprint') as AcademicSearchCursor;
    const candidate = transform(cursor);
    const expectedFingerprint = _name === 'wrong query fingerprint' ? 'other-fingerprint' : 'query-fingerprint';

    expect(() => codec.validate(candidate as AcademicSearchCursor, expectedFingerprint)).toThrow(AcademicSearchError);
    try {
      codec.validate(candidate as AcademicSearchCursor, expectedFingerprint);
      throw new Error('expected cursor validation to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'ACADEMIC_SEARCH_CURSOR_INVALID' });
    }
  });

  it('rejects an expired token without exposing its payload', () => {
    const shortLived = new HmacAcademicSearchCursorCodec({ secret: 'cursor-secret-for-tests', ttlMs: 1 });
    const cursor = shortLived.encodeProviderCursor('openalex-next', 'query-fingerprint') as AcademicSearchCursor;
    jest.advanceTimersByTime(10);

    expect(() => shortLived.validate(cursor, 'query-fingerprint')).toThrow(AcademicSearchError);
    expect(() => shortLived.decodeProviderCursor(cursor, 'query-fingerprint')).toThrow(AcademicSearchError);
  });
});
