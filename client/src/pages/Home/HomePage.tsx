import { useNavigate } from 'react-router-dom';
import {
  ListTree,
  BookOpen,
  Sparkles,
  LayoutTemplate,
  SearchCheck,
  BarChart3,
  ArrowRight,
  Upload,
  MousePointerClick,
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
  FormInput,
  RotateCcw,
  Eraser,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TOOL_CATEGORIES,
  type ToolCategory,
} from '@shared/api.interface';
import {
  getProductCapabilities,
} from '@shared/product-capability.catalog';
import type { ProductToolCapability } from '@shared/product-capability.interface';

const iconMap: Record<string, typeof ListTree> = {
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
  'form-input': FormInput,
  'rotate-ccw': RotateCcw,
  eraser: Eraser,
  presentation: Presentation,
};

const steps = [
  {
    num: 1,
    title: '选择工具',
    description: '从当前可用的学术写作工具中选择需要的辅助功能',
    icon: MousePointerClick,
  },
  {
    num: 2,
    title: '提交任务',
    description: '上传文档或输入文本，设置参数后一键提交 AI 处理',
    icon: Upload,
  },
  {
    num: 3,
    title: '查看结果',
    description: '在线查看 AI 处理结果与任务状态',
    icon: FileText,
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const productionCapabilityCount = getProductCapabilities().filter(
    (capability: ProductToolCapability) => capability.readiness === 'production',
  ).length;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50 to-slate-50">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-28 text-center">
          <Badge variant="secondary" className="mb-6 bg-white/80 text-blue-600 border-blue-100">
            AI 驱动的学术写作助手
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-800 leading-tight mb-6">
            智能学术写作助手
            <br />
            <span className="text-blue-600">让论文写作更高效</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI 驱动的学术写作辅助平台，提供选题、润色与论文修改等已开放能力，
            帮助您更高效地完成学术写作
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="px-8 text-base"
              onClick={() => navigate('/tools')}
            >
              立即进入工具中心
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-base bg-white"
              onClick={() => navigate('/tools')}
            >
              查看可用工具
            </Button>
          </div>
          <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>当前开放能力持续更新</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>{productionCapabilityCount} 项能力已开放</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>结果与任务状态可查看</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 space-y-12">
        <div className="text-center mb-4">
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">
            当前可用的学术写作工具
          </h2>
          <p className="text-sm text-slate-500">
            当前提供选题、润色与论文修改等学术写作辅助能力
          </p>
        </div>

        {TOOL_CATEGORIES.map((cat) => {
          const tools = getProductCapabilities().filter(
            (t: ProductToolCapability) =>
              t.readiness === 'production' &&
              t.category === (cat.key as ToolCategory),
          );
          const catDesc =
            cat.key === 'writing-planning'
              ? '提供选题生成与论文修改等已开放能力'
              : cat.key === 'efficiency-tools'
                ? '提供语法润色等已开放能力'
                : '当前暂无已开放的扩展工具';
          return (
            <div key={cat.key}>
              <div className="mb-5">
                <h3 className="text-xl font-semibold text-slate-800 mb-1">
                  {cat.name}
                </h3>
                <p className="text-sm text-slate-500">{catDesc}</p>
              </div>
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                data-ai-section-type="card-list"
              >
                {tools.map((tool: ProductToolCapability) => {
                  const IconComp = iconMap[tool.icon] || Sparkles;
                  return (
                    <Card
                      key={tool.type}
                      className="p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md group relative"
                      onClick={() => navigate(`/tools/${tool.type}`)}
                    >
                      {tool.isHot && (
                        <Badge
                          variant="destructive"
                          className="absolute top-3 right-3 text-xs"
                        >
                          热门
                        </Badge>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <IconComp className="w-6 h-6 text-blue-600" />
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-amber-50 text-amber-600 border-amber-100"
                        >
                          {tool.basePoints} 积分
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4">
                        {tool.description}
                      </p>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto text-blue-600 hover:text-blue-700 hover:bg-transparent"
                      >
                        立即使用
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Steps Section */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">
              3步轻松完成
            </h2>
            <p className="text-sm text-slate-500">简单高效，快速上手</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                      <span className="text-xl font-bold text-white">
                        {step.num}
                      </span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                      <StepIcon className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[70%] w-[60%] border-t-2 border-dashed border-slate-200" />
                  )}
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-[240px] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
            开始您的高效学术写作之旅
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            查看当前已开放的学术写作辅助能力，选择适合您的工具
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 px-8"
              onClick={() => navigate('/tools')}
            >
              查看可用工具
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 px-8"
              onClick={() => navigate('/tools')}
            >
              浏览工具
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
