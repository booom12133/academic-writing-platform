/**
 * 课程论文生成器
 * 输入：{ title, field, courseName, targetWords }
 * 输出：{ abstract, keywords, sections, references, wordCount }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface CoursePaperGeneratorInput {
  title?: string;
  field?: string;
  courseName?: string;
  targetWords?: number;
}

export interface CoursePaperGeneratorOutput {
  abstract: string;
  keywords: string[];
  sections: { title: string; content: string }[];
  references: string[];
  wordCount: number;
}

const SECTIONS_TEMPLATE = [
  {
    title: '一、引言',
    content: '介绍研究背景、目的和意义，说明本文的研究思路和结构安排。',
  },
  {
    title: '二、理论基础与文献综述',
    content: '梳理相关理论和国内外研究现状，为后续分析提供理论支撑。',
  },
  {
    title: '三、研究方法与数据来源',
    content: '说明本文采用的研究方法、数据来源和样本选择，确保研究的科学性。',
  },
  {
    title: '四、实证分析与结果',
    content: '通过实证分析得出研究结果，并对结果进行深入讨论和解释。',
  },
  {
    title: '五、结论与建议',
    content: '总结研究发现，提出对策建议，并指出研究的局限性和未来方向。',
  },
];

const REFERENCES_TEMPLATE = [
  '张三, 李四. 相关主题研究综述[J]. 某某学报, 2023, 46(5): 1001-1020.',
  '王五. 课程相关理论与实践[M]. 北京: 某某出版社, 2022.',
  'Smith J, Johnson A. Research on Related Topics[J]. Journal of X, 2021, 32(4): 456-472.',
  '赵六, 钱七. 实证研究方法与应用[J]. 某某研究, 2023, (3): 78-92.',
  '陈刚. 学术论文写作指南[M]. 北京: 高等教育出版社, 2021.',
];

export async function generate(input: CoursePaperGeneratorInput): Promise<CoursePaperGeneratorOutput> {
  const {
    title = '浅析人工智能在教育领域的应用',
    field = '教育学',
    courseName = '教育技术学',
    targetWords = 3000,
  } = input;

  const abstract = `本文以"${title}"为题，结合${field}专业${courseName}课程所学内容，` +
    `采用文献研究和案例分析相结合的方法，探讨了相关问题的现状、问题与对策。` +
    `研究发现，当前该领域在理论研究和实践应用方面均取得了一定进展，` +
    `但仍存在一些需要进一步解决的问题。本文在分析问题成因的基础上，` +
    `提出了相应的改进建议，以期为相关研究和实践提供参考。`;

  const keywords = [field, courseName, title.slice(2, 8), '理论分析', '对策建议'];

  const sectionCount = Math.min(SECTIONS_TEMPLATE.length, targetWords > 3000 ? 5 : 4);
  const sections = SECTIONS_TEMPLATE.slice(0, sectionCount).map((sec) => ({
    title: sec.title,
    content: `${sec.content}\n\n具体到"${title}"这一主题，${field}领域已有多位学者进行了探讨。` +
      `本文在${courseName}课程学习的基础上，结合相关文献资料，对这一问题进行深入分析。` +
      `通过梳理已有研究成果，本文发现${sec.title.replace(/^[一二三四五六七八九十]+、/, '')}` +
      `是理解和解决该问题的重要环节。下文将从多个角度展开论述，形成较为完整的分析框架。`,
  }));

  const references = REFERENCES_TEMPLATE.map((ref, i) => {
    if (i === 0) return `${field}领域相关研究综述[J]. 某某学报, 2023, 46(5): 1001-1020.`;
    return ref;
  });

  // 估算字数
  const wordCount =
    abstract.length +
    sections.reduce((sum: number, sec) => sum + sec.content.length, 0) +
    references.reduce((sum: number, ref) => sum + ref.length, 0);

  return {
    abstract,
    keywords,
    sections,
    references,
    wordCount,
  };
}
