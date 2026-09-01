import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import { PieChart } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';
import { FileUploadZone, SuccessCard, FormField, SubmitFooter } from './ToolCommon';

const ANALYSIS_TYPES = [
  { value: 'descriptive', label: '描述性统计' },
  { value: 'regression', label: '回归分析' },
  { value: 'correlation', label: '相关性分析' },
  { value: 'hypothesis', label: '假设检验' },
  { value: 'cluster', label: '聚类分析' },
  { value: 'factor', label: '因子分析' },
  { value: 'mediator', label: '中介效应' },
  { value: 'moderator', label: '调节效应' },
];
const BASE_POINTS = 30;

const DataAnalysisTool: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [analysisTypes, setAnalysisTypes] = useState<string[]>([]);
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = files.length > 0 && analysisTypes.length > 0;

  const toggleType = (v: string) => {
    setAnalysisTypes((prev) =>
      prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'data-analysis',
        title: files[0]?.name || '数据分析',
        inputData: {
          fileName: files[0]?.name,
          fileSize: files[0]?.size,
          analysisTypes,
          requirements,
        },
      });
      setResult(task);
    } catch (err) { logger.error('submit da task failed', JSON.stringify(err)); }
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
          <PieChart className="h-5 w-5 text-blue-600" /> 数据分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="数据文件" required>
          <FileUploadZone files={files} onChange={setFiles}
            accept=".xlsx,.xls,.csv" multiple={false}
            label="上传数据文件" hint="支持 .xlsx / .xls / .csv 格式" />
        </FormField>

        <FormField label="分析类型（可多选）" required>
          <div className="grid grid-cols-2 gap-2">
            {ANALYSIS_TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <Checkbox id={`at-${t.value}`}
                  checked={analysisTypes.includes(t.value)}
                  onCheckedChange={() => toggleType(t.value)} />
                <Label htmlFor={`at-${t.value}`} className="text-xs cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </FormField>

        <FormField label="分析要求">
          <Textarea placeholder="请详细描述分析需求、变量说明、预期输出等"
            rows={4} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
      </CardContent>
      <SubmitFooter loading={loading} disabled={!canSubmit}
        points={BASE_POINTS} onClick={handleSubmit} label="生成数据分析报告" />
    </Card>
  );
};

export default DataAnalysisTool;
