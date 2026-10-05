// Unit tests for b7-8: AC-156 plan rules, AC-94 field mapping, AC-162 portfolio template, AC-168 Heading Strike and the wall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DOMAINS, GOALS_PER_DOMAIN, adoptedChanges, buildPlan, defaultAnswers, finishDate, goalKeys, hoursFor, nextVersion,
  pathwayCards, suggestedPitfalls, validAnswers, withDomain,
} from '../src/features/coach/plan.ts';
import { bestRules, kindOfFields, parseNumber } from '../src/features/coach/fields.ts';
import { ROUND_SIZE, buildRound, score } from '../src/features/coach/strike.ts';
import { pinProblem } from '../src/features/coach/lib.ts';
import { portfolioHtml, tessdataPath } from '../../server/src/routes/features/coach.ts';

const strings = JSON.parse(readFileSync(new URL('../src/features/coach/strings.en.json', import.meta.url), 'utf8'));

test('AC-156 every domain offers 3 to 5 measurable goals and each goal string exists', () => {
  for (const d of DOMAINS) {
    const keys = goalKeys(d);
    assert.ok(keys.length >= 3 && keys.length <= 5);
    assert.equal(keys.length, GOALS_PER_DOMAIN);
    for (const k of keys) assert.ok(strings[k], k);
  }
});

test('AC-156 defaults are a valid answer set, so "accept defaults" always reaches a plan', () => {
  const a = defaultAnswers();
  assert.ok(validAnswers(a));
  const plan = buildPlan(a, 1, Date.UTC(2026, 10, 2), null);
  assert.equal(plan.version, 1);
  assert.deepEqual(plan.adopted, []);
  assert.equal(plan.hoursPerWeek, 8);
});

test('AC-156 the plan is versioned: changes against the previous answers are named', () => {
  const v1 = buildPlan(defaultAnswers(), 1, 0, null);
  const changed = { ...v1.answers, pathway: 'intense', modifiers: ['evenings'] };
  const v2 = buildPlan(changed, nextVersion([v1.version]), 0, v1.answers);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.adopted, ['pathway', 'modifiers']);
  assert.equal(nextVersion([]), 1);
  assert.equal(nextVersion([1, 3, 2]), 4);
});

test('AC-156 pathway cards: light < standard < intense hours, later finish for fewer hours', () => {
  const cards = pathwayCards(8, Date.UTC(2026, 10, 2));
  assert.deepEqual(cards.map((c) => c.id), ['light', 'standard', 'intense']);
  assert.ok(cards[0].hoursPerWeek < cards[1].hoursPerWeek && cards[1].hoursPerWeek < cards[2].hoursPerWeek);
  assert.ok(cards[0].finishDate > cards[2].finishDate);
  assert.equal(finishDate(9, 0), '1970-03-12'); // 90 h / 9 h a week = 10 weeks
  assert.equal(hoursFor('light', 1), 1);
  assert.equal(hoursFor('intense', 100), 40);
});

test('AC-156 changing the domain resets only the goal; low energy pre-ticks a pitfall', () => {
  const a = { ...defaultAnswers(), hours: 12 };
  const b = withDomain(a, 'money');
  assert.equal(b.goal, goalKeys('money')[0]);
  assert.equal(b.hours, 12);
  assert.deepEqual(suggestedPitfalls('low'), ['skipMorning']);
  assert.deepEqual(adoptedChanges(null, defaultAnswers()), []);
});

test('AC-156 / F-05 PIN rules: digits only, at least four', () => {
  assert.equal(pinProblem('12'), 'short');
  assert.equal(pinProblem('12a4'), 'digits');
  assert.equal(pinProblem('1234'), null);
});

test('AC-94 rules read the diet screenshot lines and the person confirms; expense maps to money', () => {
  const rules = [
    { app: 'synthetic-diet', fields: [{ name: 'calories', anchor: '^calories\\b', pick: 'same-line-number' }, { name: 'protein', anchor: '^protein\\b', pick: 'same-line-number' }] },
    { app: 'expense', fields: [{ name: 'amount', anchor: '^amount\\b', pick: 'same-line-number' }] },
  ];
  const lines = ['Diet diary', 'Calories 1,850', 'Protein 72.5 g'];
  const best = bestRules(lines, rules);
  assert.equal(best.rules.app, 'synthetic-diet');
  assert.equal(best.found, 2);
  assert.equal(kindOfFields(['calories', 'protein']), 'food');
  assert.equal(kindOfFields(['amount']), 'money');
  assert.equal(kindOfFields(['whatever']), 'note');
  assert.equal(parseNumber('1,234.50'), 1234.5);
  assert.equal(parseNumber('abc'), null);
});

test('AC-94 OCR data comes from the hub: only a hub folder is searched, nothing from a CDN', () => {
  assert.equal(tessdataPath('/nonexistent-root', '/nonexistent-data', {}), null);
});

test('AC-162 portfolio template lists repos, badges and certificates and escapes user text', () => {
  const html = portfolioHtml({
    name: '<b>Asha</b>', org: 'Org', primary: '#123456', text: 'red;}',
    repos: [{ label: 'repo "one"', url: 'https://example.org/a' }],
    badges: [{ name: 'First merged PR', team: 'team-a' }],
    certificates: [{ certId: '7KQ2M9X4TB1R', programName: 'Program' }],
  });
  assert.match(html, /&lt;b&gt;Asha&lt;\/b&gt;/);
  assert.match(html, /First merged PR/);
  assert.match(html, /\/verify\/7KQ2M9X4TB1R/);
  assert.match(html, /repo &quot;one&quot;/);
  assert.doesNotMatch(html, /red;}/); // an invalid brand colour falls back to the default
  assert.match(portfolioHtml({ name: 'x', org: 'o', primary: '', text: '', repos: [], badges: [], certificates: [] }), /No repositories yet/);
});

test('AC-168 Heading Strike rounds are seeded, have exactly one real heading each and score correctly', () => {
  const a = buildRound('seed-1'), b = buildRound('seed-1'), c = buildRound('seed-2');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, ROUND_SIZE);
  for (const q of a) {
    assert.equal(q.options.filter((o) => /^#{1,3} \S/.test(o)).length, 1);
    assert.match(q.options[q.answer], /^#{1,3} \S/);
  }
  assert.equal(score(a, a.map((q) => q.answer)), ROUND_SIZE);
  assert.equal(score(a, a.map(() => null)), 0);
});

test('AC-156 AC-94 AC-162 AC-168 strings: every key is namespaced and every plan string exists', () => {
  for (const k of Object.keys(strings)) assert.match(k, /^coach\./);
  for (const id of ['light', 'standard', 'intense']) assert.ok(strings[`coach.pathway.${id}.tradeoff`]);
  for (const id of ['lateScroll', 'skipMorning', 'tooMuch', 'noTime']) assert.ok(strings[`coach.pitfall.${id}.fix`]);
});
