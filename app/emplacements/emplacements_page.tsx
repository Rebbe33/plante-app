'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SPOTS_HINT, deleteSpot, errMsg, isMissingSpots, loadAll, loadSpots, saveSpot } from '@/lib/api';
import type { SpotValues } from '@/lib/api';
import {
  AIR_OPTIONS,
  DISTANCE_OPTIONS,
  ORIENTATION_OPTIONS,
  TEMP_OPTIONS,
  lightLabel,
  lightScore,
  spotSummary,
} from '@/lib/besoins';
import type { Plant, Spot } from '@/lib/types';

const EMPTY: SpotValues = {
  name: '',
  orientation: null,
  distance: 'proche',
  sheer: false,
  temp_winter: null,
  humidity: null,
  draft: false,
  radiator: false,
  notes: null,
};

export default function SpotsPage() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<SpotValues>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([loadSpots(), loadAll()]);
      setSpots(s);
      setPlants(p.plants);
      setError(null);
    } catch (e) {
      setError(isMissingSpots(e) ? SPOTS_HINT : errMsg(e));
      setSpots((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plantsBySpot = useMemo(() => {
    const m = new Map<string, Plant[]>();
    for (const p of plants) {
      if (!p.spot_id) continue;
      m.set(p.spot_id, [...(m.get(p.spot_id) ?? []), p]);
    }
    return m;
  }, [plants]);

  function startNew() {
    setForm(EMPTY);
    setEditing('new');
  }

  function startEdit(s: Spot) {
    setForm({
      name: s.name,
      orientation: s.orientation,
      distance: s.distance,
      sheer: s.sheer,
      temp_winter: s.temp_winter,
      humidity: s.humidity,
      draft: s.draft,
      radiator: s.radiator,
      notes: s.notes,
    });
    setEditing(s.id);
  }

  const set = <K extends keyof SpotValues>(k: K, v: SpotValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Donne un nom à cet emplacement.');
      return;
    }
    setBusy(true);
    try {
      await saveSpot(
        {
          ...form,
          name: form.name.trim(),
          notes: form.notes?.trim() || null,
          distance: form.orientation === 'aucune' ? null : form.distance,
        },
        editing && editing !== 'new' ? editing : undefined
      );
      setEditing(null);
      await load();
    } catch (err) {
      setError(isMissingSpots(err) ? SPOTS_HINT : errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Spot) {
    const n = plantsBySpot.get(s.id)?.length ?? 0;
    const msg = n
      ? `Supprimer « ${s.name} » ? Les ${n} plante(s) qui y sont resteront, mais sans emplacement.`
      : `Supprimer « ${s.name} » ?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteSpot(s.id);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const liveLight = lightScore(form);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes emplacements 📍</h1>
          <p className="sub">Décris tes pièces une fois : l&apos;appli juge où chaque plante est le mieux.</p>
        </div>
        {editing === null && (
          <button className="btn primary sm" onClick={startNew}>
            + Ajouter
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {editing !== null && (
        <form className="card" onSubmit={submit}>
          <h2>{editing === 'new' ? 'Nouvel emplacement' : "Modifier l'emplacement"}</h2>
          <label className="field">
            Nom *
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Salon, fenêtre sud"
            />
          </label>

          <div className="q-title">Lumière</div>
          <label className="field">
            Orientation de la fenêtre
            <select value={form.orientation ?? ''} onChange={(e) => set('orientation', e.target.value || null)}>
              <option value="">— Je ne sais pas —</option>
              {ORIENTATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {form.orientation && form.orientation !== 'aucune' && (
            <>
              <label className="field">
                Distance de la fenêtre
                <select value={form.distance ?? 'proche'} onChange={(e) => set('distance', e.target.value)}>
                  {DISTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-line">
                <input type="checkbox" checked={form.sheer} onChange={(e) => set('sheer', e.target.checked)} />
                Voilage ou rideau fin devant la fenêtre
              </label>
            </>
          )}
          <p className="small muted" style={{ marginTop: 6 }}>
            {liveLight !== null ? (
              <>
                Lumière estimée : <strong>{lightLabel(liveLight)}</strong>.
              </>
            ) : (
              "Place-toi face à la fenêtre pour trouver l'orientation : en France, le soleil de midi est plein sud."
            )}
          </p>

          <div className="q-title">Climat</div>
          <div className="grid2">
            <label className="field">
              Température en hiver
              <select value={form.temp_winter ?? ''} onChange={(e) => set('temp_winter', e.target.value || null)}>
                <option value="">—</option>
                {TEMP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Air
              <select value={form.humidity ?? ''} onChange={(e) => set('humidity', e.target.value || null)}>
                <option value="">—</option>
                {AIR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="check-line">
            <input type="checkbox" checked={form.radiator} onChange={(e) => set('radiator', e.target.checked)} />
            Près d&apos;un radiateur ou d&apos;une source de chaleur
          </label>
          <label className="check-line">
            <input type="checkbox" checked={form.draft} onChange={(e) => set('draft', e.target.checked)} />
            Courants d&apos;air (porte ou fenêtre souvent ouverte)
          </label>

          <label className="field" style={{ marginTop: 12 }}>
            Notes
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              style={{ minHeight: 56 }}
              placeholder="Étagère haute, rebord de fenêtre…"
            />
          </label>

          <div className="btn-row">
            <button className="btn primary" disabled={busy}>
              Enregistrer
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {!spots && !error && <p className="muted">Chargement…</p>}

      {spots && spots.length === 0 && editing === null && !error && (
        <div className="empty">
          <span className="big">📍</span>
          Aucun emplacement pour l&apos;instant.
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={startNew}>
              Créer mon premier emplacement
            </button>
          </div>
        </div>
      )}

      {spots?.map((s) => {
        const list = plantsBySpot.get(s.id) ?? [];
        return (
          <div className="card" key={s.id}>
            <div className="page-head" style={{ marginBottom: 4 }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>{s.name}</h2>
                <div className="small muted">{spotSummary(s)}</div>
              </div>
              <div className="btn-row">
                <button className="btn sm" disabled={busy} onClick={() => startEdit(s)}>
                  Modifier
                </button>
                <button className="btn sm danger" disabled={busy} onClick={() => remove(s)}>
                  Supprimer
                </button>
              </div>
            </div>
            {s.notes && <div className="small">{s.notes}</div>}
            <div className="small" style={{ marginTop: 8 }}>
              {list.length === 0 ? (
                <span className="muted">Aucune plante ici.</span>
              ) : (
                <>
                  <span className="muted">{list.length} plante{list.length > 1 ? 's' : ''} :</span>{' '}
                  {list.map((p, i) => (
                    <span key={p.id}>
                      <Link href={`/plantes/${p.id}`} className="linklike">
                        {p.name}
                      </Link>
                      {i < list.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
