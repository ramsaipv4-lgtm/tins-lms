# MS 10.2 — Activity key: Encrypted backups and Google adapters

## Activity: Validate backup headers and troubleshoot a switch issue

### Part 1: Write a backup header validator (15 min)

**Task:** Write a function that checks if a backup file has the right structure without decrypting it.

**Starter code:**
```typescript
function validateBackupHeader(data: Uint8Array): { saltSize: number | null; ivSize: number | null; minValidSize: number; isValid: boolean } {
  // Salt: 16 bytes
  // IV: 12 bytes (from AES-GCM)
  // Ciphertext + auth tag: at least 1 + 16 bytes
  // Minimum total: 16 + 12 + 1 + 16 = 45 bytes
  
  const MIN_SIZE = 45;
  if (data.length < MIN_SIZE) {
    return { saltSize: null, ivSize: null, minValidSize: MIN_SIZE, isValid: false };
  }
  
  return {
    saltSize: 16,
    ivSize: 12,
    minValidSize: MIN_SIZE,
    isValid: true,
  };
}
```

**Test cases:**
1. Empty data: `validateBackupHeader(new Uint8Array([]))` → `isValid: false`
2. 40 bytes: `validateBackupHeader(new Uint8Array(40))` → `isValid: false`
3. 45 bytes: `validateBackupHeader(new Uint8Array(45))` → `isValid: true`
4. 1000 bytes: `validateBackupHeader(new Uint8Array(1000))` → `isValid: true`

**Expected output:**
```text
Empty: { saltSize: null, ivSize: null, minValidSize: 45, isValid: false }
40 bytes: { saltSize: null, ivSize: null, minValidSize: 45, isValid: false }
45 bytes: { saltSize: 16, ivSize: 12, minValidSize: 45, isValid: true }
1000 bytes: { saltSize: 16, ivSize: 12, minValidSize: 45, isValid: true }
```

### Part 2: Fix a broken Google adapter (20 min)

**Scenario:** A learner's code tries to sync calendar events but the switch check has a bug.

**Buggy code:**
```typescript
async syncCalendar(options: { calendarId: string; events: Array<{ id: string; title: string; start: number; end: number; timezone: string }> }): Promise<{ synced: number }> {
  // BUG: Wrong switch check
  if (switches.calendarSync !== true) {
    return { synced: 0 }; // Returns 0 instead of throwing
  }
  
  let synced = 0;
  for (const event of options.events) {
    // ... fetch calendar events
    synced++;
  }
  return { synced };
}
```

**Problems:**
1. Returns `{ synced: 0 }` silently instead of rejecting
2. The caller doesn't know the switch is off
3. The acceptance test expects an error to be thrown

**Fix:** Make the check throw an error:
```typescript
async syncCalendar(options: ...): Promise<{ synced: number }> {
  if (switches.calendarSync !== true) {
    throw new Error(`Switch calendarSync is off`);
  }
  
  let synced = 0;
  // ... rest of the code
}
```

**Test the fix:**
```typescript
const adapter = createGoogleAdapter({ 
  baseUrls: { ... }, 
  accessToken: 'token', 
  switches: { calendarSync: false } // Off
});

try {
  await adapter.syncCalendar({ calendarId: 'test', events: [] });
  console.log('ERROR: should have thrown');
} catch (e) {
  console.log(`Good: ${e.message}`); // Expect "Switch calendarSync is off"
}
```

### Part 3: Debug a multipart upload (15 min)

**Scenario:** A test uploads to Google Drive but the restored data doesn't match.

**Problem:** The test server corrupts binary data:
```typescript
let body = '';
req.on('data', chunk => body += chunk); // BUG: corrupts binary
req.on('end', () => {
  uploadedData = body; // String, not bytes!
});
```

**Why it breaks:** String concatenation interprets bytes as UTF-8, losing values > 127.

**Fix:** Use Buffer.concat:
```typescript
const chunks = [];
req.on('data', chunk => chunks.push(chunk));
req.on('end', () => {
  uploadedData = Buffer.concat(chunks); // Preserve all bytes
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id: fileId }));
});
```

**Test that it works:** Upload binary `[255, 254, 128, 127]` and verify it comes back intact.

## Answer key

### Part 1 validator
The function correctly identifies minimum size and validates that backups have enough data for salt + IV + ciphertext + tag.

### Part 2 switch fix
The corrected code throws an error with the switch name, making it clear to the caller why the call failed. This is what the contract requires.

### Part 3 multipart fix
Using `Buffer.concat()` preserves all bytes. The test now correctly verifies that encryption works even with high-value bytes (255, 128, etc.).

## Common learner errors

1. **Using `!== false` instead of `=== true` for switch checks:** This makes missing switches default to on, violating the contract.
2. **Returning an error value instead of throwing:** The caller doesn't know the call failed unless it throws or returns an error object. Always throw for validation failures.
3. **Using string concatenation for binary data in Node.js:** This silently corrupts data. Always use Buffer or typed arrays for binary.

## Discussion prompts

1. "What would happen if the salt weren't included in the backup file?"
   - Answer: The restore function wouldn't know what salt was used, so it couldn't re-derive the same key.

2. "Why doesn't the folder target use HTTP like S3 and Drive?"
   - Answer: It's for local/USB storage, not a network service. File I/O is simpler and the acceptance tests verify files exist on disk.

3. "What's the difference between a feature switch being off and a feature not existing?"
   - Answer: A switch that's off still exists (has a default value), so the code can check it. A feature that doesn't exist would need a code change to add it.
