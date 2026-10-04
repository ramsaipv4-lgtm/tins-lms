import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchDefaults, isOn } from '../src/switches.ts';

test('switchDefaults returns correct table', () => {
  const defaults = switchDefaults();
  const expected = {
    secretScan: true,
    planVsActual: false,
    pairProgramming: false,
    googleForms: false,
    storyMode: false,
    teamBadges: true,
    githubPass: true,
    printedQrFallback: true,
    certificates: true,
    diskEncryptionCheck: false,
    calendarSync: false,
    explainBackAi: false,
    meetLinks: false,
    headingStrike: true,
    celebrationWall: true,
    jira: false,
    voiceFollow: false,
    gradedShifts: true,
  };
  assert.deepEqual(defaults, expected);
});

test('isOn returns default when no layers provided', () => {
  const defaults = switchDefaults();
  for (const [key, value] of Object.entries(defaults)) {
    assert.equal(isOn(key, {}), value);
  }
});

test('isOn respects org layer', () => {
  const layers = {
    org: { secretScan: false, planVsActual: true },
  };
  assert.equal(isOn('secretScan', layers), false);
  assert.equal(isOn('planVsActual', layers), true);
});

test('isOn respects program layer', () => {
  const layers = {
    program: { secretScan: false },
  };
  assert.equal(isOn('secretScan', layers), false);
});

test('isOn respects class layer', () => {
  const layers = {
    class: { secretScan: false },
  };
  assert.equal(isOn('secretScan', layers), false);
});

test('isOn precedence: class > program > org > default', () => {
  const layers = {
    org: { secretScan: true },
    program: { secretScan: false },
    class: { secretScan: true },
  };
  assert.equal(isOn('secretScan', layers), true);
});

test('isOn precedence: program > org > default', () => {
  const layers = {
    org: { secretScan: true },
    program: { secretScan: false },
  };
  assert.equal(isOn('secretScan', layers), false);
});

test('isOn precedence: org > default', () => {
  const defaults = switchDefaults();
  const defaultValue = defaults.planVsActual;
  const layers = {
    org: { planVsActual: !defaultValue },
  };
  assert.equal(isOn('planVsActual', layers), !defaultValue);
});

test('isOn throws on unknown switch name', () => {
  assert.throws(() => isOn('unknownSwitch', {}), (err) => {
    return err.message.includes('Unknown switch');
  });
});

test('isOn throws on any unknown switch', () => {
  assert.throws(() => isOn('notASwitch', { class: {} }));
  assert.throws(() => isOn('invalidName', { program: {} }));
  assert.throws(() => isOn('typo', { org: {} }));
});

test('AC-49: all switches have correct defaults', () => {
  const defaults = switchDefaults();
  const keys = Object.keys(defaults);
  assert.ok(keys.includes('secretScan'));
  assert.ok(keys.includes('planVsActual'));
  assert.ok(keys.includes('headingStrike'));
  assert.ok(keys.includes('gradedShifts'));
  assert.equal(defaults.secretScan, true);
  assert.equal(defaults.planVsActual, false);
  assert.equal(defaults.headingStrike, true);
  assert.equal(defaults.gradedShifts, true);
});
