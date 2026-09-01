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
  user_id varchar(64) NOT NULL UNIQUE,
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
  _updated_by text
);

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
