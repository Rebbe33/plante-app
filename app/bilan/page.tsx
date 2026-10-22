'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CARE_TYPES, HEALTH, addDays, daysBetween, fmtDate, lateBy, today } from '@/lib/care';
import { errMsg, loadAll } from '@/lib/api';
import { db } from '@/lib/supabase';
import type { Log, Plant, Task } from '@/lib/types';

const PERIODS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
];

export default function BilanPage() {
  const [period, setPeriod] = useState(7);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [bilans, setBilans] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAll()
      .then((d) => {
        setPlants(d.plants);
        setTasks(d.tasks);
      })
      .catch((e) => setError(errMsg(e)));
    db()
      .from('plantes_logs')
      .select('*')
      .eq('care_type', 'bilan')
      .not('health', 'is', null)
      .order('done_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error));
        else setBilans((data ?? []) as Log[]);
      });
  }, []);

  useEffect(() => {
    const start = addDays(today(), -(period - 1));
    db()
      .from('plantes_logs')
      .select('*')
      .gte('done_on', start)
      .order('done_on', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error));
        else setLogs((data ?? []) as Log[]);
      });
  }, [period]);

  const plantById = useMemo(() => new Map((plants ?? []).map((p) => [p.id, p])), [plants]);
  const activeLogs = useMemo(() => logs.filter((l) => plantById.has(l.plant_id)), [logs, plantById]);

  const byType = useMemo(
    () =>
      CARE_TYPES.map((c) => ({ ...c, n: activeLogs.filter((l) => l.care_type === c.code).length })).filter((c) => c.n > 0),
    [activeLogs]
  );
  const maxType = Math.max(1, ...byType.map((c) => c.n));

  const perDay = useMemo(() => {
    const start = addDays(today(), -(period - 1));
    const counts = new Array(period).fill(0) as number[];
    for (const l of activeLogs) {
      const i = daysBetween(start, l.done_on);
      if (i >= 0 && i < period) counts[i]++;
    }
    return { start, counts, max: Math.max(1, ...counts) };
  }, [activeLogs, period]);

  const overdue = useMemo(
    () =>
      tasks
        .map((t) => ({ t, late: lateBy(t) }))
        .filter((x): x is { t: Task; late: number } => x.late !== null && x.late > 0)
        .sort((a, b) => b.late - a.late),
    [tasks]
  );

  const latestHealth = useMemo(() => {
    const m = new Map<string, Log>();
    for (const b of bilans) if (!m.has(b.plant_id)) m.set(b.plant_id, b);
    return m;
  }, [bilans]);

  const worrying = (plants ?? []).filter((p) => (latestHealth.get(p.id)?.health ?? 3) === 1);
  const medium = (plants ?? []).filter((p) => latestHealth.get(p.id)?.health === 2);
  const neverChecked = (plants ?? []).filter((p) => !latestHealth.has(p.id));

  return (
    <>
      <h1>Bilan</h1>
      <p className="sub">Où en sont tes plantes et tes soins.</p>
      {error && <div className="error">{error}</div>}

      <div className="chips">
        {PERIODS.map((p) => (
          <button key={p.days} className={`chip ${period === p.days ? 'active' : ''}`} onClick={() => setPeriod(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="n">{activeLogs.filter((l) => l.care_type !== 'bilan').length}</div>
          <div className="l">soins faits</div>
        </div>
        <div className={`stat ${overdue.length > 0 ? 'warn' : ''}`}>
          <div className="n">{overdue.length}</div>
          <div className="l">en retard</div>
        </div>
        <div className={`stat ${worrying.length > 0 ? 'warn' : ''}`}>
          <div className="n">{worrying.length}</div>
          <div className="l">plantes en souci</div>
        </div>
      </div>

      <h2>Soins par type</h2>
      <div className="card flush" style={{ padding: '8px 0' }}>
        {byType.length === 0 && <div className="row muted">Aucun soin enregistré sur la période.</div>}
        {byType.map((c) => (
          <div className="bar-row" key={c.code}>
            <div className="lab">
              {c.emoji} {c.label.split(' ')[0]}
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${(c.n / maxType) * 100}%` }} />
            </div>
            <div className="val">{c.n}</div>
          </div>
        ))}
      </div>

      <h2>Activité</h2>
      <div className="card flush">
        <div className="spark">
          {perDay.counts.map((n, i) => (
            <div
              key={i}
              className="col"
              title={`${fmtDate(addDays(perDay.start, i))} : ${n}`}
              style={{ height: `${Math.max(3, (n / perDay.max) * 100)}%`, opacity: n === 0 ? 0.25 : 0.85 }}
            />
          ))}
        </div>
        <div className="spark-axis">
          <span>{fmtDate(perDay.start)}</span>
          <span>aujourd&apos;hui</span>
        </div>
      </div>

      <h2>Soins en retard</h2>
      <div className="card flush">
        {overdue.length === 0 && <div className="row muted">Rien en retard 🎉</div>}
        {overdue.slice(0, 15).map(({ t, late }) => {
          const p = plantById.get(t.plant_id);
          const c = CARE_TYPES.find((x) => x.code === t.care_type);
          if (!p) return null;
          return (
            <Link href={`/plantes/${p.id}`} className="row" key={t.id}>
              <div className="grow">
                <div className="name">{p.name}</div>
                <div className="small muted">{c?.emoji} {c?.label}</div>
              </div>
              <span className="badge late">{late} j de retard</span>
            </Link>
          );
        })}
      </div>

      <h2>Santé des plantes</h2>
      <div className="card flush">
        {(plants ?? []).length === 0 && <div className="row muted">Pas de plante.</div>}
        {[...worrying, ...medium].map((p) => {
          const b = latestHealth.get(p.id);
          const h = HEALTH.find((x) => x.value === b?.health);
          return (
            <Link href={`/plantes/${p.id}`} className="row" key={p.id}>
              <div className="grow">
                <div className="name">
                  <span className={`dot h${b?.health}`} />
                  {p.name}
                </div>
                <div className="small muted">
                  {h?.emoji} {h?.label} · {fmtDate(b?.done_on)}
                  {b?.note ? ` · ${b.note}` : ''}
                </div>
              </div>
            </Link>
          );
        })}
        {worrying.length + medium.length === 0 && (plants ?? []).length > 0 && (
          <div className="row muted">Aucune plante à surveiller.</div>
        )}
      </div>

      {neverChecked.length > 0 && (
        <p className="small muted">
          {neverChecked.length} plante{neverChecked.length > 1 ? 's' : ''} sans bilan santé :{' '}
          {neverChecked
            .slice(0, 6)
            .map((p) => p.name)
            .join(', ')}
          {neverChecked.length > 6 ? '…' : ''}
        </p>
      )}
    </>
  );
}
