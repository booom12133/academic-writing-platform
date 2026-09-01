export type TaskType =
  | 'outline'
  | 'literature'
  | 'polish'
  | 'format'
  | 'check'
  | 'chart'
  | 'thesis'
  | 'graduation-design'
  | 'topic-generation'
  | 'literature-review'
  | 'proposal'
  | 'task-assignment'
  | 'course-paper'
  | 'journal-paper'
  | 'practice-report'
  | 'project-application'
  | 'paper-revision'
  | 'comment-revision'
  | 'data-analysis'
  | 'questionnaire-design'
  | 'paper-reverse'
  | 'ai-reduce'
  | 'ai-ppt';

export type ToolCategory = 'writing-planning' | 'efficiency-tools' | 'extended-tools';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MemberLevel = 'normal' | 'silver' | 'gold' | 'diamond';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PointRecordType = 'recharge' | 'consume' | 'refund';

export interface UserProfile {
  userId: string;
  username?: string;
  phone?: string;
  avatarUrl?: string;
  points: number;
  totalRecharge: number;
  memberLevel: MemberLevel;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  taskType: TaskType;
  title: string;
  status: TaskStatus;
  progress: number;
  pointsCost: number;
  inputData: Record<string, any>;
  resultData?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PointRecord {
  id: string;
  userId: string;
  type: PointRecordType;
  amount: number;
  balanceAfter: number;
  taskId?: string;
  orderId?: string;
  description?: string;
  createdAt: string;
}

export interface PointRecordListResponse {
  items: PointRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RechargeOrder {
  id: string;
  userId: string;
  amount: number;
  points: number;
  status: OrderStatus;
  payMethod?: string;
  payOrderNo?: string;
  createdAt: string;
}

export interface OrderListResponse {
  items: RechargeOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateTaskRequest {
  taskType: TaskType;
  title: string;
  inputData: Record<string, any>;
}

export interface CreateOrderRequest {
  amount: number;
  payMethod: string;
}

export interface ToolConfig {
  type: TaskType;
  name: string;
  description: string;
  basePoints: number;
  icon: string;
  category: ToolCategory;
  isHot?: boolean;
  isRealtime?: boolean;
}

export const TOOL_CONFIGS: ToolConfig[] = [
  { type: 'thesis', name: '毕业论文创作', description: 'AI一站式生成完整毕业论文', basePoints: 80, icon: 'graduation-cap', category: 'writing-planning', isHot: true },
  { type: 'graduation-design', name: '毕业设计创作', description: '设计类毕业作品全套生成', basePoints: 100, icon: 'palette', category: 'writing-planning', isHot: true },
  { type: 'topic-generation', name: '智能拟题', description: 'AI推荐论文题目及研究思路', basePoints: 15, icon: 'lightbulb', category: 'writing-planning', isHot: true },
  { type: 'outline', name: '智能大纲生成', description: 'AI生成结构化论文大纲框架', basePoints: 20, icon: 'list-tree', category: 'writing-planning' },
  { type: 'literature-review', name: '文献综述', description: 'AI生成完整文献综述文章', basePoints: 40, icon: 'bookmark', category: 'writing-planning' },
  { type: 'literature', name: '文献素材推荐', description: 'AI推荐相关文献与研究综述', basePoints: 30, icon: 'book-open', category: 'writing-planning' },
  { type: 'proposal', name: '开题报告', description: 'AI生成规范开题报告文档', basePoints: 50, icon: 'file-text', category: 'writing-planning' },
  { type: 'task-assignment', name: '任务书', description: 'AI生成符合规范的任务书', basePoints: 30, icon: 'clipboard-list', category: 'writing-planning' },
  { type: 'course-paper', name: '课程论文', description: 'AI生成课程结课论文', basePoints: 40, icon: 'file-edit', category: 'writing-planning' },
  { type: 'journal-paper', name: '期刊论文', description: 'AI生成符合期刊规范的论文', basePoints: 60, icon: 'newspaper', category: 'writing-planning' },
  { type: 'practice-report', name: '实践报告', description: '实习/实验/社会实践报告生成', basePoints: 35, icon: 'briefcase', category: 'writing-planning' },
  { type: 'project-application', name: '课题申报', description: 'AI生成课题申报书', basePoints: 70, icon: 'target', category: 'writing-planning' },
  { type: 'paper-revision', name: 'AI论文修改', description: '内容扩充精简/逻辑优化/学术化提升', basePoints: 30, icon: 'edit-3', category: 'writing-planning' },
  { type: 'comment-revision', name: 'AI批注修改', description: '识别文档批注并应用修改建议', basePoints: 25, icon: 'message-square', category: 'writing-planning' },
  { type: 'polish', name: '语法润色', description: '语法纠错、学术化表达提升、降重改写', basePoints: 10, icon: 'sparkles', category: 'efficiency-tools' },
  { type: 'format', name: '格式规范排版', description: 'AI自动适配论文模板格式', basePoints: 50, icon: 'layout-template', category: 'efficiency-tools', isHot: true },
  { type: 'check', name: '查重参考', description: 'AI相似度检测与修改建议', basePoints: 40, icon: 'search-check', category: 'efficiency-tools', isHot: true },
  { type: 'ai-reduce', name: '降AI/降重', description: '降低AI检测率与重复率', basePoints: 30, icon: 'eraser', category: 'efficiency-tools' },
  { type: 'chart', name: '图表可视化', description: 'AI生成各类学术图表', basePoints: 25, icon: 'bar-chart-3', category: 'efficiency-tools' },
  { type: 'data-analysis', name: '数据分析', description: 'AI生成数据分析报告与图表', basePoints: 40, icon: 'pie-chart', category: 'efficiency-tools' },
  { type: 'questionnaire-design', name: '问卷设计', description: 'AI生成专业问卷与量表', basePoints: 25, icon: 'form-input', category: 'efficiency-tools' },
  { type: 'paper-reverse', name: '论文倒推', description: '从论文反推大纲选题与研究方法', basePoints: 20, icon: 'rotate-ccw', category: 'extended-tools' },
  { type: 'ai-ppt', name: 'AI PPT', description: 'AI生成PPT大纲与每页内容', basePoints: 35, icon: 'presentation', category: 'extended-tools' },
];

export const TOOL_CATEGORIES: { key: ToolCategory; name: string }[] = [
  { key: 'writing-planning', name: '写作规划' },
  { key: 'efficiency-tools', name: '效率工具' },
  { key: 'extended-tools', name: '扩展工具' },
];

export const MEMBER_LEVELS: { level: MemberLevel; name: string; discount: number; threshold: number }[] = [
  { level: 'normal', name: '普通用户', discount: 1, threshold: 0 },
  { level: 'silver', name: '白银会员', discount: 0.95, threshold: 100 },
  { level: 'gold', name: '黄金会员', discount: 0.9, threshold: 500 },
  { level: 'diamond', name: '钻石会员', discount: 0.8, threshold: 1000 },
];

export const RECHARGE_OPTIONS = [10, 30, 50, 100, 200, 500];

export const PROFESSIONAL_FIELDS = [
  '计算机科学与技术', '软件工程', '人工智能', '数据科学', '信息管理',
  '教育学', '心理学', '学前教育', '高等教育', '职业教育',
  '临床医学', '护理学', '药学', '公共卫生', '中医学',
  '经济学', '金融学', '会计学', '国际贸易', '财政学',
  '管理学', '工商管理', '人力资源管理', '市场营销', '物流管理',
  '法学', '宪法学与行政法学', '民商法学', '刑法学', '国际法学',
  '中国语言文学', '外国语言文学', '新闻学', '传播学',
  '数学', '物理学', '化学', '生物学', '地理学',
  '机械工程', '电子信息工程', '土木工程', '材料科学', '化学工程',
  '艺术设计', '音乐学', '美术学', '戏剧影视',
  '其他',
];

export const EDUCATION_LEVELS = ['专科', '本科', '硕士', '博士'];

export const CITATION_FORMATS = ['GB/T 7714', 'APA', 'MLA', 'Chicago', 'Harvard', 'IEEE'];
