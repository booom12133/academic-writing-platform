import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader } from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Lightbulb } from 'lucide-react';
import { PROFESSIONAL_FIELDS, EDUCATION_LEVELS } from '@shared/api.interface';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { FormField, SubmitFooter, SuccessCard } from './ToolCommon';
import { readContinueState } from '@client/src/lib/task-actions';

const BASE_POINTS = 15;

const TopicGenerationTool: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const continueConsumed = useRef(false);
  const [major, setMajor] = useState('');
  const [education, setEducation] = useState('');
  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  useEffect(() => {
    if (continueConsumed.current) return;
    continueConsumed.current = true;
    const state = readContinueState('topic-generation', location.state);
    if (!state) return;
    const inputData = state.inputData;
    if (typeof inputData.field === 'string') setMajor(inputData.field);
    if (typeof inputData.educationLevel === 'string') setEducation(inputData.educationLevel);
    if (typeof inputData.researchDirection === 'string') setRequirement(inputData.researchDirection);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const canSubmit = Boolean(major && education);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const inputData: Record<string, string> = {
        field: major,
        educationLevel: education,
      };
      if (requirement.trim()) inputData.researchDirection = requirement.trim();

      const task = await aiToolsApi.submitTask({
        taskType: 'topic-generation',
        title: `${major}智能拟题`,
        inputData,
      });
      setResult(task);
    } catch (err) {
      logger.error('submit topic generation task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card>
        <CardContent className="pt-6">
          <SuccessCard
            taskId={result.id}
            title={result.title}
            pointsCost={result.pointsCost}
            onView={() => navigate(`/tasks/${result.id}`)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          智能拟题
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          根据您的专业和研究要求，AI 将生成结构化的论文候选题目及研究思路。
        </p>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="专业领域" required>
            <Select value={major} onValueChange={setMajor}>
              <SelectTrigger><SelectValue placeholder="请选择专业" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONAL_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>{field}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="学历层次" required>
            <Select value={education} onValueChange={setEducation}>
              <SelectTrigger><SelectValue placeholder="请选择学历" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="选题要求">
          <Textarea
            placeholder="请描述您感兴趣的研究方向、研究对象或其他要求（选填）"
            rows={3}
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
          />
        </FormField>
      </CardContent>
      <SubmitFooter
        loading={loading}
        disabled={!canSubmit}
        points={BASE_POINTS}
        onClick={handleSubmit}
        label="生成题目"
        hint="提交后将在任务详情页查看 DeepSeek 生成结果，内容仅供学术写作参考"
      />
    </Card>
  );
};

export default TopicGenerationTool;
