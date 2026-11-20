'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AdviceCard from '@/components/AdviceCard';
import { SPOTS_HINT, applyActions, errMsg, moveToSpot } from '@/lib/api';
import {
  conditionAdvice,
  evaluateSpot,
  humidityLabel,
  lightWanted,
  needsFor,
  rankSpots,
  spotSummary,
} from '@/lib/besoins';
import type { Advice, Kind } from '@/lib/diagnostic';
import type { Plant, Spot, Task } from '@/lib/types';

/**
 * Section « Emplacement et conditions » de la fiche plante :
 * ce qu'elle aime, si elle est bien placée, où elle serait mieux, et les réglages du programme qui en découlent.
 */
export default function Conditions({
  plant,
  tasks,
  spots,
  spotsError,
  kind,
  onChanged,
}: {
  plant: Plant;
  tasks: Task[];
  spots: Spot[];
  /** message affiché si les emplacements ne sont pas encore activés dans Supabase */
  spotsError: boolean;
  kind: Kind | null;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[]>([]);

  const needs = useMemo(() => needsFor(plant.species, plant.name), [plant.species, plant.name]);
  const wanted = lightWanted(needs);
  const spot = spots.find((s) => s.id === plant.spot_id) ?? null;
  const ev = useMemo(() => (spot ? evaluateSpot(needs, spot) : null), [needs, spot]);

  // Emplacements qui lui conviendraient nettement mieux que l'actuel
  const better = useMemo(() => {
    const cur = ev ? ev.fit : -1;
    return rankSpots(needs, spots)
      .filter((r) => r.spot.id !== plant.spot_id && r.ev.fit >= cur + 10)
      .slice(0, 3);
  }, [needs, spots, ev, plant.spot_id]);

  const advice = useMemo(
    () => conditionAdvice({ plant, kind, needs, spot, tasks }),
    [plant, kind, needs, spot, tasks]
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const move = (to: Spot | null) => run(() => moveToSpot(plant, to, spots));

  const apply = (a: Advice) =>
    run(async () => {
      await applyActions(plant.id, a.actions, a.title, kind, a.cond ? [a.cond] : []);
      setApplied((prev) => [...prev, a.id]);
    });

  return (
    <>
      <h2>Emplacement et conditions</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="q-title" style={{ marginTop: 0 }}>
          Ce qu&apos;elle aime <span className="muted">(repères généraux)</span>
        </div>
        <ul className="needs">
          <li>
            💡 Lumière : <strong>{wanted.label}</strong>
            {needs.variegated && <span className="muted"> (variété panachée : plus de lumière)</span>}
          </li>
          <li>
            💧 Humidité de l&apos;air : <strong>{humidityLabel(needs.humidity)}</strong>
          </li>
          <li>
            🌡️ Température : pas moins de <strong>{needs.tempMin} °C</strong>
            {needs.drafts && <span className="muted"> · sensible aux courants d&apos;air</span>}
          </li>
        </ul>
        {needs.source === 'defaut' && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Espèce non reconnue : besoins moyens. Renseigne l&apos;espèce dans « Modifier » pour des repères plus précis.
          </p>
        )}
      </div>

      {spotsError ? (
        <div className="banner">{SPOTS_HINT}</div>
      ) : spots.length === 0 ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Pour savoir si elle est bien placée, décris d&apos;abord tes pièces (lumière, température, air).
          </p>
          <Link href="/emplacements" className="btn primary sm">
            Créer mes emplacements
          </Link>
        </div>
      ) : (
        <div className="card">
          <label className="field" style={{ marginBottom: 8 }}>
            Où est-elle ?
            <select
              value={plant.spot_id ?? ''}
              disabled={busy}
              onChange={(e) => move(spots.find((s) => s.id === e.target.value) ?? null)}
            >
              <option value="">— Aucun emplacement —</option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {spot && ev && (
            <>
              <div className="small muted" style={{ marginBottom: 8 }}>
                {spotSummary(spot)}
              </div>
              <div className={`fit ${ev.worst}`}>
                {ev.worst === 'ok' ? '✅ Bien placée' : ev.worst === 'warn' ? '🟡 Presque idéal' : '⚠️ Mal placée'} ·
                adéquation {ev.fit} %
              </div>
              {ev.issues.map((i, idx) => (
                <div className={`advice ${i.level === 'alert' ? 'alert' : 'adjust'}`} key={idx}>
                  <div className="small">{i.text}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    → {i.fix}
                  </div>
                </div>
              ))}
              {ev.light === null && (
                <p className="small muted">
                  La fenêtre de cet emplacement n&apos;est pas renseignée : la lumière n&apos;est pas évaluée.{' '}
                  <Link href="/emplacements" className="linklike">
                    Compléter
                  </Link>
                </p>
              )}
            </>
          )}

          {better.length > 0 && (
            <>
              <div className="q-title">Elle serait mieux ici</div>
              {better.map(({ spot: s, ev: e }) => (
                <div className="row bare" key={s.id}>
                  <div className="grow">
                    <div className="name">{s.name}</div>
                    <div className="small muted">
                      {e.fit} % ·{' '}
                      {e.issues.length === 0 ? 'aucun problème détecté' : e.issues.map((i) => i.text.split(':')[0]).join(', ')}
                    </div>
                  </div>
                  <button className="btn sm" disabled={busy} onClick={() => move(s)}>
                    Déplacer ici
                  </button>
                </div>
              ))}
            </>
          )}
          {spot && ev && better.length === 0 && ev.worst !== 'ok' && spots.length > 1 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Aucun de tes autres emplacements ne lui convient mieux.
            </p>
          )}
        </div>
      )}

      {advice.length > 0 && (
        <>
          <div className="q-title">Programme selon ses conditions</div>
          <p className="small muted" style={{ marginTop: 0 }}>
            Suggestions seulement : rien ne change sans ton clic.
          </p>
          {advice.map((a) => (
            <AdviceCard
              key={a.id}
              advice={a}
              tasks={tasks}
              kind={kind}
              done={applied.includes(a.id)}
              busy={busy}
              onApply={apply}
            />
          ))}
        </>
      )}
    </>
  );
}
