import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createS3Target, createDriveTarget, createFolderTarget, backup, restore } from '../src/backup.ts';
import { utf8Encode, utf8Decode, hexEncode, hexDecode } from '../../core/src/util.ts';

const testData = utf8Encode('Hello, world!');
const testPassphrase = 'my-secret-passphrase';

// === S3/R2 Tests ===
test('S3 backup and restore', async () => {
  let uploadedData = null;

  const server = createServer((req, res) => {
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        uploadedData = Buffer.concat(chunks);
        res.writeHead(200);
        res.end(JSON.stringify({}));
      });
    } else if (req.method === 'GET') {
      res.writeHead(200);
      res.end(uploadedData);
    }
  });

  await new Promise((resolve) => server.listen(3001, resolve));

  try {
    const target = createS3Target({
      endpoint: 'http://localhost:3001',
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    // Backup
    const backupResult = await backup(target, {
      name: 'test-backup',
      bytes: testData,
      passphrase: testPassphrase,
    });
    assert(backupResult.ref, 'backup should return a ref');

    // Verify data is encrypted (not plaintext)
    // The first 16 bytes are the salt, next 12 bytes are the IV, rest is ciphertext
    // Check that it doesn't start with our plaintext magic bytes
    assert.notEqual(uploadedData[16], 72, 'encrypted data should not contain plaintext "Hello" (H=72)');
    assert.notEqual(uploadedData[17], 101, 'encrypted data should not contain plaintext "Hello" (e=101)');

    // Restore with correct passphrase
    const restored = await restore(target, {
      ref: backupResult.ref,
      passphrase: testPassphrase,
    });
    assert.deepEqual(restored, testData, 'restored data should match original');

    // Try to restore with wrong passphrase (should fail)
    try {
      await restore(target, {
        ref: backupResult.ref,
        passphrase: 'wrong-passphrase',
      });
      assert.fail('should throw on wrong passphrase');
    } catch (e) {
      assert(e.message.includes('Wrong passphrase'), 'error should mention wrong passphrase');
    }
  } finally {
    server.close();
  }
});

// === Google Drive Tests ===
test('Google Drive backup and restore', async () => {
  let uploadedData = null;
  let fileId = 'file-123';

  const server = createServer((req, res) => {
    if (req.url.includes('/upload/drive/v3/files') && req.method === 'POST') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        // For multipart uploads, extract the binary part after the second \r\n\r\n (end of headers)
        const fullData = Buffer.concat(chunks);

        // Convert to string to find the structure
        const str = fullData.toString('latin1'); // Use latin1 to preserve byte values

        // Find the second occurrence of \r\n\r\n (first is after Content-Type header of part 1, second is after headers of part 2)
        const firstHeaderEnd = str.indexOf('\r\n\r\n');
        const secondHeaderEnd = str.indexOf('\r\n\r\n', firstHeaderEnd + 4);

        if (secondHeaderEnd > 0) {
          // Find where the binary data ends (before the final \r\n--)
          const finalBoundary = str.indexOf('\r\n--', secondHeaderEnd + 4);
          if (finalBoundary > 0) {
            uploadedData = fullData.slice(secondHeaderEnd + 4, finalBoundary);
          } else {
            uploadedData = fullData.slice(secondHeaderEnd + 4);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: fileId }));
      });
    } else if (req.url.includes('/drive/v3/files/') && req.method === 'GET') {
      res.writeHead(200);
      res.end(uploadedData);
    }
  });

  await new Promise((resolve) => server.listen(3002, resolve));

  try {
    const target = createDriveTarget({
      apiUrl: 'http://localhost:3002',
      accessToken: 'test-token',
      folderId: 'folder-123',
    });

    // Backup
    const backupResult = await backup(target, {
      name: 'test-backup',
      bytes: testData,
      passphrase: testPassphrase,
    });
    assert.equal(backupResult.ref, fileId, 'ref should match file ID');

    // Verify data is encrypted (check that it doesn't contain plaintext)
    assert.notEqual(uploadedData[16], 72, 'encrypted data should not contain plaintext');
    assert.notEqual(uploadedData[17], 101, 'encrypted data should not contain plaintext');

    // Restore with correct passphrase
    const restored = await restore(target, {
      ref: fileId,
      passphrase: testPassphrase,
    });
    assert.deepEqual(restored, testData, 'restored data should match original');

    // Try to restore with wrong passphrase
    try {
      await restore(target, {
        ref: fileId,
        passphrase: 'wrong-passphrase',
      });
      assert.fail('should throw on wrong passphrase');
    } catch (e) {
      assert(e.message.includes('Wrong passphrase'), 'error should mention wrong passphrase');
    }
  } finally {
    server.close();
  }
});

// === Folder/USB Tests ===
test('Folder backup and restore', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'lms-backup-test-'));
  const target = createFolderTarget({
    dir: tempDir,
  });

  // Backup
  const backupResult = await backup(target, {
    name: 'test-backup',
    bytes: testData,
    passphrase: testPassphrase,
  });
  assert(backupResult.ref, 'backup should return a ref');
  assert(backupResult.ref.includes(tempDir), 'ref should include the directory');

  // Restore with correct passphrase
  const restored = await restore(target, {
    ref: backupResult.ref,
    passphrase: testPassphrase,
  });
  assert.deepEqual(restored, testData, 'restored data should match original');

  // Try to restore with wrong passphrase
  try {
    await restore(target, {
      ref: backupResult.ref,
      passphrase: 'wrong-passphrase',
    });
    assert.fail('should throw on wrong passphrase');
  } catch (e) {
    assert(e.message.includes('File not found') || e.message.includes('Wrong passphrase'), 'error should mention file not found or wrong passphrase');
  }
});

// === Byte-identical restore test ===
test('backup and restore are byte-identical', async () => {
  let uploadedData = null;

  const server = createServer((req, res) => {
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        uploadedData = Buffer.concat(chunks);
        res.writeHead(200);
        res.end();
      });
    } else if (req.method === 'GET') {
      res.writeHead(200);
      res.end(uploadedData);
    }
  });

  await new Promise((resolve) => server.listen(3004, resolve));

  try {
    const target = createS3Target({
      endpoint: 'http://localhost:3004',
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });

    // Create test data with various byte values
    const testBytes = new Uint8Array([0, 1, 127, 128, 255, 100, 200, 50]);

    // Backup and restore
    const backupResult = await backup(target, {
      name: 'byte-test',
      bytes: testBytes,
      passphrase: 'test-pass',
    });

    const restored = await restore(target, {
      ref: backupResult.ref,
      passphrase: 'test-pass',
    });

    // Check byte-for-byte equality
    assert.equal(restored.length, testBytes.length, 'length should match');
    for (let i = 0; i < testBytes.length; i++) {
      assert.equal(restored[i], testBytes[i], `byte ${i} should match`);
    }
  } finally {
    server.close();
  }
});
