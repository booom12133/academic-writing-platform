import { AlertCircle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';

interface TaskStatePanelProps {
  state: 'loading' | 'error' | 'empty';
  errorMessage?: string;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyHint?: string;
}

export function TaskStatePanel({
  state,
  errorMessage = '加载失败，请重试。',
  onRetry,
  emptyMessage = '暂无任务',
  emptyHint,
}: TaskStatePanelProps) {
  if (state === 'loading') {
    return <div className="py-20 text-center text-slate-500">加载中...</div>;
  }

  if (state === 'error') {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <AlertCircle className="h-12 w-12 text-red-300 mb-4" />
        <p className="text-red-600 font-medium mb-2">{errorMessage}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="py-20 flex flex-col items-center justify-center text-center">
      <FileText className="h-16 w-16 text-slate-300 mb-4" />
      <p className="text-slate-600 font-medium mb-2">{emptyMessage}</p>
      {emptyHint && <p className="text-sm text-slate-400">{emptyHint}</p>}
    </div>
  );
}

export function TaskLoadingInline() {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在刷新
    </span>
  );
}
