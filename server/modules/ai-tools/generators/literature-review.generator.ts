/**
 * 文献综述生成器
 * 输入：{ topic, field, researchDirection, yearRange }
 * 输出：{ domesticStatus, foreignStatus, researchHotspots, researchGaps, developmentTrends, references, reviewText }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface LiteratureReviewInput {
  topic?: string;
  field?: string;
  researchDirection?: string;
  yearRange?: string;
}

export interface LiteratureReviewOutput {
  domesticStatus: string;
  foreignStatus: string;
  researchHotspots: string[];
  researchGaps: string[];
  developmentTrends: string[];
  references: { title: string; authors: string; year: string; journal: string }[];
  reviewText: string;
}

const HOTSPOT_TEMPLATES = [
  '深度学习与神经网络模型优化',
  '大数据驱动的智能决策系统',
  '多模态数据融合与特征学习',
  '可解释人工智能与模型透明度',
  '联邦学习与隐私保护计算',
  '边缘智能与实时推理技术',
];

const GAP_TEMPLATES = [
  '跨领域迁移学习的泛化能力有待提升',
  '小样本学习场景下的模型性能不足',
  '模型可解释性与可验证性研究滞后',
  '伦理与社会影响层面的研究相对薄弱',
  '实际应用场景中的鲁棒性有待加强',
  '多语言、跨文化场景下的适应性研究不足',
];

const TREND_TEMPLATES = [
  '从专用人工智能向通用人工智能演进',
  '多模态大模型成为技术发展主流方向',
  'AI与各学科深度交叉融合加速',
  '可解释、可信赖的AI技术日益受到重视',
  '边缘智能与端侧部署需求持续增长',
  'AI伦理治理与监管框架逐步完善',
];

const REFERENCES_TEMPLATES = [
  { title: '深度学习研究进展与趋势', authors: '李华, 王明', year: '2023', journal: '计算机学报' },
  { title: 'Natural Language Processing: State of the Art', authors: 'Smith J, Johnson A', year: '2022', journal: 'ACM Computing Surveys' },
  { title: '机器学习在社会科学中的应用综述', authors: '陈刚, 刘丽', year: '2023', journal: '管理世界' },
  { title: 'Deep Learning for Text Classification: A Review', authors: 'Zhang Y, Liu X', year: '2021', journal: 'IEEE Transactions on Neural Networks' },
  { title: '人工智能研究的知识图谱分析', authors: '赵伟, 孙强', year: '2022', journal: '情报学报' },
  { title: 'A Survey on Explainable Artificial Intelligence', authors: 'Miller T, Howe P', year: '2023', journal: 'Artificial Intelligence Review' },
];

export async function generate(input: LiteratureReviewInput): Promise<LiteratureReviewOutput> {
  const {
    topic = '人工智能',
    field = '计算机科学与技术',
    researchDirection = '深度学习',
    yearRange = '2018-2023',
  } = input;

  const domesticStatus = `国内${field}领域关于"${topic}"的研究在${yearRange}年间呈现快速增长态势。` +
    `研究方向主要集中在${researchDirection}、智能算法优化、行业应用等方面。` +
    `国内学者在顶会顶刊发表的论文数量稳步增长，部分方向达到国际先进水平。` +
    `高校和科研机构是研究主力，产学研合作日益紧密，国家重点研发计划等项目持续投入支持。` +
    `整体来看，国内研究在应用层面具有鲜明特色，但基础理论原创性仍有提升空间。`;

  const foreignStatus = `国际${field}领域"${topic}"研究起步较早，理论体系相对成熟。` +
    `${yearRange}年间，${researchDirection}方向取得突破性进展，大模型、多模态学习等领域成果丰硕。` +
    `美国、欧盟等发达国家在基础研究和核心技术方面保持领先优势。` +
    `研究热点从算法创新逐步转向系统架构、伦理治理和跨学科应用等方向。` +
    `国际合作研究日益增多，开放科学理念推动学术资源共享和成果快速传播。`;

  const researchHotspots = HOTSPOT_TEMPLATES.map((h) => `${field}领域${h}`);
  const researchGaps = GAP_TEMPLATES.map((g) => `${researchDirection}方向${g}`);
  const developmentTrends = TREND_TEMPLATES.map((t) => t);

  const references = REFERENCES_TEMPLATES.map((ref) => ({
    ...ref,
    title: ref.title.includes('深度学习') || ref.title.includes('人工智能') || ref.title.includes('NLP') || ref.title.includes('Deep')
      ? ref.title
      : `${researchDirection}${ref.title}`,
  }));

  const reviewText = `# ${topic}研究文献综述\n\n` +
    `## 摘要\n\n本文梳理了${yearRange}年${field}领域关于"${topic}"的研究进展，` +
    `从国内外研究现状、研究热点、存在不足和发展趋势四个方面进行系统综述，` +
    `为后续研究提供参考和借鉴。\n\n` +
    `## 一、引言\n\n${topic}是${field}领域的重要研究方向，近年来受到学术界和工业界的广泛关注。` +
    `随着${researchDirection}技术的快速发展，相关研究成果不断涌现。` +
    `本文对${yearRange}年间的代表性研究进行梳理和分析，旨在明确当前研究进展，发现研究空白，展望未来方向。\n\n` +
    `## 二、国内研究现状\n\n${domesticStatus}\n\n` +
    `## 三、国外研究现状\n\n${foreignStatus}\n\n` +
    `## 四、研究热点分析\n\n` +
    researchHotspots.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n') +
    `\n\n## 五、研究不足与空白\n\n` +
    researchGaps.map((g: string, i: number) => `${i + 1}. ${g}`).join('\n') +
    `\n\n## 六、发展趋势展望\n\n` +
    developmentTrends.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n') +
    `\n\n## 七、结语\n\n本文系统综述了${topic}的研究进展，虽然已有大量研究成果，` +
    `但在理论深度、方法创新和应用广度方面仍有较大发展空间。` +
    `未来研究可在上述研究空白的基础上进一步探索，推动${field}领域的持续发展。`;

  return {
    domesticStatus,
    foreignStatus,
    researchHotspots,
    researchGaps,
    developmentTrends,
    references,
    reviewText,
  };
}
