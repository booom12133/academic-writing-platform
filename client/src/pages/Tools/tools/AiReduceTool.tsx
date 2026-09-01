import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Eraser, Upload, FileText } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const PROCESS_TYPES = [
  { value: 'ai-detection', label: '降AI检测率' },
  { value: 'similarity', label: '降低重复率' },
  { value: 'both', label: '两者兼顾' },
];

const INTENSITY_OPTIONS = [
  { value: 'light', label: '轻度', desc: '少量替换，保持原意' },
  { value: 'medium', label: '中度', desc: '句式重构+同义词替换' },
  { value: 'strong', label: '强力', desc: '深度改写，变化幅度大' },
];

const BASE_POINTS = 30;

const AiReduceTool: React.FC = () => {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [processType, setProcessType] = useState('ai-detection');
  const [intensity, setIntensity] = useState('medium');
  const [keepRequirements, setKeepRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit =
    (inputMode === 'text' && text.trim().length > 0) ||
    (inputMode === 'file' && files.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'ai-reduce',
        title: inputMode === 'text'
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : files[0]?.name || '降AI/降重',
        inputData: {
          inputMode,
          text: inputMode === 'text' ? text : undefined,
          fileName: inputMode === 'file' ? files[0]?.name : undefined,
          processType,
          intensity,
          keepRequirements,
          wordCount: text.length,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit ai-reduce task failed', JSON.stringify(err)); }
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
          <Eraser className="h-5 w-5 text-blue-600" /> 降AI/降重
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'file')}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1">
              <FileText className="h-4 w-4" /> 粘贴文本
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4" /> 上传文档
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-4">
            <Textarea placeholder="请粘贴需要处理的论文内容..."
              rows={12} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>字数：{text.length} 字</span>
            </div>
          </TabsContent>
          <TabsContent value="file" className="mt-4">
            <FileUploadZone files={files} onChange={setFiles}
              accept=".docx" multiple={false}
              label="上传论文文档" hint="支持 .docx 格式，最大20MB" />
          </TabsContent>
        </Tabs>

        <FormField label="处理类型" required>
          <RadioGroup value={processType} onValueChange={setProcessType}
            className="grid grid-cols-3 gap-2">
            {PROCESS_TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <RadioGroupItem value={t.value} id={`pt-${t.value}`} />
                <Label htmlFor={`pt-${t.value}`} className="text-xs cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FormField>

        <FormField label="降重强度" required>
          <RadioGroup value={intensity} onValueChange={setIntensity}
            className="space-y-2">
            {INTENSITY_OPTIONS.map((t) => (
              <div key={t.value} className="flex items-start gap-2">
                <RadioGroupItem value={t.value} id={`int-${t.value}`} className="mt-0.5" />
                <Label htmlFor={`int-${t.value}`} className="cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">{t.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FormField>

        <FormField label="保留要求">
          <Textarea placeholder="说明哪些内容/术语不能改动（选填）"
            rows={3} value={keepRequirements}
            onChange={(e) => setKeepRequirements(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="立即处理" />
    </Card>
  );
};

export default AiReduceTool;
