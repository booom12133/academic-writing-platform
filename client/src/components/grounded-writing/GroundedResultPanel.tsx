import { useState } from 'react';
import { Check, Clipboard, Download } from 'lucide-react';

import type { GroundedGenerationResult } from '@client/src/api/grounded-generation';
import { createGroundedWritingMarkdownExport } from '@client/src/lib/grounded-writing';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';

interface GroundedResultPanelProps {
  result: GroundedGenerationResult;
}

export function GroundedResultPanel({ result }: GroundedResultPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copyContent = async () => {
    if (!result.content.trim() || !navigator.clipboard) {
      setCopyState('failed');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.content);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
    }
  };

  const exportMarkdown = () => {
    if (!result.content.trim()) return;
    const exported = createGroundedWritingMarkdownExport(result);
    const url = URL.createObjectURL(exported.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exported.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = result.status === 'grounded' ? '已完成有据生成' : result.status === 'partial' ? '部分绑定' : '已阻止';
  const statusVariant = result.status === 'grounded' ? 'default' : result.status === 'partial' ? 'secondary' : 'destructive';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">生成结果</CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.status === 'partial' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              部分 claim 的 evidence binding 不完整，请在使用前核对引用和资料来源。
            </p>
          )}
          {result.status === 'blocked' && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              生成已被阻止，因为部分内容无法绑定到有效证据。
            </p>
          )}
          {result.content.trim() && (
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800">
              {result.content}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!result.content.trim()} onClick={() => void copyContent()}>
              {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制正文'}
            </Button>
            <Button type="button" variant="secondary" disabled={!result.content.trim()} onClick={exportMarkdown}>
              <Download className="h-4 w-4" />导出 Markdown
            </Button>
          </div>
        </CardContent>
      </Card>

      {result.claims.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Claims</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.claims.map((claim) => (
              <div key={claim.claimId} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{claim.claimId}</span>
                  <Badge variant={claim.bindingStatus === 'bound' ? 'secondary' : 'destructive'}>{claim.bindingStatus}</Badge>
                </div>
                <p className="mt-2 text-slate-700">{claim.text}</p>
                <p className="mt-2 text-xs text-slate-500">证据：{claim.evidenceRefs.map((ref) => ref.evidenceId).join('、') || '无'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result.citations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">引用</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {result.citations.map((citation) => (
              <p key={citation.citationId} className="text-sm text-slate-700">
                <span className="font-medium">{citation.citationId}</span> → {citation.evidenceIds.join('、') || '无证据'}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {result.bibliography.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">参考文献</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.bibliography.map((entry) => (
              <div key={entry.citationId} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-800">{entry.citationId}</p>
                {Object.entries(entry.fields).length > 0 ? (
                  <dl className="mt-2 space-y-1 text-slate-600">
                    {Object.entries(entry.fields).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[auto_1fr] gap-2">
                        <dt className="font-medium">{key}</dt>
                        <dd>{displayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-2 text-xs text-slate-500">元数据缺失或不可解析。</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">证据轨迹与来源</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {result.evidenceTrace.length === 0 ? (
            <p className="text-sm text-slate-500">当前结果没有可展示的证据轨迹。</p>
          ) : result.evidenceTrace.map((trace) => (
            <details key={trace.evidenceId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-800">{trace.evidenceId}</summary>
              <div className="mt-3 space-y-2 text-slate-600">
                <p>引用定位：{formatLocator(trace.citationLocator)}</p>
                <p>文档版本：{formatProvenance(trace.provenance)}</p>
                {trace.sourceRecord && <p>来源记录：{displaySourceRecord(trace.sourceRecord)}</p>}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      {result.grounding.diagnostics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Grounding diagnostics</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {result.grounding.diagnostics.map((diagnostic, index) => (
              <p key={`${diagnostic.code}:${diagnostic.unitId ?? diagnostic.evidenceId ?? index}`} className="text-sm text-slate-600">
                {diagnostic.code}{diagnostic.detail ? `：${diagnostic.detail}` : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function displayValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join('；');
  return '缺失或不可解析';
}

function formatLocator(locator: Record<string, unknown>): string {
  const section = readString(locator, 'section');
  const sourceBlockId = readString(locator, 'sourceBlockId');
  const sourceBlockIndex = typeof locator.sourceBlockIndex === 'number' ? `区块 ${locator.sourceBlockIndex}` : undefined;
  return [section, sourceBlockId, sourceBlockIndex].filter(Boolean).join(' · ') || '未提供';
}

function formatProvenance(provenance: Record<string, unknown>): string {
  const documentVersionId = readString(provenance, 'documentVersionId');
  const section = readString(provenance, 'section');
  const headingPath = Array.isArray(provenance.headingPath)
    ? provenance.headingPath.filter((item): item is string => typeof item === 'string').join(' / ')
    : undefined;
  return [documentVersionId, section, headingPath].filter(Boolean).join(' · ') || '未提供';
}

function displaySourceRecord(sourceRecord: Record<string, unknown>): string {
  return readString(sourceRecord, 'title') ?? readString(sourceRecord, 'displayName') ?? '已关联来源记录';
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' && value[key].trim() ? value[key] as string : undefined;
}
