import { normalizeZoteroMetadata } from './zotero.metadata';

describe('normalizeZoteroMetadata', () => {
  it('maps bibliographic citation fields to typed E1 assertions', () => {
    const result = normalizeZoteroMetadata({
      key: 'ITEM1', version: 7, itemType: 'journalArticle', data: {
        title: 'A study', creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
        date: '2024-05-01', publicationTitle: 'Journal', abstractNote: 'Abstract', DOI: '10/test', citationKey: 'Lovelace2024',
        publisher: 'Press', volume: '2', issue: '3', pages: '1-9', url: 'https://example.test', isbn: '123', issn: '456', language: 'en',
      },
    }, '42');

    expect(result.canonicalMetadata).toEqual(expect.objectContaining({
      title: expect.objectContaining({ value: 'A study' }),
      authors: expect.objectContaining({ value: [{ name: 'Ada Lovelace', given: 'Ada', family: 'Lovelace' }] }),
      year: expect.objectContaining({ value: 2024 }),
      publisher: expect.objectContaining({ value: 'Press' }),
      language: expect.objectContaining({ value: 'en' }),
    }));
    expect(result.metadataAssertions.map((item) => item.field)).toEqual(expect.arrayContaining(['title', 'authors', 'year', 'publisher', 'language']));
    expect(result.externalProvenance[0]).toMatchObject({ externalRecordId: 'user:42:item:ITEM1', externalVersion: '7' });
  });

  it('does not promote provider-only fields into E1 canonical metadata', () => {
    const result = normalizeZoteroMetadata({
      key: 'ITEM1', version: 1, itemType: 'book', data: { title: 'Book', tags: [{ tag: 'private' }], collections: ['COL1'], itemType: 'book' },
    }, '42');

    expect(result.canonicalMetadata).not.toHaveProperty('tags');
    expect(result.canonicalMetadata).not.toHaveProperty('collections');
    expect(result.canonicalMetadata).not.toHaveProperty('itemType');
  });
});
