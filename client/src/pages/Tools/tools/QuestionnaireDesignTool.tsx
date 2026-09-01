import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import { ClipboardSignature } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const QUESTION_TYPES = [
  { value: 'single', label: '单选题' },
  { value: 'multiple', label: '多选题' },
  { value: 'scale', label: '量表题' },
  { value: 'open', label: '开放题' },
  { value: 'matrix', label: '矩阵题' },
];
const BASE_POINTS = 20;

const QuestionnaireDesignTool: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [objectives, setObjectives] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [questionTypes, setQuestionTypes] = useState<string[]>([]);
  const [respondents, setRespondents] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = topic.trim() && objectives.trim() && questionCount && questionTypes.length > 0;

  const toggleType = (v: string) => {
    setQuestionTypes((prev) =>
      prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'questionnaire-design',
        title: topic.trim(),
        inputData: {
          objectives, dimensions,
          questionCount: Number(questionCount),
          questionTypes,
          respondents,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit qd task failed', JSON.stringify(err)); }
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
          <ClipboardSignature className="h-5 w-5 text-blue-600" /> 问卷设计
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="研究主题" required>
          <Input placeholder="请输入研究主题" value={topic}
            onChange={(e) => setTopic(e.target.value)} />
        </FormField>
        <FormField label="研究目标" required>
          <Textarea placeholder="请详细描述研究目标和问卷目的"
            rows={3} value={objectives}
            onChange={(e) => setObjectives(e.target.value)} />
        </FormField>
        <FormField label="问卷维度">
          <Textarea placeholder="请描述问卷的维度划分或模块（选填，每行一个维度）"
            rows={3} value={dimensions}
            onChange={(e) => setDimensions(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="题目数量" required>
            <Input type="number" placeholder="请输入题目数量"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)} />
          </FormField>
          <FormField label="目标受访者">
            <Input placeholder="如：大学生、企业员工等（选填）"
              value={respondents}
              onChange={(e) => setRespondents(e.target.value)} />
          </FormField>
        </div>
        <FormField label="题目类型（可多选）" required>
          <div className="grid grid-cols-3 gap-2">
            {QUESTION_TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <Checkbox id={`qt-${t.value}`}
                  checked={questionTypes.includes(t.value)}
                  onCheckedChange={() => toggleType(t.value)} />
                <Label htmlFor={`qt-${t.value}`} className="text-xs cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成问卷" />
    </Card>
  );
};

export default QuestionnaireDesignTool;
