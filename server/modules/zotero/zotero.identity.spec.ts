import { deriveAttachmentIdentity, deriveParentIdentity } from './zotero.identity';

describe('Zotero identities', () => {
  it('derives user-scoped parent and attachment identities', () => {
    expect(deriveParentIdentity('42', 'ABC')).toBe('user:42:item:ABC');
    expect(deriveAttachmentIdentity('42', 'PDF1')).toBe('zotero:user:42:attachment:PDF1');
  });
});
