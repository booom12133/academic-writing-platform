import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coins,
  FileText,
  Clock,
  ArrowRight,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { userApi } from '@client/src/api/index';
import { taskApi } from '@client/src/api/index';
import type { UserProfile, Task } from '@shared/api.interface';
import { getProductCapabilities } from '@shared/product-capability.catalog';
import type { ProfileTab } from '../ProfileSidebar';

interface DashboardProps {
  onNavigate: (tab: ProfileTab) => void;
}

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

export default function Dashboard({ onNavigate }: DashboardProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, tasksRes] = await Promise.all([
          userApi.getProfile(),
          taskApi.getTaskList({ page: 1, pageSize: 3 }),
        ]);
        setProfile(profileRes);
        setRecentTasks(tasksRes.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  const processingCount = recentTasks.filter(
    (t) => t.status === 'processing' || t.status === 'pending',
  ).length;
  const productionCapabilityCount = getProductCapabilities().filter(
    (capability) => capability.readiness === 'production',
  ).length;

  const statCards = [
    {
      label: '积分余额',
      value: profile.points.toLocaleString(),
      unit: '积分',
      icon: Coins,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hint: '当前余额（只读）',
    },
    {
      label: '任务总数',
      value: recentTasks.length.toLocaleString(),
      unit: '个',
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      hint: '最近30天',
    },
    {
      label: '进行中任务',
      value: processingCount.toLocaleString(),
      unit: '个',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: '已开放能力',
      value: productionCapabilityCount.toLocaleString(),
      unit: '项',
      icon: Sparkles,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      hint: '依据产品能力目录',
    },
  ];

  return (
    <div className="space-y-6" data-ai-section-type="card-stat">
      {/* 数据卡片行 */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="text-sm text-slate-500">{card.label}</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-semibold ${card.color}`}>
                        {card.value}
                      </span>
                      {card.unit && (
                        <span className="text-xs text-slate-500">{card.unit}</span>
                      )}
                    </div>
                    {card.hint && (
                      <div className="text-xs text-slate-400">{card.hint}</div>
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

      </div>

      {/* 快捷入口 */}
      <div data-ai-section-type="card-menu" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
          <CardContent className="p-5">
            <Link to="/tools" className="block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-800">
                        发起新任务
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                      使用已开放的 AI 工具
                      </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
          <CardContent className="p-5">
            <button
              onClick={() => {
                onNavigate('tasks');
                navigate('/tasks');
              }}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                    <ListTodo className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-800">
                      查看任务进度
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      实时追踪任务状态
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* 最近任务 */}
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">最近任务</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/tasks')}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              暂无任务记录
            </div>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {taskTypeLabels[task.taskType] || task.taskType} ·{' '}
                        {task.pointsCost} 积分
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
