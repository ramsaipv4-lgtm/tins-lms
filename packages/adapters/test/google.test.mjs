import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { createGoogleAdapter } from '../src/google.ts';

const testToken = 'test-access-token';
const testCalendarId = 'test-calendar@google.com';

// === Meet Link Creation Tests ===
test('createMeetLink with switch on', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/v2/spaces' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          meetingUri: 'https://meet.google.com/abc-defg-hij',
        }));
      });
    }
  });

  await new Promise((resolve) => server.listen(3010, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3010', calendar: 'http://localhost:3010', forms: 'http://localhost:3010' },
      accessToken: testToken,
      switches: { meetLinks: true },
    });

    const result = await adapter.createMeetLink({ title: 'Test Meeting' });
    assert.equal(result.url, 'https://meet.google.com/abc-defg-hij', 'should return meet link');
  } finally {
    server.close();
  }
});

test('createMeetLink with switch off', async () => {
  const server = createServer((req, res) => {
    res.writeHead(500);
    res.end('Should not be called');
  });

  await new Promise((resolve) => server.listen(3011, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3011', calendar: 'http://localhost:3011', forms: 'http://localhost:3011' },
      accessToken: testToken,
      switches: { meetLinks: false },
    });

    try {
      await adapter.createMeetLink({ title: 'Test Meeting' });
      assert.fail('should throw when switch is off');
    } catch (e) {
      assert(e.message.includes('meetLinks'), 'error should mention the switch name');
    }
  } finally {
    server.close();
  }
});

test('createMeetLink defaults to off (when switch not specified)', async () => {
  const server = createServer((req, res) => {
    res.writeHead(500);
    res.end('Should not be called');
  });

  await new Promise((resolve) => server.listen(3012, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3012', calendar: 'http://localhost:3012', forms: 'http://localhost:3012' },
      accessToken: testToken,
      switches: {}, // meetLinks not specified, should default to off
    });

    try {
      await adapter.createMeetLink({ title: 'Test Meeting' });
      assert.fail('should throw when switch not specified (defaults to off)');
    } catch (e) {
      assert(e.message.includes('meetLinks'), 'error should mention the switch name');
    }
  } finally {
    server.close();
  }
});

// === Calendar Sync Tests ===
test('syncCalendar with switch on', async () => {
  let requestCount = 0;

  const server = createServer((req, res) => {
    if (req.url.includes('/calendar/v3/calendars/') && req.method === 'POST') {
      requestCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'event-' + requestCount }));
    }
  });

  await new Promise((resolve) => server.listen(3013, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3013', calendar: 'http://localhost:3013', forms: 'http://localhost:3013' },
      accessToken: testToken,
      switches: { calendarSync: true },
    });

    const now = Date.now();
    const result = await adapter.syncCalendar({
      calendarId: testCalendarId,
      events: [
        { id: 'evt1', title: 'Event 1', start: now, end: now + 3600000, timezone: 'UTC' },
        { id: 'evt2', title: 'Event 2', start: now + 7200000, end: now + 10800000, timezone: 'UTC' },
      ],
    });

    assert.equal(result.synced, 2, 'should sync both events');
  } finally {
    server.close();
  }
});

test('syncCalendar with switch off', async () => {
  const server = createServer((req, res) => {
    res.writeHead(500);
    res.end('Should not be called');
  });

  await new Promise((resolve) => server.listen(3014, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3014', calendar: 'http://localhost:3014', forms: 'http://localhost:3014' },
      accessToken: testToken,
      switches: { calendarSync: false },
    });

    try {
      await adapter.syncCalendar({
        calendarId: testCalendarId,
        events: [],
      });
      assert.fail('should throw when switch is off');
    } catch (e) {
      assert(e.message.includes('calendarSync'), 'error should mention the switch name');
    }
  } finally {
    server.close();
  }
});

// === Quiz Export Tests ===
test('exportQuiz with switch on', async () => {
  let formId = 'form-123';
  let createFormCalled = false;
  let batchUpdateCalled = false;
  let publishCalled = false;

  const server = createServer((req, res) => {
    if (req.url === '/v1/forms' && req.method === 'POST') {
      createFormCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        formId: formId,
        responderUri: 'https://forms.google.com/d/e/1FAIpQLSc...',
      }));
    } else if (req.url.includes(':batchUpdate') && req.method === 'POST') {
      batchUpdateCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    } else if (req.url.includes(':setPublishSettings') && req.method === 'POST') {
      publishCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    }
  });

  await new Promise((resolve) => server.listen(3015, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3015', calendar: 'http://localhost:3015', forms: 'http://localhost:3015' },
      accessToken: testToken,
      switches: { googleForms: true },
    });

    const result = await adapter.exportQuiz({
      title: 'Test Quiz',
      questions: [
        { text: 'Q1', choices: ['A', 'B', 'C'], answerIndex: 0 },
        { text: 'Q2', choices: ['Yes', 'No'], answerIndex: 1 },
      ],
    });

    assert(createFormCalled, 'should create form');
    assert(batchUpdateCalled, 'should add questions');
    assert(publishCalled, 'should publish form');
    assert.equal(result.formId, formId, 'should return form ID');
    assert.equal(result.published, true, 'should be published');
    assert(result.responderUri.includes('forms.google.com'), 'should have responder URI');
  } finally {
    server.close();
  }
});

test('exportQuiz with switch off', async () => {
  const server = createServer((req, res) => {
    res.writeHead(500);
    res.end('Should not be called');
  });

  await new Promise((resolve) => server.listen(3016, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3016', calendar: 'http://localhost:3016', forms: 'http://localhost:3016' },
      accessToken: testToken,
      switches: { googleForms: false },
    });

    try {
      await adapter.exportQuiz({
        title: 'Test Quiz',
        questions: [],
      });
      assert.fail('should throw when switch is off');
    } catch (e) {
      assert(e.message.includes('googleForms'), 'error should mention the switch name');
    }
  } finally {
    server.close();
  }
});

// === Combined test with multiple methods ===
test('multiple adapters with different switch states', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url === '/v2/spaces') {
      res.end(JSON.stringify({ meetingUri: 'https://meet.google.com/test' }));
    } else if (req.url.includes('/calendar/v3/calendars/')) {
      res.end(JSON.stringify({ id: 'event-1' }));
    } else if (req.url === '/v1/forms') {
      res.end(JSON.stringify({ formId: 'form-1', responderUri: 'https://forms.google.com/d/e/...' }));
    } else {
      res.end(JSON.stringify({}));
    }
  });

  await new Promise((resolve) => server.listen(3017, resolve));

  try {
    const adapter = createGoogleAdapter({
      baseUrls: { meet: 'http://localhost:3017', calendar: 'http://localhost:3017', forms: 'http://localhost:3017' },
      accessToken: testToken,
      switches: { meetLinks: true, calendarSync: false, googleForms: true },
    });

    // Meet should work
    const meetResult = await adapter.createMeetLink({ title: 'Test' });
    assert(meetResult.url, 'meet should work with switch on');

    // Calendar should fail
    try {
      const now = Date.now();
      await adapter.syncCalendar({
        calendarId: testCalendarId,
        events: [{ id: 'e1', title: 'E1', start: now, end: now + 3600000, timezone: 'UTC' }],
      });
      assert.fail('calendar should fail with switch off');
    } catch (e) {
      assert(e.message.includes('calendarSync'), 'should mention calendarSync');
    }

    // Forms should work
    const formsResult = await adapter.exportQuiz({
      title: 'Test',
      questions: [{ text: 'Q', choices: ['A'], answerIndex: 0 }],
    });
    assert(formsResult.formId, 'forms should work with switch on');
  } finally {
    server.close();
  }
});
