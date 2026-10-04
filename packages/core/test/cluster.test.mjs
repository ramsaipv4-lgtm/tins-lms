// AC-40
import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterSubmissions } from '../src/index.ts';

test('AC-40 same failing sets in different order cluster together', () => {
  const subs = [
    { id: 's1', failing: ['a', 'b'] },
    { id: 's2', failing: ['b', 'a'] },
    { id: 's3', failing: [] },
  ];

  const result = clusterSubmissions(subs);

  // s1 and s2 should be in the same cluster
  const abCluster = result.find((c) => c.signature.length === 2);
  assert.ok(abCluster);
  assert.deepEqual(abCluster.signature, ['a', 'b']);
  assert.deepEqual(new Set(abCluster.ids), new Set(['s1', 's2']));

  // s3 should be in its own cluster with empty signature
  const emptyCluster = result.find((c) => c.signature.length === 0);
  assert.ok(emptyCluster);
  assert.deepEqual(emptyCluster.ids, ['s3']);
});

test('AC-40 clusters sorted by size, every id appears once', () => {
  const subs = [
    { id: 's1', failing: ['a'] },
    { id: 's2', failing: ['b'] },
    { id: 's3', failing: ['b'] },
    { id: 's4', failing: ['b'] },
  ];

  const result = clusterSubmissions(subs);

  // Cluster with ['b'] should be first (size 3), then ['a'] (size 1)
  assert.equal(result[0].ids.length, 3);
  assert.deepEqual(result[0].signature, ['b']);
  assert.equal(result[1].ids.length, 1);
  assert.deepEqual(result[1].signature, ['a']);

  // Check every id appears exactly once
  const allIds = new Set();
  for (const cluster of result) {
    for (const id of cluster.ids) {
      assert.ok(!allIds.has(id), `id ${id} appears twice`);
      allIds.add(id);
    }
  }
  assert.equal(allIds.size, 4);
});
