import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PaperProjectRepository } from './paper-project.repository';
import { PaperProjectError } from './paper-project.errors';
import { createPaperProjectRequestSchema, projectProfileSchema, researchPlanSchema, sourceStrategySchema } from './domain/paper-project.schemas';
import type { ProjectProfileV1, ResearchPlanV1 } from '../../../shared/paper-project.interface';

const updateProjectSchema = z.object({
  expectedLockVersion: z.number().int().nonnegative(),
  profile: projectProfileSchema.optional(),
  selectedTitle: z.string().trim().min(1).max(500).nullable().optional(),
  defaultSourceStrategy: sourceStrategySchema.optional(),
}).strict();
const versionSchema = z.object({ expectedLockVersion: z.number().int().nonnegative() }).strict();
const topicSelectionSchema = z.object({ expectedLockVersion: z.number().int().nonnegative(), title: z.string().trim().min(1).max(500), candidateFingerprint: z.string().max(128).optional() }).strict();
const researchPlanPutSchema = z.object({ expectedLockVersion: z.number().int().nonnegative(), researchPlan: researchPlanSchema }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'Paper project request is invalid.', result.error.flatten());
  return result.data;
}

@Injectable()
export class PaperProjectService {
  constructor(private readonly repository: PaperProjectRepository) {}

  async create(userId: string, body: unknown) {
    const input = parse(createPaperProjectRequestSchema, body);
    return this.repository.create(userId, { ...input, profile: input.profile as ProjectProfileV1 });
  }
  list(userId: string, status?: string) {
    if (status !== undefined && status !== 'active' && status !== 'archived') throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'Invalid project status.');
    return this.repository.list(userId, status as 'active' | 'archived' | undefined);
  }
  get(userId: string, projectId: string) { return this.repository.require(userId, projectId); }
  update(userId: string, projectId: string, body: unknown) {
    const { expectedLockVersion, ...patch } = parse(updateProjectSchema, body);
    const rootPatch = {
      ...patch,
      ...(patch.profile === undefined ? {} : { profile: patch.profile as ProjectProfileV1 }),
    } as unknown as Parameters<PaperProjectRepository['updateRoot']>[3];
    return this.repository.updateRoot(userId, projectId, expectedLockVersion, rootPatch);
  }
  archive(userId: string, projectId: string, body: unknown) {
    const { expectedLockVersion } = parse(versionSchema, body);
    return this.repository.archive(userId, projectId, expectedLockVersion);
  }
  selectTopic(userId: string, projectId: string, body: unknown) {
    const { expectedLockVersion, title } = parse(topicSelectionSchema, body);
    return this.repository.updateRoot(userId, projectId, expectedLockVersion, { selectedTitle: title });
  }
  async getResearchPlan(userId: string, projectId: string) {
    const project = await this.repository.require(userId, projectId);
    return { researchPlan: project.researchPlan ?? null, lockVersion: project.lockVersion };
  }
  saveResearchPlan(userId: string, projectId: string, body: unknown) {
    const { expectedLockVersion, researchPlan } = parse(researchPlanPutSchema, body);
    return this.repository.updateRoot(userId, projectId, expectedLockVersion, { researchPlan: researchPlan as ResearchPlanV1 });
  }
}
