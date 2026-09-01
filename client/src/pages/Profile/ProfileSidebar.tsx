import {
  LayoutDashboard,
  FileText,
  Receipt,
  History,
  Settings,
} from 'lucide-react';

export type ProfileTab =
  | 'dashboard'
  | 'tasks'
  | 'orders'
  | 'records'
  | 'settings';

interface ProfileSidebarProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

const menuItems: {
  key: ProfileTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: 'dashboard', label: '数据概览', icon: LayoutDashboard },
  { key: 'tasks', label: '我的任务', icon: FileText },
  { key: 'orders', label: '充值订单', icon: Receipt },
  { key: 'records', label: '积分流水', icon: History },
  { key: 'settings', label: '账号设置', icon: Settings },
];

export default function ProfileSidebar({
  active,
  onChange,
}: ProfileSidebarProps) {
  return (
    <div className="w-[200px] bg-white border-r border-slate-200 py-5 shrink-0">
      <nav className="space-y-1 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
