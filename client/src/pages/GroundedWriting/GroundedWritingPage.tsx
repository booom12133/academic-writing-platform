import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import {
  generate,
  GroundedGenerationApiError,
  type GroundedGenerationDiagnostic,
  type GroundedGenerationResult,
} from '@client/src/api/grounded-generation';
import { knowledgeApi } from '@client/src/api/index';
import { EvidenceSelectionPanel, type GroundedWritingSelection } from '@client/src/components/grounded-writing/EvidenceSelectionPanel';
import { GroundedResultPanel } from '@client/src/components/grounded-writing/GroundedResultPanel';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';
import {
  getGroundedWritingViewState,
  getSelectableKnowledgeSources,
  revalidateGroundedWritingSelection,
} from '@client/src/lib/grounded-writing';

function safeErrorMessage(error: unknown): string {
  return error instanceof GroundedGenerationApiError
    ? error.message
    : '有据写作暂时失败，请稍后重试。';
}

export default function GroundedWritingPage() {
  const location = useLocation();
  const [documents, setDocuments] = useState<KnowledgeWorkspaceDocument[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [selection, setSelection] = useState<GroundedWritingSelection>({ mode: 'active' });
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [queryText, setQueryText] = useState('');
  const [format, setFormat] = useState<'markdown' | 'plain'>('markdown');
  const [onUnbound, setOnUnbound] = useState<'block' | 'annotate'>('block');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedDiagnostics, setBlockedDiagnostics] = useState<GroundedGenerationDiagnostic[]>([]);
  const [result, setResult] = useState<GroundedGenerationResult | null>(null);

  const loadWorkspace = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      setDocuments(await knowledgeApi.listDocuments());
    } catch {
      setWorkspaceError('知识工作区加载失败，请重试。');
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  useEffect(() => {
    const state = location.state;
    if (state === null || state === undefined) return;
    const validated = revalidateGroundedWritingSelection(state, documents);
    if (validated) {
      setSelection({ mode: 'explicit', documentVersionIds: validated });
      setSelectionError(null);
    } else if (!workspaceLoading) {
      setSelection({ mode: 'active' });
      setSelectionError('继续写作时选择的资料已不可用，请从当前工作区重新选择已建立索引的版本。');
    }
  }, [documents, location.state, workspaceLoading]);

  const selectableSources = useMemo(() => getSelectableKnowledgeSources(documents), [documents]);
  const viewState = getGroundedWritingViewState({ loading, error, blocked, result });

  const handleSelectionChange = (next: GroundedWritingSelection) => {
    setSelection(next);
    setSelectionError(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedInstructions = instructions.trim();
    const normalizedQuery = queryText.trim();
    if (!normalizedInstructions || !normalizedQuery) {
      setError('请填写写作要求和研究问题。');
      return;
    }
    if (selectableSources.length === 0) {
      setError('当前没有已建立索引的活动版本，请先在文档工作区建立索引。');
      return;
    }
    if (selection.mode === 'explicit' && selection.documentVersionIds.length === 0) {
      setError('请至少选择一个已建立索引的活动版本。');
      return;
    }
    setLoading(true);
    setError(null);
    setBlocked(false);
    setBlockedDiagnostics([]);
    setResult(null);
    try {
      setResult(await generate({
        instructions: normalizedInstructions,
        queryText: normalizedQuery,
        retrieval: { selection },
        output: { format, citationStyle: 'numeric-inline' },
        grounding: { onUnbound },
      }));
    } catch (generationError) {
      const isBlocked = generationError instanceof GroundedGenerationApiError && generationError.uiState === 'blocked';
      setBlocked(isBlocked);
      setBlockedDiagnostics(isBlocked ? generationError.diagnostics : []);
      setError(safeErrorMessage(generationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <PenLine className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold leading-tight text-slate-800">有据写作</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          从已建立索引的知识版本中检索证据，由服务端生成带引用和来源轨迹的内容。
        </p>
      </div>

      {workspaceLoading ? (
        <Card><CardContent className="py-8 text-center text-sm text-slate-500">正在加载知识工作区…</CardContent></Card>
      ) : workspaceError ? (
        <Card><CardContent className="space-y-3 py-8 text-center"><p className="text-sm text-red-600">{workspaceError}</p><Button variant="outline" onClick={() => void loadWorkspace()}>重试</Button></CardContent></Card>
      ) : (
        <EvidenceSelectionPanel documents={documents} selection={selection} onChange={handleSelectionChange} />
      )}

      {selectionError && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{selectionError}</p>}

      <Card>
        <CardContent className="pt-5">
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              写作要求
              <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="例如：围绕研究问题写一段讨论，保持学术、克制的语气。" rows={5} />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              研究问题
              <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="你希望从资料中回答什么问题？" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                输出格式
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700" value={format} onChange={(event) => setFormat(event.target.value as 'markdown' | 'plain')}>
                  <option value="markdown">Markdown</option>
                  <option value="plain">纯文本</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                未绑定 claim 的处理
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700" value={onUnbound} onChange={(event) => setOnUnbound(event.target.value as 'block' | 'annotate')}>
                  <option value="block">阻止输出</option>
                  <option value="annotate">标注为部分绑定</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">引用样式固定为服务端 accepted contract 的 numeric-inline；浏览器不会提交 evidence 内容或身份字段。</p>
            <Button type="submit" disabled={loading || workspaceLoading || selectableSources.length === 0}>
              {loading ? '生成中…' : '生成有据内容'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {viewState === 'loading' && <Card><CardContent className="py-8 text-center text-sm text-slate-500">正在检索证据并生成内容…</CardContent></Card>}
      {viewState === 'blocked' && !result && (
        <Card>
          <CardContent className="space-y-3 py-8">
            <h2 className="text-lg font-semibold text-red-700">生成已被阻止</h2>
            <p className="text-sm text-slate-700">安全说明：部分内容无法绑定有效证据。</p>
            {blockedDiagnostics.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">Grounding diagnostics</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {blockedDiagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}:${diagnostic.unitId ?? diagnostic.evidenceId ?? index}`}>
                      {diagnostic.code}
                      {diagnostic.unitId ? ` · unit ${diagnostic.unitId}` : ''}
                      {diagnostic.evidenceId ? ` · evidence ${diagnostic.evidenceId}` : ''}
                      {diagnostic.detail ? `：${diagnostic.detail}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {viewState === 'error' && <Card><CardContent className="space-y-3 py-8 text-center"><p className="text-sm text-red-600">{error}</p><Button variant="outline" onClick={() => void submit()}>重试</Button></CardContent></Card>}
      {result && viewState !== 'loading' && <GroundedResultPanel result={result} />}
    </div>
  );
}
