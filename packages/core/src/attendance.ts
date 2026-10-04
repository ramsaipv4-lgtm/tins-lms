// Rotating attendance code (SPEC 4.5): HOTP-style, HMAC-SHA-256, 6 digits.
import { hmacSha256 } from './util.ts';

async function codeForCounter(secret: Uint8Array, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter), false);
  const mac = await hmacSha256(secret, msg);
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

function counterAt(now: number, periodSec: number): number {
  return Math.floor(now / 1000 / periodSec);
}

export async function attendanceCode(secret: Uint8Array, now: number, periodSec: number = 60): Promise<string> {
  return codeForCounter(secret, counterAt(now, periodSec));
}

export async function verifyAttendanceCode(
  code: string,
  secret: Uint8Array,
  now: number,
  periodSec: number = 60,
): Promise<boolean> {
  const counter = counterAt(now, periodSec);
  const current = await codeForCounter(secret, counter);
  const previous = await codeForCounter(secret, counter - 1);
  return code === current || code === previous;
}
