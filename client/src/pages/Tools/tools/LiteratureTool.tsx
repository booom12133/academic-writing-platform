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
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { BookOpen, CheckCircle, ArrowRight } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const MAJORS = [
  '计算机科学', '教育学', '医学', '经济学', '管理学', '文学', '法学', '理学', '工学',
];
const LITERATURE_COUNTS = ['5篇', '10篇', '15篇', '20篇'];

const LiteratureTool: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [major, setMajor] = useState('');
  const [count, setCount] = useState('10篇');
  const [yearRange, setYearRange] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = topic.trim() && keywords.trim() && major;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'literature',
        title: topic.trim(),
        inputData: {
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          major,
          count,
          yearRange,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit literature task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
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
            <span className="text-slate-500">研究主题</span>
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
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">文献素材推荐</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            研究主题 <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="请输入研究主题"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            关键词 <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="多个关键词用逗号分隔，如：深度学习,自然语言处理"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <p className="text-xs text-slate-500">多个关键词之间用英文逗号分隔</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              专业领域 <span className="text-red-500">*</span>
            </label>
            <Select value={major} onValueChange={setMajor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择专业" />
              </SelectTrigger>
              <SelectContent>
                {MAJORS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              文献数量
            </label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LITERATURE_COUNTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">年份范围</label>
          <Input
            placeholder="例如：2018-2024（选填）"
            value={yearRange}
            onChange={(e) => setYearRange(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <BookOpen className="h-4 w-4" />
          {loading ? '提交中...' : '推荐文献（30积分起）'}
        </Button>
        <p className="text-xs text-slate-500">
          AI基于语义分析推荐相关文献方向，供学术研究参考
        </p>
      </CardFooter>
    </Card>
  );
};

export default LiteratureTool;
