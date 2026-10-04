// Plan vs actual re-flow (SPEC §4.23)

export function reflow(
  plan: readonly { dayIndex: number; topics: string[] }[],
  covered: Record<number, string[]>,
  throughDay: number,
): {
  plan: { dayIndex: number; topics: string[] }[];
  moved: { topic: string; from: number; to: number }[];
} {
  const moved: { topic: string; from: number; to: number }[] = [];
  const newPlan = plan.map((day) => ({ ...day, topics: [...day.topics] }));

  // Create a set of covered topics for quick lookup
  const coveredTopics = new Set<string>();
  for (const dayTopics of Object.values(covered)) {
    for (const topic of dayTopics) {
      coveredTopics.add(topic);
    }
  }

  // Collect uncovered topics from days up to throughDay
  const uncoveredTopics: string[] = [];
  for (const day of newPlan) {
    if (day.dayIndex <= throughDay) {
      day.topics = day.topics.filter((topic) => {
        if (!coveredTopics.has(topic)) {
          uncoveredTopics.push(topic);
          moved.push({ topic, from: day.dayIndex, to: throughDay + 1 });
          return false;
        }
        return true;
      });
    }
  }

  // Add uncovered topics to the start of day throughDay + 1
  if (uncoveredTopics.length > 0) {
    const nextDayIndex = throughDay + 1;
    const nextDay = newPlan.find((day) => day.dayIndex === nextDayIndex);

    if (nextDay) {
      nextDay.topics = [...uncoveredTopics, ...nextDay.topics];
    } else {
      newPlan.push({ dayIndex: nextDayIndex, topics: uncoveredTopics });
    }
  }

  // Sort the plan by dayIndex
  newPlan.sort((a, b) => a.dayIndex - b.dayIndex);

  return { plan: newPlan, moved };
}
