import type { DocumentInputDescriptor } from '@shared/document-input.interface';
import type {
  ImportWorkspaceDocumentRequest,
  KnowledgeWorkspaceDocument,
  WorkspaceDocumentSelection,
} from '@shared/knowledge-product.interface';

export type DocumentWorkspaceStatus =
  | 'idle'
  | 'selecting'
  | 'uploading'
  | 'importing'
  | 'ready'
  | 'error';

export type DocumentWorkspaceFailureStage = 'upload' | 'import';

export interface DocumentWorkspaceState {
  status: DocumentWorkspaceStatus;
  file: File | null;
  descriptor: DocumentInputDescriptor | null;
  selection: WorkspaceDocumentSelection | null;
  error: { stage: DocumentWorkspaceFailureStage; message: string } | null;
}

export const initialDocumentWorkspaceState: DocumentWorkspaceState = {
  status: 'idle',
  file: null,
  descriptor: null,
  selection: null,
  error: null,
};

export type DocumentWorkspaceAction =
  | { type: 'select-file'; file: File | null }
  | { type: 'upload-started' }
  | { type: 'upload-succeeded'; descriptor: DocumentInputDescriptor }
  | {
      type: 'import-succeeded';
      selection: WorkspaceDocumentSelection;
      descriptor: DocumentInputDescriptor;
    }
  | {
      type: 'flow-failed';
      stage: DocumentWorkspaceFailureStage;
      message: string;
    }
  | { type: 'reset' };

export function reduceDocumentWorkspaceState(
  state: DocumentWorkspaceState,
  action: DocumentWorkspaceAction,
): DocumentWorkspaceState {
  switch (action.type) {
    case 'select-file':
      return {
        status: action.file ? 'selecting' : 'idle',
        file: action.file,
        descriptor: null,
        selection: null,
        error: null,
      };
    case 'upload-started':
      return { ...state, status: 'uploading', descriptor: null, selection: null, error: null };
    case 'upload-succeeded':
      return { ...state, status: 'importing', descriptor: action.descriptor, selection: null, error: null };
    case 'import-succeeded':
      return {
        ...state,
        status: 'ready',
        descriptor: action.descriptor,
        selection: action.selection,
        error: null,
      };
    case 'flow-failed':
      return {
        ...state,
        status: 'error',
        selection: null,
        error: { stage: action.stage, message: action.message },
      };
    case 'reset':
      return initialDocumentWorkspaceState;
  }
}

export function toWorkspaceDocumentSelection(
  item: KnowledgeWorkspaceDocument,
): WorkspaceDocumentSelection | null {
  if (!item.documentRef || !item.activeVersion) return null;
  if (item.activeVersion.documentId !== item.document.id) return null;
  return {
    documentRef: item.documentRef,
    documentId: item.document.id,
    documentVersionId: item.activeVersion.id,
    displayName: item.document.displayName,
  };
}

export class DocumentWorkspaceFlowError extends Error {
  constructor(
    public readonly stage: DocumentWorkspaceFailureStage,
    public readonly cause: unknown,
  ) {
    super(stage === 'upload' ? 'Document upload failed.' : 'Workspace import failed.');
    this.name = 'DocumentWorkspaceFlowError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface DocumentUploadFlowDependencies {
  uploadDocument(file: File): Promise<DocumentInputDescriptor>;
  importDocument(
    request: ImportWorkspaceDocumentRequest,
  ): Promise<KnowledgeWorkspaceDocument>;
  createIdempotencyKey(): string;
}

export async function runDocumentUploadFlow(
  file: File,
  dependencies: DocumentUploadFlowDependencies,
  sourceRecordId?: string,
): Promise<{
  descriptor: DocumentInputDescriptor;
  workspaceDocument: KnowledgeWorkspaceDocument;
}> {
  let descriptor: DocumentInputDescriptor;
  try {
    descriptor = await dependencies.uploadDocument(file);
  } catch (error) {
    throw new DocumentWorkspaceFlowError('upload', error);
  }

  try {
    const displayName = descriptor.summary.title?.trim() || descriptor.document.fileName;
    const workspaceDocument = await dependencies.importDocument({
      idempotencyKey: `workspace:${dependencies.createIdempotencyKey()}`,
      displayName,
      documentRef: descriptor.document,
      ...(sourceRecordId ? { sourceRecordId } : {}),
    });
    return { descriptor, workspaceDocument };
  } catch (error) {
    throw new DocumentWorkspaceFlowError('import', error);
  }
}
