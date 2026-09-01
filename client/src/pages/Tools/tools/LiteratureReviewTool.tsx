import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Bookmark } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, type Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 30;

const LiteratureReviewTool: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [major, setMajor] = useState('');
  const [wordCount, setWordCount] = useState('');
  const [requirements, setRequirements] = useState('');
  const [refCount, setRefCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = topic.trim() && keywords.trim() && major;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'literature-review',
        title: topic.trim(),
        inputData: {
          keywords,
          major,
          wordCount: wordCount ? Number(wordCount) : undefined,
          requirements,
          refCount: refCount ? Number(refCount) : undefined,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit lr task failed', JSON.stringify(err)); }
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
          <Bookmark className="h-5 w-5 text-blue-600" /> 文献综述
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="研究主题" required>
          <Input placeholder="请输入您的研究主题"
            value={topic} onChange={(e) => setTopic(e.target.value)} />
        </FormField>
        <FormField label="关键词" required>
          <Input placeholder="多个关键词用逗号分隔，如：深度学习,图像识别,医疗影像"
            value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </FormField>
        <FormField label="专业领域" required>
          <Select value={major} onValueChange={setMajor}>
            <SelectTrigger><SelectValue placeholder="请选择专业领域" /></SelectTrigger>
            <SelectContent>
              {PROFESSIONAL_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="目标字数">
            <Input type="number" placeholder="请输入目标字数"
              value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
          </FormField>
          <FormField label="参考文献数量">
            <Input type="number" placeholder="篇（选填）"
              value={refCount} onChange={(e) => setRefCount(e.target.value)} />
          </FormField>
        </div>
        <FormField label="综述要求">
          <Textarea placeholder="请说明综述的侧重点、结构要求等（选填）"
            rows={4} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter
        loading={loading}
        disabled={!canSubmit}
        points={BASE_POINTS}
        onClick={handleSubmit}
        label="生成文献综述"
      />
    </Card>
  );
};

export default LiteratureReviewTool;
