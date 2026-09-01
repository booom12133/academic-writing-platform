/**
 * 毕业设计创作生成器
 * 输入：{ title, field, designType, targetWords, designRequirement }
 * 输出：{ designOutline, designSpecifications, deliverables, references, suggestions }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface GraduationDesignGeneratorInput {
  title?: string;
  field?: string;
  designType?: string;
  targetWords?: number;
  designRequirement?: string;
}

export interface GraduationDesignGeneratorOutput {
  designOutline: { title: string; level: number; points: string[] }[];
  designSpecifications: { section: string; content: string }[];
  deliverables: { name: string; description: string; status: string }[];
  references: { title: string; authors: string; year: string }[];
  suggestions: string[];
}

const OUTLINE_TEMPLATES = [
  { title: '设计任务书', level: 1, points: ['设计目的与要求', '设计内容与进度', '主要参考文献', '成果形式'] },
  { title: '第一章 绪论', level: 1, points: ['设计背景与意义', '国内外研究现状', '设计目标与内容', '设计思路与方法'] },
  { title: '第二章 方案设计', level: 1, points: ['需求分析', '总体方案设计', '关键技术选型', '方案论证与比较'] },
  { title: '第三章 详细设计', level: 1, points: ['系统架构设计', '功能模块设计', '界面设计', '数据库设计'] },
  { title: '第四章 实现与测试', level: 1, points: ['开发环境搭建', '核心功能实现', '系统测试方案', '测试结果分析'] },
  { title: '第五章 总结与展望', level: 1, points: ['设计总结', '创新点说明', '存在的问题', '未来改进方向'] },
];

const SPEC_TEMPLATES = [
  { section: '功能需求规格', content: '系统应具备用户管理、数据处理、结果展示等核心功能，满足用户日常使用需求。' },
  { section: '性能需求规格', content: '系统响应时间应控制在2秒以内，支持1000+并发用户，数据处理准确率不低于95%。' },
  { section: '界面设计规范', content: '采用简洁直观的界面设计，遵循可用性原则，确保不同技能水平的用户都能轻松上手。' },
  { section: '安全需求规格', content: '实现用户身份认证、权限管理、数据加密传输，保障系统和数据安全。' },
];

const DELIVERABLE_TEMPLATES = [
  { name: '设计说明书', description: '完整的毕业设计说明书，包含设计背景、方案、实现、测试等内容', status: '已完成' },
  { name: '原型系统/作品', description: '可运行的设计原型或实物作品，展示核心功能与设计效果', status: '进行中' },
  { name: '设计图纸', description: '系统架构图、功能流程图、界面原型图等设计文档', status: '已完成' },
  { name: '演示视频', description: '设计成果展示视频，介绍设计思路和使用方法', status: '待开始' },
  { name: '外文翻译', description: '与设计主题相关的外文文献翻译', status: '已完成' },
];

const REFERENCES_TEMPLATES = [
  { title: '软件工程：实践者的研究方法', authors: 'Roger S. Pressman', year: '2020' },
  { title: '设计模式：可复用面向对象软件的基础', authors: 'Erich Gamma 等', year: '2019' },
  { title: '人机交互设计', authors: 'Alan Dix 等', year: '2021' },
  { title: '产品设计与开发', authors: 'Karl T. Ulrich', year: '2022' },
];

export async function generate(input: GraduationDesignGeneratorInput): Promise<GraduationDesignGeneratorOutput> {
  const {
    title = '基于Web的学生管理系统设计与实现',
    field = '计算机科学与技术',
    designType = '系统设计',
  } = input;

  const designOutline = OUTLINE_TEMPLATES.map((ch) => ({
    title: ch.title,
    level: ch.level,
    points: ch.points.map((p) => p.replace('设计', `${field}${designType}的`)),
  }));

  const designSpecifications = SPEC_TEMPLATES.map((spec) => ({
    section: spec.section,
    content: `${spec.content} 本设计主题为"${title}"，面向${field}领域。`,
  }));

  const deliverables = DELIVERABLE_TEMPLATES.map((d) => ({
    ...d,
    description: d.description.replace('设计', `${field}${designType}`),
  }));

  const references = REFERENCES_TEMPLATES.slice(0, 5).map((ref) => ({
    ...ref,
    title: ref.title.includes('软件') || ref.title.includes('设计')
      ? ref.title
      : `${field}领域${ref.title}`,
  }));

  const suggestions = [
    `建议按照${field}专业毕业设计规范完成设计文档和作品。`,
    '系统设计阶段要充分考虑需求完整性和可扩展性，避免后期大幅修改。',
    '测试环节要覆盖功能测试、性能测试、兼容性测试等多个维度。',
    '答辩前准备好演示视频和答辩PPT，确保展示流畅。',
    '注意设计说明书的格式规范，包括图表编号、参考文献格式等。',
    '建议提前与指导老师沟通设计方案，确保方向正确。',
  ];

  return {
    designOutline,
    designSpecifications,
    deliverables,
    references,
    suggestions,
  };
}
