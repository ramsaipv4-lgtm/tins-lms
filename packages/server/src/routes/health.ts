// GET /api/health (AC-60): public, never includes secrets.
export function register(app: any, ctx: any): void {
  app.get('/api/health', (c: any) => c.json({ ok: true, profile: ctx.config.profile, schema: ctx.schema, version: ctx.version }));
}
