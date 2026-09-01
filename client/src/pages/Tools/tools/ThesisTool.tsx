import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { ChevronRight, ChevronLeft, ListTree } from 'lucide-react';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, EDUCATION_LEVELS, CITATION_FORMATS, type Task } from '@shared/api.interface';
import { FileUploadZone, StepIndicator, SuccessCard, FormField, InfoBanner } from './ToolCommon';

const DATA_STATUS = ['不需要', '需要但我现在没有数据', '数据在资料中'];
const FILE_OPTIONS = [
  { value: '范文', label: '范文（必选）', fixed: true },
  { value: '数据文件', label: '数据文件' },
  { value: '访谈大纲', label: '访谈大纲' },
  { value: '问卷', label: '问卷' },
  { value: '代码', label: '代码' },
  { value: '3D模型', label: '3D模型' },
];
const BASE_POINTS = 80;

interface ThesisForm {
  title: string;
  major: string;
  education: string;
  wordCount: string;
  dataStatus: string;
  citationFormat: string;
  fileTypes: string[];
  requirements: string;
  references: string;
}

const ThesisTool: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ThesisForm>({
    title: '',
    major: '',
    education: '',
    wordCount: '',
    dataStatus: '不需要',
    citationFormat: 'GB/T 7714',
    fileTypes: ['范文'],
    requirements: '',
    references: '',
  });
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [templateFiles, setTemplateFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const update = <K extends keyof ThesisForm>(key: K, value: ThesisForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const canStep1 =
    form.title.trim() && form.major && form.education && form.wordCount &&
    Number(form.wordCount) >= 500 && Number(form.wordCount) <= 200000;

  const toggleFile = (v: string) => {
    if (v === '范文') return;
    update('fileTypes', form.fileTypes.includes(v)
      ? form.fileTypes.filter((f) => f !== v)
      : [...form.fileTypes, v]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'thesis',
        title: form.title.trim(),
        inputData: {
          ...form,
          wordCount: Number(form.wordCount),
          resourceCount: resourceFiles.length,
          templateName: templateFiles[0]?.name,
        },
      });
      setResult(task);
    } catch (err) {
      logger.error('submit thesis task failed', JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card><CardContent className="pt-6">
        <SuccessCard taskId={result.id} title={result.title}
          pointsCost={result.pointsCost}
          onView={() => navigate(`/tasks/${result.id}`)} />
      </CardContent></Card>
    );
  }

  const stepTitles = ['填写基本信息', '确认大纲预览', '提交任务'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">毕业论文创作</CardTitle>
          <Badge variant="secondary">步骤 {step}/3</Badge>
        </div>
        <StepIndicator current={step} total={3} titles={stepTitles} />
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 1 && (
          <>
            <FormField label="论文标题" required>
              <Input placeholder="请输入论文标题" value={form.title}
                onChange={(e) => update('title', e.target.value)} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="专业领域" required>
                <Select value={form.major} onValueChange={(v) => update('major', v)}>
                  <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    {PROFESSIONAL_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="学历层次" required>
                <Select value={form.education} onValueChange={(v) => update('education', v)}>
                  <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVELS.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="目标字数" required>
                <Input type="number" min={500} max={200000}
                  placeholder="500 ~ 200000 字"
                  value={form.wordCount}
                  onChange={(e) => update('wordCount', e.target.value)} />
              </FormField>
              <FormField label="数据状态">
                <Select value={form.dataStatus} onValueChange={(v) => update('dataStatus', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATA_STATUS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="引文格式">
              <Select value={form.citationFormat}
                onValueChange={(v) => update('citationFormat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CITATION_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="需要生成的文件">
              <div className="grid grid-cols-3 gap-2">
                {FILE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox id={`tf-${opt.value}`}
                      checked={form.fileTypes.includes(opt.value)}
                      disabled={opt.fixed}
                      onCheckedChange={() => toggleFile(opt.value)} />
                    <Label htmlFor={`tf-${opt.value}`} className="text-xs cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </FormField>

            <FormField label="写作要求">
              <Textarea
                placeholder="请详细描述您的写作要求、结构偏好等（最多5000字）"
                rows={3} maxLength={5000} value={form.requirements}
                onChange={(e) => update('requirements', e.target.value)} />
              <p className="text-xs text-slate-500 text-right">
                {form.requirements.length}/5000
              </p>
            </FormField>

            <FormField label="参考文献">
              <Textarea placeholder="请粘贴参考文献列表（选填）" rows={2}
                value={form.references}
                onChange={(e) => update('references', e.target.value)} />
            </FormField>

            <FormField label="相关资料文件">
              <FileUploadZone files={resourceFiles} onChange={setResourceFiles}
                label="上传参考资料" hint="支持 PDF、Word、图片等格式" />
            </FormField>

            <FormField label="格式模板上传">
              <FileUploadZone files={templateFiles} onChange={setTemplateFiles}
                accept=".docx" multiple={false}
                label="上传 .docx 格式模板" hint="学校格式模板更佳" />
            </FormField>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <InfoBanner text="以下为AI根据您的信息生成的大纲预览，确认后将进入提交环节。" tone="warning" />
            <OutlinePreview />
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">信息确认</p>
              <p>标题：{form.title || '未填写'}</p>
              <p>专业：{form.major || '未选择'}</p>
              <p>学历：{form.education || '未选择'}</p>
              <p>字数：{form.wordCount || '未填写'} 字</p>
              <p>引文格式：{form.citationFormat}</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">任务确认</h4>
              {[
                ['论文题目', form.title],
                ['专业领域', form.major],
                ['学历层次', form.education],
                ['目标字数', `${form.wordCount} 字`],
                ['引文格式', form.citationFormat],
                ['生成文件', form.fileTypes.join('、')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-700 text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-slate-100 text-sm">
                <span className="text-slate-500">预计消耗</span>
                <span className="text-amber-600 font-semibold">{BASE_POINTS} 积分</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              点击下方按钮提交任务，AI将自动开始撰写。
              <br />完成后可在"我的任务"中查看和下载结果。
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-3 border-t border-slate-100 pt-5">
        {step === 1 && (
          <Button className="w-full" onClick={() => setStep(2)} disabled={!canStep1}>
            下一步 <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        {step === 2 && (
          <div className="w-full flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> 上一步
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              确认大纲 <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="w-full flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4" /> 返回修改
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? '提交中...' : `提交任务（${BASE_POINTS}积分）`}
            </Button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          提交即表示同意服务条款，AI生成内容仅供参考
        </p>
      </CardFooter>
    </Card>
  );
};

const OUTLINE_ITEMS = ['摘要', 'Abstract', '第一章 绪论', '第二章 相关理论与技术基础',
  '第三章 研究设计与方法', '第四章 实证分析与讨论', '第五章 结论与展望',
  '参考文献', '附录', '致谢'];

const OutlinePreview: React.FC = () => (
  <div className="rounded-lg border border-slate-200 p-4">
    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
      <ListTree className="h-4 w-4 text-blue-600" /> 论文大纲预览
    </h4>
    <div className="space-y-1.5 text-sm">
      {OUTLINE_ITEMS.map((t, i) => (
        <div key={i} className="text-slate-700 font-medium">{t}</div>
      ))}
    </div>
  </div>
);

export default ThesisTool;
