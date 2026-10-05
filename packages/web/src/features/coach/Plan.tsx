// The coaching conversation (PLAN 7.0, AC-156): stages 0-4 with a low-friction default at every step, then a
// versioned plan; stage 5 (the review cadence) replays stages 2-4 with the previous answers pre-selected.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import PinGate from './Gate.tsx';
import { listEntries, saveEntry } from './lib.ts';
import {
  DOMAINS, ENERGIES, MODIFIERS, PATHWAYS, PITFALLS, STAGES, buildPlan, defaultAnswers, goalKeys, nextVersion, pathwayCards,
  suggestedPitfalls, validAnswers, withDomain, type Answers, type Plan, type Stage,
} from './plan.ts';
import './coach.css';

async function loadPlans(person: string, key: Uint8Array): Promise<Plan[]> {
  const rows = await listEntries(person, key);
  return rows.filter((r) => r.kind === 'note' && r.values?.plan && validAnswers(r.values.plan.answers)).map((r) => r.values.plan as Plan).sort((a, b) => a.version - b.version);
}

function Conversation({ person, keyBytes }: { person: string; keyBytes: Uint8Array }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [stage, setStage] = useState<Stage | 'plan'>('context');
  const [a, setA] = useState<Answers>(defaultAnswers());
  const [free, setFree] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    loadPlans(person, keyBytes).then((p) => { if (!live) return; setPlans(p); if (p.length) { setA(p[p.length - 1].answers); setStage('plan'); } }).catch(() => live && setPlans([]));
    return () => { live = false; };
  }, [person, keyBytes]);

  if (!plans) return <p role="status">{t('app.loading')}</p>;
  const latest = plans[plans.length - 1] ?? null;
  const upd = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));
  const go = (s: Stage) => { setError(null); setStage(s); };
  const next = () => { const i = STAGES.indexOf(stage as Stage); go(STAGES[Math.min(STAGES.length - 1, i + 1)]); };

  async function save() {
    setSaving(true); setError(null);
    try {
      const plan = buildPlan(a, nextVersion(plans!.map((p) => p.version)), Date.now(), latest?.answers ?? null);
      await saveEntry(person, keyBytes, { kind: 'note', values: { plan }, source: 'manual', confirmed: true, idHint: `plan-v${plan.version}` });
      setPlans([...plans!, plan]); setStage('plan');
    } catch { setError(t('app.error')); } finally { setSaving(false); }
  }

  if (stage === 'plan' && latest) {
    const p = latest;
    return (
      <section aria-labelledby="plan-h">
        <h1 id="plan-h">{t('coach.plan.title')}</h1>
        <div data-testid="coach-plan" data-version={p.version}>
          <h2>{t('coach.plan.version', { n: p.version })}</h2>
          <p>{p.answers.goalIsKey ? t(p.answers.goal) : p.answers.goal}</p>
          <ul>
            <li>{t('coach.plan.pathway', { name: t(`coach.pathway.${p.answers.pathway}`) })}</li>
            <li>{t('coach.plan.hours', { n: p.hoursPerWeek })}</li>
            <li>{t('coach.plan.finish', { date: p.finishDate })}</li>
            <li>{t('coach.plan.cadence')}</li>
          </ul>
          {p.adopted.length > 0 && <p>{t('coach.plan.adopted', { list: p.adopted.map((x) => t(`coach.adopted.${x}`)).join(', ') })}</p>}
        </div>
        <p><button type="button" onClick={() => { setA(p.answers); go('constraints'); }}>{t('coach.plan.checkin')}</button></p>
        {plans.length > 1 && (
          <>
            <h2>{t('coach.plan.history')}</h2>
            <ol>{plans.map((x) => <li key={x.version}>{t('coach.plan.version', { n: x.version })}: {t(`coach.pathway.${x.answers.pathway}`)}</li>)}</ol>
          </>
        )}
      </section>
    );
  }

  const idx = STAGES.indexOf(stage as Stage);
  const sameAsBefore = latest ? <button type="button" className="coach-quiet" onClick={() => setStage('final')}>{t('coach.sameAsBefore')}</button> : null;
  return (
    <section aria-labelledby="conv-h">
      <h1 id="conv-h">{t('coach.conv.title')}</h1>
      <ol className="coach-steps" aria-label={t('coach.conv.progress')}>
        {STAGES.map((s, i) => <li key={s} aria-current={i === idx ? 'step' : undefined}>{t(`coach.stage.${s}`)}</li>)}
      </ol>
      {error && <p role="alert" className="err">{error}</p>}

      {stage === 'context' && (
        <fieldset><legend>{t('coach.context.q')}</legend>
          <ul className="coach-cards">{DOMAINS.map((d) => (
            <li key={d} className="coach-card" data-selected={a.domain === d}>
              <label><input type="radio" name="domain" checked={a.domain === d} onChange={() => setA((x) => withDomain(x, d))} /> {t(`coach.domain.${d}`)}</label>
            </li>))}
          </ul>
        </fieldset>
      )}

      {stage === 'goal' && (
        <fieldset><legend>{t('coach.goal.q')}</legend>
          <ul className="coach-cards">{goalKeys(a.domain).map((k) => (
            <li key={k} className="coach-card" data-selected={a.goal === k}>
              <label><input type="radio" name="goal" checked={a.goal === k} onChange={() => { upd({ goal: k, goalIsKey: true }); setFree(''); }} /> {t(k)}</label>
            </li>))}
          </ul>
          <div className="field">
            <label htmlFor="coach-goal-free">{t('coach.goal.own')}</label>
            <input id="coach-goal-free" maxLength={140} value={free} onChange={(e) => { setFree(e.target.value); if (e.target.value.trim()) upd({ goal: e.target.value.trim(), goalIsKey: false }); }} />
          </div>
        </fieldset>
      )}

      {stage === 'constraints' && (
        <div>
          <div className="field">
            <label htmlFor="coach-hours">{t('coach.constraints.hours', { n: a.hours })}</label>
            <input id="coach-hours" type="range" min={2} max={20} step={1} value={a.hours} onChange={(e) => upd({ hours: Number(e.target.value) })} />
          </div>
          <fieldset><legend>{t('coach.constraints.energy')}</legend>
            <div className="row">{ENERGIES.map((en) => (
              <label key={en} className="coach-chip"><input type="radio" name="energy" checked={a.energy === en} onChange={() => upd({ energy: en, pitfalls: suggestedPitfalls(en) })} /> {t(`coach.energy.${en}`)}</label>))}
            </div>
          </fieldset>
          <fieldset><legend>{t('coach.constraints.pitfalls')}</legend>
            <ul className="coach-chips">{PITFALLS.map((p) => (
              <li key={p.id} className="coach-chip">
                <label><input type="checkbox" checked={a.pitfalls.includes(p.id)} onChange={(e) => upd({ pitfalls: e.target.checked ? [...a.pitfalls, p.id] : a.pitfalls.filter((x) => x !== p.id) })} /> {t(`coach.pitfall.${p.id}`)}</label>
                {a.pitfalls.includes(p.id) && <span className="help">{t(`coach.pitfall.${p.id}.fix`)}</span>}
              </li>))}
            </ul>
          </fieldset>
        </div>
      )}

      {stage === 'pathway' && (
        <div>
          <fieldset><legend>{t('coach.pathway.q')}</legend>
            <ul className="coach-cards">{pathwayCards(a.hours, Date.now()).map((c) => (
              <li key={c.id} className="coach-card" data-selected={a.pathway === c.id}>
                <label><input type="radio" name="pathway" checked={a.pathway === c.id} onChange={() => upd({ pathway: c.id })} /> <strong>{t(`coach.pathway.${c.id}`)}</strong></label>
                <p>{t('coach.plan.hours', { n: c.hoursPerWeek })}</p>
                <p>{t('coach.plan.finish', { date: c.finishDate })}</p>
                <p className="help">{t(`coach.pathway.${c.id}.tradeoff`)}</p>
              </li>))}
            </ul>
          </fieldset>
          <fieldset><legend>{t('coach.modifiers.q')}</legend>
            <ul className="coach-chips">{MODIFIERS.map((m) => (
              <li key={m} className="coach-chip"><label><input type="checkbox" checked={a.modifiers.includes(m)} onChange={(e) => upd({ modifiers: e.target.checked ? [...a.modifiers, m] : a.modifiers.filter((x) => x !== m) })} /> {t(`coach.modifier.${m}`)}</label></li>))}
            </ul>
          </fieldset>
        </div>
      )}

      {stage === 'final' && (() => {
        const draft = buildPlan(a, nextVersion(plans.map((p) => p.version)), Date.now(), latest?.answers ?? null);
        return (
          <div>
            <h2>{t('coach.final.title', { n: draft.version })}</h2>
            <p>{a.goalIsKey ? t(a.goal) : a.goal}</p>
            <p>{t('coach.plan.pathway', { name: t(`coach.pathway.${a.pathway}`) })} · {t('coach.plan.hours', { n: draft.hoursPerWeek })} · {t('coach.plan.finish', { date: draft.finishDate })}</p>
            <p>{draft.adopted.length ? t('coach.plan.adopted', { list: draft.adopted.map((x) => t(`coach.adopted.${x}`)).join(', ') }) : t('coach.plan.adoptedNone')}</p>
          </div>
        );
      })()}

      <div className="row">
        {stage !== 'final' && <button type="button" onClick={next}>{t('coach.acceptDefaults')}</button>}
        {stage === 'final' && <button type="button" disabled={saving} onClick={() => void save()}>{t('coach.saveStart')}</button>}
        {stage !== 'final' && <button type="button" className="coach-quiet" onClick={next}>{t('coach.skip')}</button>}
        {idx > 0 && <button type="button" className="coach-quiet" onClick={() => go(STAGES[idx - 1])}>{t('coach.back')}</button>}
        {sameAsBefore && stage === 'constraints' ? sameAsBefore : null}
      </div>
    </section>
  );
}

export default function Plan() {
  return <PinGate needTrackers>{(key, person) => <Conversation person={person} keyBytes={key} />}</PinGate>;
}
