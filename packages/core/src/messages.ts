// Messages for other apps (SPEC §4.32)

export function waLink(phone: string, text: string): string {
  // Normalize Indian phone numbers: 91XXXXXXXXXX (10 digits)
  // Accept: +91XXXXXXXXXX, 0XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
  let normalized = phone.replace(/[\s\-+]/g, '');

  // Handle leading 0
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }

  // Handle 91 prefix
  if (normalized.startsWith('91')) {
    normalized = normalized.slice(2);
  }

  // Validate length
  if (normalized.length !== 10) {
    throw new Error(`Invalid phone number: expected 10 digits, got ${normalized.length}`);
  }

  // Ensure all characters are digits
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error('Invalid phone number: must contain only digits');
  }

  // Use 91 prefix for India
  const fullNumber = '91' + normalized;

  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(text)}`;
}

export function copyAll(messages: readonly { name: string; text: string }[]): string {
  return messages.map((msg) => `${msg.name}:\n${msg.text}`).join('\n\n');
}
