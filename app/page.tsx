'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlantPhoto from '@/components/PlantPhoto';
import { CARE_TYPES, dueLabel, fmtDate, isWinter, lateBy, nextDue, today } from '@/lib/care';
import { errMsg, loadAll, markDone } from '@/lib/api';
import type { Plant, Task } from '@/lib/types';

type Data = { plants: Plant[]; tasks: Task[] };

export default function TodayPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await loadAll());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plantById = useMemo(() => new Map((data?.plants ?? []).map((p) => [p.id, p])), [data]);

  const { due, upcoming } = useMemo(() => {
    const due: Task[] = [];
    const upcoming: Task[] = [];
    for (const t of data?.tasks ?? []) {
      const late = lateBy(t);
      if (late === null) continue;
      if (late >= 0) due.push(t);
      else if (late >= -3) upcoming.push(t);
    }
    const byPlant = (a: Task, b: Task) =>
      (plantById.get(a.plant_id)?.name ?? '').localeCompare(plantById.get(b.plant_id)?.name ?? '', 'fr');
    due.sort((a, b) => (lateBy(b) ?? 0) - (lateBy(a) ?? 0) || byPlant(a, b));
    upcoming.sort((a, b) => (lateBy(b) ?? 0) - (lateBy(a) ?? 0) || byPlant(a, b));
    return { due, upcoming };
  }, [data, plantById]);

  async function done(tasks: Task[], key: string) {
    setBusy(key);
    try {
      await markDone(tasks);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <h1>Aujourd&apos;hui</h1>
      <p className="sub" style={{ textTransform: 'capitalize' }}>{dateLabel}</p>

      {error && <div className="error">{error}</div>}
      {isWinter() && <div className="banner">❄️ Mode hiver : les fréquences d&apos;hiver s&apos;appliquent (nov. à mars).</div>}

      {!data && !error && <p className="muted">Chargement…</p>}

      {data && data.plants.length === 0 && (
        <div className="empty">
          <span className="big">🪴</span>
          Aucune plante pour l&apos;instant.
          <div style={{ marginTop: 12 }}>
            <Link href="/plantes/nouvelle" className="btn primary">Ajouter ma première plante</Link>
          </div>
        </div>
      )}

      {data && data.plants.length > 0 && due.length === 0 && (
        <div className="empty">
          <span className="big">🌿</span>
          Tout est fait pour aujourd&apos;hui, bravo !
        </div>
      )}

      {CARE_TYPES.map((c) => {
        const list = due.filter((t) => t.care_type === c.code);
        if (list.length === 0) return null;
        return (
          <section key={c.code} className="card flush">
            <div className="group-head">
              <h2>
                {c.emoji} {c.label} <span className="muted">({list.length})</span>
              </h2>
              {list.length > 1 && (
                <button className="btn sm" disabled={busy !== null} onClick={() => done(list, `all-${c.code}`)}>
                  Tout fait ✓
                </button>
              )}
            </div>
            {list.map((t) => {
              const p = plantById.get(t.plant_id);
              if (!p) return null;
              const late = lateBy(t) ?? 0;
              return (
                <div className="row" key={t.id}>
                  <Link href={`/plantes/${p.id}`}>
                    <PlantPhoto path={p.photo_path} alt={p.name} />
                  </Link>
                  <div className="grow">
                    <div className="name">{p.name}</div>
                    <div className="small muted">
                      {p.room ? `${p.room} · ` : ''}
                      {t.last_done ? `dernier : ${fmtDate(t.last_done)}` : 'jamais fait'}
                    </div>
                  </div>
                  {late > 0 && <span className="badge late">{dueLabel(late)}</span>}
                  <button className="btn primary sm" disabled={busy !== null} onClick={() => done([t], t.id)}>
                    Fait ✓
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}

      {upcoming.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h2>À venir (3 jours)</h2>
          <div className="card flush">
            {upcoming.map((t) => {
              const p = plantById.get(t.plant_id);
              if (!p) return null;
              const c = CARE_TYPES.find((x) => x.code === t.care_type);
              const due = nextDue(t) ?? today();
              return (
                <Link href={`/plantes/${p.id}`} className="row" key={t.id}>
                  <div className="grow">
                    <div className="name">
                      {c?.emoji} {p.name}
                    </div>
                    <div className="small muted">{c?.label}</div>
                  </div>
                  <span className="badge soon">{dueLabel(lateBy(t) ?? 0)}</span>
                  <span className="small muted">{fmtDate(due)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <Link href="/plantes/nouvelle" className="fab" aria-label="Ajouter une plante">+</Link>
    </>
  );
}
