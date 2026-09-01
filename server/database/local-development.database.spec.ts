import { appUsers } from './schema';
import { createLocalDevelopmentDatabase } from './local-development.database';

describe('createLocalDevelopmentDatabase', () => {
  it('creates the app user table for the existing task services', async () => {
    const local = await createLocalDevelopmentDatabase();

    try {
      await local.db.insert(appUsers).values({
        userId: 'database-test-user',
        points: 100,
      });
      const rows = await local.db.select().from(appUsers);

      expect(rows.some((row) => row.userId === 'database-test-user')).toBe(true);
    } finally {
      await local.close();
    }
  });
});
