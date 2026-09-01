import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { FileEdit } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, type Task } from '@shared/api.interface';
import { SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 30;

const CoursePaperTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [major, setMajor] = useState('');
  const [wordCount, setWordCount] = useState('');
  const [requirements, setRequirements] = useState('');
  const [references, setReferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && courseName.trim() && major && wordCount;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'course-paper',
        title: title.trim(),
        inputData: {
          courseName, major,
          wordCount: Number(wordCount), requirements, references,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit cp task failed', JSON.stringify(err)); }
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
          <FileEdit className="h-5 w-5 text-blue-600" /> 课程论文
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="论文题目" required>
          <Input placeholder="请输入论文题目" value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="课程名称" required>
            <Input placeholder="请输入课程名称" value={courseName}
              onChange={(e) => setCourseName(e.target.value)} />
          </FormField>
          <FormField label="专业领域" required>
            <Select value={major} onValueChange={setMajor}>
              <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONAL_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="目标字数" required>
          <Input type="number" placeholder="请输入目标字数"
            value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
        </FormField>
        <FormField label="写作要求">
          <Textarea placeholder="请说明写作要求、结构偏好、特殊格式等（选填）"
            rows={4} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
        <FormField label="参考文献">
          <Textarea placeholder="请粘贴参考文献（选填）"
            rows={2} value={references}
            onChange={(e) => setReferences(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成课程论文" />
    </Card>
  );
};

export default CoursePaperTool;
