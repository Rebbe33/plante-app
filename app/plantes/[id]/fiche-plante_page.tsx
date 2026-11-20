'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdviceCard from '@/components/AdviceCard';
import Conditions from '@/components/Conditions';
import PlantPhoto from '@/components/PlantPhoto';
import { HEALTH, careInfo, dueLabel, effectiveFreq, fmtDate, lateBy, nextDue } from '@/lib/care';
import { addBilan, applyActions, deletePlant, errMsg, loadPlant, loadSpots, markDone, setArchived } from '@/lib/api';
import { evaluateSpot, needsFor } from '@/lib/besoins';
import { SOILS, SYMPTOM_GROUPS, buildAdvice, plantKind, soilLabel, symptomLabel } from '@/lib/diagnostic';
import { CATEGORIES } from '@/lib/species';
import type { Advice, Soil } from '@/lib/diagnostic';
import type { Log, Plant, Spot, Task } from '@/lib/types';

export default function PlantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotsError, setSpotsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bilan
  const [health, setHealth] = useState<number | null>(null);
  const [soil, setSoil] = useState<Soil | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Conseils issus du dernier bilan
  const [advice, setAdvice] = useState<Advice[] | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const adviceRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await loadPlant(id);
      setPlant(d.plant);
      setTasks(d.tasks);
      setLogs(d.logs);
      setError(null);
      try {
        setSpots(await loadSpots());
        setSpotsError(false);
      } catch {
        // table pas encore créée : on affiche l'invitation à lancer le script SQL
        setSpots([]);
        setSpotsError(true);
      }
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // type de plante déduit de l'espèce (null = non reconnu)
  const kind = useMemo(() => (plant ? plantKind(plant.species, plant.name) : null), [plant]);

  useEffect(() => {
    if (!advice) return;
    const t = setTimeout(() => adviceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [advice]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleSymptom(code: string) {
    setSymptoms((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function saveBilan() {
    if (health === null) return;
    const spot = spots.find((x) => x.id === plant?.spot_id) ?? null;
    const placement = spot
      ? { spotName: spot.name, issues: evaluateSpot(needsFor(plant?.species, plant?.name ?? ''), spot).issues }
      : null;
    const list = buildAdvice({ health, soil, symptoms, kind, tasks, placement });
    await run(async () => {
      await addBilan(id, health, note, soil, symptoms);
      setAdvice(list);
      setApplied([]);
      setHealth(null);
      setSoil(null);
      setSymptoms([]);
      setNote('');
    });
  }

  async function applyAdvice(a: Advice) {
    await run(async () => {
      await applyActions(id, a.actions, a.title, kind);
      setApplied((prev) => [...prev, a.id]);
    });
  }

  async function remove() {
    if (!plant) return;
    if (!confirm(`Supprimer « ${plant.name} » et tout son historique ? C'est définitif.`)) return;
    setBusy(true);
    try {
      await deletePlant(plant);
      router.push('/plantes');
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  if (error && !plant) return <div className="error">{error}</div>;
  if (!plant) return <p className="muted">Chargement…</p>;

  const activeTasks = tasks
    .filter((t) => t.active)
    .sort((a, b) => (lateBy(b) ?? -999) - (lateBy(a) ?? -999));
  const lastBilan = logs.find((l) => l.care_type === 'bilan' && l.health);

  return (
    <>
      <p className="small">
        <Link href="/plantes" className="muted">← Mes plantes</Link>
      </p>
      {error && <div className="error">{error}</div>}

      <PlantPhoto path={plant.photo_path} alt={plant.name} large />

      <div className="page-head" style={{ marginTop: 12 }}>
        <div>
          <h1>{plant.name}</h1>
          <p className="sub">
            {[plant.species, plant.room, plant.exposure].filter(Boolean).join(' · ') || 'Aucune info'}
            {plant.archived && ' · archivée'}
          </p>
        </div>
        <Link href={`/plantes/${plant.id}/modifier`} className="btn sm">Modifier</Link>
      </div>

      {plant.notes && <div className="card small">{plant.notes}</div>}

      <h2>Soins</h2>
      <div className="card flush">
        {activeTasks.length === 0 && <div className="row muted">Aucun soin programmé.</div>}
        {activeTasks.map((t) => {
          const c = careInfo(t.care_type);
          const late = lateBy(t);
          const freq = effectiveFreq(t);
          return (
            <div className="row" key={t.id}>
              <div style={{ fontSize: '1.4rem' }}>{c.emoji}</div>
              <div className="grow">
                <div className="name">{c.label}</div>
                <div className="small muted">
                  {freq ? `tous les ${freq} j` : 'en pause (hiver)'} · dernier : {fmtDate(t.last_done)}
                  {nextDue(t) && late !== null && late < 0 ? ` · prochain : ${fmtDate(nextDue(t))}` : ''}
                </div>
              </div>
              {late === null ? (
                <span className="badge off">pause</span>
              ) : (
                <span className={`badge ${late > 0 ? 'late' : late === 0 ? '' : 'soon'}`}>{dueLabel(late)}</span>
              )}
              {t.care_type !== 'bilan' && (
                <button className="btn primary sm" disabled={busy} onClick={() => run(() => markDone([t]))}>
                  Fait ✓
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Conditions plant={plant} tasks={tasks} spots={spots} spotsError={spotsError} kind={kind} onChanged={load} />

      <h2>Bilan santé</h2>
      <div className="card">
        {lastBilan && (
          <p className="small muted" style={{ marginTop: 0 }}>
            Dernier bilan ({fmtDate(lastBilan.done_on)}) : {HEALTH.find((h) => h.value === lastBilan.health)?.emoji}{' '}
            {HEALTH.find((h) => h.value === lastBilan.health)?.label}
          </p>
        )}

        <div className="q-title" style={{ marginTop: 0 }}>Comment va-t-elle ?</div>
        <div className="health-btns">
          {HEALTH.map((h) => (
            <button key={h.value} type="button" className={health === h.value ? 'sel' : ''} onClick={() => setHealth(h.value)}>
              <span className="e">{h.emoji}</span>
              {h.label}
            </button>
          ))}
        </div>

        <div className="q-title">
          Terre au toucher <span className="muted">(enfonce un doigt à 3 cm)</span>
        </div>
        <div className="health-btns">
          {SOILS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={soil === s.value ? 'sel' : ''}
              onClick={() => setSoil(soil === s.value ? null : s.value)}
            >
              <span className="e">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>

        <p className="small muted" style={{ marginBottom: 0 }}>
          Coche seulement ce que tu vois vraiment. Si tout va bien, ne coche rien.
        </p>
        {SYMPTOM_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="q-title">{g.title}</div>
            <div className="chips">
              {g.items.map((i) => (
                <button
                  key={i.code}
                  type="button"
                  className={`chip ${symptoms.includes(i.code) ? 'active' : ''}`}
                  onClick={() => toggleSymptom(i.code)}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <label className="field" style={{ marginTop: 14 }}>
          Autre observation (nouvelle pousse, fleur…)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} />
        </label>
        <button className="btn primary" disabled={busy || health === null} onClick={saveBilan}>
          Enregistrer le bilan
        </button>
      </div>

      {advice && (
        <div ref={adviceRef} style={{ scrollMarginTop: 12 }}>
          <h2>Conseils selon ton bilan</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            {kind
              ? `Conseils adaptés au type « ${CATEGORIES[kind]?.label ?? kind} », déduit de l'espèce. `
              : "Type de plante non reconnu : conseils généraux (renseigne l'espèce dans « Modifier » pour des conseils plus précis). "}
            Ce sont des suggestions : rien ne change sans ton accord. Après un ajustement, laisse 2 à 3 semaines à la
            plante avant de réajuster.
          </p>
          {advice.map((a) => (
            <AdviceCard
              key={a.id}
              advice={a}
              tasks={tasks}
              kind={kind}
              done={applied.includes(a.id)}
              busy={busy}
              onApply={applyAdvice}
            />
          ))}
          <button className="btn sm" onClick={() => setAdvice(null)}>
            Fermer les conseils
          </button>
        </div>
      )}

      <h2>Historique</h2>
      <div className="card flush">
        {logs.length === 0 && <div className="row muted">Rien pour l&apos;instant.</div>}
        {logs.map((l) => {
          const c = careInfo(l.care_type);
          const h = HEALTH.find((x) => x.value === l.health);
          return (
            <div className="log-line" key={l.id}>
              <span className="d">{fmtDate(l.done_on)}</span>
              <span>
                {c.emoji} {c.label}
                {h ? ` — ${h.emoji} ${h.label}` : ''}
                {l.soil && <span className="muted"> · terre {soilLabel(l.soil)}</span>}
                {l.symptoms && l.symptoms.length > 0 && (
                  <span className="muted"> · {l.symptoms.map(symptomLabel).join(', ')}</span>
                )}
                {l.note && <span className="muted"> · {l.note}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn" disabled={busy} onClick={() => run(() => setArchived(plant.id, !plant.archived))}>
          {plant.archived ? 'Désarchiver' : 'Archiver'}
        </button>
        <button className="btn danger" disabled={busy} onClick={remove}>
          Supprimer
        </button>
      </div>
    </>
  );
}
