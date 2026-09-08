import { useState } from 'react';
import { FileDown, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import type { ZoteroImportResult, ZoteroItem, ZoteroItemsPage } from '@shared/zotero.interface';

interface ZoteroItemsListProps {
  page: ZoteroItemsPage | null;
  loading: boolean;
  error: string | null;
  actionKey: string | null;
  onRefresh: () => Promise<void>;
  onImport: (item: ZoteroItem) => Promise<ZoteroImportResult | void>;
  onSync: (item: ZoteroItem) => Promise<ZoteroImportResult | void>;
  onImportAttachment: (item: ZoteroItem) => Promise<ZoteroImportResult | void>;
}

function displayField(item: ZoteroItem, field: string): string | undefined {
  const value = item.data[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function ZoteroItemsList({
  page,
  loading,
  error,
  actionKey,
  onRefresh,
  onImport,
  onSync,
  onImportAttachment,
}: ZoteroItemsListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Zotero 条目</CardTitle>
          {page?.libraryVersion && <p className="mt-1 text-xs text-slate-400">Library version：{page.libraryVersion}</p>}
        </div>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => void onRefresh()}>
          <RefreshCw className="h-4 w-4" /> 刷新
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">正在加载 Zotero 条目…</p>
          : error ? <p className="py-8 text-center text-sm text-red-600">{error}</p>
            : !page || page.items.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">暂无 Zotero 条目。</p>
              : <div className="space-y-3">{page.items.map((item) => {
                const title = displayField(item, 'title') || `${item.itemType} · ${item.key}`;
                const creators = Array.isArray(item.data.creators)
                  ? item.data.creators.filter((creator): creator is Record<string, unknown> => typeof creator === 'object' && creator !== null).map((creator) => typeof creator.name === 'string' ? creator.name : [creator.firstName, creator.lastName].filter((part): part is string => typeof part === 'string').join(' ')).filter(Boolean).join('、')
                  : undefined;
                const running = actionKey === item.key;
                const attachment = item.itemType === 'attachment';
                return (
                  <div key={item.key} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" className="min-w-0 text-left" onClick={() => setExpandedKey(expandedKey === item.key ? null : item.key)}>
                        <div className="truncate text-sm font-medium text-slate-800">{title}</div>
                        <div className="mt-1 text-xs text-slate-500">{creators || item.itemType} · {item.key}</div>
                      </button>
                      <Badge variant="secondary">{item.itemType}</Badge>
                    </div>
                    {expandedKey === item.key && <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">条目元数据由 Zotero 提供；导入后仍需在知识工作区执行后续索引流程。</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!attachment && <Button size="sm" disabled={running} onClick={() => void onImport(item)}>{running ? '导入中…' : '导入到知识工作区'}</Button>}
                      {!attachment && <Button size="sm" variant="secondary" disabled={running} onClick={() => void onSync(item)}><RefreshCw className="h-4 w-4" />同步</Button>}
                      {attachment && <Button size="sm" variant="secondary" disabled={running} onClick={() => void onImportAttachment(item)}><FileDown className="h-4 w-4" />导入 PDF 附件</Button>}
                    </div>
                  </div>
                );
              })}</div>}
      </CardContent>
    </Card>
  );
}
