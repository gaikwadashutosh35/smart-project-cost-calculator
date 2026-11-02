import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { z } from 'zod';
import { estimate } from './calc/engine';
import { decodeShare, money } from './calc/export';
import { DEFAULT_ANSWERS } from './calc/questionnaire';
import { chooseTier } from './calc/recommend';
import { ScenarioSchema, TIERS, type Advanced, type Answers, type Estimate, type Scenario, type Tier, type Workload } from './calc/types';
import { defaultWorkload, derive } from './calc/workload';
import { AdvancedMode } from './ui/Advanced';
import { Card, btn, cx } from './ui/kit';
import { Report } from './ui/Report';
import { Results } from './ui/Results';
import { Progress, StepAI, StepBudget, StepProject, StepUsers } from './ui/Wizard';

const DRAFT_KEY = 'spc:draft';
const SCENARIOS_KEY = 'spc:scenarios';
const EMPTY_ADV: Advanced = { serviceOverrides: {}, priceOverrides: {}, instanceOverride: 0, disabledSlots: [], extraSlots: [] };
const DraftSchema = z.object({ scenario: ScenarioSchema, step: z.number().int().min(0).max(4) });

const newScenario = (): Scenario => ({ id: crypto.randomUUID(), name: 'My project', savedAt: '', answers: DEFAULT_ANSWERS, workloadOverrides: {}, advanced: EMPTY_ADV });

// localStorage can be unavailable (private mode, blocked storage) — the app must still work.
function read<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? schema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

function initialState(): { scenario: Scenario; step: number; shared: boolean } {
  if (location.hash.startsWith('#s=')) {
    const shared = decodeShare(location.hash.slice(3));
    history.replaceState(null, '', location.pathname);
    if (shared) return { scenario: { ...shared, id: crypto.randomUUID() }, step: 4, shared: true };
  }
  const draft = read(DRAFT_KEY, DraftSchema);
  return draft ? { ...draft, shared: false } : { scenario: newScenario(), step: 0, shared: false };
}

export default function App() {
  const [init] = useState(initialState);
  const [sc, setSc] = useState<Scenario>(init.scenario);
  const [step, setStep] = useState(init.step); // 0–3 questionnaire, 4 results
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [viewTier, setViewTier] = useState<Tier | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(() => read(SCENARIOS_KEY, z.array(ScenarioSchema)) ?? []);
  const [panel, setPanel] = useState(false);
  const [toast, setToast] = useState<string | null>(init.shared ? 'Loaded a shared estimate' : null);
  const [tried, setTried] = useState(false);

  useEffect(() => { write(DRAFT_KEY, { scenario: sc, step }); }, [sc, step]);
  useEffect(() => { write(SCENARIOS_KEY, scenarios); }, [scenarios]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step, advancedOpen]);

  const a = sc.answers;
  const w: Workload = useMemo(() => ({ ...defaultWorkload(a), ...sc.workloadOverrides }), [a, sc.workloadOverrides]);
  const d = useMemo(() => derive(w, a), [w, a]);
  const estimates = useMemo(() => Object.fromEntries(TIERS.map((t) => [t, estimate(a, w, t, sc.advanced)])) as Record<Tier, Estimate>, [a, w, sc.advanced]);
  const chosen = useMemo(() => chooseTier(a, estimates), [a, estimates]);
  const view = viewTier ?? chosen.tier;

  const setAnswers = (p: Partial<Answers>) => setSc((s) => ({ ...s, answers: { ...s.answers, ...p } }));
  const setW = (p: Partial<Workload>) => setSc((s) => ({ ...s, workloadOverrides: { ...s.workloadOverrides, ...p } }));
  const resetW = () => setSc((s) => ({ ...s, workloadOverrides: {} }));
  const setAdv = (p: Partial<Advanced>) => setSc((s) => ({ ...s, advanced: { ...s.advanced, ...p } }));

  const next = () => {
    if (step === 0 && !a.projectType) { setTried(true); return; }
    setTried(false);
    setStep((s) => Math.min(4, s + 1));
  };
  const save = () => {
    const saved = { ...sc, savedAt: new Date().toISOString() };
    setSc(saved);
    setScenarios((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
    setToast(`Saved “${saved.name}”`);
  };
  const duplicate = (from: Scenario = sc) => {
    const copy = { ...from, id: crypto.randomUUID(), name: `${from.name} (copy)`, savedAt: new Date().toISOString() };
    setScenarios((list) => [copy, ...list]);
    setSc(copy);
    setToast(`Created “${copy.name}”`);
  };
  const open = (s: Scenario) => { setSc(s); setStep(4); setAdvancedOpen(false); setViewTier(null); setPanel(false); };
  const startNew = () => { setSc(newScenario()); setStep(0); setAdvancedOpen(false); setViewTier(null); setPanel(false); };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="relative bg-surface/90 backdrop-blur border-b border-line print:hidden sticky top-0 z-30">
        <span aria-hidden className="brand-gradient absolute inset-x-0 bottom-0 h-0.5" />
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" aria-label="Smart Project Cost Calculator home" className="flex items-center gap-2.5 font-bold tracking-[-0.2px] shrink-0"><span className="brand-gradient grid place-items-center size-8 rounded-lg text-white shadow-card"><Calculator size={18} /></span><span className="hidden sm:inline">Smart Project Cost Calculator</span></a>
          <input
            aria-label="Project name"
            value={sc.name}
            maxLength={120}
            onChange={(e) => setSc((s) => ({ ...s, name: e.target.value }))}
            className="min-w-0 flex-1 sm:flex-none sm:w-56 rounded-lg border border-transparent hover:border-line focus:border-primary px-2 py-1 text-sm outline-none"
          />
          <span className="ml-auto flex items-center gap-2">
            {step === 4 && <span className="hidden md:block text-sm text-muted tabular-nums">{money(estimates[view].monthlyUsd, a.currency)}/mo</span>}
            <a href="/about/" className={cx(btn.ghost, "hidden sm:inline-flex")}>How it works</a>
            <button type="button" className={btn.ghost} onClick={() => setPanel(true)}><FolderOpen size={16} /> <span className="hidden sm:inline">Scenarios</span></button>
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 print:hidden">
        {step < 4 ? (
          <>
            <Progress step={step} onJump={setStep} canJump={!!a.projectType} />
            {step === 0 && <StepProject a={a} set={setAnswers} />}
            {step === 1 && <StepUsers a={a} set={setAnswers} w={w} d={d} setW={setW} resetW={resetW} />}
            {step === 2 && <StepAI a={a} set={setAnswers} d={d} preview={estimates.recommended} />}
            {step === 3 && <StepBudget a={a} set={setAnswers} />}
            {tried && !a.projectType && <p role="alert" className="mt-4 text-sm text-red-700">Please choose what you are building to continue.</p>}
          </>
        ) : advancedOpen ? (
          <AdvancedMode a={a} set={setAnswers} w={w} setW={setW} resetW={resetW} adv={sc.advanced} setAdv={setAdv} e={estimates[view]} onBack={() => setAdvancedOpen(false)} />
        ) : (
          <Results
            a={a} w={w} d={d} adv={sc.advanced} estimates={estimates} chosen={chosen} view={view} setView={setViewTier} scenario={sc}
            onEdit={(s) => setStep(s)} onAdvanced={() => setAdvancedOpen(true)} onSave={save} onDuplicate={() => duplicate()}
            onApplyWorkload={(field, value) => setW({ [field]: value })}
            onApplyPrice={(key, usd) => setSc((s) => ({ ...s, advanced: { ...s.advanced, priceOverrides: { ...s.advanced.priceOverrides, [key]: usd } } }))}
          />
        )}
      </main>

      {step < 4 && (
        <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line print:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <button type="button" className={btn.secondary} disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={16} /> Back</button>
            {a.projectType && <span className="hidden sm:block text-sm text-muted">Current estimate: <b className="text-ink tabular-nums">{money(estimates.recommended.monthlyUsd, a.currency)}/mo</b> (Recommended)</span>}
            <button type="button" className={cx(btn.primary, 'ml-auto')} onClick={next}>{step === 3 ? 'See my estimate' : 'Next'} <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 4 && <Report a={a} w={w} d={d} estimates={estimates} view={view} name={sc.name} />}

      {panel && (
        <div className="fixed inset-0 z-40 print:hidden" role="dialog" aria-modal="true" aria-label="Saved scenarios">
          <div className="absolute inset-0 bg-brand-dark/40" onClick={() => setPanel(false)} />
          <Card className="absolute inset-x-0 bottom-0 sm:inset-auto sm:right-4 sm:top-16 sm:w-96 rounded-b-none sm:rounded-2xl p-4 max-h-[80vh] overflow-y-auto shadow-float">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Scenarios</h2>
              <button type="button" aria-label="Close" className={btn.ghost} onClick={() => setPanel(false)}><X size={16} /></button>
            </div>
            <button type="button" className={cx(btn.secondary, 'w-full mb-3')} onClick={startNew}><Plus size={16} /> New project</button>
            {scenarios.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No saved scenarios yet. Use “Save scenario” on the results page.</p>
            ) : (
              <ul className="space-y-2">
                {scenarios.map((s) => (
                  <li key={s.id} className={cx('rounded-xl border p-3', s.id === sc.id ? 'border-primary' : 'border-line')}>
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted">{s.savedAt ? new Date(s.savedAt).toLocaleString() : ''}</p>
                    <div className="flex gap-1 mt-2">
                      <button type="button" className={btn.ghost} onClick={() => open(s)}>Open</button>
                      <button type="button" className={btn.ghost} onClick={() => { duplicate(s); setPanel(false); setStep(4); }}>Duplicate</button>
                      <button type="button" aria-label={`Delete ${s.name}`} className={cx(btn.ghost, 'ml-auto')} onClick={() => window.confirm(`Delete “${s.name}”?`) && setScenarios((l) => l.filter((x) => x.id !== s.id))}><Trash2 size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {toast && <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-brand-dark text-white text-sm font-medium px-5 py-2.5 shadow-float print:hidden">{toast}</div>}
    </div>
  );
}
