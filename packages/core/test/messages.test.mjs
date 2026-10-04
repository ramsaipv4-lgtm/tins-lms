// AC-57
import test from 'node:test';
import assert from 'node:assert/strict';
import { waLink, copyAll } from '../src/index.ts';

test('AC-57 phone normalization and link generation', () => {
  const text = 'Hello World';

  // Test +91 prefix
  const link1 = waLink('+91 98765-43210', text);
  assert.ok(link1.includes('919876543210'));

  // Test leading 0
  const link2 = waLink('09876543210', text);
  assert.ok(link2.includes('919876543210'));

  // Test plain 10 digits
  const link3 = waLink('9876543210', text);
  assert.ok(link3.includes('919876543210'));

  // All three should be identical
  assert.equal(link1, link2);
  assert.equal(link2, link3);

  // Test with special characters in text
  const text2 = 'Price: $100 & more? Yes! 😊\nNext line';
  const link4 = waLink('9876543210', text2);
  assert.ok(link4.includes('https://wa.me/919876543210?text='));

  // Decode and verify
  const encoded = link4.split('?text=')[1];
  const decoded = decodeURIComponent(encoded);
  assert.equal(decoded, text2);
});

test('AC-57 invalid phone numbers throw', () => {
  // Too short
  assert.throws(() => waLink('9876543', 'test'), { message: /expected 10 digits/ });

  // Too long
  assert.throws(() => waLink('98765432100', 'test'), { message: /expected 10 digits/ });
});

test('AC-57 copyAll joins messages', () => {
  const messages = [
    { name: 'Alice', text: 'Hello' },
    { name: 'Bob', text: 'Hi there' },
    { name: 'Carol', text: 'Hey everyone' },
  ];

  const result = copyAll(messages);
  assert.equal(result, 'Alice:\nHello\n\nBob:\nHi there\n\nCarol:\nHey everyone');
});

test('AC-57 copyAll with empty array', () => {
  assert.equal(copyAll([]), '');
});

test('AC-57 copyAll with single message', () => {
  const result = copyAll([{ name: 'Alice', text: 'Hello' }]);
  assert.equal(result, 'Alice:\nHello');
});
