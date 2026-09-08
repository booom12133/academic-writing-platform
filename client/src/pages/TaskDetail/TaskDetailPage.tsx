import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileText,
  BookOpen,
  Sparkles,
  LayoutTemplate,
  SearchCheck,
  BarChart3,
  Copy,
  GraduationCap,
  Palette,
  Lightbulb,
  Bookmark,
  ClipboardList,
  FileEdit,
  Newspaper,
  Briefcase,
  Target,
  Edit3,
  MessageSquare,
  PieChart,
  FormInput,
  RotateCcw,
  CalendarClock,
  LightbulbIcon,
  Award,
  TrendingUp,
  Users,
  BookOpenCheck,
  FlaskConical,
  Microscope,
  ListOrdered,
  GripVertical,
  Calculator,
  Eraser,
  Presentation,
  ImageIcon,
  Mic,
  Palette as PaletteIcon,
  ArrowRight as ArrowRightIcon,
  TrendingDown,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Progress } from '@client/src/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';

import { aiToolsApi, taskApi } from '@client/src/api/index';
import type { Task, TaskStatus, TaskType } from '@shared/api.interface';
import { TOOL_CONFIGS } from '@shared/api.interface';
import { TaskResultActions } from '@client/src/components/tasks/TaskResultActions';
import { TaskStatePanel } from '@client/src/components/tasks/TaskStatePanel';
import { buildContinueState, buildRerunPayload } from '@client/src/lib/task-actions';
import { adaptTaskResult } from '@client/src/lib/task-result';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '等待中',
  processing: '进行中',
  completed: '已完成',
  failed: '失败',
};

const STATUS_VARIANTS: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

const TYPE_VARIANTS: Record<TaskType, string> = {
  'thesis': 'bg-blue-50 text-blue-700 border-blue-200',
  'graduation-design': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  outline: 'bg-blue-50 text-blue-700 border-blue-200',
  'topic-generation': 'bg-amber-50 text-amber-700 border-amber-200',
  literature: 'bg-purple-50 text-purple-700 border-purple-200',
  'literature-review': 'bg-violet-50 text-violet-700 border-violet-200',
  proposal: 'bg-sky-50 text-sky-700 border-sky-200',
  'task-assignment': 'bg-blue-50 text-blue-700 border-blue-200',
  'course-paper': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'journal-paper': 'bg-purple-50 text-purple-700 border-purple-200',
  'practice-report': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'project-application': 'bg-blue-50 text-blue-700 border-blue-200',
  'paper-revision': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'comment-revision': 'bg-violet-50 text-violet-700 border-violet-200',
  polish: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  format: 'bg-amber-50 text-amber-700 border-amber-200',
  check: 'bg-rose-50 text-rose-700 border-rose-200',
  chart: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'data-analysis': 'bg-teal-50 text-teal-700 border-teal-200',
  'questionnaire-design': 'bg-orange-50 text-orange-700 border-orange-200',
  'paper-reverse': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'ai-reduce': 'bg-orange-50 text-orange-700 border-orange-200',
  'ai-ppt': 'bg-violet-50 text-violet-700 border-violet-200',
};

const TYPE_ICONS: Record<TaskType, typeof FileText> = {
  'thesis': GraduationCap,
  'graduation-design': Palette,
  outline: FileText,
  'topic-generation': Lightbulb,
  literature: BookOpen,
  'literature-review': Bookmark,
  proposal: FileText,
  'task-assignment': ClipboardList,
  'course-paper': FileEdit,
  'journal-paper': Newspaper,
  'practice-report': Briefcase,
  'project-application': Target,
  'paper-revision': Edit3,
  'comment-revision': MessageSquare,
  polish: Sparkles,
  format: LayoutTemplate,
  check: SearchCheck,
  chart: BarChart3,
  'data-analysis': PieChart,
  'questionnaire-design': FormInput,
  'paper-reverse': RotateCcw,
  'ai-reduce': Eraser,
  'ai-ppt': Presentation,
};

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getTypeName(type: TaskType): string {
  const cfg = TOOL_CONFIGS.find((c) => c.type === type);
  return cfg?.name || type;
}

// --- Result Renderers ---

function OutlineResult({ resultData }: { resultData: Record<string, any> }) {
  const chapters = resultData?.chapters || resultData?.outline || resultData?.sections || [];
  if (!chapters || chapters.length === 0) {
    return (
      <div className="text-slate-500 text-sm">暂无大纲数据</div>
    );
  }

  const renderChapter = (chapter: any, level: number = 0) => {
    const indent = level * 20;
    const title = chapter.title || chapter.name || '';
    const points = chapter.points || chapter.keyPoints || chapter.description || [];
    const children = chapter.children || chapter.subsections || chapter.subChapters || [];

    return (
      <div key={title} style={{ marginLeft: indent }}>
        <div className="py-2 border-l-2 border-blue-200 pl-3 mb-1">
          <div className="font-medium text-slate-800 text-sm">
            {chapter.numbering ? `${chapter.numbering} ` : ''}
            {title}
          </div>
          {Array.isArray(points) && points.length > 0 && (
            <ul className="mt-2 space-y-1">
              {points.map((p: string, i: number) => (
                <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                  <span className="text-blue-400 flex-shrink-0">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          {typeof points === 'string' && (
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
              {points}
            </div>
          )}
        </div>
        {children && children.length > 0 && (
          <div>
            {children.map((child: any) => renderChapter(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {chapters.map((chapter: any, idx: number) => renderChapter(chapter, 0))}
    </div>
  );
}

function LiteratureResult({ resultData }: { resultData: Record<string, any> }) {
  const papers = resultData?.papers || resultData?.literatures || [];
  if (!papers || papers.length === 0) {
    return <div className="text-slate-500 text-sm">暂无文献数据</div>;
  }

  return (
    <div className="space-y-4">
      {papers.map((paper: any, idx: number) => (
        <div
          key={idx}
          className="p-4 border border-slate-200 rounded-lg hover:border-purple-300 transition-colors"
        >
          <div className="font-medium text-slate-800 text-sm mb-2">
            {paper.title}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
            <span>{paper.authors || paper.author || '未知作者'}</span>
            <span>·</span>
            <span>{paper.year || paper.publicationYear || '未知年份'}</span>
            {paper.journal && (
              <>
                <span>·</span>
                <span className="text-purple-600">{paper.journal}</span>
              </>
            )}
          </div>
          {paper.abstract && (
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
              {paper.abstract}
            </p>
          )}
          {paper.doi && (
            <div className="mt-2 text-xs text-purple-600">
              DOI: {paper.doi}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PolishResult({ resultData }: { resultData: Record<string, any> }) {
  const original = resultData?.originalContent || resultData?.original || resultData?.originalText || '';
  const polished = resultData?.revisedContent || resultData?.polished || resultData?.polishedText || '';
  const suggestions = resultData?.changes || resultData?.suggestions || [];
  const warnings = resultData?.warnings || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              原文
            </Badge>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {original || '暂无原文数据'}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              润色后
            </Badge>
          </div>
          <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50/50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {polished || '暂无润色结果'}
          </div>
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-medium text-slate-600 mb-3">
            修改建议
          </div>
          <div className="space-y-3">
            {suggestions.map((s: any, idx: number) => (
              <div
                key={idx}
                className="p-3 border border-slate-200 rounded-lg"
              >
                <div className="text-sm font-medium text-slate-700 mb-1">
                  {s.type && (
                    <Badge variant="outline" className="mr-2 bg-blue-50 text-blue-700 border-blue-200">
                      {s.type}
                    </Badge>
                  )}
                  {s.title || `建议 ${idx + 1}`}
                </div>
                {s.original && (
                  <div className="text-xs text-slate-500 mt-2">
                    <span className="text-red-500 line-through">
                      {s.original}
                    </span>
                    <span className="mx-2">→</span>
                    <span className="text-emerald-600 font-medium">
                      {s.revised || s.suggestion}
                    </span>
                  </div>
                )}
                {s.reason && (
                  <div className="text-xs text-slate-500 mt-1">
                    原因：{s.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/40 text-sm text-amber-700">
          <div className="font-medium mb-1">校验提示</div>
          {warnings.map((warning: string, idx: number) => <div key={idx}>{warning}</div>)}
        </div>
      )}
    </div>
  );
}

function FormatResult({ resultData }: { resultData: Record<string, any> }) {
  const summary = resultData?.summary || resultData?.description || '';
  const changes = resultData?.changes || resultData?.formattingChanges || [];

  return (
    <div className="space-y-4">
      <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/50">
        <div className="text-sm font-medium text-amber-800 mb-2">
          处理结果说明
        </div>
        <p className="text-sm text-amber-700 leading-relaxed">
          {summary || '文档格式已按照指定规范完成排版，包括字体、字号、行距、页边距、标题层级、引用格式等调整。'}
        </p>
      </div>

      {changes && changes.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-600">格式调整项</div>
          <div className="space-y-2">
            {changes.map((change: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{change}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckResult({ resultData }: { resultData: Record<string, any> }) {
  const similarity =
    resultData?.overallSimilarity ??
    resultData?.similarity ??
    resultData?.similarityRate ??
    0;
  const duplicateParts =
    resultData?.duplicateSegments ||
    resultData?.duplicateParts ||
    resultData?.duplicates ||
    [];
  const totalWords = resultData?.totalWords || resultData?.wordCount || 0;
  const duplicateWords = resultData?.duplicateWords || 0;

  const getSimilarityColor = (rate: number) => {
    if (rate < 15) return 'text-emerald-600';
    if (rate < 30) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* 重复率概览 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 border border-slate-200 rounded-lg text-center">
          <div className="text-3xl font-semibold mb-1" style={{ color: similarity < 15 ? '#10b981' : similarity < 30 ? '#f59e0b' : '#ef4444' }}>
            {typeof similarity === 'number' ? similarity.toFixed(1) : similarity}%
          </div>
          <div className="text-sm text-slate-500">总体重复率</div>
        </div>
        <div className="p-5 border border-slate-200 rounded-lg text-center">
          <div className="text-3xl font-semibold text-slate-800 mb-1">
            {totalWords || '-'}
          </div>
          <div className="text-sm text-slate-500">总字数</div>
        </div>
        <div className="p-5 border border-slate-200 rounded-lg text-center">
          <div className="text-3xl font-semibold text-slate-800 mb-1">
            {duplicateWords || duplicateParts.length || 0}
          </div>
          <div className="text-sm text-slate-500">
            {duplicateWords ? '重复字数' : '重复片段'}
          </div>
        </div>
      </div>

      {/* 重复片段列表 */}
      {duplicateParts && duplicateParts.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-3">
            重复片段列表
          </div>
          <div className="space-y-3">
            {duplicateParts.map((part: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-red-100 rounded-lg bg-red-50/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                    片段 {idx + 1}
                  </Badge>
                  {part.source && (
                    <span className="text-xs text-slate-500">
                      来源：{part.source}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {part.text || part.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartResult({ resultData }: { resultData: Record<string, any> }) {
  const mermaidCode = resultData?.mermaid || resultData?.chartCode || resultData?.diagram || '';
  const description = resultData?.description || resultData?.title || '';

  return (
    <div className="space-y-4">
      {description && (
        <div className="text-sm text-slate-600">{description}</div>
      )}
      <div className="p-6 border border-slate-200 rounded-lg bg-slate-50 flex flex-col items-center justify-center min-h-[300px]">
        {mermaidCode ? (
          <>
            <BarChart3 className="h-12 w-12 text-indigo-400 mb-3" />
            <p className="text-sm text-slate-500 mb-3">图表代码已生成</p>
            <div className="w-full mt-2">
              <div className="text-xs text-slate-500 mb-1">Mermaid 代码：</div>
              <pre className="text-xs bg-white p-3 rounded-md border border-slate-200 overflow-x-auto text-slate-700 whitespace-pre-wrap">
                {mermaidCode}
              </pre>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                navigator.clipboard?.writeText(mermaidCode);
              }}
            >
              <Copy className="h-4 w-4" />
              复制代码
            </Button>
          </>
        ) : (
          <div className="text-slate-400">暂无图表数据</div>
        )}
      </div>
    </div>
  );
}

// --- Thesis Result ---

function ThesisResult({ resultData }: { resultData: Record<string, any> }) {
  const outline = resultData?.outline || resultData?.chapters || [];
  const chapters = resultData?.chapters || resultData?.chapterContents || [];
  const references = resultData?.references || resultData?.refs || [];
  const suggestions = resultData?.suggestions || resultData?.writingSuggestions || [];

  return (
    <div className="space-y-6">
      {outline && outline.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-blue-600" />
            论文大纲
          </div>
          <div className="space-y-1 pl-1">
            {outline.map((item: any, idx: number) => (
              <div
                key={idx}
                className="py-2 border-l-2 border-blue-200 pl-3 mb-1"
              >
                <div className="font-medium text-slate-800 text-sm">
                  {item.numbering ? `${item.numbering} ` : ''}
                  {item.title || item.name || `第 ${idx + 1} 章`}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {chapters && chapters.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-blue-600" />
            章节内容
          </div>
          <div className="space-y-4">
            {chapters.map((ch: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="font-medium text-slate-800 text-sm mb-2">
                  {ch.title || ch.name || `第 ${idx + 1} 章`}
                </div>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {ch.content || ch.text || '暂无内容'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-blue-600" />
            参考文献
          </div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LightbulbIcon className="h-4 w-4 text-amber-500" />
            写作建议
          </div>
          <div className="space-y-2">
            {suggestions.map((s: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-amber-100 rounded-lg bg-amber-50/50 text-sm text-slate-700"
              >
                <span className="text-amber-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!outline?.length && !chapters?.length && !references?.length && !suggestions?.length && (
        <div className="text-slate-500 text-sm">暂无毕业论文数据</div>
      )}
    </div>
  );
}

// --- Graduation Design Result ---

function GraduationDesignResult({ resultData }: { resultData: Record<string, any> }) {
  const designOutline = resultData?.designOutline || resultData?.outline || [];
  const designDescription = resultData?.designDescription || resultData?.description || '';
  const deliverables = resultData?.deliverables || resultData?.deliverableList || [];
  const references = resultData?.references || [];

  return (
    <div className="space-y-6">
      {designDescription && (
        <div className="p-4 border border-indigo-100 rounded-lg bg-indigo-50/50">
          <div className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            设计说明
          </div>
          <p className="text-sm text-indigo-700 leading-relaxed whitespace-pre-wrap">
            {designDescription}
          </p>
        </div>
      )}

      {designOutline && designOutline.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-indigo-600" />
            设计大纲
          </div>
          <div className="space-y-1 pl-1">
            {designOutline.map((item: any, idx: number) => (
              <div
                key={idx}
                className="py-2 border-l-2 border-indigo-200 pl-3 mb-1"
              >
                <div className="font-medium text-slate-800 text-sm">
                  {item.numbering ? `${item.numbering} ` : ''}
                  {item.title || item.name || `模块 ${idx + 1}`}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 mt-1">
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {deliverables && deliverables.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            交付物清单
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deliverables.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-3 border border-slate-200 rounded-lg flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {item.name || item.title || `交付物 ${idx + 1}`}
                  </div>
                  {item.description && (
                    <div className="text-xs text-slate-500 mt-1">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-indigo-600" />
            参考文献
          </div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}

      {!designOutline?.length && !designDescription && !deliverables?.length && !references?.length && (
        <div className="text-slate-500 text-sm">暂无毕业设计数据</div>
      )}
    </div>
  );
}

// --- Topic Generation Result ---

function TopicGenerationResult({ resultData }: { resultData: Record<string, any> }) {
  const topics = resultData?.topics || resultData?.titles || resultData?.topicList || [];

  if (!topics || topics.length === 0) {
    return <div className="text-slate-500 text-sm">暂无拟题数据</div>;
  }

  return (
    <div className="space-y-4">
      {topics.map((topic: any, idx: number) => (
        <div
          key={idx}
          className="p-4 border border-slate-200 rounded-lg hover:border-amber-300 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-amber-600">
                {idx + 1}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-800 text-sm mb-2">
                {topic.title || topic.topic || topic.name}
              </div>
              {topic.description && (
                <p className="text-xs text-slate-500 leading-relaxed mb-2">
                  {topic.description}
                </p>
              )}
              {topic.researchDirection && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                  研究方向：{topic.researchDirection}
                </Badge>
              )}
              {topic.innovation && (
                <div className="mt-2 text-xs text-emerald-600 flex items-start gap-1">
                  <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>创新点：{topic.innovation}</span>
                </div>
              )}
              {topic.difficulty && (
                <div className="mt-1 text-xs text-slate-500">
                  难度：{topic.difficulty}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Literature Review Result ---

function LiteratureReviewResult({ resultData }: { resultData: Record<string, any> }) {
  const domesticStatus = resultData?.domesticStatus || resultData?.domesticResearch || '';
  const foreignStatus = resultData?.foreignStatus || resultData?.foreignResearch || '';
  const hotspots = resultData?.hotspots || resultData?.researchHotspots || [];
  const gaps = resultData?.gaps || resultData?.researchGaps || [];
  const trends = resultData?.trends || resultData?.developmentTrends || [];
  const references = resultData?.references || [];

  return (
    <div className="space-y-6">
      {(domesticStatus || foreignStatus) && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600" />
            国内外研究现状
          </div>
          <div className="space-y-4">
            {domesticStatus && (
              <div className="p-4 border border-slate-200 rounded-lg">
                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 mb-2">
                  国内研究现状
                </Badge>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {domesticStatus}
                </p>
              </div>
            )}
            {foreignStatus && (
              <div className="p-4 border border-slate-200 rounded-lg">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mb-2">
                  国外研究现状
                </Badge>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {foreignStatus}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {hotspots && hotspots.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">研究热点</div>
          <div className="flex flex-wrap gap-2">
            {hotspots.map((h: string, idx: number) => (
              <Badge
                key={idx}
                variant="outline"
                className="bg-violet-50 text-violet-700 border-violet-200"
              >
                {h}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {gaps && gaps.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-600" />
            研究空白
          </div>
          <div className="space-y-2">
            {gaps.map((g: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-violet-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{g}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trends && trends.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            发展趋势
          </div>
          <div className="space-y-2">
            {trends.map((t: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-violet-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-violet-600" />
            参考文献
          </div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Proposal Result ---

function ProposalResult({ resultData }: { resultData: Record<string, any> }) {
  const background = resultData?.background || resultData?.researchBackground || '';
  const content = resultData?.content || resultData?.researchContent || '';
  const methods = resultData?.methods || resultData?.researchMethods || [];
  const timeline = resultData?.timeline || resultData?.schedule || [];
  const outcomes = resultData?.outcomes || resultData?.expectedOutcomes || [];
  const innovations = resultData?.innovations || resultData?.innovationPoints || [];

  return (
    <div className="space-y-6">
      {background && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sky-600" />
            研究背景
          </div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {background}
          </div>
        </div>
      )}

      {content && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-600" />
            研究内容
          </div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}

      {methods && methods.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-sky-600" />
            研究方法
          </div>
          <div className="space-y-2">
            {methods.map((m: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-sky-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {timeline && timeline.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-sky-600" />
            进度安排
          </div>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-sky-200" />
            {timeline.map((item: any, idx: number) => (
              <div key={idx} className="relative">
                <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-white" />
                <div className="text-sm font-medium text-slate-800">
                  {item.period || item.time || `阶段 ${idx + 1}`}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {item.task || item.content || item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-sky-600" />
            预期成果
          </div>
          <div className="space-y-2">
            {outcomes.map((o: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {innovations && innovations.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LightbulbIcon className="h-4 w-4 text-amber-500" />
            创新点
          </div>
          <div className="space-y-2">
            {innovations.map((i: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-amber-100 rounded-lg bg-amber-50/50 text-sm"
              >
                <span className="text-amber-600 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{i}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Task Assignment Result ---

function TaskAssignmentResult({ resultData }: { resultData: Record<string, any> }) {
  const taskInfo = resultData?.taskInfo || resultData?.basicInfo || {};
  const researchContent = resultData?.researchContent || resultData?.content || '';
  const objectives = resultData?.objectives || resultData?.goals || [];
  const schedule = resultData?.schedule || resultData?.timeline || [];
  const references = resultData?.references || [];

  return (
    <div className="space-y-6">
      {Object.keys(taskInfo).length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            任务基本信息
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(taskInfo).map(([key, value]: [string, any]) => (
              <div key={key} className="p-3 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">{key}</div>
                <div className="text-sm text-slate-800">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {researchContent && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">研究内容</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {researchContent}
          </div>
        </div>
      )}

      {objectives && objectives.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">研究目标</div>
          <div className="space-y-2">
            {objectives.map((obj: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <Target className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {schedule && schedule.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            进度安排
          </div>
          <div className="space-y-2">
            {schedule.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg"
              >
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
                  {item.phase || item.period || `阶段 ${idx + 1}`}
                </Badge>
                <span className="text-sm text-slate-700">
                  {item.task || item.content || item.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">主要参考文献</div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Course Paper Result ---

function CoursePaperResult({ resultData }: { resultData: Record<string, any> }) {
  const abstract = resultData?.abstract || '';
  const keywords = resultData?.keywords || [];
  const chapters = resultData?.chapters || resultData?.sections || [];
  const references = resultData?.references || [];

  return (
    <div className="space-y-6">
      {abstract && (
        <div className="p-4 border border-indigo-100 rounded-lg bg-indigo-50/30">
          <div className="text-sm font-semibold text-indigo-800 mb-2">摘要</div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {abstract}
          </p>
        </div>
      )}

      {keywords && keywords.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-600">关键词：</span>
          {keywords.map((kw: string, idx: number) => (
            <Badge
              key={idx}
              variant="outline"
              className="bg-indigo-50 text-indigo-700 border-indigo-200"
            >
              {kw}
            </Badge>
          ))}
        </div>
      )}

      {chapters && chapters.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-indigo-600" />
            正文章节
          </div>
          <div className="space-y-4">
            {chapters.map((ch: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="font-medium text-slate-800 text-sm mb-2">
                  {ch.title || ch.name || `第 ${idx + 1} 章`}
                </div>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {ch.content || ch.text || ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">参考文献</div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Journal Paper Result ---

function JournalPaperResult({ resultData }: { resultData: Record<string, any> }) {
  const abstract = resultData?.abstract || '';
  const keywords = resultData?.keywords || [];
  const introduction = resultData?.introduction || resultData?.intro || '';
  const methods = resultData?.methods || resultData?.methodology || '';
  const results = resultData?.results || resultData?.findings || '';
  const discussion = resultData?.discussion || '';
  const conclusion = resultData?.conclusion || '';
  const references = resultData?.references || [];

  return (
    <div className="space-y-6">
      {abstract && (
        <div className="p-4 border border-purple-100 rounded-lg bg-purple-50/30">
          <div className="text-sm font-semibold text-purple-800 mb-2">摘要 Abstract</div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {abstract}
          </p>
        </div>
      )}

      {keywords && keywords.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-600">关键词：</span>
          {keywords.map((kw: string, idx: number) => (
            <Badge
              key={idx}
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200"
            >
              {kw}
            </Badge>
          ))}
        </div>
      )}

      {introduction && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">1. 引言 Introduction</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {introduction}
          </div>
        </div>
      )}

      {methods && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            2. 研究方法 Methods
          </div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {methods}
          </div>
        </div>
      )}

      {results && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">3. 研究结果 Results</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {results}
          </div>
        </div>
      )}

      {discussion && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">4. 讨论 Discussion</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {discussion}
          </div>
        </div>
      )}

      {conclusion && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">5. 结论 Conclusion</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {conclusion}
          </div>
        </div>
      )}

      {references && references.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">参考文献 References</div>
          <div className="space-y-2">
            {references.map((ref: string, idx: number) => (
              <div
                key={idx}
                className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-200"
              >
                [{idx + 1}] {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Practice Report Result ---

function PracticeReportResult({ resultData }: { resultData: Record<string, any> }) {
  const introduction = resultData?.introduction || '';
  const practiceContent = resultData?.practiceContent || resultData?.content || '';
  const processSteps = resultData?.processSteps || resultData?.steps || resultData?.process || [];
  const achievements = resultData?.achievements || resultData?.results || resultData?.outcomes || [];
  const experience = resultData?.experience || resultData?.reflection || resultData?.feelings || '';

  return (
    <div className="space-y-6">
      {introduction && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">一、引言</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {introduction}
          </div>
        </div>
      )}

      {practiceContent && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-cyan-600" />
            二、实践内容
          </div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {practiceContent}
          </div>
        </div>
      )}

      {processSteps && processSteps.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">三、实践过程</div>
          <div className="space-y-3">
            {processSteps.map((step: any, idx: number) => (
              <div
                key={idx}
                className="flex gap-3 p-3 border border-slate-200 rounded-lg"
              >
                <div className="w-7 h-7 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-cyan-700">
                    {idx + 1}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {step.title || step.name || `步骤 ${idx + 1}`}
                  </div>
                  {step.description && (
                    <div className="text-xs text-slate-500 mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {achievements && achievements.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-cyan-600" />
            四、实践成果
          </div>
          <div className="space-y-2">
            {achievements.map((a: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {experience && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">五、心得体会</div>
          <div className="p-4 border border-cyan-100 rounded-lg bg-cyan-50/50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {experience}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Project Application Result ---

function ProjectApplicationResult({ resultData }: { resultData: Record<string, any> }) {
  const objectives = resultData?.objectives || resultData?.researchObjectives || [];
  const content = resultData?.content || resultData?.researchContent || '';
  const methods = resultData?.methods || resultData?.researchMethods || [];
  const techRoute = resultData?.techRoute || resultData?.technicalRoute || resultData?.roadmap || [];
  const outcomes = resultData?.expectedOutcomes || resultData?.outcomes || [];
  const innovations = resultData?.innovations || resultData?.innovationPoints || [];
  const budget = resultData?.budget || resultData?.budgetItems || [];

  return (
    <div className="space-y-6">
      {objectives && objectives.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            研究目标
          </div>
          <div className="space-y-2">
            {objectives.map((obj: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-blue-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">研究内容</div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}

      {methods && methods.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Microscope className="h-4 w-4 text-blue-600" />
            研究方法
          </div>
          <div className="space-y-2">
            {methods.map((m: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-blue-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {techRoute && techRoute.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-blue-600" />
            技术路线
          </div>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-blue-200" />
            {techRoute.map((item: any, idx: number) => (
              <div key={idx} className="relative">
                <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="text-sm font-medium text-slate-800">
                  {item.stage || item.step || `阶段 ${idx + 1}`}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {outcomes && outcomes.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-600" />
            预期成果
          </div>
          <div className="space-y-2">
            {outcomes.map((o: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-slate-700">
                  {o.name || o.title || o}
                </span>
                {o.quantity && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {o.quantity}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {innovations && innovations.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LightbulbIcon className="h-4 w-4 text-amber-500" />
            创新点
          </div>
          <div className="space-y-2">
            {innovations.map((i: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-amber-100 rounded-lg bg-amber-50/50 text-sm"
              >
                <span className="text-amber-600 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{i}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {budget && budget.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">经费预算</div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">预算科目</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">金额（万元）</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">说明</th>
                </tr>
              </thead>
              <tbody>
                {budget.map((item: any, idx: number) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">
                      {item.name || item.item || `科目 ${idx + 1}`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">
                      {item.amount || item.money || '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {item.description || item.note || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Paper Revision Result ---

function PaperRevisionResult({ resultData }: { resultData: Record<string, any> }) {
  const original = resultData?.originalContent || resultData?.original || resultData?.originalText || '';
  const revised = resultData?.revisedContent || resultData?.revised || resultData?.revisedText || '';
  const revisions = resultData?.changeSummary || resultData?.revisions || resultData?.changeList || resultData?.changes || [];
  const unresolvedIssues = resultData?.unresolvedIssues || [];
  const warnings = resultData?.warnings || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              原文
            </Badge>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {original || '暂无原文数据'}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              修改后
            </Badge>
          </div>
          <div className="p-4 border border-indigo-200 rounded-lg bg-indigo-50/50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {revised || '暂无修改结果'}
          </div>
        </div>
      </div>

      {revisions && revisions.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-indigo-600" />
            修改清单
          </div>
          <div className="space-y-3">
            {revisions.map((r: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="text-sm font-medium text-slate-700 mb-2">
                  {typeof r !== 'string' && r.type && (
                    <Badge variant="outline" className="mr-2 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {r.type}
                    </Badge>
                  )}
                  {typeof r === 'string' ? r : (r.title || `修改 ${idx + 1}`)}
                </div>
                {typeof r !== 'string' && <div className="space-y-2 text-xs">
                  {r.original && (
                    <div className="p-2 bg-red-50 rounded text-red-600 line-through">
                      {r.original}
                    </div>
                  )}
                  {r.revised && (
                    <div className="p-2 bg-emerald-50 rounded text-emerald-700">
                      {r.revised}
                    </div>
                  )}
                  {r.reason && (
                    <div className="text-slate-500 mt-1">修改说明：{r.reason}</div>
                  )}
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {resultData?.authorInputNeeded && unresolvedIssues.length > 0 && (
        <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/60">
          <div className="text-sm font-medium text-amber-800 mb-2">需要作者补充信息</div>
          <ul className="list-disc pl-5 text-sm text-amber-700 space-y-1">
            {unresolvedIssues.map((issue: string, idx: number) => <li key={idx}>{issue}</li>)}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/40 text-sm text-amber-700">
          <div className="font-medium mb-1">校验提示</div>
          {warnings.map((warning: string, idx: number) => <div key={idx}>{warning}</div>)}
        </div>
      )}
    </div>
  );
}

// --- Comment Revision Result ---

function CommentRevisionResult({ resultData }: { resultData: Record<string, any> }) {
  const revisedContent = resultData?.revisedContent || resultData?.revisedText || resultData?.content || '';
  const commentRevisions = resultData?.commentRevisions || resultData?.changes || resultData?.revisionList || [];

  return (
    <div className="space-y-6">
      {revisedContent && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-600" />
            修改后全文
          </div>
          <div className="p-4 border border-violet-100 rounded-lg bg-violet-50/30 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {revisedContent}
          </div>
        </div>
      )}

      {commentRevisions && commentRevisions.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-3">
            批注修改明细
          </div>
          <div className="space-y-3">
            {commentRevisions.map((c: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 mb-1">
                      批注 {idx + 1}
                      {c.location && (
                        <span className="text-xs text-slate-400 ml-2">
                          位置：{c.location}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded mb-2">
                      💬 {c.comment || c.annotation || '批注内容'}
                    </div>
                    {c.before && (
                      <div className="text-xs text-slate-500 mb-1">
                        <span className="text-red-500 line-through">{c.before}</span>
                      </div>
                    )}
                    {c.after && (
                      <div className="text-xs text-emerald-600">
                        → {c.after}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Data Analysis Result ---

function DataAnalysisResult({ resultData }: { resultData: Record<string, any> }) {
  const descriptiveStats = resultData?.descriptiveStats || resultData?.statistics || [];
  const analysisResults = resultData?.analysisResults || resultData?.analysis || [];
  const conclusions = resultData?.conclusions || resultData?.findings || [];
  const suggestions = resultData?.suggestions || resultData?.recommendations || [];

  return (
    <div className="space-y-6">
      {descriptiveStats && descriptiveStats.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-teal-600" />
            描述性统计
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">变量</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">样本量</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">均值</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">标准差</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">最小值</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">最大值</th>
                </tr>
              </thead>
              <tbody>
                {descriptiveStats.map((stat: any, idx: number) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700 font-medium">
                      {stat.variable || stat.name || `变量 ${idx + 1}`}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {stat.n ?? stat.sampleSize ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {stat.mean ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {stat.std ?? stat.stdDev ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {stat.min ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {stat.max ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analysisResults && analysisResults.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">分析结果</div>
          <div className="space-y-4">
            {analysisResults.map((a: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                    {a.method || a.type || `分析 ${idx + 1}`}
                  </Badge>
                </div>
                {a.description && (
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    {a.description}
                  </p>
                )}
                {a.result && (
                  <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded whitespace-pre-wrap">
                    {a.result}
                  </div>
                )}
                {a.significant !== undefined && (
                  <div className="mt-2 text-xs">
                    {a.significant ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        显著 p &lt; 0.05
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                        不显著
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {conclusions && conclusions.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-teal-600" />
            研究结论
          </div>
          <div className="space-y-2">
            {conclusions.map((c: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-teal-100 rounded-lg bg-teal-50/50 text-sm"
              >
                <span className="text-teal-600 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">建议与展望</div>
          <div className="space-y-2">
            {suggestions.map((s: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <LightbulbIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Questionnaire Design Result ---

function QuestionnaireDesignResult({ resultData }: { resultData: Record<string, any> }) {
  const title = resultData?.title || resultData?.questionnaireTitle || '';
  const instruction = resultData?.instruction || resultData?.guidance || '';
  const demographicQuestions = resultData?.demographicQuestions || resultData?.demographics || [];
  const dimensions = resultData?.dimensions || resultData?.sections || [];
  const scoringInstructions = resultData?.scoringInstructions || resultData?.scoring || '';

  return (
    <div className="space-y-6">
      {title && (
        <div className="text-center py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        </div>
      )}

      {instruction && (
        <div className="p-4 border border-orange-100 rounded-lg bg-orange-50/30">
          <div className="text-sm font-medium text-orange-800 mb-1 flex items-center gap-2">
            <FormInput className="h-4 w-4" />
            指导语
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {instruction}
          </p>
        </div>
      )}

      {demographicQuestions && demographicQuestions.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3">
            一、基本信息
          </div>
          <div className="space-y-3">
            {demographicQuestions.map((q: any, idx: number) => (
              <div
                key={idx}
                className="p-3 border border-slate-200 rounded-lg"
              >
                <div className="text-sm font-medium text-slate-700 mb-2">
                  {idx + 1}. {q.title || q.question || q.label}
                </div>
                {q.options && q.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt: string, oIdx: number) => (
                      <Badge
                        key={oIdx}
                        variant="outline"
                        className="bg-slate-50 text-slate-600 border-slate-200"
                      >
                        {opt}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {dimensions && dimensions.length > 0 && (
        <div className="space-y-6">
          {dimensions.map((dim: any, dimIdx: number) => (
            <div key={dimIdx}>
              <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                  {dimIdx + 1}
                </span>
                {dim.name || dim.title || dim.dimension || `维度 ${dimIdx + 1}`}
                {dim.description && (
                  <span className="text-xs text-slate-500 font-normal ml-2">
                    ({dim.description})
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(dim.questions || dim.items || []).map((q: any, qIdx: number) => (
                  <div
                    key={qIdx}
                    className="p-3 border border-slate-200 rounded-lg"
                  >
                    <div className="text-sm text-slate-700 mb-2">
                      {dimIdx + 1}.{qIdx + 1} {q.title || q.question || q.text}
                    </div>
                    {q.type && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 mr-2">
                        {q.type}
                      </Badge>
                    )}
                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {q.options.map((opt: string, oIdx: number) => (
                          <Badge
                            key={oIdx}
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-200 text-xs"
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {scoringInstructions && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-orange-600" />
            计分说明
          </div>
          <div className="p-4 border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {scoringInstructions}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Paper Reverse Result ---

function PaperReverseResult({ resultData }: { resultData: Record<string, any> }) {
  const topicAnalysis = resultData?.topicAnalysis || resultData?.topic || '';
  const outline = resultData?.outline || resultData?.chapters || [];
  const researchFramework = resultData?.researchFramework || resultData?.framework || [];
  const researchMethods = resultData?.researchMethods || resultData?.methods || [];
  const innovations = resultData?.innovations || resultData?.innovationPoints || [];

  return (
    <div className="space-y-6">
      {topicAnalysis && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-emerald-600" />
            选题分析
          </div>
          <div className="p-4 border border-emerald-100 rounded-lg bg-emerald-50/30 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {topicAnalysis}
          </div>
        </div>
      )}

      {outline && outline.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-emerald-600" />
            论文大纲
          </div>
          <div className="space-y-1 pl-1">
            {outline.map((item: any, idx: number) => (
              <div
                key={idx}
                className="py-2 border-l-2 border-emerald-200 pl-3 mb-1"
              >
                <div className="font-medium text-slate-800 text-sm">
                  {item.numbering ? `${item.numbering} ` : ''}
                  {item.title || item.name || `第 ${idx + 1} 章`}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 mt-1">
                    {item.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {researchFramework && researchFramework.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-emerald-600" />
            研究框架
          </div>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-emerald-200" />
            {researchFramework.map((item: any, idx: number) => (
              <div key={idx} className="relative">
                <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                <div className="text-sm font-medium text-slate-800">
                  {item.name || item.title || item.stage || `模块 ${idx + 1}`}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {researchMethods && researchMethods.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            研究方法
          </div>
          <div className="space-y-2">
            {researchMethods.map((m: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-emerald-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {innovations && innovations.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LightbulbIcon className="h-4 w-4 text-amber-500" />
            创新点提炼
          </div>
          <div className="space-y-2">
            {innovations.map((i: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-amber-100 rounded-lg bg-amber-50/50 text-sm"
              >
                <span className="text-amber-600 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{i}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- AI Reduce Result ---

function AiReduceResult({ resultData }: { resultData: Record<string, any> }) {
  const aiRateBefore = resultData?.aiRateBefore ?? resultData?.originalAiRate ?? 0;
  const aiRateAfter = resultData?.aiRateAfter ?? resultData?.reducedAiRate ?? 0;
  const similarityBefore = resultData?.similarityBefore ?? resultData?.originalSimilarity ?? 0;
  const similarityAfter = resultData?.similarityAfter ?? resultData?.reducedSimilarity ?? 0;
  const original = resultData?.original || resultData?.originalText || '';
  const revised = resultData?.revised || resultData?.reducedText || resultData?.rewrittenText || '';
  const changes = resultData?.changes || resultData?.modifications || resultData?.revisions || [];
  const summary = resultData?.summary || resultData?.description || '';
  const suggestions = resultData?.suggestions || resultData?.recommendations || [];

  const getRateColor = (rate: number) => {
    if (rate < 15) return 'text-emerald-600';
    if (rate < 30) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRateBg = (rate: number) => {
    if (rate < 15) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (rate < 30) return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-red-50 border-red-200 text-red-700';
  };

  return (
    <div className="space-y-6">
      {/* 检测率对比 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-600">AI 检测率</div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${getRateBg(aiRateBefore)}`}>
              前: {aiRateBefore}%
            </Badge>
            <ArrowRightIcon className="w-4 h-4 text-slate-400" />
            <Badge variant="outline" className={`${getRateBg(aiRateAfter)}`}>
              后: {aiRateAfter}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-500" />
            <span className={`text-sm font-medium ${getRateColor(Math.max(0, aiRateBefore - aiRateAfter))}`}>
              下降 {Math.max(0, aiRateBefore - aiRateAfter).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-600">重复率</div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${getRateBg(similarityBefore)}`}>
              前: {similarityBefore}%
            </Badge>
            <ArrowRightIcon className="w-4 h-4 text-slate-400" />
            <Badge variant="outline" className={`${getRateBg(similarityAfter)}`}>
              后: {similarityAfter}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-500" />
            <span className={`text-sm font-medium ${getRateColor(Math.max(0, similarityBefore - similarityAfter))}`}>
              下降 {Math.max(0, similarityBefore - similarityAfter).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 原文/改写后 对比 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
              原文
            </Badge>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {original || '暂无原文数据'}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              改写后
            </Badge>
          </div>
          <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/30 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[200px]">
            {revised || '暂无降重结果'}
          </div>
        </div>
      </div>

      {/* 修改点列表 */}
      {changes && changes.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-3">
            修改点列表
          </div>
          <div className="space-y-3">
            {changes.map((c: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  {c.type && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                      {c.type}
                    </Badge>
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    修改 {idx + 1}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-1">原文 → 改写后</div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-red-500 line-through flex-1">
                    {c.original || c.before}
                  </span>
                  <ArrowRightIcon className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span className="text-emerald-600 font-medium flex-1">
                    {c.revised || c.after || c.replacement}
                  </span>
                </div>
                {c.reason && (
                  <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    原因：{c.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 总结说明 */}
      {summary && (
        <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/30">
          <div className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
            <Eraser className="h-4 w-4" />
            降重总结
          </div>
          <p className="text-sm text-orange-700 leading-relaxed">
            {summary}
          </p>
        </div>
      )}

      {/* 建议列表 */}
      {suggestions && suggestions.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-600 mb-3">
            进一步优化建议
          </div>
          <div className="space-y-2">
            {suggestions.map((s: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <LightbulbIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!original && !revised && !changes?.length && !summary && !suggestions?.length && (
        <div className="text-slate-500 text-sm">暂无降AI/降重结果数据</div>
      )}
    </div>
  );
}

// --- AI PPT Result ---

function AiPptResult({ resultData }: { resultData: Record<string, any> }) {
  const title = resultData?.title || resultData?.presentationTitle || '';
  const style = resultData?.style || resultData?.designStyle || '';
  const totalSlides = resultData?.totalSlides ?? resultData?.slideCount ?? 0;
  const slides = resultData?.slides || resultData?.pages || [];
  const designTips = resultData?.designTips || resultData?.designSuggestions || [];
  const speakingTips = resultData?.speakingTips || resultData?.presentationSkills || [];

  return (
    <div className="space-y-6">
      {/* 顶部概览 */}
      <div className="p-5 border border-violet-200 rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Presentation className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-slate-800 mb-1">
              {title || '未命名演示文稿'}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {style && (
                <span className="inline-flex items-center gap-1">
                  <PaletteIcon className="w-3 h-3" />
                  风格：{style}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <ListOrdered className="w-3 h-3" />
                共 {totalSlides || slides.length || 0} 页
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 幻灯片列表 */}
      {slides && slides.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-violet-600" />
            幻灯片内容
          </div>
          <div className="space-y-4">
            {slides.map((slide: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-lg hover:border-violet-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-semibold">
                      {slide.page || slide.index || idx + 1}
                    </div>
                    <div className="font-medium text-slate-800 text-sm">
                      {slide.title || slide.heading || `第 ${idx + 1} 页`}
                    </div>
                  </div>
                  {slide.type && (
                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                      {slide.type}
                    </Badge>
                  )}
                </div>

                {/* 要点列表 */}
                {(slide.points || slide.keyPoints || slide.bullets || slide.content) && (
                  <div className="pl-11 space-y-1 mb-3">
                    {(slide.points || slide.keyPoints || slide.bullets || (slide.content ? [slide.content] : [])).map((p: string, pi: number) => (
                      <div key={pi} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <span className="text-violet-400 flex-shrink-0">•</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 配图建议 */}
                {slide.imageSuggestion && (
                  <div className="pl-11 mb-2">
                    <div className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                      <ImageIcon className="w-3 h-3" />
                      配图建议：{slide.imageSuggestion}
                    </div>
                  </div>
                )}

                {/* 演讲备注 */}
                {slide.speakerNote && (
                  <div className="pl-11">
                    <div className="text-xs text-slate-500 flex items-start gap-1 bg-amber-50 px-2 py-1.5 rounded">
                      <Mic className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-600" />
                      <span className="text-amber-700">演讲备注：{slide.speakerNote}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 设计建议 */}
      {designTips && designTips.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <PaletteIcon className="h-4 w-4 text-violet-600" />
            设计建议
          </div>
          <div className="space-y-2">
            {designTips.map((tip: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-sm"
              >
                <span className="text-violet-500 font-medium flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-slate-700">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 演讲技巧 */}
      {speakingTips && speakingTips.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Mic className="h-4 w-4 text-violet-600" />
            演讲技巧
          </div>
          <div className="space-y-2">
            {speakingTips.map((tip: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 border border-violet-100 rounded-lg bg-violet-50/30 text-sm"
              >
                <Award className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!title && !slides?.length && !designTips?.length && !speakingTips?.length && (
        <div className="text-slate-500 text-sm">暂无 PPT 生成结果数据</div>
      )}
    </div>
  );
}

// --- Main Page ---

const TaskDetailPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('result');

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setError(null);
    try {
      const result: Task = await taskApi.getTask(taskId);
      setTask(result);
    } catch (err) {
      logger.error('获取任务详情失败', JSON.stringify(err));
      setError('任务详情加载失败，请重试。');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Auto-refresh every 3s when task is not completed
  const isActive =
    task && (task.status === 'pending' || task.status === 'processing');

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      fetchTask();
    }, 3000);
    return () => clearInterval(timer);
  }, [isActive, fetchTask]);

  const handleDelete = async () => {
    if (!task || deleting) return;
    setDeleting(true);
    try {
      await taskApi.deleteTask(task.id);
      navigate('/tasks');
    } catch (err) {
      logger.error('删除任务失败', JSON.stringify(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleContinue = () => {
    if (!task) return;
    const continueState = buildContinueState(task);
    if (!continueState) return;
    navigate(`/tools/${task.taskType}`, {
      state: continueState,
    });
  };

  const handleRerun = async () => {
    if (!task || rerunning) return;
    const payload = buildRerunPayload(task);
    if (!payload) return;
    setRerunning(true);
    try {
      const rerunTask = await aiToolsApi.submitTask(payload);
      navigate(`/tasks/${rerunTask.id}`);
    } catch (err) {
      logger.error('重新运行任务失败', JSON.stringify(err));
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-6 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="px-6 py-6 min-h-screen bg-slate-50">
        <div className="max-w-[1200px] mx-auto">
          <Button variant="ghost" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-4 w-4" />
            返回任务列表
          </Button>
          <TaskStatePanel state="error" errorMessage={error} onRetry={() => {
            setLoading(true);
            fetchTask();
          }} />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="px-6 py-6 min-h-screen bg-slate-50">
        <div className="max-w-[1200px] mx-auto">
          <Button variant="ghost" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-4 w-4" />
            返回任务列表
          </Button>
          <div className="mt-20 text-center">
            <AlertCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">任务不存在或已被删除</p>
          </div>
        </div>
      </div>
    );
  }

  const taskType = task.taskType as TaskType;
  const TypeIcon = TYPE_ICONS[taskType];
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  // Timeline stages
  const timelineStages = [
    {
      key: 'created',
      label: '任务创建',
      time: task.createdAt,
      done: true,
    },
    {
      key: 'processing',
      label: 'AI处理中',
      time: task.status !== 'pending' ? task.updatedAt : undefined,
      done: task.status !== 'pending',
      active: task.status === 'processing',
    },
    {
      key: 'finished',
      label: isFailed ? '处理失败' : '处理完成',
      time: isCompleted || isFailed ? task.updatedAt : undefined,
      done: isCompleted || isFailed,
      failed: isFailed,
    },
  ];

  const taskResult = isCompleted && (
    taskType === 'topic-generation' || taskType === 'polish' || taskType === 'paper-revision'
  )
    ? adaptTaskResult(taskType, task.resultData || {})
    : null;

  return (
    <div className="px-6 py-6 min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tasks')}
            className="mb-3 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回任务列表
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <TypeIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold leading-tight text-slate-800">
                  {task.title}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge
                    variant="outline"
                    className={TYPE_VARIANTS[taskType]}
                  >
                    {getTypeName(taskType)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={STATUS_VARIANTS[task.status]}
                  >
                    {task.status === 'processing' && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {STATUS_LABELS[task.status]}
                  </Badge>
                  {isActive && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      自动刷新中
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {buildContinueState(task) && (
                <Button variant="secondary" onClick={handleContinue}>
                  继续编辑
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                删除任务
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">
                处理进度
              </span>
              <span className="text-sm font-semibold text-primary">
                {task.progress}%
              </span>
            </div>
            <Progress value={task.progress} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: info + timeline */}
          <div className="col-span-1 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">任务ID</div>
                    <div className="text-sm text-slate-800 font-mono break-all">
                      {task.id}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">任务类型</div>
                    <div className="text-sm text-slate-800">
                      {getTypeName(taskType)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">状态</div>
                    <div className="text-sm text-slate-800">
                      {STATUS_LABELS[task.status]}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">消耗积分</div>
                    <div className="text-sm text-slate-800 font-medium">
                      {task.pointsCost} 积分
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 mb-1">创建时间</div>
                    <div className="text-sm text-slate-800">
                      {formatDateTime(task.createdAt)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 mb-1">更新时间</div>
                    <div className="text-sm text-slate-800">
                      {formatDateTime(task.updatedAt)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">处理进度</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="relative">
                  {timelineStages.map((stage, idx) => (
                    <div key={stage.key} className="flex gap-3 pb-5 last:pb-0">
                      {/* Line */}
                      {idx < timelineStages.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-1 w-px bg-slate-200" />
                      )}
                      {/* Dot */}
                      <div className="relative z-10 mt-0.5">
                        {stage.done && !stage.active && !stage.failed && (
                          <div className="h-[22px] w-[22px] rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                        )}
                        {stage.active && (
                          <div className="h-[22px] w-[22px] rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
                            <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                          </div>
                        )}
                        {stage.failed && (
                          <div className="h-[22px] w-[22px] rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          </div>
                        )}
                        {!stage.done && !stage.active && !stage.failed && (
                          <div className="h-[22px] w-[22px] rounded-full bg-slate-100 flex items-center justify-center">
                            <Circle className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1">
                        <div
                          className={`text-sm font-medium ${
                            stage.done || stage.active
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {stage.label}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {stage.time ? formatDateTime(stage.time) : '等待中...'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right column: result preview */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">结果预览</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {isFailed ? (
                  <div className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-red-600 font-medium mb-1">任务处理失败</p>
                    <p className="text-sm text-slate-500">
                      {task.errorMessage || '未知错误，请重试或联系客服'}
                    </p>
                  </div>
                ) : !isCompleted ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">处理中，请稍候...</p>
                    <p className="text-sm text-slate-400 mt-1">
                      当前进度：{task.progress}%，预计还需一些时间完成
                    </p>
                  </div>
                ) : (
                  <>
                    {taskResult?.valid && (
                      <TaskResultActions
                        task={task}
                        envelope={taskResult.envelope}
                        onRerun={handleRerun}
                        onContinue={handleContinue}
                      />
                    )}
                    {taskResult && !taskResult.valid && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        任务已完成，但结果数据不完整，暂时无法复制或导出。
                      </div>
                    )}
                    {(!taskResult || taskResult.valid) && <>
                    {taskType === 'outline' && (
                      <OutlineResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'literature' && (
                      <LiteratureResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'polish' && (
                      <PolishResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'format' && (
                      <FormatResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'check' && (
                      <CheckResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'chart' && (
                      <ChartResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'thesis' && (
                      <ThesisResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'graduation-design' && (
                      <GraduationDesignResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'topic-generation' && (
                      <TopicGenerationResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'literature-review' && (
                      <LiteratureReviewResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'proposal' && (
                      <ProposalResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'task-assignment' && (
                      <TaskAssignmentResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'course-paper' && (
                      <CoursePaperResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'journal-paper' && (
                      <JournalPaperResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'practice-report' && (
                      <PracticeReportResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'project-application' && (
                      <ProjectApplicationResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'paper-revision' && (
                      <PaperRevisionResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'comment-revision' && (
                      <CommentRevisionResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'data-analysis' && (
                      <DataAnalysisResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'questionnaire-design' && (
                      <QuestionnaireDesignResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'paper-reverse' && (
                      <PaperReverseResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'ai-reduce' && (
                      <AiReduceResult resultData={task.resultData || {}} />
                    )}
                    {taskType === 'ai-ppt' && (
                      <AiPptResult resultData={task.resultData || {}} />
                    )}
                    </>}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除任务</DialogTitle>
            <DialogDescription>
              确定要删除任务「{task.title}」吗？此操作只删除任务记录，不会取消正在执行的任务。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskDetailPage;
