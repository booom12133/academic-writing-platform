import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';

import { getSelectableKnowledgeSources } from '@client/src/lib/grounded-writing';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';

export type GroundedWritingSelection =
  | { mode: 'active' }
  | { mode: 'explicit'; documentVersionIds: string[] };

interface EvidenceSelectionPanelProps {
  documents: KnowledgeWorkspaceDocument[];
  selection: GroundedWritingSelection;
  onChange: (selection: GroundedWritingSelection) => void;
}

export function EvidenceSelectionPanel({
  documents,
  selection,
  onChange,
}: EvidenceSelectionPanelProps) {
  const selectable = getSelectableKnowledgeSources(documents);
  const selected = new Set(selection.mode === 'explicit' ? selection.documentVersionIds : []);

  const toggleVersion = (documentVersionId: string) => {
    const next = new Set(selected);
    if (next.has(documentVersionId)) next.delete(documentVersionId);
    else next.add(documentVersionId);
    onChange({ mode: 'explicit', documentVersionIds: [...next] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">证据资料</CardTitle>
        <p className="text-sm text-slate-500">
          只有当前用户工作区中已建立索引的活动版本可以用于有据写作。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="radio"
            name="grounded-writing-selection-mode"
            checked={selection.mode === 'active'}
            disabled={selectable.length === 0}
            onChange={() => onChange({ mode: 'active' })}
          />
          <span>
            <span className="block font-medium">使用全部当前有效索引</span>
            <span className="mt-1 block text-xs text-slate-500">
              由服务端按当前用户身份和活动版本执行检索。
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">或选择指定版本</p>
          {documents.map((item) => {
            const version = item.activeVersion;
            const isIndexed = item.index?.status === 'indexed' && item.document.lifecycleStatus === 'active' && Boolean(version);
            const source = selectable.find((candidate) => candidate.documentId === item.document.id);
            const status = item.document.lifecycleStatus !== 'active'
              ? '文档已移除'
              : !version
                ? '无活动版本'
                : item.index?.status === 'indexed'
                  ? '已建立索引'
                  : item.index?.status === 'indexing'
                    ? '索引中'
                    : item.index?.status === 'failed'
                      ? '索引失败'
                      : item.index?.status === 'stale'
                        ? '索引已过期'
                        : '未建立索引';
            return (
              <label
                key={`${item.document.id}:${version?.id ?? 'none'}`}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${isIndexed ? 'border-slate-200 text-slate-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
              >
                <input
                  type="checkbox"
                  checked={source ? selected.has(source.documentVersionId) : false}
                  disabled={!isIndexed || !source}
                  onChange={() => source && toggleVersion(source.documentVersionId)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.document.displayName}</span>
                  <span className="mt-1 block text-xs">
                    {item.document.sourceType.toUpperCase()} · 版本 {version?.versionNumber ?? '—'} · {status}
                  </span>
                </span>
              </label>
            );
          })}
          {documents.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              当前工作区没有资料。
            </p>
          )}
        </div>

        {selection.mode === 'explicit' && selection.documentVersionIds.length === 0 && (
          <p className="text-xs text-amber-700">请至少选择一个已建立索引的活动版本。</p>
        )}
      </CardContent>
    </Card>
  );
}
