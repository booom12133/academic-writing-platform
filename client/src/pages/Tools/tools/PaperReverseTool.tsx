import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, InfoBanner, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 25;

const PaperReverseTool: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = files.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'paper-reverse',
        title: files[0]?.name || '论文倒推',
        inputData: {
          fileName: files[0]?.name,
          fileSize: files[0]?.size,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit pr task failed', JSON.stringify(err)); }
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
          <RotateCcw className="h-5 w-5 text-blue-600" /> 论文倒推
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoBanner
          text="上传完整的论文文档，AI将反推论文的选题依据、研究框架、大纲结构、研究方法等关键信息，帮助您快速理解论文全貌或进行逆向分析。"
          tone="info"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            论文文档 <span className="text-red-500">*</span>
          </label>
          <FileUploadZone
            files={files}
            onChange={setFiles}
            accept=".docx"
            multiple={false}
            label="上传论文文档"
            hint="支持 .docx 格式，最大 50MB"
          />
        </div>

        <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-4">
          <p className="text-sm font-medium text-blue-700 mb-2">倒推内容包括：</p>
          <ul className="text-xs text-blue-600 space-y-1.5 list-disc list-inside">
            <li>选题依据与研究背景分析</li>
            <li>研究框架与理论基础梳理</li>
            <li>论文大纲结构提取</li>
            <li>研究方法与技术路线总结</li>
            <li>核心观点与创新点提炼</li>
            <li>研究结论与局限性分析</li>
          </ul>
        </div>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="开始倒推分析" />
    </Card>
  );
};

export default PaperReverseTool;
