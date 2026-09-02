import React, { useState } from 'react';
import { Upload, FileText, X, Info } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';

// ============= File Upload Zone =============

interface FileUploadZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onChange,
  accept = '.docx,.pdf,.xlsx,.xls,.csv',
  multiple = true,
  label = '上传文件',
  hint = '拖拽或点击上传',
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    onChange(multiple ? [...files, ...newFiles] : newFiles);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <Upload className="mb-2 h-6 w-6 text-slate-400" />
      {files.length > 0 ? (
        <div className="w-full text-center space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-center gap-2">
              <FileText className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-slate-700 truncate max-w-[180px]">
                {f.name}
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-500"
                onClick={(e) => { e.preventDefault(); removeFile(i); }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="mt-1 text-xs text-blue-600 hover:underline"
            onClick={(e) => { e.preventDefault(); onChange([]); }}
          >
            {multiple ? '清空文件' : '重新选择'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs text-slate-600 font-medium">{label}</p>
          <p className="mt-1 text-xs text-slate-500">
            拖拽到此处，或
            <label className="cursor-pointer text-blue-600 hover:underline">
              {' '}点击上传
              <input
                type="file"
                accept={accept}
                multiple={multiple}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
      )}
    </div>
  );
};

interface DocumentInputUploadActionProps {
  file: File | null;
  ready: boolean;
  uploading?: boolean;
  error?: string | null;
  onUpload: () => void;
}

export const DocumentInputUploadAction: React.FC<DocumentInputUploadActionProps> = ({
  file,
  ready,
  uploading = false,
  error,
  onUpload,
}) => (
  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
    {ready ? (
      <p className="text-sm font-medium text-emerald-700">文档已准备就绪：{file?.name}</p>
    ) : (
      <Button className="w-full" onClick={onUpload} disabled={!file || uploading}>
        {uploading ? '上传并准备中...' : '上传并准备文档'}
      </Button>
    )}
    {error && <p className="text-xs text-red-600">{error}</p>}
    <p className="text-xs text-slate-500">C4 仅完成文档上传与准备，不会创建 AI 任务或扣除积分。</p>
  </div>
);

// ============= Step Indicator =============

interface StepIndicatorProps {
  current: number;
  total: number;
  titles?: string[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  current,
  total,
  titles = [],
}) => {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium flex-shrink-0 ${
                current >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {current > s ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < total && (
              <div
                className={`mx-2 h-0.5 flex-1 rounded ${
                  current > s ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      {titles[current - 1] && (
        <p className="mt-2 text-xs text-slate-500">{titles[current - 1]}</p>
      )}
    </div>
  );
};

// ============= Success Card =============

interface SuccessCardProps {
  taskId: string;
  title: string;
  pointsCost: number;
  onView: () => void;
}

export const SuccessCard: React.FC<SuccessCardProps> = ({
  taskId,
  title,
  pointsCost,
  onView,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-800">任务提交成功</h3>
      </div>
      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex justify-between">
          <span className="text-slate-500">任务ID</span>
          <span className="font-mono text-slate-700">{taskId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">任务标题</span>
          <span className="text-slate-700 truncate max-w-[60%] text-right">{title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">消耗积分</span>
          <span className="text-amber-600 font-medium">{pointsCost} 积分</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">当前状态</span>
          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">等待中</span>
        </div>
      </div>
      <button
        onClick={onView}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        查看任务进度
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

// ============= Form Field =============

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

// ============= Info Banner =============

interface InfoBannerProps {
  text: string;
  tone?: 'info' | 'warning' | 'tip';
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ text, tone = 'info' }) => {
  const toneMap = {
    info: 'border-blue-200 bg-blue-50/50 text-blue-700',
    warning: 'border-amber-200 bg-amber-50/50 text-amber-700',
    tip: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${toneMap[tone]}`}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="text-xs leading-relaxed">{text}</p>
      </div>
    </div>
  );
};

// ============= Submit Footer =============

interface SubmitFooterProps {
  loading?: boolean;
  disabled?: boolean;
  points: number;
  onClick: () => void;
  label?: string;
  hint?: string;
}

export const SubmitFooter: React.FC<SubmitFooterProps> = ({
  loading,
  disabled,
  points,
  onClick,
  label = '提交任务',
  hint = '提交即表示同意服务条款，AI生成内容仅供参考',
}) => (
  <div className="flex-col gap-3 border-t border-slate-100 pt-5 flex">
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {loading ? '提交中...' : `${label}（${points}积分）`}
    </button>
    <p className="text-xs text-slate-500 text-center">{hint}</p>
  </div>
);
