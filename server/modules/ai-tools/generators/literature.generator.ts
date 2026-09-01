/**
 * 文献素材推荐生成器
 * 输入：{ topic, keywords, field, count, yearRange }
 * 输出：{ papers, researchHotspots, researchGaps, reviewSuggestions }
 *
 * TODO: 后续接入真实 AI 插件 / 学术数据库 API 时替换下方模板逻辑
 */

interface PaperInfo {
  title: string;
  authors: string[];
  year: number;
  journal: string;
  abstract: string;
  keyPoints: string[];
}

interface LiteratureGeneratorOutput {
  papers: PaperInfo[];
  researchHotspots: string[];
  researchGaps: string[];
  reviewSuggestions: string;
}

const FIRST_NAMES = ['伟', '芳', '娜', '敏', '静', '强', '磊', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀英'];
const LAST_NAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡'];
const JOURNALS = [
  '中国社会科学',
  '经济研究',
  '管理世界',
  '计算机学报',
  '软件学报',
  '自动化学报',
  '清华大学学报(自然科学版)',
  '北京大学学报(哲学社会科学版)',
  'Journal of Applied Psychology',
  'Academy of Management Review',
  'Strategic Management Journal',
  'Information Systems Research',
  'MIS Quarterly',
  'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  'Nature Communications',
];

function randomPick<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  const copy = [...arr];
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function generateAuthor(count: number): string[] {
  const authors: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    authors.push(`${ln}${fn}`);
  }
  return authors;
}

export async function generate(input: Record<string, any>): Promise<LiteratureGeneratorOutput> {
  const topic = (input.topic as string) ?? '研究主题';
  const keywords = (input.keywords as string[] | undefined) ?? [];
  const field = (input.field as string) ?? '综合';
  const count = Math.min(15, Math.max(6, Number(input.count) || 8));
  const yearRange = (input.yearRange as [number, number] | undefined) ?? [2018, 2024];

  const keywordStr = keywords.length > 0 ? keywords.join('、') : topic;
  const startYear = yearRange[0];
  const endYear = yearRange[1];

  const papers: PaperInfo[] = [];
  const selectedJournals = randomPick(JOURNALS, Math.min(count, JOURNALS.length));

  const titleTemplates = [
    `基于${keywordStr}的${field}研究：理论框架与实证检验`,
    `${keywordStr}对${field}的影响机制研究`,
    `数字时代下${topic}的演进路径与未来展望`,
    `${field}视角下${topic}的多维分析`,
    `基于多源数据的${keywordStr}测度与应用研究`,
    `${topic}研究的知识图谱与热点前沿`,
    `国内外${keywordStr}研究进展与比较`,
    `人工智能赋能${topic}：机制、路径与挑战`,
    `基于扎根理论的${topic}影响因素研究`,
    `${field}中${keywordStr}的作用机理研究`,
    `面向${topic}的创新模式与绩效评价`,
    `${keywordStr}与${topic}：一个文献综述`,
    `数字化转型背景下${topic}的重构研究`,
    `双碳目标下${field}的${topic}研究`,
    `新发展格局中${keywordStr}的战略价值`,
  ];

  const abstractTemplates = [
    `本文以${topic}为研究对象，系统探讨了${keywordStr}在${field}领域的应用价值与作用机制。研究采用文献分析与实证研究相结合的方法，基于200余份有效样本数据，验证了核心假设。研究发现，${keywordStr}对${field}发展具有显著正向影响，且该效应在不同情境下存在异质性。本文的研究结论丰富了${field}理论体系，为实践部门提供了决策参考。`,
    `随着数字化转型的深入推进，${topic}日益成为${field}领域关注的焦点。本文通过系统梳理国内外相关文献，构建了${keywordStr}的分析框架，并利用面板数据进行了实证检验。研究结果表明，${keywordStr}能够显著提升${field}绩效，且存在明显的空间溢出效应。本研究拓展了${field}的研究视角，对推动相关实践具有重要启示。`,
    `本文聚焦于${topic}这一前沿议题，采用混合研究方法，从理论和实证两个层面展开深入探讨。通过构建${keywordStr}的测度指标体系，本文发现${keywordStr}在${field}中的应用呈现出加速增长态势。进一步的机制分析表明，技术创新和制度环境是两个重要的传导路径。本研究为理解${field}的发展规律提供了新的经验证据。`,
  ];

  for (let i = 0; i < count; i += 1) {
    const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
    const authorCount = 2 + Math.floor(Math.random() * 3);
    const title = titleTemplates[i % titleTemplates.length];
    const abstract = abstractTemplates[i % abstractTemplates.length];
    const journal = selectedJournals[i % selectedJournals.length];

    const keyPoints = [
      `构建了${keywordStr}的理论分析框架`,
      `实证检验了${topic}的影响因素与作用机制`,
      `揭示了${field}领域的发展规律与异质性特征`,
      `提出了针对性的政策建议与实践路径`,
    ];

    papers.push({
      title,
      authors: generateAuthor(authorCount),
      year,
      journal,
      abstract,
      keyPoints,
    });
  }

  // 按年份降序排列
  papers.sort((a, b) => b.year - a.year);

  const researchHotspots = [
    `${keywordStr}与数字化转型的融合应用`,
    `基于大数据和AI的${field}研究方法创新`,
    `${topic}的多维度测度与评价体系构建`,
    `跨学科视角下${field}的理论整合`,
    `双碳/数字经济等国家战略与${topic}的结合研究`,
  ];

  const researchGaps = [
    `现有研究对${keywordStr}的微观作用机制探讨不够深入`,
    `缺乏针对中国情境的系统性理论构建`,
    `研究方法上重实证轻理论构建，缺乏纵向追踪研究`,
    `对不同行业/区域的异质性分析不足`,
    `新兴技术（如生成式AI）对${field}的影响研究尚处于起步阶段`,
  ];

  const reviewSuggestions = `建议按"理论基础→研究进展→研究评述→未来展望"的逻辑组织文献综述部分。重点梳理${keywordStr}的概念演化、测量方法和主要研究脉络，突出中国情境下的独特研究问题。文献引用注意中英文文献平衡，经典文献与前沿文献结合，建议综述部分引用文献不少于${count + 10}篇。`;

  return {
    papers,
    researchHotspots,
    researchGaps,
    reviewSuggestions,
  };
}
