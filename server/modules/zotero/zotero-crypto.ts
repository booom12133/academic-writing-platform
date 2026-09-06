import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ZoteroEncryptedCredential } from './zotero.types';

export class ZoteroCredentialCrypto {
  constructor(
    private readonly key: Buffer,
    private readonly keyVersion: string,
  ) {
    if (key.length !== 32) throw new Error('Zotero credential encryption key must be 32 bytes.');
    if (!keyVersion) throw new Error('Zotero credential encryption key version is required.');
  }

  encrypt(plaintext: string): ZoteroEncryptedCredential {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      algorithm: 'aes-256-gcm',
      encryptionKeyVersion: this.keyVersion,
      keyFingerprint: createHash('sha256').update(plaintext).digest('hex'),
    };
  }

  decrypt(value: ZoteroEncryptedCredential): string {
    if (value.encryptionKeyVersion !== this.keyVersion) {
      throw new Error('Credential encryption key version is unavailable.');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(value.nonce, 'base64'));
      decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('Credential could not be decrypted.');
    }
  }
}
