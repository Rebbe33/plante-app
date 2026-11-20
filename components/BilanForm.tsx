'use client';

import { useMemo, useState } from 'react';
import AdviceCard from '@/components/AdviceCard';
import { addBilan, applyActions, errMsg } from '@/lib/api';
import { evaluateSpot, needsFor } from '@/lib/besoins';
import { HEALTH } from '@/lib/care';
import { SOILS, SYMPTOM_GROUPS, buildAdvice, plantKind } from '@/lib/diagnostic';
import type { Advice, Soil } from '@/lib/diagnostic';
import { CATEGORIES } from '@/lib/species';
import type { Plant, Spot, Task } from '@/lib/types';

/**
 * Questionnaire de bilan + conseils qui en découlent.
 * Utilisé sur la fiche plante et sur l'écran « Aujourd'hui ».
 * - onChanged : appelé après chaque écriture (bilan enregistré, ajustement appliqué)
 * - onClose   : si fourni, un bouton « Fermer » apparaît (sous le formulaire et sous les conseils)
 */
export default function BilanForm({
  plant,
  tasks,
  spots,
  onChanged,
  onClose,
}: {
  plant: Plant;
  tasks: Task[];
  spots: Spot[];
  onChanged?: () => Promise<void> | void;
  onClose?: () => void;
}) {
  const [health, setHealth] = useState<number | null>(null);
  const [soil, setSoil] = useState<Soil | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [advice, setAdvice] = useState<Advice[] | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = useMemo(() => plantKind(plant.species, plant.name), [plant.species, plant.name]);

  const toggle = (code: string) =>
    setSymptoms((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function save() {
    if (health === null) return;
    setBusy(true);
    setError(null);
    try {
      const spot = spots.find((x) => x.id === plant.spot_id) ?? null;
      const placement = spot
        ? { spotName: spot.name, issues: evaluateSpot(needsFor(plant.species, plant.name), spot).issues }
        : null;
      const list = buildAdvice({ health, soil, symptoms, kind, tasks, placement });
      await addBilan(plant.id, health, note, soil, symptoms);
      setAdvice(list);
      setApplied([]);
      await onChanged?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply(a: Advice) {
    setBusy(true);
    setError(null);
    try {
      await applyActions(plant.id, a.actions, a.title, kind, a.cond ? [a.cond] : []);
      setApplied((prev) => [...prev, a.id]);
      await onChanged?.();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (advice) {
    return (
      <div style={{ scrollMarginTop: 12 }}>
        {error && <div className="error">{error}</div>}
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
            onApply={apply}
          />
        ))}
        <button
          className="btn sm"
          onClick={() => {
            setAdvice(null);
            setHealth(null);
            setSoil(null);
            setSymptoms([]);
            setNote('');
            onClose?.();
          }}
        >
          Fermer les conseils
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {error && <div className="error">{error}</div>}
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
                onClick={() => toggle(i.code)}
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
      <div className="btn-row">
        <button className="btn primary" disabled={busy || health === null} onClick={save}>
          Enregistrer le bilan
        </button>
        {onClose && (
          <button className="btn" disabled={busy} onClick={onClose}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
