export function deriveParentIdentity(libraryId: string, itemKey: string): string {
  if (!libraryId || !itemKey) throw new Error('Zotero parent identity requires a library and item key.');
  return `user:${libraryId}:item:${itemKey}`;
}

export function deriveAttachmentIdentity(libraryId: string, attachmentKey: string): string {
  if (!libraryId || !attachmentKey) throw new Error('Zotero attachment identity requires a library and attachment key.');
  return `zotero:user:${libraryId}:attachment:${attachmentKey}`;
}
