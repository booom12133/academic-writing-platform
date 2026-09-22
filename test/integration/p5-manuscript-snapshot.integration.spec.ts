import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import * as schema from '../../server/database/schema';
import { PaperProjectRepository } from '../../server/modules/paper-project/paper-project.repository';
import { computeBodyFingerprint } from '../../server/modules/paper-project/manuscript/manuscript-fingerprint';
import { createP3PostgresRoleFixture, type P3PostgresRoleFixture } from '../support/p3-postgres-role-fixture';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMigrationPoolConfig, runMigrations } = require('../../scripts/db-migrate.js');

const describeIfDatabase = process.env.P3_POSTGRES_ROLE_INTEGRATION === 'YES' ? describe : describe.skip;

describeIfDatabase('P5 manuscript repeatable-read snapshot', () => {
  let fixture: P3PostgresRoleFixture;
  let pool: Pool;

  beforeAll(async () => {
    fixture = await createP3PostgresRoleFixture();
    await fixture.applyCanonicalGrants();
    await runMigrations({ pool: new Pool(createMigrationPoolConfig({
      NODE_ENV: 'production', MIGRATION_DATABASE_URL: fixture.migratorUrl, DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    })) });
    await fixture.applyCanonicalGrants();
    pool = new Pool(createStandardPostgresConfig({
      NODE_ENV: 'production', DATABASE_URL: fixture.appUrl, DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    }));
  });

  afterAll(async () => {
    await pool?.end();
    await fixture?.close();
  });

  it('observes either the complete pre-mutation or post-mutation project and section state, never a mixture', async () => {
    const userId = `p5-snapshot-${randomUUID()}`;
    const project = await pool.query<{ id: string }>(
      `INSERT INTO paper_projects (user_id,selected_title,profile) VALUES ($1,'Before',$2::jsonb) RETURNING id`,
      [userId, JSON.stringify({ schemaVersion: 1, researchIdea: 'snapshot', paperType: 'other', language: 'en' })],
    );
    const projectId = project.rows[0].id;
    const outline = await pool.query<{ id: string }>(
      `INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','Body',0) RETURNING id`,
      [projectId, userId],
    );
    const section = await pool.query<{ id: string }>(
      `INSERT INTO paper_sections (project_id,user_id,outline_node_id,current_revision_number) VALUES ($1,$2,$3,1) RETURNING id`,
      [projectId, userId, outline.rows[0].id],
    );
    await pool.query(
      `INSERT INTO paper_section_revisions (section_id,user_id,revision_number,content,content_hash,origin,source_strategy,actual_support_mode,support_state) VALUES ($1,$2,1,'Before body',$3,'USER_EDIT','MODEL_ONLY','AI_DRAFT','NOT_CLAIMED')`,
      [section.rows[0].id, userId, 'a'.repeat(64)],
    );

    const reader = await pool.connect();
    const writer = await pool.connect();
    try {
      await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const beforeProject = await reader.query<{ selected_title: string }>('SELECT selected_title FROM paper_projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
      await reader.query('SELECT id FROM paper_outline_nodes WHERE project_id=$1 AND user_id=$2 AND status=\'active\'', [projectId, userId]);

      await writer.query('BEGIN');
      await writer.query(`UPDATE paper_projects SET selected_title='After' WHERE id=$1 AND user_id=$2`, [projectId, userId]);
      await writer.query(
        `INSERT INTO paper_section_revisions (section_id,user_id,revision_number,content,content_hash,origin,source_strategy,actual_support_mode,support_state) VALUES ($1,$2,2,'After body',$3,'USER_EDIT','MODEL_ONLY','AI_DRAFT','NOT_CLAIMED')`,
        [section.rows[0].id, userId, 'b'.repeat(64)],
      );
      await writer.query('UPDATE paper_sections SET current_revision_number=2 WHERE id=$1 AND user_id=$2', [section.rows[0].id, userId]);
      await writer.query('COMMIT');

      const readerSection = await reader.query<{ current_revision_number: number }>('SELECT current_revision_number FROM paper_sections WHERE id=$1 AND user_id=$2', [section.rows[0].id, userId]);
      const readerRevision = await reader.query<{ content_hash: string }>('SELECT content_hash FROM paper_section_revisions WHERE section_id=$1 AND user_id=$2 AND revision_number=$3', [section.rows[0].id, userId, readerSection.rows[0].current_revision_number]);
      const repeatedProject = await reader.query<{ selected_title: string }>('SELECT selected_title FROM paper_projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
      expect([beforeProject.rows[0].selected_title, readerSection.rows[0].current_revision_number, readerRevision.rows[0].content_hash, repeatedProject.rows[0].selected_title]).toEqual(['Before', 1, 'a'.repeat(64), 'Before']);
      await reader.query('COMMIT');

      const after = await pool.query<{ selected_title: string; current_revision_number: number; content_hash: string }>(
        `SELECT p.selected_title,s.current_revision_number,r.content_hash FROM paper_projects p JOIN paper_sections s ON s.project_id=p.id AND s.user_id=p.user_id JOIN paper_section_revisions r ON r.section_id=s.id AND r.user_id=s.user_id AND r.revision_number=s.current_revision_number WHERE p.id=$1 AND p.user_id=$2`,
        [projectId, userId],
      );
      expect(after.rows[0]).toEqual({ selected_title: 'After', current_revision_number: 2, content_hash: 'b'.repeat(64) });
    } finally {
      await reader.query('ROLLBACK').catch(() => undefined);
      await writer.query('ROLLBACK').catch(() => undefined);
      reader.release();
      writer.release();
    }
  });

  it('exercises the repository loader across a concurrent project and revision commit without a mixed fingerprint', async () => {
    const userId = `p5-repository-snapshot-${randomUUID()}`;
    const project = await pool.query<{ id: string }>(
      `INSERT INTO paper_projects (user_id,selected_title,profile) VALUES ($1,'Before',$2::jsonb) RETURNING id`,
      [userId, JSON.stringify({ schemaVersion: 1, researchIdea: 'repository snapshot', paperType: 'other', language: 'en' })],
    );
    const projectId = project.rows[0].id;
    const outline = await pool.query<{ id: string }>(
      `INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','Body',0) RETURNING id`,
      [projectId, userId],
    );
    const section = await pool.query<{ id: string }>(
      `INSERT INTO paper_sections (project_id,user_id,outline_node_id,current_revision_number) VALUES ($1,$2,$3,1) RETURNING id`,
      [projectId, userId, outline.rows[0].id],
    );
    await pool.query(
      `INSERT INTO paper_section_revisions (section_id,user_id,revision_number,content,content_hash,origin,source_strategy,actual_support_mode,support_state) VALUES ($1,$2,1,'Before body',$3,'USER_EDIT','MODEL_ONLY','AI_DRAFT','NOT_CLAIMED')`,
      [section.rows[0].id, userId, 'a'.repeat(64)],
    );

    const config = createStandardPostgresConfig({
      NODE_ENV: 'production', DATABASE_URL: fixture.appUrl, DATABASE_SSL: 'require',
      ...(fixture.caFile ? { DATABASE_SSL_CA_FILE: fixture.caFile } : {}),
    });
    const readerClient = new Client(config);
    const locker = await pool.connect();
    const writer = await pool.connect();
    await readerClient.connect();
    const repository = new PaperProjectRepository(drizzle(readerClient, { schema }) as never);
    try {
      await locker.query('BEGIN');
      await locker.query('LOCK TABLE paper_outline_nodes IN ACCESS EXCLUSIVE MODE');
      const loading = repository.loadManuscriptSnapshot(userId, projectId);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await pool.query<{ wait_event_type: string | null }>('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [readerClient.processID]);
        if (activity.rows[0]?.wait_event_type === 'Lock') break;
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (attempt === 99) throw new Error('Repository snapshot reader did not reach the outline lock barrier.');
      }

      await writer.query('BEGIN');
      await writer.query(`UPDATE paper_projects SET selected_title='After' WHERE id=$1 AND user_id=$2`, [projectId, userId]);
      await writer.query(
        `INSERT INTO paper_section_revisions (section_id,user_id,revision_number,content,content_hash,origin,source_strategy,actual_support_mode,support_state) VALUES ($1,$2,2,'After body',$3,'USER_EDIT','MODEL_ONLY','AI_DRAFT','NOT_CLAIMED')`,
        [section.rows[0].id, userId, 'b'.repeat(64)],
      );
      await writer.query('UPDATE paper_sections SET current_revision_number=2 WHERE id=$1 AND user_id=$2', [section.rows[0].id, userId]);
      await writer.query('COMMIT');
      await locker.query('COMMIT');

      const before = await loading;
      expect(before.project.selectedTitle).toBe('Before');
      expect(before.revisionsBySectionId[section.rows[0].id]).toMatchObject({ revisionNumber: 1, contentHash: 'a'.repeat(64) });
      const beforeFingerprint = computeBodyFingerprint(before);

      const after = await repository.loadManuscriptSnapshot(userId, projectId);
      expect(after.project.selectedTitle).toBe('After');
      expect(after.revisionsBySectionId[section.rows[0].id]).toMatchObject({ revisionNumber: 2, contentHash: 'b'.repeat(64) });
      expect(computeBodyFingerprint(after)).not.toBe(beforeFingerprint);
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await writer.query('ROLLBACK').catch(() => undefined);
      locker.release();
      writer.release();
      await readerClient.end();
    }
  });

  it('backfills P4-shaped inserts as OUTLINE and enforces one active derived role under concurrency', async () => {
    const userId = `p5-role-${randomUUID()}`;
    const project = await pool.query<{ id: string }>(`INSERT INTO paper_projects (user_id,profile) VALUES ($1,$2::jsonb) RETURNING id`, [userId, JSON.stringify({ schemaVersion: 1, researchIdea: 'role', paperType: 'other', language: 'en' })]);
    const projectId = project.rows[0].id;
    const outline = await pool.query<{ id: string }>(`INSERT INTO paper_outline_nodes (project_id,user_id,node_type,title,position) VALUES ($1,$2,'writing-unit','Body',0) RETURNING id`, [projectId, userId]);
    const p4Section = await pool.query<{ section_role: string }>(`INSERT INTO paper_sections (project_id,user_id,outline_node_id) VALUES ($1,$2,$3) RETURNING section_role`, [projectId, userId, outline.rows[0].id]);
    expect(p4Section.rows[0].section_role).toBe('OUTLINE');

    const concurrent = await Promise.allSettled([
      pool.query(`INSERT INTO paper_sections (project_id,user_id,section_role) VALUES ($1,$2,'ABSTRACT')`, [projectId, userId]),
      pool.query(`INSERT INTO paper_sections (project_id,user_id,section_role) VALUES ($1,$2,'ABSTRACT')`, [projectId, userId]),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const count = await pool.query<{ count: string }>(`SELECT count(*) FROM paper_sections WHERE project_id=$1 AND user_id=$2 AND section_role='ABSTRACT' AND status='active'`, [projectId, userId]);
    expect(count.rows[0].count).toBe('1');
    await expect(pool.query(`INSERT INTO paper_sections (project_id,user_id,section_role,status) VALUES ($1,$2,'KEYWORDS','orphaned')`, [projectId, userId])).rejects.toThrow();
  });

  it('enforces export owner, format, fingerprint, and JSON object constraints', async () => {
    const userId = `p5-export-${randomUUID()}`;
    const project = await pool.query<{ id: string }>(`INSERT INTO paper_projects (user_id,profile) VALUES ($1,$2::jsonb) RETURNING id`, [userId, JSON.stringify({ schemaVersion: 1, researchIdea: 'export', paperType: 'other', language: 'en' })]);
    const projectId = project.rows[0].id;
    const values = [randomUUID(), projectId, userId, 'a'.repeat(64), JSON.stringify({ schemaVersion: 1 }), JSON.stringify({ version: 1 })];
    await expect(pool.query(`INSERT INTO paper_exports (id,project_id,user_id,format,template_key,template_version,renderer_version,manuscript_fingerprint,snapshot_manifest,artifact_ref,_created_at) VALUES ($1,$2,$3,'DOCX','generic-academic-v1','1','1',$4,$5::jsonb,$6::jsonb,CURRENT_TIMESTAMP)`, values)).resolves.toBeDefined();
    await expect(pool.query(`INSERT INTO paper_exports (id,project_id,user_id,format,template_key,template_version,renderer_version,manuscript_fingerprint,snapshot_manifest,artifact_ref,_created_at) VALUES ($1,$2,'other-user','DOCX','generic-academic-v1','1','1',$4,$5::jsonb,$6::jsonb,CURRENT_TIMESTAMP)`, [randomUUID(), ...values.slice(1)])).rejects.toThrow();
    await expect(pool.query(`INSERT INTO paper_exports (id,project_id,user_id,format,template_key,template_version,renderer_version,manuscript_fingerprint,snapshot_manifest,artifact_ref,_created_at) VALUES ($1,$2,$3,'PDF','generic-academic-v1','1','1',$4,$5::jsonb,$6::jsonb,CURRENT_TIMESTAMP)`, [randomUUID(), ...values.slice(1)])).rejects.toThrow();
    await expect(pool.query(`INSERT INTO paper_exports (id,project_id,user_id,format,template_key,template_version,renderer_version,manuscript_fingerprint,snapshot_manifest,artifact_ref,_created_at) VALUES ($1,$2,$3,'DOCX','generic-academic-v1','1','1','BAD',$4::jsonb,$5::jsonb,CURRENT_TIMESTAMP)`, [randomUUID(), projectId, userId, JSON.stringify([]), JSON.stringify({})])).rejects.toThrow();
  });
});
