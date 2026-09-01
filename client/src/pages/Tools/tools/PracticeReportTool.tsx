import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Briefcase } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, type Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const PRACTICE_TYPES = ['实习报告', '社会实践报告', '实验报告', '调研报告'];
const BASE_POINTS = 30;

const PracticeReportTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [practiceType, setPracticeType] = useState('实习报告');
  const [major, setMajor] = useState('');
  const [location, setLocation] = useState('');
  const [wordCount, setWordCount] = useState('');
  const [content, setContent] = useState('');
  const [harvest, setHarvest] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && major && content.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'practice-report',
        title: title.trim(),
        inputData: {
          practiceType, major, location,
          wordCount: wordCount ? Number(wordCount) : undefined,
          content, harvest, fileCount: files.length,
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
          <Briefcase className="h-5 w-5 text-blue-600" /> 实践报告
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="报告题目" required>
          <Input placeholder="请输入报告题目" value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="实践类型">
            <Select value={practiceType} onValueChange={setPracticeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRACTICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="实践单位/地点">
            <Input placeholder="选填" value={location}
              onChange={(e) => setLocation(e.target.value)} />
          </FormField>
          <FormField label="目标字数">
            <Input type="number" placeholder="请输入目标字数"
              value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
          </FormField>
        </div>
        <FormField label="实践内容与过程" required>
          <Textarea placeholder="请详细描述实践的主要内容、过程和经历"
            rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </FormField>
        <FormField label="收获与体会">
          <Textarea placeholder="请描述实践中的收获、感悟和体会（选填）"
            rows={3} value={harvest} onChange={(e) => setHarvest(e.target.value)} />
        </FormField>
        <FormField label="相关资料">
          <FileUploadZone files={files} onChange={setFiles}
            label="上传相关资料" hint="支持图片、文档等格式" />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成实践报告" />
    </Card>
  );
};

export default PracticeReportTool;
