import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { knowledgeApi } from '@client/src/api/index';
import { Button } from '@client/src/components/ui/button';
import type {
  KnowledgeWorkspaceDocument,
  WorkspaceDocumentSelection,
} from '@shared/knowledge-product.interface';
import { DocumentUploadFlow } from './DocumentUploadFlow';
import { toWorkspaceDocumentSelection } from './document-workspace.state';

export interface DocumentWorkspacePickerProps {
  value: WorkspaceDocumentSelection | null;
  onChange: (selection: WorkspaceDocumentSelection | null) => void;
}

export function DocumentWorkspacePicker({
  value,
  onChange,
}: DocumentWorkspacePickerProps) {
  const [documents, setDocuments] = useState<KnowledgeWorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setDocuments(await knowledgeApi.listDocuments());
    } catch (_error) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleWorkspaceSelection = (documentId: string) => {
    const item = documents.find((candidate) => candidate.document.id === documentId);
    onChange(item ? toWorkspaceDocumentSelection(item) : null);
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="document-workspace-picker" className="text-sm font-medium text-slate-700">
            从文档工作区选择
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => void loadDocuments()}
          >
            <RefreshCw className="h-3.5 w-3.5" />刷新
          </Button>
        </div>
        <select
          id="document-workspace-picker"
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
          value={value?.documentId ?? ''}
          disabled={loading || error}
          onChange={(event) => handleWorkspaceSelection(event.target.value)}
        >
          <option value="">
            {loading ? '正在加载文档…' : '请选择已导入文档'}
          </option>
          {documents.map((item) => {
            const selectable = toWorkspaceDocumentSelection(item) !== null;
            return (
              <option
                key={item.document.id}
                value={item.document.id}
                disabled={!selectable}
              >
                {item.document.displayName} · {item.document.sourceType}
                {selectable ? '' : '（仅文本知识版本）'}
              </option>
            );
          })}
        </select>
        {error && (
          <div className="flex items-center justify-between gap-3 text-xs text-red-600">
            <span>文档工作区加载失败。</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadDocuments()}>
              重试
            </Button>
          </div>
        )}
        {!loading && !error && documents.length === 0 && (
          <p className="text-xs text-slate-500">工作区暂无文档，可以在下方上传。</p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <DocumentUploadFlow
          onReady={onChange}
          onImported={loadDocuments}
        />
      </div>
    </div>
  );
}
