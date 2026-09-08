import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Textarea } from '@client/src/components/ui/textarea';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Edit3, Upload, FileText } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { DocumentWorkspacePicker } from '@client/src/components/documents/DocumentWorkspacePicker';
import type { Task } from '@shared/api.interface';
import type { WorkspaceDocumentSelection } from '@shared/knowledge-product.interface';
import { readContinueState } from '@client/src/lib/task-actions';
import {
  SuccessCard,
  FormField,
  SubmitFooter,
} from './ToolCommon';

const REVISION_TYPES = [
  { value: 'expand', label: '内容扩充' },
  { value: 'reduce', label: '内容精简' },
  { value: 'logic', label: '逻辑优化' },
  { value: 'academic', label: '学术化提升' },
  { value: 'format', label: '格式调整' },
];
const BASE_POINTS = 30;

const PaperRevisionTool: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const continueConsumed = useRef(false);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [workspaceSelection, setWorkspaceSelection] = useState<WorkspaceDocumentSelection | null>(null);
  const [revisionTypes, setRevisionTypes] = useState<string[]>([]);
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  useEffect(() => {
    if (continueConsumed.current) return;
    continueConsumed.current = true;
    const state = readContinueState('paper-revision', location.state);
    if (!state) return;
    const inputData = state.inputData;
    const mode = inputData.inputMode === 'file' ? 'file' : 'text';
    setInputMode(mode);
    if (typeof inputData.text === 'string') setText(inputData.text);
    if (Array.isArray(inputData.revisionTypes)) {
      setRevisionTypes(inputData.revisionTypes.filter((item): item is string => typeof item === 'string'));
    }
    if (typeof inputData.requirements === 'string') setRequirements(inputData.requirements);
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

  const canSubmit = aiToolsApi.canSubmitPaperRevision(
    inputMode,
    text,
    workspaceSelection?.documentRef ?? null,
    revisionTypes,
  );

  const toggleType = (v: string) => {
    setRevisionTypes((prev) =>
      prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitPaperRevisionTask({
        title: inputMode === 'text'
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : workspaceSelection?.displayName || '论文修改',
        inputMode,
        text: inputMode === 'text' ? text : undefined,
        documentRef: inputMode === 'file' ? workspaceSelection?.documentRef : undefined,
        revisionTypes,
        requirements,
        wordCount: inputMode === 'text' ? text.length : undefined,
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
          <Edit3 className="h-5 w-5 text-blue-600" /> AI论文修改
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'file')}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="flex-1">
              <FileText className="h-4 w-4" /> 粘贴文本
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4" /> 上传文档
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-4">
            <Textarea placeholder="请粘贴需要修改的论文内容..."
              rows={12} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>字数：{text.length} 字</span>
            </div>
          </TabsContent>
          <TabsContent value="file" className="mt-4">
            <DocumentWorkspacePicker
              value={workspaceSelection}
              onChange={setWorkspaceSelection}
            />
          </TabsContent>
        </Tabs>

        <FormField label="修改类型（可多选）">
          <div className="grid grid-cols-3 gap-2">
            {REVISION_TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <Checkbox id={`rt-${t.value}`}
                  checked={revisionTypes.includes(t.value)}
                  onCheckedChange={() => toggleType(t.value)} />
                <Label htmlFor={`rt-${t.value}`} className="text-xs cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </FormField>

        <FormField label="修改要求">
          <Textarea placeholder="请详细描述修改要求和注意事项（选填）"
            rows={3} value={requirements}
            onChange={(e) => setRequirements(e.target.value)} />
        </FormField>
      </CardContent>
      {inputMode === 'file' ? (
      <div className="border-t border-slate-100 pt-5">
        <SubmitFooter loading={loading} disabled={!canSubmit}
          points={BASE_POINTS} onClick={handleSubmit} label="开始修改" />
      </div>
      ) : (
        <SubmitFooter loading={loading} disabled={!canSubmit}
          points={BASE_POINTS} onClick={handleSubmit} label="开始修改" />
      )}
    </Card>
  );
};

export default PaperRevisionTool;
