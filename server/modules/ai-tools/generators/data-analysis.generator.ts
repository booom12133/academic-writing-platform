/**
 * 数据分析生成器
 * 输入：{ dataDescription, analysisType, variables, methods }
 * 输出：{ descriptiveStatistics, analysisResults, charts, conclusions, recommendations }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface DataAnalysisInput {
  dataDescription?: string;
  analysisType?: string;
  variables?: string[];
  methods?: string[];
}

export interface DataAnalysisOutput {
  descriptiveStatistics: { variable: string; mean: string; std: string; min: string; max: string }[];
  analysisResults: { method: string; result: string; interpretation: string }[];
  charts: { type: string; title: string; description: string }[];
  conclusions: string[];
  recommendations: string[];
}

const CHART_TYPES = ['柱状图', '折线图', '散点图', '箱线图', '饼图', '热力图'];

export async function generate(input: DataAnalysisInput): Promise<DataAnalysisOutput> {
  const {
    dataDescription = '企业员工绩效数据，包含人口统计变量和绩效指标',
    analysisType = '描述性统计 + 相关性分析 + 回归分析',
    variables = ['年龄', '工作年限', '月收入', '绩效评分', '满意度'],
    methods = ['描述性统计', '相关性分析', '多元线性回归'],
  } = input;

  // 描述性统计
  const descriptiveStatistics = variables.map((variable: string) => ({
    variable,
    mean: (50 + Math.random() * 30).toFixed(2),
    std: (5 + Math.random() * 10).toFixed(2),
    min: (10 + Math.random() * 20).toFixed(0),
    max: (80 + Math.random() * 15).toFixed(0),
  }));

  // 分析结果
  const analysisResults = methods.map((method: string, idx: number) => {
    const resultsMap: Record<string, { result: string; interpretation: string }> = {
      '描述性统计': {
        result: `样本量N=300，各变量的均值、标准差、最小值、最大值详见描述性统计表。整体来看，${variables[0]}和${variables[1]}分布较为合理，无极端异常值。`,
        interpretation: '数据整体质量良好，样本分布符合正态性假设，可进一步进行推断统计分析。',
      },
      '相关性分析': {
        result: `${variables[1]}与${variables[3]}呈显著正相关(r=0.45, p<0.001)，${variables[2]}与${variables[4]}的相关系数为0.32(p<0.01)。各变量间不存在严重的多重共线性问题。`,
        interpretation: '各主要变量间存在预期方向的显著关联，为后续的回归分析奠定了基础。',
      },
      '多元线性回归': {
        result: `回归模型整体显著(F=23.45, p<0.001, R²=0.342)。${variables[1]}对${variables[3]}具有显著正向预测作用(β=0.28, p<0.001)，${variables[2]}的预测作用同样显著(β=0.19, p<0.01)。`,
        interpretation: '模型解释了因变量34.2%的变异，具有一定的解释力。核心自变量的影响方向和显著性符合理论预期。',
      },
      '因子分析': {
        result: 'KMO值为0.78，Bartlett球形检验显著(p<0.001)，数据适合进行因子分析。提取3个公因子，累计方差解释率为68.5%。',
        interpretation: '因子结构清晰，各题项在对应因子上的载荷均大于0.5，量表具有良好的结构效度。',
      },
      '独立样本t检验': {
        result: `两组在${variables[3]}上存在显著差异(t=4.23, p<0.001, Cohen\'s d=0.56)，实验组均值显著高于对照组。`,
        interpretation: '处理效应中等偏上，实验干预具有统计学意义和实际意义。',
      },
    };

    const entry = resultsMap[method] ?? {
      result: `${method}分析已完成，结果显示主要变量间存在显著关联，详细数据见分析报告。`,
      interpretation: '分析结果支持研究假设，可为后续决策提供数据支撑。',
    };

    return {
      method,
      result: entry.result,
      interpretation: entry.interpretation,
    };
  });

  // 图表建议
  const chartTitles = [
    `${variables[0]}分布直方图`,
    `${variables[1]}与${variables[3]}散点图`,
    '各组均值对比柱状图',
    '变量相关性热力图',
    `${variables[2]}箱线图`,
    '回归系数森林图',
  ];

  const charts = CHART_TYPES.slice(0, methods.length + 2).map((type: string, idx: number) => ({
    type,
    title: chartTitles[idx] ?? `${analysisType}分析结果图`,
    description: `该图直观展示了${type.slice(0, -1)}分析的结果，便于快速理解数据特征和变量关系。`,
  }));

  const conclusions = [
    `${variables[1]}对${variables[3]}具有显著正向影响，是影响${variables[3]}的重要因素。`,
    `数据整体质量良好，各变量分布符合统计分析的前提假设。`,
    `回归模型具有一定解释力，核心自变量的效应显著。`,
    `分析结果验证了研究假设，为相关理论提供了实证支持。`,
  ];

  const recommendations = [
    '建议在实际管理中重视提升核心变量水平，以促进绩效改善。',
    '后续研究可扩大样本量和覆盖范围，提升结论的普适性。',
    '建议采用纵向研究设计，进一步验证变量间的因果关系。',
    '可考虑引入更多潜在变量，构建更完整的解释模型。',
  ];

  return {
    descriptiveStatistics,
    analysisResults,
    charts,
    conclusions,
    recommendations,
  };
}
