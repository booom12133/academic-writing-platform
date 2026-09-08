import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Sparkles, CheckCircle, ArrowRight, Upload, FileText } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { DocumentWorkspacePicker } from '@client/src/components/documents/DocumentWorkspacePicker';
import type { Task } from '@shared/api.interface';
import type { WorkspaceDocumentSelection } from '@shared/knowledge-product.interface';
import { readContinueState } from '@client/src/lib/task-actions';

const POLISH_TYPES = [
  { value: 'grammar', label: '语法纠错' },
  { value: 'academic', label: '学术化表达提升' },
  { value: 'rewrite', label: '降重改写' },
  { value: 'logic', label: '逻辑结构优化' },
];

const PolishTool: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const continueConsumed = useRef(false);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [polishType, setPolishType] = useState('grammar');
  const [workspaceSelection, setWorkspaceSelection] = useState<WorkspaceDocumentSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  useEffect(() => {
    if (continueConsumed.current) return;
    continueConsumed.current = true;
    const state = readContinueState('polish', location.state);
    if (!state) return;
    const inputData = state.inputData;
    const mode = inputData.inputMode === 'file' ? 'file' : 'text';
    setInputMode(mode);
    if (typeof inputData.text === 'string') setText(inputData.text);
    if (typeof inputData.polishType === 'string') setPolishType(inputData.polishType);
    if (mode === 'file' && inputData.documentRef) {
      setWorkspaceSelection({
        documentRef: inputData.documentRef as WorkspaceDocumentSelection['documentRef'],
        documentId: '',
        documentVersionId: '',
        displayName: state.title,
      });
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const wordCount = text.length;
  const pointsCost = Math.max(10, Math.ceil(wordCount / 1000) * 10);

  const canSubmit =
    (inputMode === 'text' && text.trim().length > 0) ||
    (inputMode === 'file' && workspaceSelection !== null);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitPolishTask({
        inputMode,
        title: inputMode === 'text'
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : workspaceSelection?.displayName || '文档润色',
        text: inputMode === 'text' ? text : undefined,
        documentRef: inputMode === 'file' ? workspaceSelection?.documentRef : undefined,
        polishType,
        wordCount: inputMode === 'text' ? wordCount : undefined,
      });
      setResult(task);
    } catch (err) {
      logger.error('submit polish task failed', JSON.stringify(err));
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
            <span className="text-slate-500">润色类型</span>
            <span className="text-slate-700">
              {POLISH_TYPES.find((t) => t.value === polishType)?.label}
            </span>
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
        <CardTitle className="text-lg">语法润色</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'file')}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1">
              <FileText className="h-4 w-4" />
              粘贴文本
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4" />
              上传文档
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-4">
            <div className="space-y-2">
              <Textarea
                placeholder="请粘贴需要润色的文本内容..."
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>字数统计：{wordCount} 字</span>
                <span>预计消耗：{pointsCost} 积分</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <DocumentWorkspacePicker
              value={workspaceSelection}
              onChange={setWorkspaceSelection}
            />
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            润色类型 <span className="text-red-500">*</span>
          </label>
          <Select value={polishType} onValueChange={setPolishType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLISH_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        {inputMode === 'file' ? (
          <>
            <>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
              >
                <Sparkles className="h-4 w-4" />
                {loading ? '提交中...' : '开始润色'}
              </Button>
              <p className="text-xs text-slate-500">
                页面仅显示文本估算，最终积分以服务器准备后的内容计费为准
              </p>
            </>
          </>
        ) : (
          <>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
            >
              <Sparkles className="h-4 w-4" />
              {loading ? '提交中...' : `开始润色（${pointsCost}积分起）`}
            </Button>
            <p className="text-xs text-slate-500">
              页面仅显示估算，最终积分以服务器准备后的内容计费为准
            </p>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default PolishTool;
