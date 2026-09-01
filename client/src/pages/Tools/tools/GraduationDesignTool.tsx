import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/src/components/ui/select';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { aiToolsApi } from '@client/src/api/index';
import { PROFESSIONAL_FIELDS, EDUCATION_LEVELS, type Task } from '@shared/api.interface';
import { FileUploadZone, StepIndicator, SuccessCard, FormField, InfoBanner } from './ToolCommon';

const DESIGN_TYPES = ['系统设计', '产品设计', '工程设计', '艺术设计', '其他'];
const FILE_OPTIONS = [
  { value: '设计说明书', label: '设计说明书（必选）', fixed: true },
  { value: '源代码', label: '源代码' },
  { value: '设计图纸', label: '设计图纸' },
  { value: '3D模型', label: '3D模型' },
  { value: '演示PPT', label: '演示PPT' },
  { value: '数据文件', label: '数据文件' },
];
const BASE_POINTS = 100;

const GraduationDesignTool: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    major: '',
    education: '',
    designType: '系统设计',
    wordCount: '',
    fileTypes: ['设计说明书'],
    requirements: '',
  });
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Task | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const canStep1 = form.title.trim() && form.major && form.education && form.wordCount;

  const toggleFile = (v: string) => {
    if (v === '设计说明书') return;
    update('fileTypes', form.fileTypes.includes(v)
      ? form.fileTypes.filter((f) => f !== v) : [...form.fileTypes, v]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const task: Task = await aiToolsApi.submitTask({
        taskType: 'graduation-design',
        title: form.title.trim(),
        inputData: { ...form, wordCount: Number(form.wordCount), refCount: refFiles.length },
      });
      setResult(task);
    } catch (err) { logger.error('submit gd task failed', JSON.stringify(err)); }
    finally { setLoading(false); }
  };

  if (result) return (
    <Card><CardContent className="pt-6">
      <SuccessCard taskId={result.id} title={result.title} pointsCost={result.pointsCost}
        onView={() => navigate(`/tasks/${result.id}`)} />
    </CardContent></Card>
  );

  const stepTitles = ['填写基本信息', '确认设计方案', '提交任务'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">毕业设计创作</CardTitle>
          <Badge variant="secondary">步骤 {step}/3</Badge>
        </div>
        <StepIndicator current={step} total={3} titles={stepTitles} />
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 1 && (<>
          <FormField label="设计题目" required>
            <Input placeholder="请输入设计题目" value={form.title}
              onChange={(e) => update('title', e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="专业领域" required>
              <Select value={form.major} onValueChange={(v) => update('major', v)}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {PROFESSIONAL_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="学历层次" required>
              <Select value={form.education} onValueChange={(v) => update('education', v)}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="设计类型">
              <Select value={form.designType} onValueChange={(v) => update('designType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESIGN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="目标字数" required>
              <Input type="number" placeholder="请输入目标字数"
                value={form.wordCount} onChange={(e) => update('wordCount', e.target.value)} />
            </FormField>
          </div>
          <FormField label="需要生成的文件">
            <div className="grid grid-cols-3 gap-2">
              {FILE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox id={`gdf-${opt.value}`}
                    checked={form.fileTypes.includes(opt.value)} disabled={opt.fixed}
                    onCheckedChange={() => toggleFile(opt.value)} />
                  <Label htmlFor={`gdf-${opt.value}`} className="text-xs cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </div>
          </FormField>
          <FormField label="设计要求">
            <Textarea placeholder="请详细描述设计需求、功能要求、技术栈偏好等"
              rows={4} value={form.requirements}
              onChange={(e) => update('requirements', e.target.value)} />
          </FormField>
          <FormField label="参考资料">
            <FileUploadZone files={refFiles} onChange={setRefFiles}
              label="上传参考资料" hint="支持 PDF、Word、图片等格式" />
          </FormField>
        </>)}

        {step === 2 && (
          <div className="space-y-4">
            <InfoBanner text="以下为设计方案预览，确认后将进入提交环节。实际生成内容会更详细。" tone="warning" />
            <div className="rounded-lg border border-slate-200 p-4 space-y-1.5 text-sm">
              <h4 className="font-semibold text-slate-800 mb-2">设计方案预览</h4>
              {['一、需求分析', '二、总体设计', '三、详细设计', '四、实现与测试',
                '五、设计总结与展望'].map((t, i) => (
                <div key={i} className="text-slate-700 font-medium">{t}</div>
              ))}
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">信息确认</p>
              <p>题目：{form.title || '未填写'}</p>
              <p>类型：{form.designType}</p>
              <p>专业：{form.major || '未选择'}</p>
              <p>字数：{form.wordCount || '未填写'} 字</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">任务确认</h4>
              {[['设计题目', form.title], ['专业领域', form.major],
                ['设计类型', form.designType], ['目标字数', `${form.wordCount} 字`],
                ['生成文件', form.fileTypes.join('、')]].map(([k, v]) => (
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
              点击下方按钮提交任务，AI将自动开始设计。
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
              确认方案 <ChevronRight className="h-4 w-4" />
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
        <p className="text-xs text-slate-500">提交即表示同意服务条款，AI生成内容仅供参考</p>
      </CardFooter>
    </Card>
  );
};

export default GraduationDesignTool;
