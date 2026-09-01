import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coins,
  Wallet,
  FileText,
  Clock,
  Crown,
  PlusCircle,
  ArrowRight,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { userApi } from '@client/src/api/index';
import { taskApi } from '@client/src/api/index';
import type { UserProfile, Task, MemberLevel } from '@shared/api.interface';
import { MEMBER_LEVELS } from '@shared/api.interface';
import type { ProfileTab } from '../ProfileSidebar';

interface DashboardProps {
  onNavigate: (tab: ProfileTab) => void;
}

const memberColors: Record<MemberLevel, string> = {
  normal: 'bg-slate-500',
  silver: 'bg-slate-400',
  gold: 'bg-amber-500',
  diamond: 'bg-blue-500',
};

const memberBadgeVariants: Record<MemberLevel, string> = {
  normal: 'bg-slate-100 text-slate-700 border-slate-200',
  silver: 'bg-slate-100 text-slate-600 border-slate-300',
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  diamond: 'bg-blue-50 text-blue-700 border-blue-200',
};

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

  const getNextLevelInfo = (totalRecharge: number, level: MemberLevel) => {
    const currentIdx = MEMBER_LEVELS.findIndex((l) => l.level === level);
    if (currentIdx >= MEMBER_LEVELS.length - 1) {
      return { nextName: '已达最高等级', needed: 0, progress: 100 };
    }
    const next = MEMBER_LEVELS[currentIdx + 1];
    const current = MEMBER_LEVELS[currentIdx];
    const needed = next.threshold - totalRecharge;
    const range = next.threshold - current.threshold;
    const progress = range > 0
      ? Math.min(100, ((totalRecharge - current.threshold) / range) * 100)
      : 100;
    return { nextName: next.name, needed, progress };
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  const nextInfo = getNextLevelInfo(profile.totalRecharge, profile.memberLevel);
  const memberInfo = MEMBER_LEVELS.find((m) => m.level === profile.memberLevel);
  const processingCount = recentTasks.filter(
    (t) => t.status === 'processing' || t.status === 'pending',
  ).length;

  const statCards = [
    {
      label: '积分余额',
      value: profile.points.toLocaleString(),
      unit: '积分',
      icon: Coins,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      action: (
        <Button size="sm" variant="default" asChild>
          <Link to="/recharge">
            <PlusCircle className="w-3.5 h-3.5" />
            充值
          </Link>
        </Button>
      ),
    },
    {
      label: '累计充值',
      value: `¥${profile.totalRecharge.toLocaleString()}`,
      unit: '',
      icon: Wallet,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
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
                    {card.action && <div className="pt-1">{card.action}</div>}
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

        {/* 会员档位卡片 */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-slate-500">会员档位</div>
              <div
                className={`w-10 h-10 rounded-lg ${memberColors[profile.memberLevel]} bg-opacity-20 flex items-center justify-center`}
                style={{
                  backgroundColor:
                    profile.memberLevel === 'normal'
                      ? '#f1f5f9'
                      : profile.memberLevel === 'silver'
                        ? '#e2e8f0'
                        : profile.memberLevel === 'gold'
                          ? '#fef3c7'
                          : '#dbeafe',
                }}
              >
                <Crown
                  className={`w-5 h-5 ${
                    profile.memberLevel === 'gold'
                      ? 'text-amber-500'
                      : profile.memberLevel === 'diamond'
                        ? 'text-blue-500'
                        : 'text-slate-500'
                  }`}
                />
              </div>
            </div>
            <Badge
              className={`${memberBadgeVariants[profile.memberLevel]} border mb-2`}
              variant="outline"
            >
              {memberInfo?.name}
            </Badge>
            <div className="text-xs text-slate-500 mb-2">
              {nextInfo.needed > 0
                ? `再充 ¥${nextInfo.needed} 升级 ${nextInfo.nextName}`
                : nextInfo.nextName}
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${nextInfo.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口 */}
      <div data-ai-section-type="card-menu" className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
          <CardContent className="p-5">
            <Link to="/recharge" className="block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-800">
                      充值积分
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      多种档位，即充即用
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
                      六大AI工具随心使用
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
