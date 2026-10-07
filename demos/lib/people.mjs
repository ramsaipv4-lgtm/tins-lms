// People and times in the demo seed (demos/seed/fixtures/journeys/base.json + demo-extra.json). All synthetic.
export const IST = (d, hm) => Date.parse(`${d}T${hm}:00+05:30`);
export const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
export const at = (dayIndex, hm = '09:00') => IST(DAYS[dayIndex], hm);
export const P = {
  admin: ['person:admin1', ['admin']], trainer: ['person:tr1', ['trainer']], sub: ['person:sub1', ['substitute']],
  coord: ['person:coord1', ['coordinator']], l1: ['person:l1', ['learner']], l2: ['person:l2', ['learner']],
  l3: ['person:l3', ['learner']], l4: ['person:l4', ['learner']],
};
for (let i = 1; i <= 8; i++) P[`s${i}`] = [`person:s${i}`, ['learner']];
export const LEARNERS = ['l1', 'l2', 'l3', 'l4', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
/** Seeds every demo starts from unless it says otherwise: org, staff, four learners, class c1, the course package, plus the extras. */
export const STANDARD = ['base', 'demo-extra', 'demo-att-d0'];
