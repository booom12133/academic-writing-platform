/**
 * 查重参考生成器
 * 输入：{ content }
 * 输出：{ overallSimilarity, chapterSimilarity, duplicateSegments, suggestions, reportSummary }
 *
 * TODO: 后续接入真实查重服务或 AI 插件时替换下方模拟逻辑
 */

interface ChapterSimilarity {
  chapter: string;
  similarity: number;
}

interface DuplicateSegment {
  text: string;
  similarity: number;
  suggestion: string;
  rewriteExample: string;
}

interface CheckGeneratorOutput {
  overallSimilarity: number;
  chapterSimilarity: ChapterSimilarity[];
  duplicateSegments: DuplicateSegment[];
  suggestions: string[];
  reportSummary: string;
}

const CHAPTER_NAMES = [
  '绪论',
  '文献综述',
  '研究方法',
  '实证分析',
  '研究结论',
];

export async function generate(input: Record<string, any>): Promise<CheckGeneratorOutput> {
  const content = (input.content as string) ?? '';

  // 总重复率 10%-30% 随机
  const overallSimilarity = 10 + Math.round(Math.random() * 20);

  // 各章节重复率（文献综述通常较高）
  const chapterSimilarity: ChapterSimilarity[] = CHAPTER_NAMES.map((name) => {
    let base = 10 + Math.random() * 15;
    if (name === '文献综述') base += 10; // 文献综述偏高
    if (name === '绪论') base += 3;
    if (name === '研究结论') base -= 5;
    return {
      chapter: name,
      similarity: Math.max(3, Math.min(45, Math.round(base))),
    };
  });

  // 生成 5-10 个重复片段
  const segmentCount = 5 + Math.floor(Math.random() * 6);
  const duplicateSegments: DuplicateSegment[] = [];

  const sampleSegments = content.length > 0
    ? splitIntoSegments(content, segmentCount)
    : generateSampleSegments(segmentCount);

  const rewriteTemplates = [
    (text: string) => `通过对${text.slice(0, 10)}相关研究的系统梳理，可以发现这一领域已形成较为丰富的研究成果。`,
    (text: string) => `从已有文献来看，${text.slice(0, 8)}的研究主要集中在以下几个方面。`,
    (text: string) => `综合现有研究，${text.slice(0, 8)}这一议题的探讨呈现出多视角、多方法的特征。`,
    (text: string) => `关于${text.slice(0, 6)}的研究，国内外学者从不同角度展开了深入分析。`,
    (text: string) => `在${text.slice(0, 6)}领域，已有研究取得了显著进展，但仍存在一些有待解决的问题。`,
  ];

  const suggestionTemplates = [
    '建议调整句式结构，使用被动语态替换主动语态',
    '可尝试更换同义词，重新组织表达逻辑',
    '建议增加个人分析和评论，减少直接引用比例',
    '可将长句拆分为短句，或合并短句为长句',
    '建议用自己的话重新表述核心观点，保留原意但改变表达方式',
    '可增加数据和案例支撑，丰富内容的同时降低重复率',
    '建议检查引用格式是否规范，正确标注引用来源',
  ];

  for (let i = 0; i < segmentCount; i += 1) {
    const similarity = 40 + Math.floor(Math.random() * 50);
    const text = sampleSegments[i];
    const suggestion = suggestionTemplates[i % suggestionTemplates.length];
    const rewriteExample = rewriteTemplates[i % rewriteTemplates.length](text);

    duplicateSegments.push({
      text,
      similarity,
      suggestion,
      rewriteExample,
    });
  }

  const suggestions = [
    '重点修改文献综述部分，该部分重复率较高，建议用自己的语言重新组织',
    '增加原创性分析内容，在引用文献的基础上补充个人研究发现和见解',
    '检查所有直接引用的部分，确保格式正确并正确标注出处',
    '建议使用同义词替换和句式变换降低重复率，但要注意保持语义通顺',
    '对于定义、公理等无法改写的内容，建议正确标注引用并计入引用率',
    '重复率较高的章节可以考虑补充实证数据和案例分析，增加原创内容比例',
    '提交终稿前建议再次使用官方查重系统检测，确保符合学校要求',
  ];

  const reportSummary =
    `本次查重总文字复制比为 ${overallSimilarity}%，` +
    `共检测到 ${segmentCount} 处疑似重复片段，` +
    `其中文献综述部分重复率相对较高（${chapterSimilarity[1]?.similarity ?? 0}%）。` +
    `整体来看，重复内容主要集中在文献引用、理论基础和定义描述等部分，` +
    `建议重点修改重复率超过 30% 的章节，通过句式变换、同义词替换和增加原创分析等方式降低重复率。` +
    `修改后建议重新检测，确保总重复率符合学校或期刊要求。`;

  return {
    overallSimilarity,
    chapterSimilarity,
    duplicateSegments,
    suggestions,
    reportSummary,
  };
}

function splitIntoSegments(text: string, count: number): string[] {
  const segments: string[] = [];
  const charsPerSegment = Math.max(40, Math.floor(text.length / count));
  for (let i = 0; i < count; i += 1) {
    const start = i * charsPerSegment;
    const end = Math.min(text.length, start + charsPerSegment + Math.floor(Math.random() * 40));
    const seg = text.slice(start, end).trim();
    if (seg.length > 10) {
      segments.push(seg.slice(0, 200));
    } else {
      segments.push(`关于${text.slice(0, 6)}的相关研究已有较多成果，本研究在此基础上进一步拓展。`);
    }
  }
  return segments;
}

function generateSampleSegments(count: number): string[] {
  const samples = [
    '随着信息技术的快速发展，数字化转型已成为各行业关注的焦点问题',
    '国内外学者对此进行了大量研究，取得了丰富的研究成果',
    '研究表明，这一现象的产生与多种因素密切相关',
    '综上所述，现有研究为本研究提供了重要的理论基础和方法参考',
    '根据以上分析可以看出，该领域的研究呈现出多学科交叉的特点',
    '在实践层面，相关政策的出台为行业发展提供了有力支撑',
    '从理论视角来看，这一问题可以从多个维度进行解释',
    '近年来，越来越多的学者开始关注这一研究议题',
    '相关研究结果显示，二者之间存在显著的正相关关系',
    '本研究的发现与已有研究结论基本一致，同时也有新的发现',
  ];
  return samples.slice(0, count);
}
