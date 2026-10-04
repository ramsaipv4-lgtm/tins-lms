// Teleprompter pacing and script parsing (§4.8)

// Helper function to convert time string to seconds
// Input: "h:mm" format (e.g., "1:23" = 83 seconds, "0:15" = 15 seconds)
function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 3600 + minutes * 60;
}

// Helper function to create a slug from text
// Lowercase, replace runs of non-alphanumerics with single dash, trim dashes
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PaceSection {
  id: string;
  plannedSec: number;
}

export interface PaceEvent {
  sectionId: string;
  at: number;
}

export interface PacePerSection {
  id: string;
  actualSec: number | null;
  deltaSec: number | null;
}

export interface PaceResult {
  perSection: PacePerSection[];
  currentId: string | null;
  behindSec: number;
}

export function pace(
  sections: readonly PaceSection[],
  events: readonly PaceEvent[],
  now: number
): PaceResult {
  // Convert milliseconds to seconds for calculations
  const nowSec = now / 1000;
  const eventMap = new Map(events.map((e) => [e.sectionId, e.at / 1000]));
  const perSection: PacePerSection[] = [];
  let currentId: string | null = null;
  let behindSec = 0;

  // Create list of entry times in order
  const eventsByTime = [...events]
    .map((e) => ({ ...e, at: e.at / 1000 }))
    .sort((a, b) => a.at - b.at);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const enteredAt = eventMap.get(section.id);

    if (enteredAt === undefined) {
      // Section never entered
      perSection.push({
        id: section.id,
        actualSec: null,
        deltaSec: null,
      });
    } else {
      // Find the next section that was entered
      const nextEventIndex = eventsByTime.findIndex((e) => e.at > enteredAt);
      let actualSec: number;

      if (nextEventIndex === -1) {
        // No section entered after this one
        currentId = section.id;
        actualSec = nowSec - enteredAt;
      } else {
        // Next section was entered at this time
        actualSec = eventsByTime[nextEventIndex].at - enteredAt;
      }

      const deltaSec = actualSec - section.plannedSec;
      perSection.push({
        id: section.id,
        actualSec,
        deltaSec,
      });
    }
  }

  // Calculate total behindSec: sum of positive deltas only
  behindSec = 0;
  for (const sec of perSection) {
    if (sec.deltaSec !== null && sec.deltaSec > 0) {
      behindSec += sec.deltaSec;
    }
  }

  return { perSection, currentId, behindSec };
}

export interface ParsedSection {
  id: string;
  title: string;
  plannedSec: number;
  graded: boolean;
}

export function parseScriptSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match lines like: ## Title (h:mm — h:mm)
    // Or with [graded] marker
    // Handle em dash (—), en dash (–), and regular hyphen (-)
    const match = line.match(
      /^#+\s+\*{0,2}(.+?)\*{0,2}\s*\((\d+):(\d{2})\s*[—–-]\s*(\d+):(\d{2})\)(.*)/
    );

    if (!match) continue;

    let title = match[1].trim();
    const startHour = parseInt(match[2], 10);
    const startMin = parseInt(match[3], 10);
    const endHour = parseInt(match[4], 10);
    const endMin = parseInt(match[5], 10);
    const trailing = match[6];

    // Check for [graded] marker
    const graded = title.includes('[graded]') || trailing.includes('[graded]');

    // Remove [graded] from title
    title = title
      .replace(/\s*\[graded\]\s*/gi, ' ')
      .trim();

    // Also remove trailing [graded]
    title = title.replace(/\s*\[graded\]\s*/gi, ' ').trim();

    const startSeconds = startHour * 3600 + startMin * 60;
    const endSeconds = endHour * 3600 + endMin * 60;
    const plannedSec = endSeconds - startSeconds;

    const id = slugify(title);

    sections.push({
      id,
      title,
      plannedSec,
      graded,
    });
  }

  return sections;
}

export function scriptTotalSec(markdown: string): number | null {
  // Look for lines like:
  // "Total runtime: **45 minutes**"
  // "### Total runtime: **2 hours**"
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/Total\s+runtime:\s*\*{0,2}(\d+)\s+(hours?|minutes?)\*{0,2}/i);
    if (!match) continue;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('hour')) {
      return value * 3600;
    } else if (unit.startsWith('minute')) {
      return value * 60;
    }
  }

  return null;
}
