import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export { DRIZZLE_DATABASE };

export type AppDatabase = NodePgDatabase<typeof schema>;
