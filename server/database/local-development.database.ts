import { randomUUID } from 'node:crypto';
import { DataType, newDb } from 'pg-mem';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { LOCAL_DEVELOPMENT_USER_ID } from '../config/local-development';

type LocalDatabase = NodePgDatabase<typeof schema>;

export interface LocalDevelopmentDatabase {
  db: LocalDatabase;
  close: () => Promise<void>;
}

const LOCAL_SCHEMA_SQL = `
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  phone varchar(20),
  username varchar(50),
  password_hash varchar(255),
  avatar_url text,
  points integer NOT NULL DEFAULT 0,
  total_recharge integer NOT NULL DEFAULT 0,
  member_level varchar(20) NOT NULL DEFAULT 'normal',
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by text,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by text,
  CONSTRAINT app_users_user_id_key UNIQUE (user_id)
);

CREATE INDEX idx_app_users_user_id ON app_users (user_id);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  task_type varchar(30) NOT NULL,
  title varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  points_cost integer NOT NULL DEFAULT 0,
  input_data jsonb NOT NULL DEFAULT '{}',
  result_data jsonb,
  error_message text,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by text,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by text
);

CREATE TABLE point_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  type varchar(20) NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  task_id uuid,
  order_id uuid,
  description varchar(255),
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by text,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by text
);

CREATE TABLE recharge_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  amount integer NOT NULL,
  points integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  pay_method varchar(20),
  pay_order_no varchar(100),
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by text,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by text
);

CREATE TABLE knowledge_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  kind varchar(32) NOT NULL,
  canonical_metadata jsonb NOT NULL DEFAULT '{}',
  status varchar(24) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_source_records_id_user_id_key UNIQUE (id, user_id)
);

CREATE INDEX knowledge_source_records_user_status_idx
  ON knowledge_source_records (user_id, status);

CREATE TABLE knowledge_metadata_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  source_record_id uuid NOT NULL,
  field varchar(32) NOT NULL,
  value jsonb NOT NULL,
  provider_kind varchar(64) NOT NULL,
  provider varchar(128) NOT NULL,
  external_record_id varchar(255) NOT NULL,
  observed_at timestamptz,
  verification_status varchar(24) NOT NULL,
  assertion_hash varchar(64) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_metadata_assertions_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_metadata_assertions_identity_key
    UNIQUE (source_record_id, user_id, assertion_hash),
  CONSTRAINT knowledge_metadata_assertions_source_owner_fk
    FOREIGN KEY (source_record_id, user_id)
    REFERENCES knowledge_source_records (id, user_id)
);

CREATE INDEX knowledge_metadata_assertions_user_source_field_idx
  ON knowledge_metadata_assertions (user_id, source_record_id, field);

CREATE TABLE knowledge_source_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  source_record_id uuid NOT NULL,
  connector_kind varchar(64) NOT NULL,
  provider varchar(128) NOT NULL,
  external_record_id varchar(255) NOT NULL,
  external_version varchar(255),
  canonical_url text,
  retrieved_at timestamptz,
  license_or_access_note text,
  verification_status varchar(24) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_source_external_links_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_source_external_links_identity_key
    UNIQUE (user_id, connector_kind, provider, external_record_id),
  CONSTRAINT knowledge_source_external_links_source_owner_fk
    FOREIGN KEY (source_record_id, user_id)
    REFERENCES knowledge_source_records (id, user_id)
);

CREATE INDEX knowledge_source_external_links_user_source_idx
  ON knowledge_source_external_links (user_id, source_record_id);

CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  source_record_id uuid,
  origin_kind varchar(32) NOT NULL,
  display_name varchar(255) NOT NULL,
  source_type varchar(16) NOT NULL,
  active_version_id uuid,
  lifecycle_status varchar(24) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_documents_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_documents_source_owner_fk
    FOREIGN KEY (source_record_id, user_id)
    REFERENCES knowledge_source_records (id, user_id)
);

CREATE INDEX knowledge_documents_user_lifecycle_idx
  ON knowledge_documents (user_id, lifecycle_status);
CREATE INDEX knowledge_documents_user_source_idx
  ON knowledge_documents (user_id, source_record_id);

CREATE TABLE knowledge_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  original_content_hash varchar(64) NOT NULL,
  normalized_content_hash varchar(64),
  normalization_profile jsonb,
  parser_profile jsonb NOT NULL,
  chunking_profile jsonb NOT NULL,
  source_text text,
  source_artifact_ref jsonb,
  supersedes_version_id uuid,
  lifecycle_status varchar(24) NOT NULL,
  readiness_status varchar(32) NOT NULL,
  index_input_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_document_versions_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_document_versions_number_key
    UNIQUE (document_id, user_id, version_number),
  CONSTRAINT knowledge_document_versions_fingerprint_key
    UNIQUE (document_id, user_id, index_input_fingerprint),
  CONSTRAINT knowledge_document_versions_document_owner_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES knowledge_documents (id, user_id),
  CONSTRAINT knowledge_document_versions_supersedes_owner_fk
    FOREIGN KEY (supersedes_version_id, user_id)
    REFERENCES knowledge_document_versions (id, user_id)
);

CREATE INDEX knowledge_document_versions_user_document_state_idx
  ON knowledge_document_versions
  (user_id, document_id, lifecycle_status, readiness_status);

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  document_version_id uuid NOT NULL,
  ordinal integer NOT NULL,
  text text NOT NULL,
  text_hash varchar(64) NOT NULL,
  provenance jsonb NOT NULL,
  citation_locator jsonb NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_chunks_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_chunks_version_ordinal_key
    UNIQUE (document_version_id, user_id, ordinal),
  CONSTRAINT knowledge_chunks_version_owner_fk
    FOREIGN KEY (document_version_id, user_id)
    REFERENCES knowledge_document_versions (id, user_id)
);

CREATE INDEX knowledge_chunks_user_version_ordinal_idx
  ON knowledge_chunks (user_id, document_version_id, ordinal);

CREATE TABLE knowledge_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(64) NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  request_fingerprint varchar(64) NOT NULL,
  document_id uuid,
  document_version_id uuid,
  status varchar(24) NOT NULL,
  _created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_imports_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT knowledge_imports_user_idempotency_key UNIQUE (user_id, idempotency_key),
  CONSTRAINT knowledge_imports_document_owner_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES knowledge_documents (id, user_id),
  CONSTRAINT knowledge_imports_version_owner_fk
    FOREIGN KEY (document_version_id, user_id)
    REFERENCES knowledge_document_versions (id, user_id)
);

CREATE INDEX knowledge_imports_user_status_idx
  ON knowledge_imports (user_id, status);
`;

export async function createLocalDevelopmentDatabase(): Promise<LocalDevelopmentDatabase> {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: () => randomUUID(),
  });
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  const originalQuery = pool.query.bind(pool);
  pool.query = (async (query: unknown, valuesOrCallback?: unknown, callback?: unknown) => {
    if (query && typeof query === 'object' && !Array.isArray(query)) {
      const queryConfig = { ...(query as Record<string, unknown>) };
      // drizzle-orm/node-postgres adds `types`, which pg-mem's Pool does not use.
      delete queryConfig.types;
      const wantsArrayRows = queryConfig.rowMode === 'array';
      delete queryConfig.rowMode;
      const result = await originalQuery(queryConfig, valuesOrCallback, callback);
      if (wantsArrayRows && result && typeof result === 'object' && 'rows' in result) {
        const queryResult = result as {
          rows: unknown[];
          fields?: Array<{ name: string }>;
        };
        queryResult.rows = queryResult.rows.map((row) =>
          queryResult.fields?.length
            ? queryResult.fields.map((field) =>
                (row as Record<string, unknown>)[field.name],
              )
            : Object.values(row as Record<string, unknown>),
        );
      }
      return result;
    }
    return originalQuery(query, valuesOrCallback, callback);
  }) as typeof pool.query;
  await pool.query(LOCAL_SCHEMA_SQL);

  const db = drizzle(pool, { schema }) as unknown as LocalDatabase;
  await db.insert(schema.appUsers).values({
    userId: LOCAL_DEVELOPMENT_USER_ID,
    username: 'Local Development User',
    points: 1000,
  });

  return {
    db,
    close: () => pool.end(),
  };
}
