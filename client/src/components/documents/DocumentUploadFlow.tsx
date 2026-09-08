import { useReducer } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';

import { documentInputApi, knowledgeApi } from '@client/src/api/index';
import { Button } from '@client/src/components/ui/button';
import type { WorkspaceDocumentSelection } from '@shared/knowledge-product.interface';
import { FileUploadZone } from '../../pages/Tools/tools/ToolCommon';
import {
  DocumentWorkspaceFlowError,
  initialDocumentWorkspaceState,
  reduceDocumentWorkspaceState,
  runDocumentUploadFlow,
  toWorkspaceDocumentSelection,
} from './document-workspace.state';

export interface DocumentUploadFlowProps {
  onReady: (selection: WorkspaceDocumentSelection | null) => void;
  onImported?: () => void | Promise<void>;
}

function createIdempotencyKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure browser id generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

export function DocumentUploadFlow({
  onReady,
  onImported,
}: DocumentUploadFlowProps) {
  const [state, dispatch] = useReducer(
    reduceDocumentWorkspaceState,
    initialDocumentWorkspaceState,
  );

  const handleFileChange = (files: File[]) => {
    const file = files[0] ?? null;
    dispatch({ type: 'select-file', file });
    onReady(null);
  };

  const handleUpload = async () => {
    if (!state.file || state.status === 'uploading' || state.status === 'importing') {
      return;
    }
    dispatch({ type: 'upload-started' });
    try {
      const result = await runDocumentUploadFlow(state.file, {
        uploadDocument: async (file) => {
          const descriptor = await documentInputApi.uploadDocument(file);
          dispatch({ type: 'upload-succeeded', descriptor });
          return descriptor;
        },
        importDocument: knowledgeApi.importDocument,
        createIdempotencyKey,
      });
      const selection = toWorkspaceDocumentSelection(result.workspaceDocument);
      if (!selection) throw new DocumentWorkspaceFlowError('import', null);
      dispatch({
        type: 'import-succeeded',
        descriptor: result.descriptor,
        selection,
      });
      onReady(selection);
      await onImported?.();
    } catch (error) {
      const stage = error instanceof DocumentWorkspaceFlowError
        ? error.stage
        : 'import';
      dispatch({
        type: 'flow-failed',
        stage,
        message: stage === 'upload'
          ? '文档上传失败，请重试。'
          : '文档已上传，但导入工作区失败，请重试。',
      });
      onReady(null);
    }
  };

  const busy = state.status === 'uploading' || state.status === 'importing';

  return (
    <div className="space-y-3">
      <FileUploadZone
        files={state.file ? [state.file] : []}
        onChange={handleFileChange}
        accept=".docx,.pdf,.txt,.md,.markdown"
        multiple={false}
        label="上传并加入文档工作区"
        hint="支持 .docx、.pdf、.txt、.md、.markdown，最大 20 MB"
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!state.file || busy || state.status === 'ready'}
        onClick={() => void handleUpload()}
      >
        {state.status === 'uploading' ? (
          '正在上传文档…'
        ) : state.status === 'importing' ? (
          '正在导入工作区…'
        ) : state.status === 'ready' ? (
          <><CheckCircle2 className="h-4 w-4 text-emerald-500" />已加入文档工作区</>
        ) : (
          <><Upload className="h-4 w-4" />上传并导入</>
        )}
      </Button>
      {state.error && (
        <p className="text-xs text-red-600" role="alert">
          {state.error.message}
        </p>
      )}
      {state.selection && (
        <p className="text-xs text-emerald-700">
          当前文档：{state.selection.displayName}
        </p>
      )}
    </div>
  );
}
