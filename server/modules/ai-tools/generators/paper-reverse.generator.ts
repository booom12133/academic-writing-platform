/**
 * 论文倒推生成器
 * 输入：{ paperTitle, paperAbstract, field, targetType }
 * 输出：{ titleAnalysis, outline, researchFramework, researchMethods, innovationPoints, topicBasis }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface PaperReverseInput {
  paperTitle?: string;
  paperAbstract?: string;
  field?: string;
  targetType?: string;
}

export interface PaperReverseOutput {
  titleAnalysis: string;
  outline: { title: string; level: number; description: string }[];
  researchFramework: string;
  researchMethods: string[];
  innovationPoints: string[];
  topicBasis: string;
}

const OUTLINE_TEMPLATES = [
  { title: '绪论', level: 1, description: '研究背景、问题提出、研究意义、研究内容与方法、论文结构' },
  { title: '文献综述与理论基础', level: 1, description: '国内外研究现状梳理、相关理论阐述、研究空白与不足分析' },
  { title: '研究设计', level: 1, description: '研究假设、模型构建、变量定义、数据来源与样本说明' },
  { title: '实证分析', level: 1, description: '描述性统计、相关性分析、假设检验、稳健性检验' },
  { title: '结果讨论', level: 1, description: '研究发现解读、理论贡献、实践启示、研究局限' },
  { title: '结论与展望', level: 1, description: '主要结论、创新点总结、未来研究方向' },
];

const METHOD_TEMPLATES = [
  '文献研究法：系统梳理相关领域研究文献，构建理论基础',
  '实证研究法：采用定量分析方法，对研究假设进行检验',
  '案例分析法：结合典型案例深入分析，增强研究说服力',
  '比较研究法：对比不同群体/方法/场景的差异',
  '问卷调查法：通过收集大样本数据进行统计分析',
  '访谈法：通过深度访谈获取质性资料',
];

const INNOVATION_TEMPLATES = [
  '研究视角创新：从新的理论视角出发研究问题',
  '研究方法创新：采用新的研究方法或分析技术',
  '研究场景创新：将已有方法应用于新的应用场景',
  '研究发现创新：得出了新的、有价值的研究结论',
];

export async function generate(input: PaperReverseInput): Promise<PaperReverseOutput> {
  const {
    paperTitle = '基于深度学习的多模态情感分析研究',
    paperAbstract = '本文提出了一种基于深度学习的多模态情感分析方法，通过...',
    field = '计算机科学与技术',
    targetType = '硕士学位论文',
  } = input;

  const titleAnalysis = `## 题目分析\n\n` +
    `**论文题目**：${paperTitle}\n\n` +
    `**研究领域**：${field}\n\n` +
    `**题目结构解析**：\n` +
    `- 技术基础：基于深度学习 → 技术路线明确，采用前沿方法\n` +
    `- 研究对象：多模态情感分析 → 研究问题具体，具有明确应用场景\n` +
    `- 研究类型：应用研究 → 偏向技术方法的应用与改进\n\n` +
    `**题目亮点**：\n` +
    `1. 紧扣当前${field}领域研究热点，时效性强\n` +
    `2. "多模态"体现了研究的复杂性和前沿性\n` +
    `3. 研究问题明确，具有较高的应用价值\n\n` +
    `**可延伸方向**：\n` +
    `可从模型优化、应用场景拓展、跨领域迁移等角度进一步深化研究，` +
    `适合作为${targetType}的选题方向。`;

  const outline = OUTLINE_TEMPLATES.map((item) => ({
    title: item.title,
    level: item.level,
    description: item.description,
  }));

  const researchFramework = `## 研究框架推断\n\n` +
    `基于论文题目"${paperTitle}"，可推断其研究框架如下：\n\n` +
    `**提出问题** → 分析${field}领域多模态情感分析面临的挑战，明确研究问题和研究意义\n\n` +
    `**理论基础** → 梳理深度学习和多模态学习相关理论，建立研究的理论支撑体系\n\n` +
    `**方法设计** → 设计多模态融合策略和深度学习模型架构，解决核心技术问题\n\n` +
    `**实验验证** → 在公开数据集或自建数据集上进行实验，验证所提方法的有效性\n\n` +
    `**结果分析** → 对实验结果进行深入分析和讨论，揭示方法的内在机理\n\n` +
    `**总结展望** → 总结研究工作，指出创新点和局限性，展望未来研究方向\n\n` +
    `该框架遵循"问题-理论-方法-实验-结论"的经典学术研究范式，` +
    `逻辑清晰，层次分明，符合${targetType}的结构规范。`;

  const researchMethods = METHOD_TEMPLATES.slice(0, 5).map((m) => m);

  const innovationPoints = INNOVATION_TEMPLATES.slice(0, 3).map((item, idx) => {
    if (idx === 0) return `方法创新：提出基于深度学习的多模态融合新策略，提升情感分析性能`;
    if (idx === 1) return `视角创新：从多模态交叉视角研究情感分析问题，弥补单一模态的不足`;
    return `应用创新：将所提方法应用于实际场景，验证方法的有效性和实用价值`;
  });

  const topicBasis = `## 选题依据倒推\n\n` +
    `从论文内容反推，该选题的确定可能基于以下依据：\n\n` +
    `**1. 理论依据**\n` +
    `${field}领域的快速发展为该研究提供了理论基础。深度学习、多模态学习等理论日趋成熟，` +
    `为开展相关研究奠定了坚实的理论根基。\n\n` +
    `**2. 现实依据**\n` +
    `随着社交媒体和多媒体内容的爆发式增长，多模态情感分析在舆情监测、用户体验优化、` +
    `智能客服等领域具有广泛的应用需求，研究具有重要的现实意义。\n\n` +
    `**3. 研究空白**\n` +
    `现有方法在多模态融合效率、跨域泛化能力、模型可解释性等方面仍存在不足，` +
    `需要进一步的研究突破。本选题正是针对这些研究空白展开研究。\n\n` +
    `**4. 可行性分析**\n` +
    `研究条件成熟：公开数据集丰富、开源工具完善、计算资源可及，` +
    `结合研究者的专业背景，具备完成该研究的可行性。`;

  return {
    titleAnalysis,
    outline,
    researchFramework,
    researchMethods,
    innovationPoints,
    topicBasis,
  };
}
