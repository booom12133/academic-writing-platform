import { useCallback, useEffect, useState } from 'react';
import { Link, RefreshCw } from 'lucide-react';
import { zoteroApi } from '@client/src/api/index';
import { ProductIntegrationError } from '@client/src/api/integration-error';
import { knowledgeApi } from '@client/src/api/index';
import { ZoteroConnectionPanel } from '@client/src/components/zotero/ZoteroConnectionPanel';
import { ZoteroItemsList } from '@client/src/components/zotero/ZoteroItemsList';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import type { ZoteroConnection, ZoteroImportResult, ZoteroItem, ZoteroItemsPage } from '@shared/zotero.interface';

function safeErrorMessage(error: unknown): string {
  return error instanceof ProductIntegrationError ? error.message : 'Zotero 操作失败，请稍后重试。';
}

function importSummary(result: ZoteroImportResult): string {
  if (result.document?.id) return `已导入知识工作区：${result.document.displayName || result.document.id}。当前仅完成导入，尚未建立索引。`;
  if (result.source) return '已导入 Zotero 元数据到知识来源。当前仅完成导入，尚未建立索引。';
  return 'Zotero 同步已完成。当前仅完成导入/同步，尚未建立索引。';
}

export default function ZoteroPage() {
  const [connection, setConnection] = useState<ZoteroConnection | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [items, setItems] = useState<ZoteroItemsPage | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState<number | null>(null);

  const loadConnection = useCallback(async () => {
    setConnectionLoading(true);
    setConnectionError(null);
    try {
      const connections = await zoteroApi.getConnectionHealth();
      setConnection(connections.find((item) => item.status === 'active') ?? connections[0] ?? null);
    } catch (error) {
      setConnectionError(safeErrorMessage(error));
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!connection || connection.status !== 'active') return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      setItems(await zoteroApi.listItems());
    } catch (error) {
      setItemsError(safeErrorMessage(error));
    } finally {
      setItemsLoading(false);
    }
  }, [connection]);

  useEffect(() => { void loadConnection(); }, [loadConnection]);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const handleConnect = async (apiKey: string) => {
    setConnecting(true);
    setConnectionError(null);
    try {
      setConnection(await zoteroApi.connect(apiKey));
      setItems(null);
    } catch (error) {
      setConnectionError(safeErrorMessage(error));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setConnectionError(null);
    try {
      await zoteroApi.disconnect();
      setConnection(null);
      setItems(null);
    } catch (error) {
      setConnectionError(safeErrorMessage(error));
    } finally {
      setDisconnecting(false);
    }
  };

  const refreshKnowledgeWorkspace = async () => {
    try {
      const documents = await knowledgeApi.listDocuments();
      setWorkspaceCount(documents.length);
    } catch {
      setWorkspaceCount(null);
    }
  };

  const runItemAction = async (item: ZoteroItem, action: () => Promise<ZoteroImportResult>) => {
    setActionKey(item.key);
    setActionMessage(null);
    try {
      const result = await action();
      if (result) {
        setActionMessage(importSummary(result));
        await refreshKnowledgeWorkspace();
      }
    } catch (error) {
      setActionMessage(safeErrorMessage(error));
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <Link className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold leading-tight text-slate-800">Zotero</h1>
          <Badge variant="secondary">Optional Advanced Integration</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-500">可选的 API Key 高级集成；OAuth 暂缓。导入真实文献元数据和支持的 PDF 附件后，仍需在文档工作区显式建立索引。</p>
      </div>

      <ZoteroConnectionPanel
        connection={connection}
        loading={connectionLoading}
        connecting={connecting}
        disconnecting={disconnecting}
        error={connectionError}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefresh={loadConnection}
      />

      {actionMessage && <Card><CardContent className="flex items-center justify-between gap-3 py-4 text-sm text-emerald-700"><span>{actionMessage}</span><Button variant="ghost" size="sm" onClick={() => void refreshKnowledgeWorkspace()}><RefreshCw className="h-4 w-4" />刷新工作区状态</Button></CardContent></Card>}
      {workspaceCount !== null && <p className="text-xs text-slate-500">知识工作区当前有 {workspaceCount} 个文档。索引由后续流程显式执行。</p>}

      {connection?.status === 'active' && (
        <ZoteroItemsList
          page={items}
          loading={itemsLoading}
          error={itemsError}
          actionKey={actionKey}
          onRefresh={loadItems}
          onImport={(item) => runItemAction(item, () => zoteroApi.importItem(item.key))}
          onSync={(item) => runItemAction(item, () => zoteroApi.syncItem(item.key))}
          onImportAttachment={(item) => runItemAction(item, () => zoteroApi.importAttachment(item.key))}
        />
      )}
    </div>
  );
}
