import { ZoteroCredentialCrypto } from './zotero-crypto';

describe('ZoteroCredentialCrypto', () => {
  it('encrypts and decrypts a credential with rotation metadata', () => {
    const crypto = new ZoteroCredentialCrypto(Buffer.alloc(32, 7), 'key-v1');
    const encrypted = crypto.encrypt('synthetic-api-key');

    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(encrypted.encryptionKeyVersion).toBe('key-v1');
    expect(encrypted.keyFingerprint).toHaveLength(64);
    expect(encrypted.ciphertext).not.toContain('synthetic-api-key');
    expect(crypto.decrypt(encrypted)).toBe('synthetic-api-key');
  });

  it('rejects an authentication tag or key-version mismatch', () => {
    const crypto = new ZoteroCredentialCrypto(Buffer.alloc(32, 9), 'key-v2');
    const encrypted = crypto.encrypt('synthetic-api-key');
    const tampered = { ...encrypted, authTag: Buffer.alloc(16).toString('base64') };

    expect(() => crypto.decrypt(tampered)).toThrow('Credential could not be decrypted.');
    expect(() => new ZoteroCredentialCrypto(Buffer.alloc(32, 9), 'key-v3').decrypt(encrypted)).toThrow(
      'Credential encryption key version is unavailable.',
    );
  });
});
