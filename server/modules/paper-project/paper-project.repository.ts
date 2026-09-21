import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import { paperOutlineNodes, paperProjectSources, paperProjects, paperSectionRevisions, paperSections } from '../../database/schema';
import type { ActualSupportMode, OutlineNode, PaperProject, PaperProjectSource, PaperSection, PaperSectionRevision, ProjectProfileV1, ResearchPlanV1, RevisionOrigin, SourceStrategy, SupportState } from '../../../shared/paper-project.interface';
import type { ManuscriptSnapshot, ManuscriptSnapshotRevision, SectionRole } from '../../../shared/manuscript.interface';
import { PaperProjectError } from './paper-project.errors';

type ProjectRow = typeof paperProjects.$inferSelect;
type OutlineRow = typeof paperOutlineNodes.$inferSelect;
type SectionRow = typeof paperSections.$inferSelect;
type RevisionRow = typeof paperSectionRevisions.$inferSelect;
type CreateProjectInput = { profile: ProjectProfileV1; selectedTitle?: string; defaultSourceStrategy?: SourceStrategy };
type RootPatch = { profile?: ProjectProfileV1; selectedTitle?: string | null; researchPlan?: ResearchPlanV1 | null; defaultSourceStrategy?: SourceStrategy };

function toProject(row: ProjectRow): PaperProject {
  return {
    id: row.id,
    ...(row.selectedTitle === null ? {} : { selectedTitle: row.selectedTitle }),
    profile: row.profile as unknown as ProjectProfileV1,
    ...(row.researchPlan === null ? {} : { researchPlan: row.researchPlan as unknown as ResearchPlanV1 }),
    defaultSourceStrategy: row.defaultSourceStrategy as SourceStrategy,
    status: row.status as PaperProject['status'],
    lockVersion: row.lockVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOutline(row: OutlineRow, sectionId?: string): OutlineNode { return { id: row.id, ...(row.parentId ? { parentId: row.parentId } : {}), nodeType: row.nodeType as OutlineNode['nodeType'], title: row.title, position: row.position, ...(row.targetWords === null ? {} : { targetWords: row.targetWords }), ...(row.generationNotes === null ? {} : { generationNotes: row.generationNotes }), status: row.status as OutlineNode['status'], ...(sectionId ? { sectionId } : {}) }; }
function toSection(row: SectionRow): PaperSection { return { id: row.id, ...(row.outlineNodeId ? { outlineNodeId: row.outlineNodeId } : {}), sectionRole: row.sectionRole as SectionRole, status: row.status as PaperSection['status'], currentRevisionNumber: row.currentRevisionNumber }; }
function toRevision(row: RevisionRow): PaperSectionRevision { return { id: row.id, sectionId: row.sectionId, revisionNumber: row.revisionNumber, ...(row.baseRevisionId ? { baseRevisionId: row.baseRevisionId } : {}), content: row.content, origin: row.origin as RevisionOrigin, sourceStrategy: row.sourceStrategy as SourceStrategy, actualSupportMode: row.actualSupportMode as ActualSupportMode, supportState: row.supportState as SupportState, citations: row.citations as unknown[], bibliography: row.bibliography as unknown[], evidenceTrace: row.evidenceTrace as unknown[], generationMetadata: row.generationMetadata as Record<string, unknown>, warnings: row.warnings as string[], ...(row.rewriteInstruction ? { rewriteInstruction: row.rewriteInstruction } : {}), createdAt: row.createdAt.toISOString() }; }
function toSnapshotRevision(row: RevisionRow): ManuscriptSnapshotRevision { return { ...toRevision(row), contentHash: row.contentHash }; }

export interface OutlineWriteNode { id?: string; clientKey: string; parentClientKey?: string; nodeType: 'container' | 'writing-unit'; title: string; position: number; targetWords?: number; generationNotes?: string; }
export interface RevisionWrite { content: string; baseRevisionId?: string; origin: RevisionOrigin; sourceStrategy: SourceStrategy; actualSupportMode: ActualSupportMode; supportState: SupportState; citations: unknown[]; bibliography: unknown[]; evidenceTrace: unknown[]; generationMetadata: Record<string, unknown>; warnings: string[]; rewriteInstruction?: string; }
export interface CanonicalSourceWrite { sourceRecordId?: string; documentVersionId?: string; originClass: 'WEB_IMPORTED'|'USER_KNOWLEDGE'; }

@Injectable()
export class PaperProjectRepository {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase) {}

  async create(userId: string, input: CreateProjectInput): Promise<PaperProject> {
    const [row] = await this.db.insert(paperProjects).values({
      userId,
      profile: input.profile as unknown as Record<string, unknown>,
      ...(input.selectedTitle === undefined ? {} : { selectedTitle: input.selectedTitle }),
      ...(input.defaultSourceStrategy === undefined ? {} : { defaultSourceStrategy: input.defaultSourceStrategy }),
    }).returning();
    if (!row) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'Paper project was not created.');
    return toProject(row);
  }

  async list(userId: string, status: 'active' | 'archived' = 'active'): Promise<PaperProject[]> {
    const rows = await this.db.select().from(paperProjects)
      .where(and(eq(paperProjects.userId, userId), eq(paperProjects.status, status)))
      .orderBy(desc(paperProjects.updatedAt));
    return rows.map(toProject);
  }

  async get(userId: string, projectId: string): Promise<PaperProject | null> {
    const [row] = await this.db.select().from(paperProjects)
      .where(and(eq(paperProjects.id, projectId), eq(paperProjects.userId, userId))).limit(1);
    return row ? toProject(row) : null;
  }

  async require(userId: string, projectId: string): Promise<PaperProject> {
    const project = await this.get(userId, projectId);
    if (!project) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.');
    return project;
  }

  async updateRoot(userId: string, projectId: string, expected: number, patch: RootPatch): Promise<PaperProject> {
    const changes: Record<string, unknown> = { lockVersion: expected + 1, updatedAt: new Date() };
    if ('profile' in patch) changes.profile = patch.profile as unknown as Record<string, unknown>;
    if ('selectedTitle' in patch) changes.selectedTitle = patch.selectedTitle ?? null;
    if ('researchPlan' in patch) changes.researchPlan = patch.researchPlan as unknown as Record<string, unknown> ?? null;
    if ('defaultSourceStrategy' in patch) changes.defaultSourceStrategy = patch.defaultSourceStrategy;
    const [row] = await this.db.update(paperProjects).set(changes)
      .where(and(eq(paperProjects.id, projectId), eq(paperProjects.userId, userId), eq(paperProjects.lockVersion, expected), eq(paperProjects.status, 'active')))
      .returning();
    if (row) return toProject(row);
    const current = await this.get(userId, projectId);
    if (!current) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.');
    throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT', 'Paper project changed; reload before saving.', { current });
  }

  async archive(userId: string, projectId: string, expected: number): Promise<PaperProject> {
    const [row] = await this.db.update(paperProjects)
      .set({ status: 'archived', lockVersion: expected + 1, updatedAt: new Date() })
      .where(and(eq(paperProjects.id, projectId), eq(paperProjects.userId, userId), eq(paperProjects.lockVersion, expected), eq(paperProjects.status, 'active')))
      .returning();
    if (row) return toProject(row);
    const current = await this.get(userId, projectId);
    if (!current) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.');
    throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT', 'Paper project changed; reload before archiving.', { current });
  }

  async replaceOutline(userId: string, projectId: string, expected: number, nodes: OutlineWriteNode[]): Promise<{ nodes: OutlineNode[]; sections: PaperSection[]; lockVersion: number }> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx.update(paperProjects).set({ lockVersion: expected + 1, updatedAt: new Date() })
        .where(and(eq(paperProjects.id, projectId), eq(paperProjects.userId, userId), eq(paperProjects.lockVersion, expected), eq(paperProjects.status, 'active'))).returning({ id: paperProjects.id });
      if (!locked) { const current = await this.get(userId, projectId); if (!current) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.'); throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT', 'Paper project changed; reload before saving the outline.', { current }); }
      const existing = await tx.select().from(paperOutlineNodes).where(and(eq(paperOutlineNodes.userId, userId), eq(paperOutlineNodes.projectId, projectId)));
      const byId = new Map(existing.map((row) => [row.id, row]));
      if (nodes.some((node) => node.id && !byId.has(node.id))) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE', 'Outline contains an unknown node.');
      await tx.update(paperOutlineNodes).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(paperOutlineNodes.userId, userId), eq(paperOutlineNodes.projectId, projectId), eq(paperOutlineNodes.status, 'active')));
      await tx.update(paperSections).set({ status: 'orphaned', updatedAt: new Date() }).where(and(eq(paperSections.userId, userId), eq(paperSections.projectId, projectId), eq(paperSections.status, 'active'), eq(paperSections.sectionRole, 'OUTLINE')));
      const ids = new Map(nodes.map((node) => [node.clientKey, node.id ?? randomUUID()]));
      const pending = [...nodes]; const saved: OutlineRow[] = [];
      while (pending.length) {
        const index = pending.findIndex((node) => !node.parentClientKey || saved.some((row) => row.id === ids.get(node.parentClientKey!)));
        if (index < 0) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE', 'Outline contains a cycle.');
        const [node] = pending.splice(index, 1); const id = ids.get(node.clientKey)!; const parentId = node.parentClientKey ? ids.get(node.parentClientKey) : undefined;
        const values = { parentId: parentId ?? null, nodeType: node.nodeType, title: node.title, position: node.position, targetWords: node.targetWords ?? null, generationNotes: node.generationNotes ?? null, status: 'active', updatedAt: new Date() };
        let row: OutlineRow;
        if (node.id) [row] = await tx.update(paperOutlineNodes).set(values).where(and(eq(paperOutlineNodes.id, id), eq(paperOutlineNodes.userId, userId), eq(paperOutlineNodes.projectId, projectId))).returning();
        else [row] = await tx.insert(paperOutlineNodes).values({ id, projectId, userId, ...values }).returning();
        saved.push(row!);
      }
      const sections: SectionRow[] = [];
      for (const node of saved.filter((item) => item.nodeType === 'writing-unit')) {
        const [existingSection] = await tx.select().from(paperSections).where(and(eq(paperSections.userId, userId), eq(paperSections.projectId, projectId), eq(paperSections.outlineNodeId, node.id), eq(paperSections.sectionRole, 'OUTLINE'))).limit(1);
        if (existingSection) { const [row] = await tx.update(paperSections).set({ status: 'active', updatedAt: new Date() }).where(eq(paperSections.id, existingSection.id)).returning(); sections.push(row!); }
        else { const [row] = await tx.insert(paperSections).values({ projectId, userId, outlineNodeId: node.id }).returning(); sections.push(row!); }
      }
      const sectionByNode = new Map(sections.map((section) => [section.outlineNodeId, section.id]));
      return { nodes: saved.sort((a,b) => a.position-b.position).map((row) => toOutline(row, sectionByNode.get(row.id))), sections: sections.map(toSection), lockVersion: expected + 1 };
    });
  }

  async listOutline(userId: string, projectId: string, includeArchived = false): Promise<OutlineNode[]> {
    const conditions = [eq(paperOutlineNodes.userId, userId), eq(paperOutlineNodes.projectId, projectId)];
    if (!includeArchived) conditions.push(eq(paperOutlineNodes.status, 'active'));
    const rows = await this.db.select().from(paperOutlineNodes).where(and(...conditions)).orderBy(paperOutlineNodes.position);
    const sections = await this.db.select().from(paperSections).where(and(eq(paperSections.userId,userId),eq(paperSections.projectId,projectId),eq(paperSections.sectionRole,'OUTLINE')));
    const sectionByNode = new Map(sections.filter((s) => s.outlineNodeId).map((s) => [s.outlineNodeId!,s.id]));
    return rows.map((row) => toOutline(row, sectionByNode.get(row.id)));
  }

  async getSection(userId: string, projectId: string, sectionId: string): Promise<PaperSection | null> {
    const [row] = await this.db.select().from(paperSections).where(and(eq(paperSections.id,sectionId),eq(paperSections.userId,userId),eq(paperSections.projectId,projectId),eq(paperSections.sectionRole,'OUTLINE'))).limit(1);
    return row ? toSection(row) : null;
  }
  async listSections(userId: string, projectId: string): Promise<PaperSection[]> { return (await this.db.select().from(paperSections).where(and(eq(paperSections.userId,userId),eq(paperSections.projectId,projectId),eq(paperSections.sectionRole,'OUTLINE')))).map(toSection); }
  async getManuscriptSection(userId: string, projectId: string, sectionId: string): Promise<PaperSection | null> { const [row] = await this.db.select().from(paperSections).where(and(eq(paperSections.id,sectionId),eq(paperSections.userId,userId),eq(paperSections.projectId,projectId))).limit(1); return row ? toSection(row) : null; }
  async getOrCreateDerivedSection(userId: string, projectId: string, role: Extract<SectionRole, 'ABSTRACT'|'KEYWORDS'>): Promise<PaperSection> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx.select({ status: paperProjects.status }).from(paperProjects).where(and(eq(paperProjects.id,projectId),eq(paperProjects.userId,userId))).limit(1);
      if (!project) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Paper project was not found.');
      if (project.status !== 'active') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED','Archived paper projects cannot generate derived content.');
      const find = async () => (await tx.select().from(paperSections).where(and(eq(paperSections.projectId,projectId),eq(paperSections.userId,userId),eq(paperSections.sectionRole,role),eq(paperSections.status,'active'))).limit(1))[0];
      const existing = await find();
      if (existing) return toSection(existing);
      const [created] = await tx.insert(paperSections).values({ projectId, userId, outlineNodeId: null, sectionRole: role }).onConflictDoNothing().returning();
      if (created) return toSection(created);
      const winner = await find();
      if (winner) return toSection(winner);
      throw new PaperProjectError('PAPER_MANUSCRIPT_INTEGRITY_FAILURE', 'Derived section creation did not produce an active role section.');
    });
  }
  async getRevision(userId: string, sectionId: string, revisionId: string): Promise<PaperSectionRevision | null> { const [row] = await this.db.select().from(paperSectionRevisions).where(and(eq(paperSectionRevisions.id,revisionId),eq(paperSectionRevisions.sectionId,sectionId),eq(paperSectionRevisions.userId,userId))).limit(1); return row ? toRevision(row) : null; }
  async listRevisions(userId: string, sectionId: string): Promise<PaperSectionRevision[]> { return (await this.db.select().from(paperSectionRevisions).where(and(eq(paperSectionRevisions.sectionId,sectionId),eq(paperSectionRevisions.userId,userId))).orderBy(desc(paperSectionRevisions.revisionNumber))).map(toRevision); }
  async appendRevision(userId: string, projectId: string, sectionId: string, expected: number, input: RevisionWrite): Promise<PaperSectionRevision> {
    return this.db.transaction(async (tx) => {
      const [section] = await tx.select().from(paperSections).where(and(eq(paperSections.id,sectionId),eq(paperSections.projectId,projectId),eq(paperSections.userId,userId))).limit(1);
      if (!section) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Paper section was not found.');
      if (section.currentRevisionNumber !== expected) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT','Paper section changed; reload before saving.',{ currentRevisionNumber: section.currentRevisionNumber });
      if (input.baseRevisionId) { const [base] = await tx.select({id:paperSectionRevisions.id}).from(paperSectionRevisions).where(and(eq(paperSectionRevisions.id,input.baseRevisionId),eq(paperSectionRevisions.sectionId,sectionId),eq(paperSectionRevisions.userId,userId))).limit(1); if (!base) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Base revision was not found.'); }
      const revisionNumber = expected + 1;
      const changed = await tx.update(paperSections).set({currentRevisionNumber:revisionNumber,updatedAt:new Date()}).where(and(eq(paperSections.id,sectionId),eq(paperSections.userId,userId),eq(paperSections.currentRevisionNumber,expected))).returning({id:paperSections.id});
      if (!changed.length) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT','Paper section changed; reload before saving.');
      const [revision] = await tx.insert(paperSectionRevisions).values({ sectionId,userId,revisionNumber,baseRevisionId:input.baseRevisionId,content:input.content,contentHash:createHash('sha256').update(input.content).digest('hex'),origin:input.origin,sourceStrategy:input.sourceStrategy,actualSupportMode:input.actualSupportMode,supportState:input.supportState,citations:input.citations,bibliography:input.bibliography,evidenceTrace:input.evidenceTrace,generationMetadata:input.generationMetadata,warnings:input.warnings,rewriteInstruction:input.rewriteInstruction }).returning();
      return toRevision(revision!);
    });
  }

  async loadManuscriptSnapshot(userId: string, projectId: string): Promise<ManuscriptSnapshot> {
    return this.db.transaction(async (tx) => {
      const [projectRow] = await tx.select().from(paperProjects)
        .where(and(eq(paperProjects.id, projectId), eq(paperProjects.userId, userId))).limit(1);
      if (!projectRow) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.');
      const outlineRows = await tx.select().from(paperOutlineNodes)
        .where(and(eq(paperOutlineNodes.userId, userId), eq(paperOutlineNodes.projectId, projectId), eq(paperOutlineNodes.status, 'active')));
      const sectionRows = await tx.select().from(paperSections)
        .where(and(eq(paperSections.userId, userId), eq(paperSections.projectId, projectId)));
      const sectionIds = sectionRows.map((section) => section.id);
      const revisionRows = sectionIds.length === 0 ? [] : await tx.select().from(paperSectionRevisions)
        .where(and(eq(paperSectionRevisions.userId, userId), inArray(paperSectionRevisions.sectionId, sectionIds)));
      const revisionsBySectionId: ManuscriptSnapshot['revisionsBySectionId'] = {};
      for (const section of sectionRows) {
        const revisions = revisionRows.filter((revision) => revision.sectionId === section.id);
        const maximum = revisions.reduce((value, revision) => Math.max(value, revision.revisionNumber), 0);
        if ((section.currentRevisionNumber === 0 && maximum > 0) || maximum > section.currentRevisionNumber) {
          throw new PaperProjectError('PAPER_MANUSCRIPT_INTEGRITY_FAILURE', 'Paper section revision pointer is inconsistent.');
        }
        if (section.currentRevisionNumber > 0) {
          const exact = revisions.find((revision) => revision.revisionNumber === section.currentRevisionNumber);
          if (!exact) throw new PaperProjectError('PAPER_MANUSCRIPT_INTEGRITY_FAILURE', 'The exact current paper section revision is missing.');
          revisionsBySectionId[section.id] = toSnapshotRevision(exact);
        }
      }
      const activeSectionByNode = new Map(sectionRows
        .filter((section) => section.status === 'active' && section.outlineNodeId)
        .map((section) => [section.outlineNodeId!, section.id]));
      return {
        project: toProject(projectRow),
        outline: outlineRows.map((row) => toOutline(row, activeSectionByNode.get(row.id))),
        sections: sectionRows.map((row) => ({ ...toSection(row), sectionRole: row.sectionRole as SectionRole })),
        revisionsBySectionId,
      };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }

  async replaceSources(userId:string,projectId:string,expected:number,sources:CanonicalSourceWrite[]):Promise<{sources:PaperProjectSource[];lockVersion:number}> {
    return this.db.transaction(async(tx)=>{
      const changed=await tx.update(paperProjects).set({lockVersion:expected+1,updatedAt:new Date()}).where(and(eq(paperProjects.id,projectId),eq(paperProjects.userId,userId),eq(paperProjects.lockVersion,expected),eq(paperProjects.status,'active'))).returning({id:paperProjects.id});
      if(!changed.length){const current=await this.get(userId,projectId);if(!current)throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Paper project was not found.');throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT','Paper project changed; reload before updating sources.',{current});}
      await tx.delete(paperProjectSources).where(and(eq(paperProjectSources.userId,userId),eq(paperProjectSources.projectId,projectId)));
      const rows=sources.length?await tx.insert(paperProjectSources).values(sources.map(source=>({userId,projectId,sourceRecordId:source.sourceRecordId,documentVersionId:source.documentVersionId,originClass:source.originClass}))).returning():[];
      return {sources:rows.map(row=>({id:row.id,...(row.sourceRecordId?{sourceRecordId:row.sourceRecordId}:{}),...(row.documentVersionId?{documentVersionId:row.documentVersionId}:{}),originClass:row.originClass as PaperProjectSource['originClass'],selectionStatus:row.selectionStatus as PaperProjectSource['selectionStatus'],evidenceAvailability:row.documentVersionId?'NOT_INDEXED':'METADATA_ONLY'})),lockVersion:expected+1};
    });
  }
  async listSources(userId:string,projectId:string):Promise<PaperProjectSource[]>{const rows=await this.db.select().from(paperProjectSources).where(and(eq(paperProjectSources.userId,userId),eq(paperProjectSources.projectId,projectId),eq(paperProjectSources.selectionStatus,'selected')));return rows.map(row=>({id:row.id,...(row.sourceRecordId?{sourceRecordId:row.sourceRecordId}:{}),...(row.documentVersionId?{documentVersionId:row.documentVersionId}:{}),originClass:row.originClass as PaperProjectSource['originClass'],selectionStatus:'selected',evidenceAvailability:row.documentVersionId?'NOT_INDEXED':'METADATA_ONLY'}));}
  async remapSection(userId:string,projectId:string,sectionId:string,targetOutlineNodeId:string,expected:number):Promise<{section:PaperSection;lockVersion:number}>{
    return this.db.transaction(async(tx)=>{
      const changed=await tx.update(paperProjects).set({lockVersion:expected+1,updatedAt:new Date()}).where(and(eq(paperProjects.id,projectId),eq(paperProjects.userId,userId),eq(paperProjects.lockVersion,expected),eq(paperProjects.status,'active'))).returning({id:paperProjects.id});
      if(!changed.length)throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT','Project changed; reload before remapping.');
      const[target]=await tx.select().from(paperOutlineNodes).where(and(eq(paperOutlineNodes.id,targetOutlineNodeId),eq(paperOutlineNodes.projectId,projectId),eq(paperOutlineNodes.userId,userId),eq(paperOutlineNodes.status,'active'),eq(paperOutlineNodes.nodeType,'writing-unit'))).limit(1);
      if(!target)throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Target must be an active writing unit.');
      const[occupied]=await tx.select({id:paperSections.id,currentRevisionNumber:paperSections.currentRevisionNumber}).from(paperSections).where(and(eq(paperSections.projectId,projectId),eq(paperSections.userId,userId),eq(paperSections.outlineNodeId,targetOutlineNodeId),eq(paperSections.sectionRole,'OUTLINE'))).limit(1);
      if(occupied){
        if(occupied.currentRevisionNumber!==0)throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Target writing unit already has revision history.');
        await tx.delete(paperSections).where(and(eq(paperSections.id,occupied.id),eq(paperSections.userId,userId),eq(paperSections.currentRevisionNumber,0)));
      }
      const[row]=await tx.update(paperSections).set({outlineNodeId:targetOutlineNodeId,status:'active',updatedAt:new Date()}).where(and(eq(paperSections.id,sectionId),eq(paperSections.projectId,projectId),eq(paperSections.userId,userId),eq(paperSections.status,'orphaned'),eq(paperSections.sectionRole,'OUTLINE'))).returning();
      if(!row)throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Orphaned section was not found.');
      return{section:toSection(row),lockVersion:expected+1};
    });
  }
}
