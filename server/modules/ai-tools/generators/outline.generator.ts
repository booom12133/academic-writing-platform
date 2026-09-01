/**
 * 智能大纲生成器
 * 输入：{ title, field, educationLevel, targetWords, outlineRequirement }
 * 输出：{ chapters, wordDistribution, suggestions }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface OutlineGeneratorInput {
  title?: string;
  field?: string;
  educationLevel?: string;
  targetWords?: number;
  outlineRequirement?: string;
}

interface OutlineChapter {
  title: string;
  level: number;
  points: string[];
}

interface WordDistribution {
  chapter: string;
  words: number;
}

interface OutlineGeneratorOutput {
  chapters: OutlineChapter[];
  wordDistribution: WordDistribution[];
  suggestions: string[];
}

const CHAPTER_TEMPLATES = [
  {
    title: '绪论',
    level: 1,
    points: ['研究背景与意义', '国内外研究现状综述', '研究内容与方法', '论文结构安排'],
  },
  {
    title: '相关理论与技术基础',
    level: 1,
    points: ['核心概念界定', '基础理论梳理', '关键技术介绍', '本章小结'],
  },
  {
    title: '研究设计与方法',
    level: 1,
    points: ['研究思路与框架', '数据来源与样本选择', '研究方法与模型构建', '变量设计与度量'],
  },
  {
    title: '实证分析与结果',
    level: 1,
    points: ['描述性统计分析', '相关性检验', '回归分析与假设验证', '稳健性检验'],
  },
  {
    title: '案例分析与讨论',
    level: 1,
    points: ['案例背景介绍', '案例分析过程', '研究发现讨论', '对比现有研究'],
  },
  {
    title: '对策与建议',
    level: 1,
    points: ['基于研究结论的对策建议', '实践应用路径', '政策启示', '本章小结'],
  },
  {
    title: '结论与展望',
    level: 1,
    points: ['主要研究结论', '研究创新点', '研究局限与不足', '未来研究方向'],
  },
];

const FIELD_ADJUSTMENTS: Record<string, { replace?: Array<[number, string]>; addPoints?: string[] }> = {
  '计算机科学': {
    replace: [
      [1, '相关理论与技术基础'],
      [2, '系统设计与实现'],
      [3, '实验设计与结果分析'],
    ],
  },
  '管理学': {
    replace: [
      [2, '理论基础与文献综述'],
      [3, '研究假设与模型构建'],
    ],
  },
  '经济学': {
    replace: [
      [2, '理论模型与文献回顾'],
      [3, '计量模型与数据说明'],
    ],
  },
  '医学': {
    replace: [
      [1, '研究背景与立题依据'],
      [2, '材料与方法'],
      [3, '实验结果'],
      [4, '讨论'],
    ],
  },
  '教育学': {
    replace: [
      [2, '教育理论基础'],
      [3, '研究设计与实施'],
    ],
  },
  '法学': {
    replace: [
      [1, '问题的提出与研究意义'],
      [2, '相关法律制度与理论基础'],
      [3, '比较法研究'],
    ],
  },
};

export async function generate(input: OutlineGeneratorInput): Promise<OutlineGeneratorOutput> {
  const {
    title = '研究主题',
    field = '综合',
    educationLevel = '本科',
    targetWords = 8000,
  } = input;

  // 根据教育水平调整章节数量
  const chapterCount = educationLevel === '博士'
    ? 8
    : educationLevel === '硕士'
      ? 7
      : educationLevel === '本科'
        ? 6
        : 5;

  const baseChapters = CHAPTER_TEMPLATES.slice(0, chapterCount);

  // 根据领域调整章节标题
  const adjustedChapters: OutlineChapter[] = baseChapters.map((ch, idx) => {
    const fieldAdjust = FIELD_ADJUSTMENTS[field];
    let chapterTitle = ch.title;
    let chapterPoints = [...ch.points];

    if (fieldAdjust?.replace) {
      const replacement = fieldAdjust.replace.find(([index]) => index === idx);
      if (replacement) chapterTitle = replacement[1];
    }

    // 结合标题微调第一章要点
    if (idx === 0) {
      chapterPoints = [
        `${title}的研究背景与现实意义`,
        `${field}领域国内外研究现状述评`,
        `研究内容与技术路线`,
        `研究方法与创新点`,
      ];
    }

    return { title: chapterTitle, level: ch.level, points: chapterPoints };
  });

  // 字数分配（按章节重要性加权）
  const weights = [0.1, 0.15, 0.2, 0.25, 0.15, 0.1, 0.05];
  const wordDistribution: WordDistribution[] = adjustedChapters.map((ch, idx) => {
    const weight = weights[idx] ?? 0.1;
    return {
      chapter: ch.title,
      words: Math.round(targetWords * weight / 100) * 100,
    };
  });

  // 写作建议
  const suggestions: string[] = [
    `建议先完成"绪论"和"文献综述"部分，为后续研究奠定理论基础。`,
    `第3-4章是论文核心，建议占总字数的45%-50%，重点突出实证分析过程。`,
    `文献综述避免简单罗列，要进行归纳分析并指出现有研究不足。`,
    `研究方法部分要详细说明数据来源、样本选择和模型设定，保证可重复性。`,
    `结论部分要回应研究问题，总结创新点，并客观指出研究局限。`,
    `建议按照学校格式规范统一排版，注意图表编号和参考文献格式。`,
  ];

  return {
    chapters: adjustedChapters,
    wordDistribution,
    suggestions,
  };
}
