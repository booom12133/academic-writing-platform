import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  BarChart3,
  CheckCircle,
  ArrowRight,
  Image as ImageIcon,
} from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const CHART_TYPES = [
  { value: 'roadmap', label: '技术路线图' },
  { value: 'flowchart', label: '流程图' },
  { value: 'org', label: '组织架构图' },
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'pie', label: '饼图' },
  { value: 'sequence', label: '时序图' },
  { value: 'er', label: 'E-R图' },
];

const ChartTool: React.FC = () => {
  const navigate = useNavigate();
  const [chartType, setChartType] = useState('flowchart');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'chart',
        title: `${CHART_TYPES.find((c) => c.value === chartType)?.label}`,
        inputData: {
          chartType,
          description,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit chart task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const chartTypeName = CHART_TYPES.find((c) => c.value === chartType)?.label;

  if (result) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              任务提交成功
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">任务ID</span>
              <span className="font-mono text-slate-700">{result.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">图表类型</span>
              <span className="text-slate-700">{result.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">消耗积分</span>
              <span className="text-amber-600 font-medium">{result.pointsCost} 积分</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">当前状态</span>
              <Badge variant="secondary">等待中</Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => navigate(`/tasks/${result.id}`)}
            >
              查看任务进度
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">预览区</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
              <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">图表生成中，请稍候...</p>
              <p className="mt-1 text-xs text-slate-400">
                生成完成后可在此预览
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">图表配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              图表类型 <span className="text-red-500">*</span>
            </label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              文本描述 <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="请描述图表的阶段、节点、关系或数据..."
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              例如：第一阶段：文献综述，第二阶段：提出假设，第三阶段：实证研究
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            <BarChart3 className="h-4 w-4" />
            {loading ? '生成中...' : '生成图表（25积分）'}
          </Button>
          <p className="text-xs text-slate-500">
            支持导出Mermaid源码和图片格式
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">预览区</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            <BarChart3 className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">图表预览</p>
            <p className="mt-1 text-xs text-slate-400">
              填写左侧信息后生成{chartTypeName}
            </p>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">
              Mermaid 代码预览
            </p>
            <pre className="overflow-x-auto text-xs text-slate-500">
              <code>
{`graph TD
    A[开始] --> B[描述图表]
    B --> C[生成图表]
    C --> D[导出使用]`}
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChartTool;
