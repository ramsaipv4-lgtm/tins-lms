// AC-56
import test from 'node:test';
import assert from 'node:assert/strict';
import { retentionDue } from '../src/index.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

test('AC-56 integrity entries delete 180 days after resultsAt', () => {
  const resultsAt = 1000;
  const docs = [
    { id: 'i1', type: 'integrity', createdAt: 0, batchEndedAt: null, resultsAt },
  ];

  // One millisecond before 180 days
  let result = retentionDue(docs, resultsAt + 180 * DAY_MS - 1);
  assert.deepEqual(result.delete, []);
  assert.deepEqual(result.pseudonymise, []);

  // Exactly at 180 days
  result = retentionDue(docs, resultsAt + 180 * DAY_MS);
  assert.deepEqual(result.delete, ['i1']);
  assert.deepEqual(result.pseudonymise, []);
});

test('AC-56 integrity entries with null resultsAt are never deleted', () => {
  const docs = [
    { id: 'i1', type: 'integrity', createdAt: 0, batchEndedAt: null, resultsAt: null },
  ];

  const result = retentionDue(docs, 10 * YEAR_MS);
  assert.deepEqual(result.delete, []);
});

test('AC-56 chat entries delete 1 year after createdAt', () => {
  const createdAt = 1000;
  const docs = [
    { id: 'c1', type: 'chat', createdAt, batchEndedAt: null, resultsAt: null },
  ];

  // One millisecond before 1 year
  let result = retentionDue(docs, createdAt + YEAR_MS - 1);
  assert.deepEqual(result.delete, []);

  // Exactly at 1 year
  result = retentionDue(docs, createdAt + YEAR_MS);
  assert.deepEqual(result.delete, ['c1']);
});

test('AC-56 container entries delete at batchEndedAt', () => {
  const batchEndedAt = 5000;
  const docs = [
    { id: 'cn1', type: 'container', createdAt: 0, batchEndedAt, resultsAt: null },
  ];

  // One millisecond before batchEndedAt
  let result = retentionDue(docs, batchEndedAt - 1);
  assert.deepEqual(result.delete, []);

  // At batchEndedAt
  result = retentionDue(docs, batchEndedAt);
  assert.deepEqual(result.delete, ['cn1']);
});

test('AC-56 container with null batchEndedAt is never deleted', () => {
  const docs = [
    { id: 'cn1', type: 'container', createdAt: 0, batchEndedAt: null, resultsAt: null },
  ];

  const result = retentionDue(docs, 10 * YEAR_MS);
  assert.deepEqual(result.delete, []);
});

test('AC-56 grades pseudonymise 3 years after batchEndedAt, never delete', () => {
  const batchEndedAt = 1000;
  const docs = [
    { id: 'g1', type: 'grade', createdAt: 0, batchEndedAt, resultsAt: null },
  ];

  // One millisecond before 3 years
  let result = retentionDue(docs, batchEndedAt + 3 * YEAR_MS - 1);
  assert.deepEqual(result.delete, []);
  assert.deepEqual(result.pseudonymise, []);

  // Exactly at 3 years
  result = retentionDue(docs, batchEndedAt + 3 * YEAR_MS);
  assert.deepEqual(result.delete, []);
  assert.deepEqual(result.pseudonymise, ['g1']);
});

test('AC-56 grade with null batchEndedAt is never pseudonymised', () => {
  const docs = [
    { id: 'g1', type: 'grade', createdAt: 0, batchEndedAt: null, resultsAt: null },
  ];

  const result = retentionDue(docs, 10 * YEAR_MS);
  assert.deepEqual(result.delete, []);
  assert.deepEqual(result.pseudonymise, []);
});

test('AC-56 certificates pseudonymise 3 years after batchEndedAt, never delete', () => {
  const batchEndedAt = 2000;
  const docs = [
    { id: 'cert1', type: 'certificate', createdAt: 0, batchEndedAt, resultsAt: null },
  ];

  // Exactly at 3 years
  const result = retentionDue(docs, batchEndedAt + 3 * YEAR_MS);
  assert.deepEqual(result.delete, []);
  assert.deepEqual(result.pseudonymise, ['cert1']);
});

test('AC-56 mixed doc types', () => {
  const now = 1000 + 180 * DAY_MS + 365 * DAY_MS + 3 * YEAR_MS;
  const docs = [
    { id: 'i1', type: 'integrity', createdAt: 0, batchEndedAt: null, resultsAt: 1000 },
    { id: 'c1', type: 'chat', createdAt: 1000, batchEndedAt: null, resultsAt: null },
    { id: 'cn1', type: 'container', createdAt: 0, batchEndedAt: 1000, resultsAt: null },
    { id: 'g1', type: 'grade', createdAt: 0, batchEndedAt: 1000, resultsAt: null },
    { id: 'cert1', type: 'certificate', createdAt: 0, batchEndedAt: 1000, resultsAt: null },
  ];

  const result = retentionDue(docs, now);
  assert.deepEqual(result.delete.sort(), ['i1', 'c1', 'cn1'].sort());
  assert.deepEqual(result.pseudonymise.sort(), ['g1', 'cert1'].sort());
});

test('AC-56 boundary conditions', () => {
  const docs = [
    { id: 'i1', type: 'integrity', createdAt: 0, batchEndedAt: null, resultsAt: 1000 },
  ];

  // Just before the boundary
  let result = retentionDue(docs, 1000 + 180 * DAY_MS - 1);
  assert.equal(result.delete.length, 0);

  // Just after the boundary
  result = retentionDue(docs, 1000 + 180 * DAY_MS + 1);
  assert.deepEqual(result.delete, ['i1']);
});
