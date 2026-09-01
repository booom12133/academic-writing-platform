/**
 * 问卷设计生成器
 * 输入：{ topic, targetPopulation, dimensions, questionCount }
 * 输出：{ title, instructions, demographics, dimensions, scoringInstructions, reliabilityNotes }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface QuestionnaireDesignInput {
  topic?: string;
  targetPopulation?: string;
  dimensions?: string[];
  questionCount?: number;
}

export interface QuestionnaireDesignOutput {
  title: string;
  instructions: string;
  demographics: { question: string; type: string; options?: string[] }[];
  dimensions: {
    dimension: string;
    questions: { question: string; type: string; options?: string[]; scale?: string }[];
  }[];
  scoringInstructions: string;
  reliabilityNotes: string;
}

const DEFAULT_DIMENSIONS = ['学习动机', '学习策略', '学习满意度', '学习效果'];

const DEMOGRAPHIC_QUESTIONS = [
  { question: '您的性别', type: 'single', options: ['男', '女', '其他/不愿透露'] },
  { question: '您的年龄', type: 'single', options: ['18岁以下', '18-25岁', '26-35岁', '36-45岁', '46岁以上'] },
  { question: '您的学历', type: 'single', options: ['高中及以下', '大专', '本科', '硕士', '博士及以上'] },
  { question: '您的职业', type: 'single', options: ['学生', '企业员工', '教师/科研人员', '政府/事业单位', '自由职业', '其他'] },
];

function generateQuestions(dimension: string, count: number): { question: string; type: string; scale: string }[] {
  const templates = [
    `我对${dimension}有浓厚兴趣`,
    `${dimension}对我来说很重要`,
    `我在${dimension}方面表现良好`,
    `我愿意投入更多时间提升${dimension}`,
    `我认为${dimension}能够带来积极影响`,
    `我对当前的${dimension}感到满意`,
    `${dimension}的质量符合我的预期`,
    `我会向他人推荐${dimension}相关内容`,
  ];

  return templates.slice(0, count).map((q: string) => ({
    question: q,
    type: 'likert5',
    scale: '非常不同意 - 不同意 - 中立 - 同意 - 非常同意',
  }));
}

export async function generate(input: QuestionnaireDesignInput): Promise<QuestionnaireDesignOutput> {
  const {
    topic = '在线学习体验',
    targetPopulation = '大学生',
    dimensions = DEFAULT_DIMENSIONS,
    questionCount = 5,
  } = input;

  const title = `${topic}调查问卷`;

  const instructions = `尊敬的${targetPopulation}朋友：\n\n` +
    `您好！我们正在进行一项关于"${topic}"的调查研究，旨在了解${targetPopulation}在${topic}方面的现状和需求。` +
    `本问卷采用匿名方式填写，所有数据仅用于学术研究，请您根据实际情况放心填写。\n\n` +
    `问卷预计需要5-8分钟完成。您的参与对本研究具有重要意义，衷心感谢您的支持与配合！\n\n` +
    `填写说明：请在符合您实际情况的选项上打"√"或点击选择。除特别说明外，所有题目均为单选题。`;

  const demographics = DEMOGRAPHIC_QUESTIONS.map((q) => ({
    question: q.question,
    type: q.type,
    options: q.options,
  }));

  const dimensionObjects = dimensions.map((dimension: string) => ({
    dimension,
    questions: generateQuestions(dimension, questionCount),
  }));

  const scoringInstructions = `## 计分说明\n\n` +
    `本问卷采用Likert 5点计分法，各维度计分规则如下：\n\n` +
    `- **正向计分题**：非常不同意=1分，不同意=2分，中立=3分，同意=4分，非常同意=5分\n` +
    `- **反向计分题**：非常不同意=5分，不同意=4分，中立=3分，同意=2分，非常同意=1分\n\n` +
    `各维度得分 = 该维度所有题目得分之和 / 该维度题目数\n\n` +
    `总问卷得分 = 所有维度得分之和 / 维度数\n\n` +
    `得分越高表示在该维度上的水平越高/状态越好。可参考以下标准进行解读：\n` +
    `- 4.0-5.0分：高水平/非常好\n` +
    `- 3.0-3.9分：中等水平/较好\n` +
    `- 2.0-2.9分：较低水平/一般\n` +
    `- 1.0-1.9分：低水平/较差`;

  const reliabilityNotes = `## 信效度说明\n\n` +
    `- **信度**：本问卷各维度Cronbach's α系数预计在0.75-0.90之间，总量表α系数预计在0.85以上，` +
    `具有良好的内部一致性信度。重测信度预计在0.70-0.85之间。\n\n` +
    `- **效度**：问卷维度设置基于理论推导和已有研究，具有良好的内容效度。` +
    `建议正式使用前通过探索性因子分析（EFA）和验证性因子分析（CFA）检验结构效度。\n\n` +
    `- **使用建议**：正式施测前建议进行预调查（样本量建议≥50），根据预调查结果进行项目分析和题项筛选，` +
    `确保问卷质量。小样本预调查后可根据统计结果删除区分度低的题项。`;

  return {
    title,
    instructions,
    demographics,
    dimensions: dimensionObjects,
    scoringInstructions,
    reliabilityNotes,
  };
}
