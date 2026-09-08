import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  FileText,
  Plus,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Progress } from '@client/src/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@client/src/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';

import { taskApi } from '@client/src/api/index';
import type {
  Task,
  TaskListResponse,
  TaskStatus,
  TaskType,
} from '@shared/api.interface';
import { TaskStatePanel } from '@client/src/components/tasks/TaskStatePanel';

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

const TYPE_NAMES: Record<TaskType, string> = {
  'thesis': '毕业论文',
  'graduation-design': '毕业设计',
  outline: '智能大纲',
  'topic-generation': '智能拟题',
  literature: '文献推荐',
  'literature-review': '文献综述',
  proposal: '开题报告',
  'task-assignment': '任务书',
  'course-paper': '课程论文',
  'journal-paper': '期刊论文',
  'practice-report': '实践报告',
  'project-application': '课题申报',
  'paper-revision': '论文修改',
  'comment-revision': '批注修改',
  polish: '语法润色',
  format: '格式排版',
  check: '查重参考',
  chart: '图表可视化',
  'data-analysis': '数据分析',
  'questionnaire-design': '问卷设计',
  'paper-reverse': '论文倒推',
  'ai-reduce': '降AI/降重',
  'ai-ppt': 'AI PPT',
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
    });
  } catch {
    return iso;
  }
}

const TasksPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setError(null);
    try {
      const result: TaskListResponse = await taskApi.getTaskList({
        page,
        pageSize,
        status: statusFilter !== 'all' ? (statusFilter as TaskStatus) : undefined,
        taskType: typeFilter !== 'all' ? typeFilter : undefined,
        keyword: searchKeyword || undefined,
      });
      setData(result);
    } catch (err) {
      logger.error('获取任务列表失败', JSON.stringify(err));
      setError('任务列表加载失败，请重试。');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [page, pageSize, statusFilter, typeFilter, searchKeyword]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh when any task is pending or processing
  const hasActiveTasks =
    data?.items?.some(
      (t: Task) => t.status === 'pending' || t.status === 'processing'
    ) ?? false;

  useEffect(() => {
    if (!hasActiveTasks) return;
    const timer = setInterval(() => {
      fetchTasks();
    }, 5000);
    return () => clearInterval(timer);
  }, [hasActiveTasks, fetchTasks]);

  const handleSearch = () => {
    setSearchKeyword(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleTypeChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete || deleting) return;
    setDeleting(true);
    try {
      await taskApi.deleteTask(taskToDelete.id);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (err) {
      logger.error('删除任务失败', JSON.stringify(err));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  const getPaginationItems = (): (number | 'ellipsis')[] => {
    const items: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
      return items;
    }
    items.push(1);
    if (page > 3) items.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) items.push(i);
    if (page < totalPages - 2) items.push('ellipsis');
    items.push(totalPages);
    return items;
  };

  return (
    <div className="px-6 py-6 min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-800">
              我的任务
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              查看和管理所有AI工具任务
            </p>
          </div>
          <Button onClick={() => navigate('/tools')}>
            <Plus className="h-4 w-4" />
            发起新任务
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">
                  状态：
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="pending">等待中</SelectItem>
                    <SelectItem value="processing">进行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">
                  类型：
                </span>
                <Select
                  value={typeFilter}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-slate-400">
                        写作规划
                      </SelectLabel>
                      <SelectItem value="thesis">毕业论文</SelectItem>
                      <SelectItem value="graduation-design">毕业设计</SelectItem>
                      <SelectItem value="outline">智能大纲</SelectItem>
                      <SelectItem value="topic-generation">智能拟题</SelectItem>
                      <SelectItem value="literature">文献推荐</SelectItem>
                      <SelectItem value="literature-review">文献综述</SelectItem>
                      <SelectItem value="proposal">开题报告</SelectItem>
                      <SelectItem value="task-assignment">任务书</SelectItem>
                      <SelectItem value="course-paper">课程论文</SelectItem>
                      <SelectItem value="journal-paper">期刊论文</SelectItem>
                      <SelectItem value="practice-report">实践报告</SelectItem>
                      <SelectItem value="project-application">课题申报</SelectItem>
                      <SelectItem value="paper-revision">论文修改</SelectItem>
                      <SelectItem value="comment-revision">批注修改</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-slate-400">
                        效率工具
                      </SelectLabel>
                      <SelectItem value="polish">语法润色</SelectItem>
                      <SelectItem value="format">格式排版</SelectItem>
                      <SelectItem value="check">查重参考</SelectItem>
                      <SelectItem value="chart">图表可视化</SelectItem>
                      <SelectItem value="data-analysis">数据分析</SelectItem>
                      <SelectItem value="questionnaire-design">问卷设计</SelectItem>
                      <SelectItem value="ai-reduce">降AI/降重</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold text-slate-400">
                        扩展工具
                      </SelectLabel>
                      <SelectItem value="paper-reverse">论文倒推</SelectItem>
                      <SelectItem value="ai-ppt">AI PPT</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-[400px] ml-auto">
                <Input
                  placeholder="输入任务ID或关键词搜索..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />
                <Button variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                  查询
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Table */}
        <Card>
          <CardContent className="p-0">
            {loading && !data ? (
              <TaskStatePanel state="loading" />
            ) : error && !data ? (
              <TaskStatePanel state="error" errorMessage={error} onRetry={() => {
                setLoading(true);
                fetchTasks();
              }} />
            ) : !data || data.items.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <FileText className="h-16 w-16 text-slate-300 mb-4" />
                <p className="text-slate-600 font-medium mb-2">暂无任务</p>
                <p className="text-sm text-slate-400 mb-6">
                  快去发起你的第一个AI写作任务吧
                </p>
                <Button onClick={() => navigate('/tools')}>
                  <Plus className="h-4 w-4" />
                  去发起任务
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                    <span>{error}</span>
                    <Button variant="secondary" size="sm" onClick={() => {
                      setLoading(true);
                      fetchTasks();
                    }}>
                      重试
                    </Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[260px]">任务备注</TableHead>
                      <TableHead className="w-[120px]">任务类型</TableHead>
                      <TableHead className="w-[100px]">状态</TableHead>
                      <TableHead className="w-[180px]">进度</TableHead>
                      <TableHead className="w-[100px]">消耗积分</TableHead>
                      <TableHead className="w-[160px]">创建时间</TableHead>
                      <TableHead className="w-[120px] text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((task: Task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-slate-800">
                          <div
                            className="max-w-[260px] truncate cursor-pointer hover:text-primary"
                            onClick={() =>
                              navigate(`/tasks/${task.id}`)
                            }
                            title={task.title}
                          >
                            {task.title}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            ID: {task.id.slice(0, 12)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              TYPE_VARIANTS[task.taskType as TaskType]
                            }
                          >
                            {TYPE_NAMES[task.taskType as TaskType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_VARIANTS[task.status]}
                          >
                            {STATUS_LABELS[task.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={task.progress}
                              className="w-[100px] h-1.5"
                            />
                            <span className="text-xs text-slate-500 w-[36px]">
                              {task.progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {task.pointsCost}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {formatDateTime(task.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(`/tasks/${task.id}`)
                              }
                            >
                              <Eye className="h-4 w-4" />
                              详情
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/tasks/${task.id}`)
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteClick(task)
                                  }
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  删除任务
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="py-4 px-5 border-t border-slate-100">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setPage((p) => Math.max(1, p - 1))
                            }
                            className={
                              page === 1
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>
                        {getPaginationItems().map(
                          (item: number | 'ellipsis', idx: number) =>
                            item === 'ellipsis' ? (
                              <PaginationItem key={`ellipsis-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={item}>
                                <PaginationLink
                                  isActive={page === item}
                                  onClick={() => setPage(item)}
                                  className="cursor-pointer"
                                >
                                  {item}
                                </PaginationLink>
                              </PaginationItem>
                            )
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setPage((p) => Math.min(totalPages, p + 1))
                            }
                            className={
                              page === totalPages
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                <div className="py-2 px-5 text-xs text-slate-400 border-t border-slate-100 text-center">
                  共 {data.total} 条记录，第 {page} / {totalPages} 页
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除任务</DialogTitle>
            <DialogDescription>
              确定要删除任务「{taskToDelete?.title}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasksPage;
