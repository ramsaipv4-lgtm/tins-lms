// AC-35, AC-36
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRules, applyParseRules } from '../src/index.ts';

test('AC-35 diet screenshot extraction', () => {
  const rules = {
    app: 'diet',
    fields: [
      { name: 'calories', anchor: 'calories', pick: 'same-line-number' },
      { name: 'protein', anchor: 'protein', pick: 'same-line-number' },
    ],
  };

  const lines = ['Calories: 1,850', 'Protein: 72.5g'];
  const result = applyParseRules(lines, rules);

  assert.deepEqual(result.calories, { value: 1850, line: 0 });
  assert.deepEqual(result.protein, { value: 72.5, line: 1 });
});

test('AC-35 expense screenshot extraction', () => {
  const rules = {
    app: 'expense',
    fields: [
      { name: 'amount', anchor: 'amount', pick: 'same-line-number' },
    ],
  };

  const lines = ['Amount: ₹1,234.50'];
  const result = applyParseRules(lines, rules);

  assert.deepEqual(result.amount, { value: 1234.5, line: 0 });
});

test('AC-35 missing field extraction', () => {
  const rules = {
    app: 'diet',
    fields: [
      { name: 'calories', anchor: 'calories', pick: 'same-line-number' },
      { name: 'missing', anchor: 'notfound', pick: 'same-line-number' },
    ],
  };

  const lines = ['Calories: 1,850'];
  const result = applyParseRules(lines, rules);

  assert.deepEqual(result.missing, { value: null, line: null });
});

test('AC-36 validate rules - anchor too long', () => {
  const longAnchor = 'a'.repeat(201);
  const rules = {
    app: 'test',
    fields: [
      { name: 'field1', anchor: longAnchor, pick: 'same-line-number' },
    ],
  };

  const problems = validateRules(rules);
  assert.ok(problems.some((p) => p.includes('anchor longer than 200')));
});

test('AC-36 validate rules - invalid regex', () => {
  const rules = {
    app: 'test',
    fields: [
      { name: 'field1', anchor: '[invalid(regex', pick: 'same-line-number' },
    ],
  };

  const problems = validateRules(rules);
  assert.ok(problems.some((p) => p.includes('invalid regex')));
});

test('AC-36 validate rules - duplicate field name', () => {
  const rules = {
    app: 'test',
    fields: [
      { name: 'field1', anchor: 'anchor1', pick: 'same-line-number' },
      { name: 'field1', anchor: 'anchor2', pick: 'same-line-number' },
    ],
  };

  const problems = validateRules(rules);
  assert.ok(problems.some((p) => p.includes('duplicate')));
});
