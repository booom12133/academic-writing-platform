import { createHash } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import JSZip = require('jszip');

import type { ManuscriptSnapshot } from '../shared/manuscript.interface';
import { DocxManuscriptRenderer } from '../server/modules/paper-project/export/docx-manuscript.renderer';
import { computeBodyFingerprint } from '../server/modules/paper-project/manuscript/manuscript-fingerprint';
import { ManuscriptProjectionService } from '../server/modules/paper-project/manuscript/manuscript-projection.service';
import { WholeManuscriptGenerationContextBuilder } from '../server/modules/paper-project/manuscript/whole-manuscript-generation-context.builder';

const SIZES = [10_000, 50_000, 100_000] as const;
const RUNS = 5;
const SECTION_COUNT = 10;
const timestamp = '2026-09-22T00:00:00.000Z';

function stableId(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makeWords(count: number, offset: number): string {
  return Array.from({ length: count }, (_, index) => `word${offset + index}`).join(' ');
}

function fixture(wordCount: number): ManuscriptSnapshot {
  const projectId = stableId(1);
  const outline: ManuscriptSnapshot['outline'] = [];
  const sections: ManuscriptSnapshot['sections'] = [];
  const revisionsBySectionId: ManuscriptSnapshot['revisionsBySectionId'] = {};
  let offset = 0;
  for (let index = 0; index < SECTION_COUNT; index += 1) {
    const nodeId = stableId(10 + index);
    const sectionId = stableId(30 + index);
    const revisionId = stableId(50 + index);
    const count = Math.floor(wordCount / SECTION_COUNT) + (index < wordCount % SECTION_COUNT ? 1 : 0);
    const content = makeWords(count, offset);
    offset += count;
    outline.push({ id: nodeId, nodeType: 'writing-unit', title: `Section ${index + 1}`, position: index, status: 'active', sectionId });
    sections.push({ id: sectionId, outlineNodeId: nodeId, sectionRole: 'OUTLINE', status: 'active', currentRevisionNumber: 1 });
    revisionsBySectionId[sectionId] = {
      id: revisionId, sectionId, revisionNumber: 1, content, contentHash: sha256(content), origin: 'USER_EDIT',
      sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [],
      evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: timestamp,
    };
  }
  const snapshot: ManuscriptSnapshot = {
    project: {
      id: projectId, selectedTitle: `Deterministic ${wordCount}-word benchmark`,
      profile: { schemaVersion: 1, researchIdea: 'P5 bounded synchronous export benchmark', paperType: 'other', language: 'en', targetWords: wordCount },
      researchPlan: {
        schemaVersion: 1, researchProblem: 'Measure bounded assembly and DOCX rendering.', researchQuestions: ['Does synchronous export complete?'],
        researchObjectives: ['Record repeatable local evidence.'], methodology: { approach: 'deterministic benchmark', methods: ['in-memory projection', 'DOCX render'] },
        dataMaterialRequirements: [], expectedContributions: ['Phase P5 performance evidence'], limitationsAssumptions: ['No database, network, LLM, or production storage calls'], keywords: ['benchmark'],
      },
      defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: timestamp, updatedAt: timestamp,
    },
    outline,
    sections,
    revisionsBySectionId,
  };
  const bodyFingerprint = computeBodyFingerprint(snapshot);
  for (const [index, role, content] of [[80, 'ABSTRACT', 'Benchmark abstract.'], [81, 'KEYWORDS', 'benchmark; export']] as const) {
    const sectionId = stableId(index);
    sections.push({ id: sectionId, sectionRole: role, status: 'active', currentRevisionNumber: 1 });
    revisionsBySectionId[sectionId] = {
      id: stableId(index + 10), sectionId, revisionNumber: 1, content, contentHash: sha256(content), origin: 'AI_GENERATION',
      sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [],
      generationMetadata: { derivedFromBodyFingerprint: bodyFingerprint }, warnings: [], createdAt: timestamp,
    };
  }
  return snapshot;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
}

async function execute(snapshot: ManuscriptSnapshot) {
  const projectionService = new ManuscriptProjectionService({ loadManuscriptSnapshot: async () => snapshot });
  const renderer = new DocxManuscriptRenderer();
  const rssBefore = process.memoryUsage().rss;
  let peakRss = rssBefore;
  const started = performance.now();
  const projection = projectionService.project(snapshot);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  const rendered = await renderer.render(projection, { exportId: stableId(99), createdAt: timestamp, mode: 'CLEAN', templateKey: 'generic-academic-v1' });
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  const zip = await JSZip.loadAsync(rendered.buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  if (!documentXml?.includes(snapshot.project.selectedTitle!) || projection.readiness !== 'READY') throw new Error('Benchmark output validation failed.');
  return {
    wallTimeMs: performance.now() - started,
    peakRssDeltaBytes: Math.max(0, peakRss - rssBefore),
    bufferBytes: rendered.buffer.length,
    manuscriptFingerprint: projection.manuscriptFingerprint,
    projectionWordCount: projection.wordCount,
  };
}

async function main() {
  const results = [];
  for (const wordCount of SIZES) {
    const snapshot = fixture(wordCount);
    const context = new WholeManuscriptGenerationContextBuilder().build({ snapshot, operation: 'ABSTRACT' });
    if (context.metadata.includedSectionIds.length !== SECTION_COUNT || context.metadata.allocations.some((allocation) => allocation.includedCodePoints < 128)) {
      throw new Error(`Context coverage validation failed for ${wordCount} words.`);
    }
    await execute(snapshot);
    const runs = [];
    for (let index = 0; index < RUNS; index += 1) runs.push(await execute(snapshot));
    const fingerprints = new Set(runs.map((run) => run.manuscriptFingerprint));
    if (fingerprints.size !== 1 || runs.some((run) => run.projectionWordCount !== wordCount)) throw new Error(`Projection determinism failed for ${wordCount} words.`);
    results.push({
      wordCount,
      warmupRuns: 1,
      measuredRuns: RUNS,
      wallTimeMs: { p50: percentile(runs.map((run) => run.wallTimeMs), 0.5), p95: percentile(runs.map((run) => run.wallTimeMs), 0.95) },
      peakObservedRssDeltaBytes: Math.max(...runs.map((run) => run.peakRssDeltaBytes)),
      bufferBytes: { min: Math.min(...runs.map((run) => run.bufferBytes)), max: Math.max(...runs.map((run) => run.bufferBytes)) },
      deterministicFingerprint: runs[0]!.manuscriptFingerprint,
      context: { budgetCodePoints: context.metadata.budgetCodePoints, includedSections: context.metadata.includedSectionIds.length, truncatedSections: context.metadata.truncatedSections.length },
      docxZipXmlValidated: true,
    });
  }
  process.stdout.write(`${JSON.stringify({
    benchmark: 'p5-manuscript-v1',
    measuredAt: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? 'unknown', logicalCpuCount: cpus().length, totalMemoryBytes: totalmem() },
    template: { key: 'generic-academic-v1', version: '1' },
    renderer: { key: 'docx', version: '1' },
    constraints: { database: false, network: false, llm: false, productionStorage: false, queueAuthorization: false },
    results,
  }, null, 2)}\n`);
}

void main();
