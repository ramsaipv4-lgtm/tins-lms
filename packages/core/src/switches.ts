// Feature switches (SPEC §4.27)

export function switchDefaults(): Record<string, boolean> {
  return {
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
}

export function isOn(name: string, layers: { class?: Record<string, boolean>; program?: Record<string, boolean>; org?: Record<string, boolean> }): boolean {
  const defaults = switchDefaults();

  // Check if the name exists in defaults, throw if not
  if (!(name in defaults)) {
    throw new Error(`Unknown switch: ${name}`);
  }

  // Precedence: class > program > org > default
  if (layers.class && name in layers.class) {
    return layers.class[name];
  }
  if (layers.program && name in layers.program) {
    return layers.program[name];
  }
  if (layers.org && name in layers.org) {
    return layers.org[name];
  }
  return defaults[name];
}
