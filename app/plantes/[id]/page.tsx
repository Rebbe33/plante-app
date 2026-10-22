'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PlantPhoto from '@/components/PlantPhoto';
import { HEALTH, careInfo, dueLabel, effectiveFreq, fmtDate, lateBy, nextDue } from '@/lib/care';
import { addBilan, deletePlant, errMsg, loadPlant, markDone, setArchived } from '@/lib/api';
import type { Log, Plant, Task } from '@/lib/types';

export default function PlantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await loadPlant(id);
      setPlant(d.plant);
      setTasks(d.tasks);
      setLogs(d.logs);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function saveBilan() {
    if (health === null) return;
    await run(async () => {
      await addBilan(id, health, note);
      setHealth(null);
      setNote('');
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

      <h2>Bilan santé</h2>
      <div className="card">
        {lastBilan && (
          <p className="small muted" style={{ marginTop: 0 }}>
            Dernier bilan ({fmtDate(lastBilan.done_on)}) : {HEALTH.find((h) => h.value === lastBilan.health)?.emoji}{' '}
            {HEALTH.find((h) => h.value === lastBilan.health)?.label}
          </p>
        )}
        <div className="health-btns">
          {HEALTH.map((h) => (
            <button key={h.value} type="button" className={health === h.value ? 'sel' : ''} onClick={() => setHealth(h.value)}>
              <span className="e">{h.emoji}</span>
              {h.label}
            </button>
          ))}
        </div>
        <label className="field">
          Observation (feuilles jaunes, nouvelle pousse, parasites…)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} />
        </label>
        <button className="btn primary" disabled={busy || health === null} onClick={saveBilan}>
          Enregistrer le bilan
        </button>
      </div>

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
