// Backup targets and encryption (AC-113)
// Supports R2/S3, Google Drive, and folder targets with encrypted backups

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { base64Encode, base64Decode, hexEncode, hexDecode, utf8Encode, utf8Decode, aesGcmSeal, aesGcmOpen, hkdfSha256 } from '../../core/src/util.ts';

// Key derivation: PBKDF2 + HKDF
async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  // Step 1: PBKDF2 to stretch the passphrase
  const passwordKey = await globalThis.crypto.subtle.importKey('raw', utf8Encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const stretchedKeyBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: 600000,
    },
    passwordKey,
    256 // 256 bits = 32 bytes
  );
  const stretchedKey = new Uint8Array(stretchedKeyBits);

  // Step 2: HKDF to derive the final encryption key
  const finalKey = await hkdfSha256(stretchedKey, salt, utf8Encode('backup'), 32);
  return finalKey;
}

// Target interface for upload/download
interface BackupTarget {
  upload(name: string, encrypted: Uint8Array): Promise<string>; // returns ref
  download(ref: string): Promise<Uint8Array>;
}

// S3/R2 target
export function createS3Target(config: { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string }): BackupTarget {
  return {
    async upload(name: string, encrypted: Uint8Array): Promise<string> {
      const key = `backups/${name}`;
      const url = `${config.endpoint}/${config.bucket}/${key}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: encrypted,
      });
      if (!response.ok) throw new Error(`S3 upload failed: ${response.statusText}`);
      return key;
    },
    async download(ref: string): Promise<Uint8Array> {
      const url = `${config.endpoint}/${config.bucket}/${ref}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`S3 download failed: ${response.statusText}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

// Google Drive target
export function createDriveTarget(config: { apiUrl: string; accessToken: string; folderId: string }): BackupTarget {
  return {
    async upload(name: string, encrypted: Uint8Array): Promise<string> {
      // Create file metadata
      const metadata = {
        name: name,
        parents: [config.folderId],
        mimeType: 'application/octet-stream',
      };

      // Multipart upload
      const boundary = '===============' + Math.random().toString().substring(2) + '==';
      const contentType = `multipart/related; boundary="${boundary}"`;

      const body =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`;

      const fullBody = new Uint8Array(utf8Encode(body).length + encrypted.length + utf8Encode(`\r\n--${boundary}--`).length);
      fullBody.set(utf8Encode(body));
      fullBody.set(encrypted, utf8Encode(body).length);
      fullBody.set(utf8Encode(`\r\n--${boundary}--`), utf8Encode(body).length + encrypted.length);

      const response = await fetch(`${config.apiUrl}/upload/drive/v3/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': contentType,
        },
        body: fullBody,
      });

      if (!response.ok) throw new Error(`Google Drive upload failed: ${response.statusText}`);
      const result = await response.json() as { id: string };
      return result.id;
    },

    async download(ref: string): Promise<Uint8Array> {
      const response = await fetch(`${config.apiUrl}/drive/v3/files/${ref}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      });
      if (!response.ok) throw new Error(`Google Drive download failed: ${response.statusText}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

// Folder/USB target - writes files to the file system
export function createFolderTarget(config: { dir: string }): BackupTarget {
  return {
    async upload(name: string, encrypted: Uint8Array): Promise<string> {
      // Ensure directory exists
      try {
        mkdirSync(config.dir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      const ref = `${config.dir}/${name}`;
      const buffer = Buffer.from(encrypted);
      writeFileSync(ref, buffer);
      return ref;
    },

    async download(ref: string): Promise<Uint8Array> {
      try {
        const buffer = readFileSync(ref);
        return new Uint8Array(buffer);
      } catch (error) {
        throw new Error(`File not found: ${ref}`);
      }
    },
  };
}

// Backup function - encrypts before upload
export async function backup(target: BackupTarget, options: { name: string; bytes: Uint8Array; passphrase: string }): Promise<{ ref: string }> {
  // Generate random salt
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // Derive key from passphrase
  const key = await deriveKeyFromPassphrase(options.passphrase, salt);

  // Encrypt the data
  const encrypted = await aesGcmSeal(key, options.bytes);

  // Prepend salt to encrypted data
  const withSalt = new Uint8Array(salt.length + encrypted.length);
  withSalt.set(salt);
  withSalt.set(encrypted, salt.length);

  // Upload
  const ref = await target.upload(options.name, withSalt);
  return { ref };
}

// Restore function - downloads and decrypts
export async function restore(target: BackupTarget, options: { ref: string; passphrase: string }): Promise<Uint8Array> {
  // Download
  const withSalt = await target.download(options.ref);

  // Extract salt (first 16 bytes)
  const salt = withSalt.slice(0, 16);
  const encrypted = withSalt.slice(16);

  // Derive key from passphrase
  const key = await deriveKeyFromPassphrase(options.passphrase, salt);

  // Decrypt
  try {
    const plaintext = await aesGcmOpen(key, encrypted);
    return plaintext;
  } catch (error) {
    throw new Error('Wrong passphrase');
  }
}
