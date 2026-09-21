import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
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
});
