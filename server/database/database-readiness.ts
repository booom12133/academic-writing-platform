import { sql } from 'drizzle-orm';

export const REQUIRED_MIGRATION_COUNT = 4;
export const REQUIRED_TABLE_NAMES = [
  'app_users',
  'tasks',
  'point_records',
  'recharge_orders',
  'knowledge_documents',
  'knowledge_document_versions',
  'knowledge_chunks',
  'knowledge_source_records',
  'knowledge_source_external_links',
  'knowledge_metadata_assertions',
  'knowledge_imports',
  'knowledge_embedding_indexes',
  'knowledge_chunk_embeddings',
  'zotero_connections',
] as const;

export type DatabaseReadinessReasonCode =
  | 'database_unreachable'
  | 'vector_extension_missing'
  | 'schema_version_missing';

export interface DatabaseReadinessResult {
  ready: boolean;
  reasonCode?: DatabaseReadinessReasonCode;
}

interface ReadinessRow {
  vector_extension?: boolean | string;
  applied_migrations?: number | string;
  required_tables?: number | string;
}

interface ReadinessDatabase {
  execute(query: unknown): Promise<{ rows: readonly ReadinessRow[] }>;
}

const requiredTableSql = REQUIRED_TABLE_NAMES.map((name) => `'${name}'`).join(', ');
const readinessQuery = sql.raw(`
  SELECT
    EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) AS vector_extension,
    (
      SELECT count(*) FROM drizzle.__drizzle_migrations
    ) AS applied_migrations,
    (
      SELECT count(*)
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${requiredTableSql})
    ) AS required_tables
`);

export async function checkDatabaseReadiness(
  database: ReadinessDatabase,
): Promise<DatabaseReadinessResult> {
  let row: ReadinessRow | undefined;
  try {
    row = (await database.execute(readinessQuery)).rows[0];
  } catch (_error) {
    return { ready: false, reasonCode: 'database_unreachable' };
  }

  if (!row || !isTruthy(row.vector_extension)) {
    return { ready: false, reasonCode: 'vector_extension_missing' };
  }
  if (
    Number(row.applied_migrations) < REQUIRED_MIGRATION_COUNT ||
    Number(row.required_tables) < REQUIRED_TABLE_NAMES.length
  ) {
    return { ready: false, reasonCode: 'schema_version_missing' };
  }
  return { ready: true };
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1';
}
