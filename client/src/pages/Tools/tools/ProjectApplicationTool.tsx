import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Target } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, type Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const CATEGORIES = ['国家级', '省部级', '市厅级', '校级', '其他'];
const BASE_POINTS = 60;

const ProjectApplicationTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [field, setField] = useState('');
  const [category, setCategory] = useState('校级');
  const [objectives, setObjectives] = useState('');
  const [methods, setMethods] = useState('');
  const [expectedResults, setExpectedResults] = useState('');
  const [foundation, setFoundation] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && field && objectives.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'project-application',
        title: title.trim(),
        inputData: {
          field, category, objectives, methods, expectedResults, foundation,
          budget: budget ? Number(budget) : undefined,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit pa task failed', JSON.stringify(err)); }
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
          <Target className="h-5 w-5 text-blue-600" /> 课题申报
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="课题名称" required>
          <Input placeholder="请输入课题名称" value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="申报领域" required>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONAL_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="课题类别">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="研究目标与内容" required>
          <Textarea placeholder="请阐述课题的研究目标和主要研究内容"
            rows={4} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
        </FormField>
        <FormField label="研究方法与技术路线">
          <Textarea placeholder="请说明拟采用的研究方法和技术路线"
            rows={3} value={methods} onChange={(e) => setMethods(e.target.value)} />
        </FormField>
        <FormField label="预期成果">
          <Textarea placeholder="请说明预期达到的研究成果"
            rows={3} value={expectedResults}
            onChange={(e) => setExpectedResults(e.target.value)} />
        </FormField>
        <FormField label="研究基础">
          <Textarea placeholder="请说明已有的研究基础、前期成果等"
            rows={3} value={foundation} onChange={(e) => setFoundation(e.target.value)} />
        </FormField>
        <FormField label="经费预算（元）">
          <Input type="number" placeholder="选填" value={budget}
            onChange={(e) => setBudget(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成课题申报书" />
    </Card>
  );
};

export default ProjectApplicationTool;
