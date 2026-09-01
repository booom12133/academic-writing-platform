import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { FileText } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, EDUCATION_LEVELS, type Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const BASE_POINTS = 40;

const ProposalTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [major, setMajor] = useState('');
  const [education, setEducation] = useState('');
  const [background, setBackground] = useState('');
  const [contentMethod, setContentMethod] = useState('');
  const [plan, setPlan] = useState('');
  const [expectedResults, setExpectedResults] = useState('');
  const [references, setReferences] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && major && education;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'proposal',
        title: title.trim(),
        inputData: {
          major, education, background, contentMethod, plan,
          expectedResults, references, fileCount: files.length,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit proposal task failed', JSON.stringify(err)); }
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
          <FileText className="h-5 w-5 text-blue-600" /> 开题报告
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="论文题目" required>
          <Input placeholder="请输入论文题目" value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="专业领域" required>
            <Select value={major} onValueChange={setMajor}>
              <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONAL_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="学历层次" required>
            <Select value={education} onValueChange={setEducation}>
              <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="研究背景与意义">
          <Textarea placeholder="请阐述研究的背景、理论意义和现实意义"
            rows={3} value={background}
            onChange={(e) => setBackground(e.target.value)} />
        </FormField>
        <FormField label="研究内容与方法">
          <Textarea placeholder="请说明主要研究内容和拟采用的研究方法"
            rows={3} value={contentMethod}
            onChange={(e) => setContentMethod(e.target.value)} />
        </FormField>
        <FormField label="研究计划与进度安排">
          <Textarea placeholder="请说明各阶段的研究任务和时间安排"
            rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </FormField>
        <FormField label="预期成果">
          <Textarea placeholder="请说明预期达到的研究成果"
            rows={2} value={expectedResults}
            onChange={(e) => setExpectedResults(e.target.value)} />
        </FormField>
        <FormField label="参考文献">
          <Textarea placeholder="请粘贴主要参考文献（选填）"
            rows={2} value={references}
            onChange={(e) => setReferences(e.target.value)} />
        </FormField>
        <FormField label="相关资料">
          <FileUploadZone files={files} onChange={setFiles}
            label="上传相关资料" hint="支持 PDF、Word 等格式" />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成开题报告" />
    </Card>
  );
};

export default ProposalTool;
