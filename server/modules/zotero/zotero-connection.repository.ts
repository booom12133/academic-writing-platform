import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import { zoteroConnections } from '../../database/schema';
import type { ZoteroConnection, ZoteroConnectionUpsertInput } from './zotero.types';

type ConnectionRow = typeof zoteroConnections.$inferSelect;

function toConnection(row: ConnectionRow): ZoteroConnection {
  return {
    id: row.id,
    userId: row.userId,
    libraryType: row.libraryType as ZoteroConnection['libraryType'],
    libraryId: row.libraryId,
    keyFingerprint: row.keyFingerprint,
    encryptionKeyVersion: row.encryptionKeyVersion,
    status: row.status as ZoteroConnection['status'],
    ...(row.lastCheckedAt === null ? {} : { lastCheckedAt: row.lastCheckedAt.toISOString() }),
    ...(row.lastSeenLibraryVersion === null ? {} : { lastSeenLibraryVersion: row.lastSeenLibraryVersion }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ZoteroConnectionRepository {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase) {}

  async upsert(input: ZoteroConnectionUpsertInput): Promise<ZoteroConnection> {
    const values = {
      userId: input.userId,
      libraryType: input.libraryType,
      libraryId: input.libraryId,
      ciphertext: input.encrypted.ciphertext,
      nonce: input.encrypted.nonce,
      authTag: input.encrypted.authTag,
      encryptionAlgorithm: input.encrypted.algorithm,
      encryptionKeyVersion: input.encrypted.encryptionKeyVersion,
      keyFingerprint: input.encrypted.keyFingerprint,
      status: input.status,
      ...(input.lastCheckedAt === undefined ? {} : { lastCheckedAt: input.lastCheckedAt }),
      ...(input.lastSeenLibraryVersion === undefined ? {} : { lastSeenLibraryVersion: input.lastSeenLibraryVersion }),
    };
    const [row] = await this.db.insert(zoteroConnections).values(values).onConflictDoUpdate({
      target: [zoteroConnections.userId, zoteroConnections.libraryType, zoteroConnections.libraryId],
      set: {
        ciphertext: values.ciphertext,
        nonce: values.nonce,
        authTag: values.authTag,
        encryptionAlgorithm: values.encryptionAlgorithm,
        encryptionKeyVersion: values.encryptionKeyVersion,
        keyFingerprint: values.keyFingerprint,
        status: values.status,
        lastCheckedAt: values.lastCheckedAt,
        lastSeenLibraryVersion: values.lastSeenLibraryVersion,
        updatedAt: new Date(),
      },
    }).returning();
    if (!row) throw new Error('Zotero connection was not persisted.');
    return toConnection(row);
  }

  async findByUser(userId: string): Promise<ZoteroConnection[]> {
    const rows = await this.db.select().from(zoteroConnections)
      .where(eq(zoteroConnections.userId, userId))
      .orderBy(desc(zoteroConnections.updatedAt));
    return rows.map(toConnection);
  }

  async findActiveCredential(userId: string): Promise<{ connection: ZoteroConnection; encrypted: { ciphertext: string; nonce: string; authTag: string; algorithm: 'aes-256-gcm'; encryptionKeyVersion: string; keyFingerprint: string } } | null> {
    const [row] = await this.db.select().from(zoteroConnections).where(and(
      eq(zoteroConnections.userId, userId), eq(zoteroConnections.status, 'active'),
    )).orderBy(desc(zoteroConnections.updatedAt)).limit(1);
    if (!row) return null;
    return {
      connection: toConnection(row),
      encrypted: {
        ciphertext: row.ciphertext, nonce: row.nonce, authTag: row.authTag,
        algorithm: row.encryptionAlgorithm as 'aes-256-gcm', encryptionKeyVersion: row.encryptionKeyVersion, keyFingerprint: row.keyFingerprint,
      },
    };
  }

  async findByUserAndLibrary(userId: string, libraryType: 'user', libraryId: string): Promise<ZoteroConnection | null> {
    const [row] = await this.db.select().from(zoteroConnections).where(and(
      eq(zoteroConnections.userId, userId), eq(zoteroConnections.libraryType, libraryType), eq(zoteroConnections.libraryId, libraryId),
    )).limit(1);
    return row ? toConnection(row) : null;
  }

  async disable(userId: string, libraryId: string, status: 'disabled' | 'revoked' | 'invalid'): Promise<void> {
    await this.db.update(zoteroConnections).set({ status, updatedAt: new Date() }).where(and(
      eq(zoteroConnections.userId, userId), eq(zoteroConnections.libraryType, 'user'), eq(zoteroConnections.libraryId, libraryId),
    ));
  }
}
