// Screenshot parsing rules (SPEC §4.18)

export type ParseRules = {
  app: string;
  fields: {
    name: string;
    anchor: string;
    pick: 'same-line-number' | 'next-line-number';
    unit?: string;
  }[];
};

export function validateRules(rules: ParseRules): string[] {
  const problems: string[] = [];
  const seenNames = new Set<string>();

  for (const field of rules.fields) {
    // Check anchor length
    if (field.anchor.length > 200) {
      problems.push(`field "${field.name}": anchor longer than 200 characters`);
    }

    // Check anchor is valid regex
    try {
      new RegExp(field.anchor, 'ui');
    } catch {
      problems.push(`field "${field.name}": invalid regex in anchor`);
    }

    // Check for duplicate field names
    if (seenNames.has(field.name)) {
      problems.push(`field "${field.name}": duplicate field name`);
    }
    seenNames.add(field.name);
  }

  return problems;
}

function extractNumber(text: string): number | null {
  // Find a number pattern in the text (possibly with currency sign before it)
  // Pattern: optional currency signs, then digits/commas/dots
  const match = text.match(/[₹Rs$]*\s*([0-9,]+\.?[0-9]*)/);

  if (!match || !match[1]) {
    return null;
  }

  // Remove thousands separators and parse
  const numberStr = match[1].replace(/,/g, '');
  const num = parseFloat(numberStr);

  return isNaN(num) ? null : num;
}

export function applyParseRules(
  lines: readonly string[],
  rules: ParseRules,
): Record<string, { value: number | null; line: number | null }> {
  const result: Record<string, { value: number | null; line: number | null }> = {};

  for (const field of rules.fields) {
    let value: number | null = null;
    let lineNum: number | null = null;

    // Create regex with case-insensitive and unicode flags
    const regex = new RegExp(field.anchor, 'ui');

    // Find the anchor line
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        // Anchor found on line i
        let targetLine = i;

        if (field.pick === 'next-line-number') {
          targetLine = i + 1;
        }

        if (targetLine < lines.length) {
          const num = extractNumber(lines[targetLine]);
          if (num !== null) {
            value = num;
            lineNum = targetLine;
          }
        }
        break;
      }
    }

    result[field.name] = { value, line: lineNum };
  }

  return result;
}
