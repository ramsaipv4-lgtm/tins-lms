// AC-55
import test from 'node:test';
import assert from 'node:assert/strict';
import { dropPlan, undoDropPlan } from '../src/index.ts';

test('AC-55 dropPlan lists exactly that person\'s tickets and reviews and their team', () => {
  const classState = {
    tickets: [
      { id: 'T1', assignee: 'alice' },
      { id: 'T2', assignee: 'bob' },
      { id: 'T3', assignee: 'alice' },
      { id: 'T4', assignee: null },
    ],
    reviews: [
      { id: 'R1', reviewer: 'alice' },
      { id: 'R2', reviewer: 'carol' },
      { id: 'R3', reviewer: 'alice' },
    ],
    teams: {
      'team-1': ['alice', 'bob'],
      'team-2': ['carol', 'david'],
    },
  };

  const plan = dropPlan(classState, 'alice');

  // Should list exactly alice's tickets and reviews
  assert.deepEqual(plan.unassignTickets, ['T1', 'T3']);
  assert.deepEqual(plan.reassignReviews, ['R1', 'R3']);
  assert.equal(plan.removeFromTeam, 'team-1');
  assert.equal(plan.archiveRepos, true);
  assert.equal(plan.stopBots, true);
});

test('AC-55 dropPlan handles person with no team', () => {
  const classState = {
    tickets: [
      { id: 'T1', assignee: 'alice' },
    ],
    reviews: [
      { id: 'R1', reviewer: 'alice' },
    ],
    teams: {
      'team-1': ['bob', 'carol'],
    },
  };

  const plan = dropPlan(classState, 'alice');

  assert.deepEqual(plan.unassignTickets, ['T1']);
  assert.deepEqual(plan.reassignReviews, ['R1']);
  assert.equal(plan.removeFromTeam, null);
});

test('AC-55 dropPlan handles person with no assignments', () => {
  const classState = {
    tickets: [
      { id: 'T1', assignee: 'bob' },
    ],
    reviews: [
      { id: 'R1', reviewer: 'carol' },
    ],
    teams: {
      'team-1': ['alice', 'bob'],
    },
  };

  const plan = dropPlan(classState, 'alice');

  assert.deepEqual(plan.unassignTickets, []);
  assert.deepEqual(plan.reassignReviews, []);
  assert.equal(plan.removeFromTeam, 'team-1');
});

test('AC-55 undoDropPlan restores team, repos and bots but not tickets', () => {
  const plan = {
    unassignTickets: ['T1', 'T3'],
    reassignReviews: ['R1', 'R3'],
    removeFromTeam: 'team-1',
    archiveRepos: true,
    stopBots: true,
  };

  const undo = undoDropPlan(plan);

  assert.equal(undo.restoreTeam, 'team-1');
  assert.equal(undo.restoreRepos, true);
  assert.equal(undo.resumeBots, true);
  assert(!undo.hasOwnProperty('unassignTickets'));
  assert(!undo.hasOwnProperty('reassignReviews'));
});

test('AC-55 undoDropPlan with null team', () => {
  const plan = {
    unassignTickets: ['T1'],
    reassignReviews: ['R1'],
    removeFromTeam: null,
    archiveRepos: true,
    stopBots: true,
  };

  const undo = undoDropPlan(plan);

  assert.equal(undo.restoreTeam, null);
  assert.equal(undo.restoreRepos, true);
  assert.equal(undo.resumeBots, true);
});
