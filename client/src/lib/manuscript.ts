import type { ManuscriptReadiness, ManuscriptWarningCode } from '@shared/manuscript.interface';

const warningLabels: Record<ManuscriptWarningCode, string> = {
  TITLE_MISSING: '论文题目尚未完成。',
  RESEARCH_PLAN_MISSING: 'Research Plan 尚未完成。',
  MISSING_SECTION: '有章节尚未完成。',
  ORPHANED_SECTION_EXCLUDED: '孤立章节已从整篇正文排除，请返回工作区恢复或确认。',
  DERIVED_CONTENT_MISSING: '摘要或关键词尚未生成。',
  DERIVED_CONTENT_STALE: '摘要或关键词已落后于当前正文。',
  CONCLUSION_REFRESH_STALE: '结论刷新依据已变化，请显式重新生成。',
  STALE_AFTER_EDIT: '正文编辑后，原证据支持已失效。',
  CITATION_RENUMBER_UNSAFE: '引用编号缺少安全定位信息，不能执行 clean export。',
  CITATION_IDENTITY_CONFLICT: '引用来源身份存在冲突。',
  BIBLIOGRAPHY_METADATA_UNRESOLVED: '参考文献元数据不完整。',
};

export const getManuscriptReadinessLabel = (readiness: ManuscriptReadiness) => ({ READY: '可导出', INCOMPLETE: '内容未完成', BLOCKED: '导出受阻' })[readiness];
export const getManuscriptWarningLabel = (code: ManuscriptWarningCode) => warningLabels[code];
export const getHeadingAnchor = (nodeId: string) => `manuscript-node-${encodeURIComponent(nodeId)}`;
