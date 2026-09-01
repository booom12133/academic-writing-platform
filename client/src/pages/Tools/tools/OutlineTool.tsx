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
import { Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const MAJORS = [
  '计算机科学', '教育学', '医学', '经济学', '管理学', '文学', '法学', '理学', '工学',
];
const DEGREES = ['专科', '本科', '硕士', '博士'];

const OutlineTool: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [major, setMajor] = useState('');
  const [degree, setDegree] = useState('');
  const [wordCount, setWordCount] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const canSubmit = title.trim() && major && degree;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'outline',
        title: title.trim(),
        inputData: {
          major,
          degree,
          wordCount: wordCount ? Number(wordCount) : undefined,
          requirements,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit outline task failed', JSON.stringify(err));
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
            <span className="text-slate-500">任务标题</span>
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
        <CardTitle className="text-lg">生成论文大纲</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            论文标题 <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="请输入论文标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
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
              学历层次 <span className="text-red-500">*</span>
            </label>
            <Select value={degree} onValueChange={setDegree}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择学历" />
              </SelectTrigger>
              <SelectContent>
                {DEGREES.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">目标字数</label>
          <Input
            type="number"
            placeholder="请输入目标字数（选填）"
            value={wordCount}
            onChange={(e) => setWordCount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">大纲要求</label>
          <Textarea
            placeholder="请说明章节数量、侧重点、特殊格式要求等（选填）"
            rows={4}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            例如：要求5个章节，重点在实证分析部分，需要包含摘要和参考文献
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <Sparkles className="h-4 w-4" />
          {loading ? '提交中...' : '生成大纲（20积分）'}
        </Button>
        <p className="text-xs text-slate-500">
          提交即表示同意服务条款，AI生成内容仅供参考
        </p>
      </CardFooter>
    </Card>
  );
};

export default OutlineTool;
