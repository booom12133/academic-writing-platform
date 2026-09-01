import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Presentation } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const STYLE_OPTIONS = [
  { value: 'academic', label: '学术风' },
  { value: 'business', label: '商务风' },
  { value: 'minimal', label: '简约风' },
  { value: 'tech', label: '科技风' },
];

const SCENE_OPTIONS = [
  { value: 'defense', label: '答辩' },
  { value: 'report', label: '汇报' },
  { value: 'presentation', label: '宣讲' },
  { value: 'teaching', label: '教学' },
];

const BASE_POINTS = 35;

const AiPptTool: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [pageCount, setPageCount] = useState('15');
  const [style, setStyle] = useState('');
  const [scene, setScene] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const pageNum = Number(pageCount);
  const canSubmit =
    topic.trim().length > 0 &&
    keyPoints.trim().length > 0 &&
    pageNum >= 5 &&
    pageNum <= 100;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'ai-ppt',
        title: topic.trim(),
        inputData: {
          topic,
          keyPoints,
          pageCount: pageNum,
          style: style || undefined,
          scene: scene || undefined,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit ai-ppt task failed', JSON.stringify(err)); }
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
          <Presentation className="h-5 w-5 text-blue-600" /> AI PPT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="PPT主题" required>
          <Input placeholder="请输入PPT主题" value={topic}
            onChange={(e) => setTopic(e.target.value)} />
        </FormField>

        <FormField label="内容要点" required>
          <Textarea placeholder="列出核心内容要点，每行一条或用序号"
            rows={6} value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="目标页数" required>
            <Input type="number" min={5} max={100}
              placeholder="默认15页"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">范围：5 ~ 100 页</p>
          </FormField>
          <FormField label="PPT风格">
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择风格（选填）" />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="使用场景">
          <Select value={scene} onValueChange={setScene}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择使用场景（选填）" />
            </SelectTrigger>
            <SelectContent>
              {SCENE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成PPT大纲" />
    </Card>
  );
};

export default AiPptTool;
