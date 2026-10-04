// AC-17, AC-18
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pace, parseScriptSections, scriptTotalSec } from '../src/index.ts';

test('AC-17 pace calculation with two sections', () => {
  const sections = [
    { id: 'section1', plannedSec: 600 },
    { id: 'section2', plannedSec: 600 },
  ];
  // Times in milliseconds
  const events = [
    { sectionId: 'section1', at: 0 },
    { sectionId: 'section2', at: 720_000 },
  ];
  const now = 900_000;

  const result = pace(sections, events, now);

  // First section: entered at 0ms, left at 720000ms
  // actualSec = (720000 - 0) / 1000 = 720 seconds
  // deltaSec = 720 - 600 = 120
  assert.deepEqual(result.perSection[0], {
    id: 'section1',
    actualSec: 720,
    deltaSec: 120,
  });

  // Second section: entered at 720000ms, at now=900000ms still in progress
  // actualSec = (900000 - 720000) / 1000 = 180 seconds
  // deltaSec = 180 - 600 = -420
  assert.deepEqual(result.perSection[1], {
    id: 'section2',
    actualSec: 180,
    deltaSec: -420,
  });

  // Current section is section2
  assert.equal(result.currentId, 'section2');

  // behindSec = sum of positive deltas only = 120
  assert.equal(result.behindSec, 120);
});

test('AC-17 sections never entered have null', () => {
  const sections = [
    { id: 'a', plannedSec: 600 },
    { id: 'b', plannedSec: 600 },
    { id: 'c', plannedSec: 600 },
  ];
  const events = [
    { sectionId: 'a', at: 0 },
    { sectionId: 'b', at: 720_000 },
    // c never entered
  ];
  const now = 900_000;

  const result = pace(sections, events, now);

  // c never entered
  assert.equal(result.perSection[2].actualSec, null);
  assert.equal(result.perSection[2].deltaSec, null);
});

test('AC-18 parseScriptSections extracts headings with time ranges', () => {
  const markdown = `# Instructor script
## Introduction (0:00 — 0:05)
Some content

## Faulty first (0:05 — 0:20)
More content

## Graded exam [graded] (0:20 — 0:30)
Exam content

## No time range heading
This should be ignored

## Break (1:15 — 1:30)
Break time
`;

  const result = parseScriptSections(markdown);

  assert.equal(result.length, 4);

  // Check first section
  assert.equal(result[0].title, 'Introduction');
  assert.equal(result[0].plannedSec, 300); // 5 minutes = 300 seconds
  assert.equal(result[0].graded, false);

  // Check second section
  assert.equal(result[1].title, 'Faulty first');
  assert.equal(result[1].plannedSec, 900); // 15 minutes = 900 seconds
  assert.equal(result[1].graded, false);

  // Check graded section
  assert.equal(result[2].title, 'Graded exam');
  assert.equal(result[2].plannedSec, 600); // 10 minutes = 600 seconds
  assert.equal(result[2].graded, true);

  // Check break section (from 1:15 to 1:30 = 75 to 90 minutes = 15 min = 900 sec)
  assert.equal(result[3].title, 'Break');
  assert.equal(result[3].plannedSec, 900);
  assert.equal(result[3].graded, false);
});

test('AC-18 parseScriptSections ignores headings without time ranges', () => {
  const markdown = `## With time (0:00 — 0:10)
Content

## Without time
This should be ignored

## Also with time (0:10 — 0:20)
More content
`;

  const result = parseScriptSections(markdown);

  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'With time');
  assert.equal(result[1].title, 'Also with time');
});

test('AC-18 parseScriptSections creates slugs for ids', () => {
  const markdown = `## Introduction to Loops (0:00 — 0:10)
Content

## Break - 5 minutes (0:10 — 0:15)
Content
`;

  const result = parseScriptSections(markdown);

  assert.equal(result[0].id, 'introduction-to-loops');
  assert.equal(result[1].id, 'break-5-minutes');
});

test('scriptTotalSec extracts runtime from markdown', () => {
  const markdown1 = `# Instructor script
### Total runtime: **45 minutes**

Content...
`;

  assert.equal(scriptTotalSec(markdown1), 2700); // 45 * 60

  const markdown2 = `# Instructor script
Total runtime: **2 hours**

Content...
`;

  assert.equal(scriptTotalSec(markdown2), 7200); // 2 * 3600

  const markdown3 = `# Instructor script
No runtime info
`;

  assert.equal(scriptTotalSec(markdown3), null);
});

test('AC-18 parseScriptSections handles bold markers in headings', () => {
  const markdown = `## **Break (0:15 — 0:30)**
Content here
`;

  const result = parseScriptSections(markdown);

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Break');
  assert.equal(result[0].plannedSec, 900); // 15 minutes
});

test('AC-18 parseScriptSections handles en dash and hyphen', () => {
  const markdown1 = `## Section (0:00 — 0:10)
Content`;
  const markdown2 = `## Section (0:00 – 0:10)
Content`;
  const markdown3 = `## Section (0:00 - 0:10)
Content`;

  const result1 = parseScriptSections(markdown1);
  const result2 = parseScriptSections(markdown2);
  const result3 = parseScriptSections(markdown3);

  assert.equal(result1.length, 1);
  assert.equal(result2.length, 1);
  assert.equal(result3.length, 1);
  assert.equal(result1[0].plannedSec, 600);
  assert.equal(result2[0].plannedSec, 600);
  assert.equal(result3[0].plannedSec, 600);
});
