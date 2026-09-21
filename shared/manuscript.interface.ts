import type { OutlineNode, PaperProject, PaperSection, PaperSectionRevision } from './paper-project.interface';

export type SectionRole = 'OUTLINE' | 'ABSTRACT' | 'KEYWORDS';
export type ManuscriptReadiness = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type DerivedContentState = 'MISSING' | 'CURRENT' | 'STALE';
export type ManuscriptWarningCode =
  | 'TITLE_MISSING'
  | 'RESEARCH_PLAN_MISSING'
  | 'MISSING_SECTION'
  | 'ORPHANED_SECTION_EXCLUDED'
  | 'DERIVED_CONTENT_MISSING'
  | 'DERIVED_CONTENT_STALE'
  | 'CONCLUSION_REFRESH_STALE'
  | 'STALE_AFTER_EDIT'
  | 'CITATION_RENUMBER_UNSAFE'
  | 'CITATION_IDENTITY_CONFLICT'
  | 'BIBLIOGRAPHY_METADATA_UNRESOLVED';

export interface ManuscriptWarning {
  code: ManuscriptWarningCode;
  severity: 'warning' | 'blocking';
  message: string;
  nodeId?: string;
  sectionId?: string;
  revisionId?: string;
  derivedRole?: Extract<SectionRole, 'ABSTRACT' | 'KEYWORDS'>;
}

export interface ManuscriptSnapshotRevision extends PaperSectionRevision {
  contentHash: string;
}

export interface ManuscriptSnapshotSection extends PaperSection {
  sectionRole: SectionRole;
}

export interface ManuscriptSnapshot {
  project: PaperProject;
  outline: OutlineNode[];
  sections: ManuscriptSnapshotSection[];
  revisionsBySectionId: Record<string, ManuscriptSnapshotRevision | undefined>;
}

export interface DerivedContentProjection {
  role: Extract<SectionRole, 'ABSTRACT' | 'KEYWORDS'>;
  state: DerivedContentState;
  sectionId?: string;
  revisionId?: string;
  revisionNumber?: number;
  content?: string;
}

export interface ManuscriptCitation {
  number: number;
  identity: string;
  contributors: Array<{
    sectionId: string;
    revisionId: string;
    localCitationId: string;
    evidenceId: string;
  }>;
}

export interface ManuscriptBibliographyEntry {
  number: number;
  identity: string;
  fields: Record<string, unknown>;
}

export type ManuscriptBlock =
  | { kind: 'heading'; nodeId: string; sectionId?: string; level: number; title: string }
  | { kind: 'paragraph'; sectionId: string; revisionId: string; text: string }
  | { kind: 'missing-section'; nodeId: string; sectionId?: string; text: '【本节尚未完成】' }
  | { kind: 'references'; entries: ManuscriptBibliographyEntry[] };

export interface ManuscriptSupportSummary {
  validSections: number;
  staleSections: number;
  notClaimedSections: number;
  missingSections: number;
  managedCitationCount: number;
  bibliographyEntryCount: number;
  bibliographyState: 'NONE' | 'COMPLETE' | 'INCOMPLETE';
}

export interface ManuscriptProjectionV1 {
  schemaVersion: 1;
  projectId: string;
  title: string | null;
  language: 'zh-CN' | 'en';
  bodyFingerprint: string;
  manuscriptFingerprint: string;
  readiness: ManuscriptReadiness;
  wordCount: number;
  blocks: ManuscriptBlock[];
  outline: Array<{ nodeId: string; sectionId?: string; title: string; depth: number; nodeType: OutlineNode['nodeType'] }>;
  derived: { abstract: DerivedContentProjection; keywords: DerivedContentProjection };
  supportSummary: ManuscriptSupportSummary;
  citations: ManuscriptCitation[];
  bibliography: ManuscriptBibliographyEntry[];
  warnings: ManuscriptWarning[];
  exportPolicy: { cleanAllowed: boolean; draftAllowed: boolean; acknowledgementCodes: ManuscriptWarningCode[] };
}
