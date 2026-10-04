// Pairing (AC-65) is built by b6-2; the fingerprint route is here because AC-61 needs it now.
export function register(app: any, ctx: any): void {
  // The hub CA's SHA-256 fingerprint (hex). Needs a session. No CA outside the hub profile.
  app.get('/api/pairing/fingerprint', ctx.guard.auth, (c: any) => {
    if (!ctx.ca) return c.json({ error: { ca: 'not-available' } }, 404);
    return c.json({ fingerprint: ctx.ca.fingerprint });
  });
}
