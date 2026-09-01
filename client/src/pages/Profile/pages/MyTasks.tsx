import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { taskApi } from '@client/src/api/index';
import type { Task } from '@shared/api.interface';

const taskTypeLabels: Record<string, string> = {
  outline: '智能大纲生成',
  literature: '文献素材推荐',
  polish: '语法润色',
  format: '格式规范排版',
  check: '查重参考',
  chart: '图表可视化',
};

const statusLabels: Record<string, string> = {
  pending: '等待中',
  processing: '进行中',
  completed: '已完成',
  failed: '失败',
};

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function MyTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await taskApi.getTaskList({ page: 1, pageSize: 10 });
        setTasks(res.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">我的任务</h2>
        <Button variant="default" onClick={() => navigate('/tasks')}>
          查看全部任务
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-500 text-sm">暂无任务记录</div>
              <Button
                variant="default"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/tools')}
              >
                去创建任务
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>
                          {taskTypeLabels[task.taskType] || task.taskType}
                        </span>
                        <span>·</span>
                        <span>{task.pointsCost} 积分</span>
                        <span>·</span>
                        <span>
                          {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={`${statusColors[task.status]} border-transparent`}
                    variant="secondary"
                  >
                    {statusLabels[task.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
