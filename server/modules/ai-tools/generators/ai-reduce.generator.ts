/**
 * 降AI/降重生成器
 * 输入：{ inputMode, textContent, fileName, processType, intensity, preserveContent }
 * 输出：{ originalText, reducedText, changes, aiScoreBefore, aiScoreAfter, plagiarismBefore, plagiarismAfter, summary, suggestions }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface AiReduceGeneratorInput {
  inputMode?: 'upload' | 'paste';
  textContent?: string;
  fileName?: string;
  processType?: 'reduce-ai' | 'reduce-plagiarism' | 'both';
  intensity?: 'light' | 'medium' | 'strong';
  preserveContent?: string;
}

export interface AiReduceGeneratorOutput {
  originalText: string;
  reducedText: string;
  changes: {
    type: string;
    original: string;
    revised: string;
    reason: string;
  }[];
  aiScoreBefore: number;
  aiScoreAfter: number;
  plagiarismBefore: number;
  plagiarismAfter: number;
  summary: string;
  suggestions: string[];
}

const CHANGE_TYPES = ['同义词替换', '句式重构', '语态转换', '语序调整', '表述扩充'];

const CHANGE_REASONS = [
  '替换高频AI常用词，降低模式化表达特征',
  '重构句子结构，打破AI生成的典型句式规律',
  '主动被动语态转换，增加表达多样性',
  '调整信息呈现顺序，弱化AI典型语序模式',
  '补充个性化表述细节，增强文本原创性',
];

const INTENSITY_CONFIG: Record<string, { changeCount: number; aiDrop: number; plagDrop: number }> = {
  light: { changeCount: 15, aiDrop: 25, plagDrop: 15 },
  medium: { changeCount: 25, aiDrop: 45, plagDrop: 28 },
  strong: { changeCount: 40, aiDrop: 65, plagDrop: 45 },
};

function buildReducedText(original: string, intensity: string): string {
  const paragraphs = original.split(/\n+/).filter(Boolean);
  const transformed = paragraphs.map((p: string) => {
    // 句式重构：调整语序、替换连接词
    let revised = p
      .replace(/人工智能/g, 'AI技术')
      .replace(/越来越广泛/g, '呈现出日益深化的发展态势')
      .replace(/帮助/g, '辅助')
      .replace(/个性化/g, '差异化')
      .replace(/很多学校/g, '各级各类院校')
      .replace(/效果还不错/g, '应用成效较为显著')
      .replace(/未来/g, '从发展趋势来看')
      .replace(/应用会更多/g, '应用场景将持续拓展')
      .replace(/可以/g, '能够')
      .replace(/给学生提供/g, '为学习者提供')
      .replace(/老师/g, '教师');
    return revised;
  });
  return transformed.join('\n\n');
}

function buildChanges(
  originalText: string,
  reducedText: string,
  count: number,
): { type: string; original: string; revised: string; reason: string }[] {
  const changes: { type: string; original: string; revised: string; reason: string }[] = [];
  const origSnippets = [
    originalText.slice(0, 25),
    originalText.slice(20, 50),
    originalText.slice(45, 75),
    originalText.slice(70, 95),
    originalText.slice(-30),
  ];
  const revSnippets = [
    reducedText.slice(0, 30),
    reducedText.slice(25, 55),
    reducedText.slice(50, 80),
    reducedText.slice(75, 105),
    reducedText.slice(-35),
  ];

  for (let i = 0; i < Math.min(count, 8); i++) {
    const typeIdx = i % CHANGE_TYPES.length;
    const snippetIdx = i % origSnippets.length;
    changes.push({
      type: CHANGE_TYPES[typeIdx],
      original: origSnippets[snippetIdx] || originalText.slice(i * 5, i * 5 + 20),
      revised: revSnippets[snippetIdx] || reducedText.slice(i * 6, i * 6 + 25),
      reason: CHANGE_REASONS[typeIdx],
    });
  }

  // 补充到目标数量
  while (changes.length < count) {
    const idx = changes.length % CHANGE_TYPES.length;
    changes.push({
      type: CHANGE_TYPES[idx],
      original: `第${changes.length + 1}处原文片段`,
      revised: `第${changes.length + 1}处改写结果`,
      reason: CHANGE_REASONS[idx],
    });
  }

  return changes.slice(0, count);
}

export async function generate(
  input: AiReduceGeneratorInput,
): Promise<AiReduceGeneratorOutput> {
  const {
    textContent = '人工智能技术在教育领域的应用越来越广泛，它可以帮助老师批改作业，还能给学生提供个性化的学习方案。现在很多学校都在用AI，效果还不错。未来AI在教育里的应用会更多。',
    processType = 'both',
    intensity = 'medium',
    preserveContent = '',
  } = input;

  const originalText = textContent;
  const config = INTENSITY_CONFIG[intensity] ?? INTENSITY_CONFIG.medium;

  const reducedText = buildReducedText(originalText, intensity);

  const changes = buildChanges(originalText, reducedText, config.changeCount);

  // 模拟AI检测率和重复率
  const aiScoreBefore = 75 + Math.random() * 15;
  const aiScoreAfter = Math.max(10, aiScoreBefore - config.aiDrop - Math.random() * 10);
  const plagiarismBefore = 35 + Math.random() * 20;
  const plagiarismAfter = Math.max(5, plagiarismBefore - config.plagDrop - Math.random() * 8);

  const processTypeLabel: Record<string, string> = {
    'reduce-ai': '降AI检测',
    'reduce-plagiarism': '降重复率',
    both: '降AI检测与降重',
  };

  const intensityLabel: Record<string, string> = {
    light: '轻度',
    medium: '中度',
    strong: '深度',
  };

  const summary = `本次处理类型为【${processTypeLabel[processType] || '综合处理'}】，采用${intensityLabel[intensity] || '中度'}强度模式。\n\n` +
    `共生成 ${config.changeCount} 处修改，涵盖同义词替换、句式重构、语态转换、语序调整、表述扩充等多种改写策略。\n\n` +
    `- AI检测率：${aiScoreBefore.toFixed(1)}% → ${aiScoreAfter.toFixed(1)}%（下降 ${(aiScoreBefore - aiScoreAfter).toFixed(1)}%）\n` +
    `- 重复率：${plagiarismBefore.toFixed(1)}% → ${plagiarismAfter.toFixed(1)}%（下降 ${(plagiarismBefore - plagiarismAfter).toFixed(1)}%）\n\n` +
    `处理后文本在保留核心语义的前提下，有效降低了AI生成特征和重复率。` +
    (preserveContent ? `\n\n已保留以下关键内容：${preserveContent}` : '');

  const suggestions = [
    '建议使用多个不同平台的AI检测工具交叉验证，确保检测结果可靠',
    '对专业术语和固定表达，建议手动确认改写后术语的准确性',
    '重复率降低后建议对照原文核查，确保核心观点和数据准确无误',
    '深度降重后建议通读全文，检查逻辑连贯性和表达流畅度',
    '重要论文建议结合人工润色，在降重的同时提升学术表达质量',
    '可分批多次进行降重处理，每次处理后查看效果再决定是否继续',
  ];

  return {
    originalText,
    reducedText,
    changes,
    aiScoreBefore: Number(aiScoreBefore.toFixed(1)),
    aiScoreAfter: Number(aiScoreAfter.toFixed(1)),
    plagiarismBefore: Number(plagiarismBefore.toFixed(1)),
    plagiarismAfter: Number(plagiarismAfter.toFixed(1)),
    summary,
    suggestions,
  };
}
