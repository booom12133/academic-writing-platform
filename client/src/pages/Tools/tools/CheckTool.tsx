import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { SearchCheck, CheckCircle, ArrowRight, Upload, FileText } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const CheckTool: React.FC = () => {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const wordCount = text.length;

  const canSubmit =
    (inputMode === 'text' && text.trim().length > 0) ||
    (inputMode === 'file' && fileName);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'check',
        title: inputMode === 'text'
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : fileName,
        inputData: {
          inputMode,
          text: inputMode === 'text' ? text : undefined,
          fileName: inputMode === 'file' ? fileName : undefined,
          wordCount,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit check task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (file) setFileName(file.name);
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            任务提交成功
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-500">任务ID</span>
            <span className="font-mono text-slate-700">{result.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">任务标题</span>
            <span className="text-slate-700 truncate max-w-[200px]">{result.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">消耗积分</span>
            <span className="text-amber-600 font-medium">{result.pointsCost} 积分</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">当前状态</span>
            <Badge variant="secondary">等待中</Badge>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => navigate(`/tasks/${result.id}`)}
          >
            查看任务进度
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">查重参考</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'file')}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1">
              <FileText className="h-4 w-4" />
              粘贴文本
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4" />
              上传文档
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4">
            <div className="space-y-2">
              <Textarea
                placeholder="请粘贴需要检测的文本内容..."
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="text-xs text-slate-500">
                字数统计：{wordCount} 字（单次最多5万字）
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file);
              }}
            >
              <Upload className="mb-3 h-8 w-8 text-slate-400" />
              {fileName ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">{fileName}</p>
                  <button
                    className="mt-2 text-xs text-blue-600 hover:underline"
                    onClick={() => setFileName('')}
                  >
                    重新选择
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    拖拽文件到此处，或
                    <label className="cursor-pointer text-blue-600 hover:underline">
                      {' '}点击上传
                      <input
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">支持 .docx 格式</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <SearchCheck className="h-4 w-4" />
          {loading ? '提交中...' : '开始查重（40积分）'}
        </Button>
        <p className="text-xs text-slate-500">
          本工具为AI辅助参考检测，结果仅供参考
        </p>
      </CardFooter>
    </Card>
  );
};

export default CheckTool;
