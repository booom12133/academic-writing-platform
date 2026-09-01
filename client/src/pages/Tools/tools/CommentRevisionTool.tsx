import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { MessageSquare, Info } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, InfoBanner, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 25;

const CommentRevisionTool: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const file = files[0];
  const canSubmit = files.length > 0;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'comment-revision',
        title: file?.name || '批注修改',
        inputData: {
          fileName: file?.name,
          fileSize: file?.size,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit cr task failed', JSON.stringify(err)); }
    finally { setLoading(false); }
  };

  if (result) return (
    <Card><CardContent className="pt-6">
      <SuccessCard taskId={result.id} title={result.title} pointsCost={result.pointsCost}
        onView={() => navigate(`/tasks/${result.id}`)} />
    </CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" /> AI批注修改
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoBanner
          text="上传带有批注的Word文档，AI将自动识别文档中的批注内容，并根据批注建议逐条修改论文。"
          tone="info"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            带批注的论文文档 <span className="text-red-500">*</span>
          </label>
          <FileUploadZone
            files={files}
            onChange={setFiles}
            accept=".docx"
            multiple={false}
            label="上传 .docx 文档"
            hint="支持 .docx 格式，最大 50MB"
          />
        </div>

        {file && (
          <div className="rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-slate-50 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-slate-500 flex-shrink-0" />
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">使用说明</p>
              <p>1. 在Word文档中使用"审阅 → 新建批注"功能添加修改意见</p>
              <p>2. 保存带有批注的 .docx 文档后上传</p>
              <p>3. AI将逐条识别批注并应用修改建议</p>
            </div>
          </div>
        </div>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="开始批注修改" />
    </Card>
  );
};

export default CommentRevisionTool;
