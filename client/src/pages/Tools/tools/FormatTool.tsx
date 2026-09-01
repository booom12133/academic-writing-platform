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
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  LayoutTemplate,
  Upload,
  CheckCircle,
  ArrowRight,
  FileText,
  Info,
} from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const FormatTool: React.FC = () => {
  const navigate = useNavigate();
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isDraggingPaper, setIsDraggingPaper] = useState(false);
  const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = paperFile && templateFile;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'format',
        title: paperFile.name,
        inputData: {
          paperFileName: paperFile.name,
          paperFileSize: paperFile.size,
          templateFileName: templateFile?.name,
          templateFileSize: templateFile?.size,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit format task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
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
            <span className="text-slate-500">文件名</span>
            <span className="text-slate-700">{result.title}</span>
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

  const renderDropZone = (
    file: File | null,
    setFile: (f: File | null) => void,
    isDragging: boolean,
    setDragging: (v: boolean) => void,
    label: string,
    hint: string,
  ) => (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-slate-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
      }}
    >
      <Upload className="mb-3 h-8 w-8 text-slate-400" />
      {file ? (
        <div className="text-center">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
              {file.name}
            </span>
          </div>
          <button
            className="mt-2 text-xs text-blue-600 hover:underline"
            onClick={() => setFile(null)}
          >
            重新选择
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="mt-1 text-xs text-slate-500">
            拖拽文件到此处，或
            <label className="cursor-pointer text-blue-600 hover:underline">
              {' '}点击上传
              <input
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">格式规范排版</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-700">温馨提示</p>
              <p className="mt-1 leading-relaxed">
                适用于毕业论文、期刊投稿等需要严格遵循格式模板的场景。
                AI会自动识别模板中的标题、正文、引用等样式，并应用到您的论文中。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            论文文档 <span className="text-red-500">*</span>
          </label>
          {renderDropZone(
            paperFile,
            setPaperFile,
            isDraggingPaper,
            setIsDraggingPaper,
            '上传论文文档',
            '支持 .docx 格式，最大 50MB',
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            格式模板 <span className="text-red-500">*</span>
          </label>
          {renderDropZone(
            templateFile,
            setTemplateFile,
            isDraggingTemplate,
            setIsDraggingTemplate,
            '上传格式模板',
            '支持 .docx 格式，最大 10MB',
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <LayoutTemplate className="h-4 w-4" />
          {loading ? '提交中...' : '开始排版（50积分）'}
        </Button>
        <p className="text-xs text-slate-500">
          仅调整格式样式，不修改正文内容
        </p>
      </CardFooter>
    </Card>
  );
};

export default FormatTool;
