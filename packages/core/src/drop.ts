// Dropping a learner (SPEC §4.30)

export type DropPlan = {
  unassignTickets: string[];
  reassignReviews: string[];
  removeFromTeam: string | null;
  archiveRepos: true;
  stopBots: true;
};

export function dropPlan(
  classState: {
    tickets: { id: string; assignee: string | null }[];
    reviews: { id: string; reviewer: string }[];
    teams: Record<string, string[]>;
  },
  personId: string
): DropPlan {
  // Find all tickets assigned to this person
  const unassignTickets = classState.tickets
    .filter((ticket) => ticket.assignee === personId)
    .map((ticket) => ticket.id);

  // Find all reviews assigned to this person
  const reassignReviews = classState.reviews
    .filter((review) => review.reviewer === personId)
    .map((review) => review.id);

  // Find which team (if any) this person is in
  let removeFromTeam: string | null = null;
  for (const [teamId, members] of Object.entries(classState.teams)) {
    if (members.includes(personId)) {
      removeFromTeam = teamId;
      break;
    }
  }

  return {
    unassignTickets,
    reassignReviews,
    removeFromTeam,
    archiveRepos: true,
    stopBots: true,
  };
}

export type UndoDropPlanResult = {
  restoreTeam: string | null;
  restoreRepos: true;
  resumeBots: true;
};

export function undoDropPlan(plan: DropPlan): UndoDropPlanResult {
  return {
    restoreTeam: plan.removeFromTeam,
    restoreRepos: true,
    resumeBots: true,
  };
}
