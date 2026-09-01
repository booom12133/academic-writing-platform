import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Button } from '@client/src/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 20;

const TaskAssignmentTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [major, setMajor] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [advisor, setAdvisor] = useState('');
  const [requirements, setRequirements] = useState('');
  const [references, setReferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && major && requirements.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'task-assignment',
        title: title.trim(),
        inputData: {
          major, studentName, studentId, advisor, requirements, references,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit ta task failed', JSON.stringify(err)); }
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
          <ClipboardList className="h-5 w-5 text-blue-600" /> 任务书
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="论文题目" required>
          <Input placeholder="请输入论文题目" value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="专业" required>
          <Input placeholder="请输入专业名称" value={major}
            onChange={(e) => setMajor(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="学生姓名">
            <Input placeholder="选填" value={studentName}
              onChange={(e) => setStudentName(e.target.value)} />
          </FormField>
          <FormField label="学号">
            <Input placeholder="选填" value={studentId}
              onChange={(e) => setStudentId(e.target.value)} />
          </FormField>
          <FormField label="指导教师">
            <Input placeholder="选填" value={advisor}
              onChange={(e) => setAdvisor(e.target.value)} />
          </FormField>
        </div>
        <FormField label="任务要求" required>
          <Textarea placeholder="请详细描述任务的主要内容、目标和要求"
            rows={5} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
        <FormField label="主要参考文献">
          <Textarea placeholder="请粘贴主要参考文献（选填）"
            rows={2} value={references}
            onChange={(e) => setReferences(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成任务书" />
    </Card>
  );
};

export default TaskAssignmentTool;
