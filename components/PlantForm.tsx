'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CARE_TYPES } from '@/lib/care';
import { db, BUCKET, photoUrl } from '@/lib/supabase';
import { errMsg } from '@/lib/api';
import { resizeImage } from '@/lib/image';
import { CATEGORIES, categorySuggestion, findSuggestion, guessCategory } from '@/lib/species';
import type { Suggestion } from '@/lib/species';
import { searchPlants } from '@/lib/wiki';
import type { WikiResult } from '@/lib/wiki';
import type { Plant, Task } from '@/lib/types';

type CareState = { active: boolean; summer: string; winter: string; last: string };

function initialCares(tasks: Task[] | undefined): Record<string, CareState> {
  const out: Record<string, CareState> = {};
  for (const c of CARE_TYPES) {
    const t = tasks?.find((x) => x.care_type === c.code);
    if (t) {
      out[c.code] = {
        active: t.active,
        summer: String(t.freq_summer),
        winter: t.freq_winter === null ? '' : String(t.freq_winter),
        last: t.last_done ?? '',
      };
    } else {
      out[c.code] = {
        // en édition, un soin sans ligne existante reste décoché ; en création on suit les défauts
        active: tasks ? false : c.defaultActive,
        summer: String(c.freqSummer),
        winter: c.freqWinter === null ? '' : String(c.freqWinter),
        last: '',
      };
    }
  }
  return out;
}

export default function PlantForm({
  plant,
  tasks,
  initial,
  wishId,
}: {
  plant?: Plant;
  tasks?: Task[];
  /** préremplissage (ex. depuis la liste de souhaits) */
  initial?: { name?: string; species?: string };
  /** souhait à marquer comme acquis après la création */
  wishId?: string;
}) {
  const router = useRouter();
  const isNew = !plant;
  const [name, setName] = useState(plant?.name ?? initial?.name ?? '');
  const [species, setSpecies] = useState(plant?.species ?? initial?.species ?? '');
  const [room, setRoom] = useState(plant?.room ?? '');
  const [exposure, setExposure] = useState(plant?.exposure ?? '');
  const [notes, setNotes] = useState(plant?.notes ?? '');
  const [purchase, setPurchase] = useState(plant?.purchase_date ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl(plant?.photo_path));
  const [cares, setCares] = useState<Record<string, CareState>>(() => initialCares(tasks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Programme de soins automatique ---
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [category, setCategory] = useState('');
  // true dès que tu modifies toi-même un soin : on n'écrase plus rien automatiquement
  const touched = useRef(false);
  const exposureTouched = useRef(!!plant?.exposure);

  // --- Recherche en ligne (Wikipédia) ---
  const [results, setResults] = useState<WikiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [picked, setPicked] = useState<WikiResult | null>(null);

  useEffect(() => {
    const q = species.trim();
    if (!showResults || q.length < 3 || picked?.title === q) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlants(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setSearchErr(false);
          setSearching(false);
        })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setSearchErr(true);
          setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [species, showResults, picked]);

  function pick(r: WikiResult) {
    setPicked(r);
    setSpecies(r.title);
    setResults([]);
    setShowResults(false);
    touched.current = false;
    setCategory('');
  }

  function setCare(code: string, patch: Partial<CareState>) {
    touched.current = true;
    setCares((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  }

  /** Applique un programme conseillé (garde les dates de dernier soin déjà saisies). */
  function applyProfile(s: Suggestion, force = false) {
    setSuggestion(s);
    setCares((prev) => {
      const next: Record<string, CareState> = {};
      for (const c of CARE_TYPES) {
        const rule = s.profile.cares[c.code];
        const cur = prev[c.code];
        if (!rule) {
          next[c.code] = cur;
          continue;
        }
        next[c.code] = {
          active: rule.active,
          summer: rule.active ? String(rule.summer) : cur.summer,
          winter: rule.active ? (rule.winter === null ? '' : String(rule.winter)) : cur.winter,
          last: cur.last,
        };
      }
      return next;
    });
    if (force || !exposureTouched.current) {
      if (!exposureTouched.current || force) setExposure(s.profile.exposure);
    }
    touched.current = false;
  }

  // Détection automatique à la saisie du nom / de l'espèce (création uniquement, tant que rien n'est modifié à la main)
  useEffect(() => {
    if (!isNew || touched.current || category) return;
    // 1) ma base de plantes courantes, 2) à défaut, un type déduit de la description Wikipédia
    let found = findSuggestion(species, name);
    if (!found && picked && picked.title === species.trim()) {
      const g = guessCategory(picked.title, picked.extract);
      if (g) found = { ...g, title: `${picked.title} · ${g.profile.label}` };
    }
    if (found) {
      if (suggestion?.title !== found.title) applyProfile(found);
    } else if (suggestion) {
      setSuggestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, species, isNew, category, picked]);

  function onCategory(code: string) {
    setCategory(code);
    const s = categorySuggestion(code);
    if (s) applyProfile(s, true);
  }

  function reapply() {
    const s = (category ? categorySuggestion(category) : null) ?? findSuggestion(species, name);
    if (s) applyProfile(s, true);
  }

  function onFile(f: File | null) {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom à ta plante.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name: name.trim(),
        species: species.trim() || null,
        room: room.trim() || null,
        exposure: exposure || null,
        notes: notes.trim() || null,
        purchase_date: purchase || null,
      };

      let id = plant?.id;
      if (id) {
        const { error } = await db().from('plantes_plants').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await db().from('plantes_plants').insert(fields).select('id').single();
        if (error) throw error;
        id = data.id as string;
      }

      if (wishId && !plant && id) {
        // lie le souhait à la plante créée ; sans gravité si ça échoue
        await db().from('plantes_wishlist').update({ owned: true, plant_id: id }).eq('id', wishId);
      }

      if (file && id) {
        const blob = await resizeImage(file);
        const path = `${id}/${Date.now()}.jpg`;
        const up = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const upd = await db().from('plantes_plants').update({ photo_path: path }).eq('id', id);
        if (upd.error) throw upd.error;
        if (plant?.photo_path) await db().storage.from(BUCKET).remove([plant.photo_path]);
      }

      const rows = CARE_TYPES.map((c) => {
        const s = cares[c.code];
        const summer = parseInt(s.summer, 10);
        return {
          plant_id: id,
          care_type: c.code,
          freq_summer: Number.isFinite(summer) && summer >= 0 ? summer : c.freqSummer,
          freq_winter: s.winter.trim() === '' ? null : Math.max(0, parseInt(s.winter, 10) || 0),
          last_done: s.last || null,
          active: s.active,
        };
      });
      const { error: tErr } = await db().from('plantes_tasks').upsert(rows, { onConflict: 'plant_id,care_type' });
      if (tErr) throw tErr;

      router.push(`/plantes/${id}`);
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  const canSuggest = !!suggestion || !!category || !!findSuggestion(species, name);

  return (
    <form onSubmit={submit}>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Infos</h2>
        <label className="field">
          Nom *
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma grosse Monstera" />
        </label>
        <div className="field">
          <label htmlFor="plantes-species-input">Espèce (recherche en ligne)</label>
          <input
            id="plantes-species-input"
            type="text"
            autoComplete="off"
            value={species}
            onChange={(e) => {
              setSpecies(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Tape au moins 3 lettres : monstera, pothos…"
          />
          {showResults && species.trim().length >= 3 && (searching || results.length > 0 || searchErr) && (
            <div className="results">
              {searching && <div className="result-msg">Recherche…</div>}
              {searchErr && <div className="result-msg">Recherche indisponible, tu peux saisir l&apos;espèce à la main.</div>}
              {results.map((r) => (
                <button type="button" className="result" key={r.title} onClick={() => pick(r)}>
                  {r.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumb} alt="" className="thumb" />
                  ) : (
                    <div className="thumb">🌿</div>
                  )}
                  <span className="grow">
                    <strong>{r.title}</strong>
                    <span className="small muted result-extract">{r.extract}</span>
                  </span>
                </button>
              ))}
              {!searching && (
                <div className="result-msg small">
                  Source : Wikipédia ·{' '}
                  <button type="button" className="linklike" onClick={() => setShowResults(false)}>
                    Fermer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid2">
          <label className="field">
            Pièce
            <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Salon" list="plantes-rooms" />
            <datalist id="plantes-rooms">
              {['Salon', 'Cuisine', 'Chambre', 'Salle de bain', 'Bureau', 'Entrée', 'Terrasse'].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Exposition
            <select
              value={exposure}
              onChange={(e) => {
                exposureTouched.current = true;
                setExposure(e.target.value);
              }}
            >
              <option value="">—</option>
              <option>Plein soleil</option>
              <option>Lumineux</option>
              <option>Mi-ombre</option>
              <option>Ombre</option>
            </select>
          </label>
        </div>
        <label className="field">
          Date d&apos;achat
          <input type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
        </label>
        <label className="field">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Arrosage par le bas, aime l'humidité…" />
        </label>
        <label className="field">
          Photo
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" className="thumb lg" style={{ height: 160, marginBottom: 8, objectFit: 'cover' }} />}
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="card">
        <h2>Soins</h2>

        {suggestion ? (
          <div className="suggest">
            <div>
              <strong>✨ Programme conseillé : {suggestion.title}</strong>
              <div className="small">{suggestion.profile.tip}</div>
            </div>
            <button type="button" className="btn sm" onClick={reapply}>
              Réappliquer
            </button>
          </div>
        ) : (
          isNew && (
            <p className="sub">
              Tape l&apos;espèce ci-dessus et le programme se remplit tout seul, ou choisis un type de plante :
            </p>
          )
        )}

        <label className="field">
          Type de plante (programme automatique)
          <select value={category} onChange={(e) => onCategory(e.target.value)}>
            <option value="">{suggestion && !category ? 'Détecté automatiquement' : '— Choisir —'}</option>
            {Object.entries(CATEGORIES).map(([code, p]) => (
              <option key={code} value={code}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {!isNew && canSuggest && !suggestion && (
          <div style={{ marginBottom: 12 }}>
            <button type="button" className="btn sm" onClick={reapply}>
              ✨ Appliquer le programme conseillé
            </button>
          </div>
        )}

        <p className="sub">
          Fréquences en jours. Hiver (nov. à mars) : laisse vide pour garder la fréquence d&apos;été, ou mets 0 pour
          mettre le soin en pause. Tu peux tout ajuster.
        </p>
        {CARE_TYPES.map((c) => {
          const s = cares[c.code];
          return (
            <div key={c.code} className={`care-block ${s.active ? '' : 'off'}`}>
              <label className="care-title">
                <input type="checkbox" checked={s.active} onChange={(e) => setCare(c.code, { active: e.target.checked })} />
                {c.emoji} {c.label}
              </label>
              {s.active && (
                <div className="grid3">
                  <label className="field">
                    Été
                    <input type="number" min={0} inputMode="numeric" value={s.summer} onChange={(e) => setCare(c.code, { summer: e.target.value })} />
                  </label>
                  <label className="field">
                    Hiver
                    <input type="number" min={0} inputMode="numeric" value={s.winter} placeholder="= été" onChange={(e) => setCare(c.code, { winter: e.target.value })} />
                  </label>
                  <label className="field">
                    Dernier soin
                    <input type="date" value={s.last} onChange={(e) => setCare(c.code, { last: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Enregistrement…' : plant ? 'Enregistrer' : 'Ajouter la plante'}
        </button>
        <button type="button" className="btn" disabled={saving} onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
