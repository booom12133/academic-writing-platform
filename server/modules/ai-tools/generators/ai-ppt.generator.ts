/**
 * AI PPT 生成器
 * 输入：{ topic, contentPoints, pageCount, style, useCase }
 * 输出：{ title, style, totalPages, slides, designSuggestions, deliveryTips }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface AiPptGeneratorInput {
  topic?: string;
  contentPoints?: string;
  pageCount?: number;
  style?: string;
  useCase?: string;
}

export interface AiPptGeneratorOutput {
  title: string;
  style: string;
  totalPages: number;
  slides: {
    page: number;
    title: string;
    type: 'cover' | 'outline' | 'content' | 'chart' | 'summary' | 'end';
    bulletPoints: string[];
    imageSuggestion?: string;
    speakerNotes?: string;
  }[];
  designSuggestions: string[];
  deliveryTips: string[];
}

const STYLE_CONFIG: Record<string, { design: string[]; colorTip: string }> = {
  '学术风': {
    design: [
      '配色以深蓝、灰白为主，体现学术严谨性',
      '字体选用衬线字体（如宋体/Garamond），标题加粗',
      '排版简洁对称，页脚标注页码和章节信息',
      '图表使用学术规范样式，数据来源清晰标注',
    ],
    colorTip: '主色 #1e3a8a（深蓝）+ 辅助色 #64748b（灰蓝）+ 背景 #f8fafc',
  },
  '商务风': {
    design: [
      '配色以深蓝、金色为主，体现专业稳重',
      '字体选用无衬线字体（如思源黑体/Helvetica）',
      '排版层次分明，善用卡片式布局和留白',
      '数据图表突出关键指标，使用图标辅助表达',
    ],
    colorTip: '主色 #1d4ed8（商务蓝）+ 点缀色 #d97706（金色）+ 背景 #ffffff',
  },
  '简约风': {
    design: [
      '配色以黑白灰为主，少量强调色点缀',
      '字体选用现代无衬线字体，保持视觉统一',
      '大量留白，每页仅保留核心信息',
      '使用图标和简洁图形替代大段文字',
    ],
    colorTip: '主色 #0f172a（近黑）+ 强调色 #0ea5e9（亮蓝）+ 背景 #ffffff',
  },
  '科技风': {
    design: [
      '配色以深色背景+荧光色为主，体现科技感',
      '字体选用几何感强的无衬线字体',
      '善用渐变、玻璃拟态、发光效果',
      '加入科技元素：数据可视化、粒子效果、几何图形',
    ],
    colorTip: '主色 #06b6d4（青蓝）+ 背景 #0f172a（深靛）+ 点缀 #22d3ee',
  },
};

const USE_CASE_TIPS: Record<string, string[]> = {
 答辩: [
    '开场先介绍研究背景和意义，快速抓住评委注意力',
    '核心创新点用3点以内概括，每点配合一个具体案例',
    '遇到质疑先肯定提问价值，再有条理地回应',
    '控制语速，每页讲解约1-2分钟，预留答辩时间',
    '结尾强调研究贡献和未来展望，给评委留下深刻印象',
  ],
 汇报: [
    '开场用数据或问题引入，引发听众兴趣',
    '核心内容采用"总-分-总"结构，逻辑清晰',
    '多用图表展示数据，避免大段文字堆砌',
    '每讲完一个部分做简要小结，帮助听众跟上思路',
    '结尾给出明确的行动建议或下一步计划',
  ],
 宣讲: [
    '开场用故事或案例引入，建立情感连接',
    '内容设计要有起伏，重点部分放慢节奏强调',
    '适当设置互动环节，保持听众注意力',
    '运用肢体语言和眼神交流，增强感染力',
    '结尾有力升华主题，留下记忆点',
  ],
 教学: [
    '每页内容不宜过多，配合讲解逐步展开',
    '重要概念用不同颜色或动画突出强调',
    '穿插案例和提问，引导学生思考',
    '重点内容重复出现，强化记忆',
    '结尾留出总结和答疑时间',
  ],
};

function generateContentSlides(
  topic: string,
  contentPoints: string,
  count: number,
  useCase: string,
): {
  page: number;
  title: string;
  type: 'content' | 'chart';
  bulletPoints: string[];
  imageSuggestion: string;
  speakerNotes: string;
}[] {
  const pointList = contentPoints
    .split(/[；;、，,\n]/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  const defaultPoints = [
    `${topic}的研究背景与意义`,
    `${topic}的国内外研究现状`,
    `${topic}的核心理论框架`,
    `${topic}的研究方法与设计`,
    `${topic}的实证分析结果`,
    `${topic}的研究发现与讨论`,
    `${topic}的实践应用价值`,
  ];

  const points = pointList.length > 0 ? pointList : defaultPoints;

  const slides: {
    page: number;
    title: string;
    type: 'content' | 'chart';
    bulletPoints: string[];
    imageSuggestion: string;
    speakerNotes: string;
  }[] = [];

  for (let i = 0; i < count; i++) {
    const pointIdx = i % points.length;
    const slideTitle = points[pointIdx] || `${topic} 第${i + 1}部分`;
    const isChart = i === Math.floor(count / 2);

    const bullets = [
      `${slideTitle}的核心概念与定义`,
      `${slideTitle}的主要特征与表现形式`,
      `${slideTitle}的关键影响因素分析`,
      `${slideTitle}的典型案例与实证依据`,
    ].slice(0, 3 + (i % 3));

    slides.push({
      page: i + 3, // 封面+目录占前2页
      title: slideTitle,
      type: isChart ? 'chart' : 'content',
      bulletPoints: bullets,
      imageSuggestion: isChart
        ? `展示${slideTitle}相关数据的柱状图/折线图`
        : `与${slideTitle}主题相关的示意图或概念图`,
      speakerNotes:
        useCase === '答辩'
          ? `本页重点介绍${slideTitle}。讲解时注意突出研究的创新点，结合具体数据说明，时间控制在1.5分钟左右。`
          : useCase === '教学'
            ? `先提问引导学生思考${slideTitle}，再逐步展开讲解核心要点，注意联系实际案例帮助理解。`
            : `本页讲解${slideTitle}，建议先抛出观点，再用数据和案例支撑，语速适中，注意与听众眼神交流。`,
    });
  }

  return slides;
}

export async function generate(input: AiPptGeneratorInput): Promise<AiPptGeneratorOutput> {
  const {
    topic = '人工智能在教育中的应用研究',
    contentPoints = '研究背景与意义;国内外研究现状;核心理论框架;研究方法设计;实证分析结果;研究发现与讨论;实践应用价值',
    pageCount = 10,
    style = '学术风',
    useCase = '答辩',
  } = input;

  const totalPages = Math.max(5, Math.min(30, pageCount));
  const styleConfig = STYLE_CONFIG[style] ?? STYLE_CONFIG['学术风'];
  const deliveryTips = USE_CASE_TIPS[useCase] ?? USE_CASE_TIPS['答辩'];

  // 内容页数 = 总页数 - 封面 - 目录 - 总结 - 结束页
  const contentPageCount = Math.max(2, totalPages - 4);

  const contentSlides = generateContentSlides(topic, contentPoints, contentPageCount, useCase);

  const slides: {
    page: number;
    title: string;
    type: 'cover' | 'outline' | 'content' | 'chart' | 'summary' | 'end';
    bulletPoints: string[];
    imageSuggestion?: string;
    speakerNotes?: string;
  }[] = [];

  // 第1页：封面
  slides.push({
    page: 1,
    title: topic,
    type: 'cover',
    bulletPoints: [
      `——${useCase}演示文稿——`,
      `汇报人：____________`,
      `指导老师：____________`,
      `日期：${new Date().getFullYear()}年${new Date().getMonth() + 1}月`,
    ],
    imageSuggestion: '与主题相关的高质量背景图，建议半透明蒙版处理',
    speakerNotes: '开场问好，简要自我介绍，用一句话引出主题，吸引听众注意。',
  });

  // 第2页：目录
  slides.push({
    page: 2,
    title: '目录',
    type: 'outline',
    bulletPoints: contentSlides.map((s: { title: string }, idx: number) => `${idx + 1}. ${s.title}`),
    speakerNotes: '简要介绍整体框架，让听众对内容有预期，然后过渡到第一部分。',
  });

  // 内容页
  slides.push(...contentSlides);

  // 倒数第2页：总结
  slides.push({
    page: totalPages - 1,
    title: '总结与展望',
    type: 'summary',
    bulletPoints: [
      `研究系统梳理了${topic}的核心内容与关键发现`,
      `主要贡献在于理论框架构建与实证分析的结合`,
      `研究局限在于样本范围和时间跨度有待扩展`,
      `未来研究可从多维度、跨学科视角进一步深入`,
    ],
    imageSuggestion: '简洁的总结信息图或研究路径示意图',
    speakerNotes: '总结部分语速放慢，强调核心贡献和价值，为结尾升华做铺垫。',
  });

  // 最后1页：结束页
  slides.push({
    page: totalPages,
    title: '感谢聆听',
    type: 'end',
    bulletPoints: ['敬请各位老师批评指正', 'THANK YOU'],
    speakerNotes: '鞠躬致谢，保持微笑，准备接受提问。',
  });

  const designSuggestions = [
    styleConfig.colorTip,
    ...styleConfig.design,
    '每页文字控制在6行以内，字号不小于24px',
    '图片选择高清无水印素材，保持风格统一',
    '动画效果适度使用，避免喧宾夺主',
  ];

  return {
    title: topic,
    style,
    totalPages,
    slides,
    designSuggestions,
    deliveryTips,
  };
}
