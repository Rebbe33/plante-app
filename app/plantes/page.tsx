'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlantPhoto from '@/components/PlantPhoto';
import { CARE_TYPES, dueLabel, lateBy } from '@/lib/care';
import { errMsg, loadAll } from '@/lib/api';
import type { Plant, Task } from '@/lib/types';

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [room, setRoom] = useState('');

  useEffect(() => {
    loadAll()
      .then((d) => {
        setPlants(d.plants);
        setTasks(d.tasks);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const rooms = useMemo(
    () => Array.from(new Set((plants ?? []).map((p) => p.room).filter((r): r is string => !!r))).sort(),
    [plants]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (plants ?? []).filter(
      (p) =>
        (!room || p.room === room) &&
        (!s || p.name.toLowerCase().includes(s) || (p.species ?? '').toLowerCase().includes(s))
    );
  }, [plants, q, room]);

  /** Soin le plus urgent d'une plante */
  function urgent(plantId: string) {
    let best: { t: Task; late: number } | null = null;
    for (const t of tasks) {
      if (t.plant_id !== plantId) continue;
      const late = lateBy(t);
      if (late === null) continue;
      if (!best || late > best.late) best = { t, late };
    }
    return best;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes plantes</h1>
          <p className="sub">{plants ? `${plants.length} plante${plants.length > 1 ? 's' : ''}` : ' '}</p>
        </div>
        <Link href="/plantes/nouvelle" className="btn primary sm">+ Ajouter</Link>
      </div>

      {error && <div className="error">{error}</div>}
      {!plants && !error && <p className="muted">Chargement…</p>}

      {plants && plants.length > 0 && (
        <>
          <input
            type="text"
            className="search"
            placeholder="Rechercher une plante…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {rooms.length > 0 && (
            <div className="chips">
              <button className={`chip ${room === '' ? 'active' : ''}`} onClick={() => setRoom('')}>
                Toutes
              </button>
              {rooms.map((r) => (
                <button key={r} className={`chip ${room === r ? 'active' : ''}`} onClick={() => setRoom(r)}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {plants && plants.length === 0 && (
        <div className="empty">
          <span className="big">🪴</span>
          Pas encore de plante.
        </div>
      )}

      <div className="card flush">
        {filtered.map((p) => {
          const u = urgent(p.id);
          const info = u ? CARE_TYPES.find((c) => c.code === u.t.care_type) : null;
          return (
            <Link href={`/plantes/${p.id}`} className="row" key={p.id}>
              <PlantPhoto path={p.photo_path} alt={p.name} />
              <div className="grow">
                <div className="name">{p.name}</div>
                <div className="small muted">{[p.species, p.room].filter(Boolean).join(' · ') || ' '}</div>
              </div>
              {u && info && (
                <span className={`badge ${u.late > 0 ? 'late' : u.late === 0 ? '' : 'soon'}`}>
                  {info.emoji} {dueLabel(u.late)}
                </span>
              )}
            </Link>
          );
        })}
        {plants && plants.length > 0 && filtered.length === 0 && (
          <div className="row muted">Aucun résultat.</div>
        )}
      </div>
    </>
  );
}
