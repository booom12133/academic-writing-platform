import { useState } from 'react';
import { CheckCircle2, KeyRound, Link2Off, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import type { ZoteroConnection } from '@shared/zotero.interface';

interface ZoteroConnectionPanelProps {
  connection: ZoteroConnection | null;
  loading: boolean;
  connecting: boolean;
  disconnecting: boolean;
  error: string | null;
  onConnect: (apiKey: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function ZoteroConnectionPanel({
  connection,
  loading,
  connecting,
  disconnecting,
  error,
  onConnect,
  onDisconnect,
  onRefresh,
}: ZoteroConnectionPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const connected = connection?.status === 'active';

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setValidationError('请输入 Zotero API key。');
      return;
    }
    setValidationError(null);
    await onConnect(apiKey);
    setApiKey('');
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-blue-600" /> Zotero 连接
        </CardTitle>
        <Button variant="ghost" size="sm" disabled={loading || connecting} onClick={() => void onRefresh()}>
          <RefreshCw className="h-4 w-4" /> 刷新状态
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在读取连接状态…</div>
        ) : connected && connection ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />已连接</div>
            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
              <span>Library：{connection.libraryId}</span>
              <span>Key fingerprint：{connection.keyFingerprint || '未提供'}</span>
              <span>状态：{connection.status}</span>
            </div>
            {connection.lastCheckedAt && <p className="text-xs text-slate-400">最近检查：{connection.lastCheckedAt}</p>}
            <Button type="button" variant="outline" disabled={disconnecting} onClick={() => void onDisconnect()}>
              <Link2Off className="h-4 w-4" />{disconnecting ? '断开中…' : '断开连接'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {connection
                ? `当前连接状态：${connection.status === 'revoked' ? '已撤销' : '不可用'}。请重新连接。`
                : '尚未连接 Zotero。'} API key 只会用于本次连接请求，不会保存在浏览器中。
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="输入 Zotero API key"
                aria-label="Zotero API key"
              />
              <Button type="button" disabled={connecting} onClick={() => void handleConnect()}>
                {connecting ? '连接中…' : '连接'}
              </Button>
            </div>
            {(validationError || error) && <p className="text-sm text-red-600">{validationError || error}</p>}
          </div>
        )}
        {!loading && !connected && error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
