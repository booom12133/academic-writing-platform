import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Newspaper } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, type Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const JOURNAL_DIRECTIONS = ['核心期刊', '普刊', 'SCI', 'EI', '其他'];
const BASE_POINTS = 50;

const JournalPaperTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [major, setMajor] = useState('');
  const [direction, setDirection] = useState('核心期刊');
  const [wordCount, setWordCount] = useState('');
  const [method, setMethod] = useState('');
  const [requirements, setRequirements] = useState('');
  const [references, setReferences] = useState('');
  const [dataFiles, setDataFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && major && wordCount;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'journal-paper',
        title: title.trim(),
        inputData: {
          major, direction,
          wordCount: Number(wordCount), method, requirements,
          references, dataCount: dataFiles.length,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit jp task failed', JSON.stringify(err)); }
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
          <Newspaper className="h-5 w-5 text-blue-600" /> 期刊论文
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
          <FormField label="目标期刊方向">
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOURNAL_DIRECTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="目标字数">
          <Input type="number" placeholder="请输入目标字数"
            value={wordCount} onChange={(e) => setWordCount(e.target.value)} />
        </FormField>
        <FormField label="研究方法">
          <Textarea placeholder="请描述拟采用的研究方法和技术路线"
            rows={3} value={method} onChange={(e) => setMethod(e.target.value)} />
        </FormField>
        <FormField label="写作要求">
          <Textarea placeholder="请说明期刊要求、格式偏好等"
            rows={3} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
        <FormField label="参考文献">
          <Textarea placeholder="请粘贴参考文献（选填）"
            rows={2} value={references}
            onChange={(e) => setReferences(e.target.value)} />
        </FormField>
        <FormField label="数据资料">
          <FileUploadZone files={dataFiles} onChange={setDataFiles}
            label="上传数据资料" hint="支持 Excel、CSV、PDF 等格式" />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成期刊论文" />
    </Card>
  );
};

export default JournalPaperTool;
