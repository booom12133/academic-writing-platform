import React, { useState } from 'react';
import {
  ListTree,
  BookOpen,
  Sparkles,
  LayoutTemplate,
  SearchCheck,
  BarChart3,
  Coins,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Palette,
  Lightbulb,
  Bookmark,
  FileText,
  ClipboardList,
  FileEdit,
  Newspaper,
  Briefcase,
  Target,
  Edit3,
  MessageSquare,
  PieChart,
  RotateCcw,
  ClipboardSignature,
  Eraser,
  Presentation,
} from 'lucide-react';
import {
  TOOL_CONFIGS,
  TOOL_CATEGORIES,
  type TaskType,
  type ToolCategory,
} from '@shared/api.interface';

interface ToolSidebarProps {
  activeType: TaskType;
  onSelect: (type: TaskType) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  'list-tree': ListTree,
  'book-open': BookOpen,
  sparkles: Sparkles,
  'layout-template': LayoutTemplate,
  'search-check': SearchCheck,
  'bar-chart-3': BarChart3,
  'graduation-cap': GraduationCap,
  palette: Palette,
  lightbulb: Lightbulb,
  bookmark: Bookmark,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  'file-edit': FileEdit,
  newspaper: Newspaper,
  briefcase: Briefcase,
  target: Target,
  'edit-3': Edit3,
  'message-square': MessageSquare,
  'pie-chart': PieChart,
  'form-input': ClipboardSignature,
  'rotate-ccw': RotateCcw,
  'eraser': Eraser,
  'presentation': Presentation,
};

const ToolSidebar: React.FC<ToolSidebarProps> = ({ activeType, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<ToolCategory, boolean>>({
    'writing-planning': false,
    'efficiency-tools': false,
    'extended-tools': false,
  });

  const toggleCategory = (key: ToolCategory) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex h-full flex-col py-3">
      <div className="px-4 pb-3">
        <h2 className="text-xs font-semibold uppercase text-slate-500">
          工具中心
        </h2>
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto px-2">
        {TOOL_CATEGORIES.map((cat) => {
          const tools = TOOL_CONFIGS.filter((t) => t.category === cat.key);
          const isCollapsed = collapsed[cat.key];
          return (
            <div key={cat.key} className="space-y-1">
              <button
                onClick={() => toggleCategory(cat.key)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>{cat.name}</span>
                <span className="ml-1 text-[10px] text-slate-400">
                  {tools.length}个工具
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-1">
                  {tools.map((tool) => {
                    const Icon = iconMap[tool.icon] || Sparkles;
                    const isActive = activeType === tool.type;
                    return (
                      <button
                        key={tool.type}
                        onClick={() => onSelect(tool.type)}
                        className={`group relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-blue-600" />
                        )}
                        <div className="relative">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {tool.isHot && (
                            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                              热门
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">
                              {tool.name}
                            </span>
                            <span
                              className={`flex items-center gap-0.5 flex-shrink-0 text-xs font-medium ${
                                isActive ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            >
                              <Coins className="h-3 w-3" />
                              {tool.basePoints}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 truncate text-xs leading-tight ${
                              isActive ? 'text-blue-600/80' : 'text-slate-500'
                            }`}
                          >
                            {tool.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default ToolSidebar;
