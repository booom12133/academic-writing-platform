import { useState } from 'react';
import { Check, Clipboard, Download, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import type { Task } from '@shared/api.interface';
import type { TaskResultEnvelope } from '@shared/task-result.interface';
import { exportTaskResult } from '@client/src/lib/task-actions';
import { normalizeTaskResultText } from '@client/src/lib/task-result';

interface TaskResultActionsProps {
  task: Task;
  envelope: TaskResultEnvelope;
  onRerun: () => void;
  onContinue: () => void;
}

export function TaskResultActions({
  task,
  envelope,
  onRerun,
  onContinue,
}: TaskResultActionsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);

  const handleCopy = async () => {
    const text = normalizeTaskResultText(envelope);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
    }
  };

  const handleExport = (format: 'markdown' | 'plain') => {
    const { blob, filename } = exportTaskResult(envelope, format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleRerun = () => {
    setRerunDialogOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 mb-4">
      <Button variant="secondary" onClick={handleCopy}>
        {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制结果'}
      </Button>
      {envelope.exportable && (
        <>
          <Button variant="secondary" onClick={() => handleExport('markdown')}>
            <Download className="h-4 w-4" />
            导出 Markdown
          </Button>
          <Button variant="secondary" onClick={() => handleExport('plain')}>
            <Download className="h-4 w-4" />
            导出文本
          </Button>
        </>
      )}
      <Button variant="secondary" onClick={onContinue}>
        继续编辑
      </Button>
      <Button variant="secondary" onClick={handleRerun}>
        <RefreshCw className="h-4 w-4" />
        重新运行
      </Button>
      <Dialog open={rerunDialogOpen} onOpenChange={setRerunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认重新运行</DialogTitle>
            <DialogDescription>
              重新运行「{task.title}」将创建新任务并再次扣除积分，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRerunDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setRerunDialogOpen(false);
                onRerun();
              }}
            >
              确认重新运行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
