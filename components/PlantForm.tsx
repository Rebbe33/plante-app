'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CARE_TYPES } from '@/lib/care';
import { db, BUCKET, photoUrl } from '@/lib/supabase';
import { errMsg } from '@/lib/api';
import { resizeImage } from '@/lib/image';
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

export default function PlantForm({ plant, tasks }: { plant?: Plant; tasks?: Task[] }) {
  const router = useRouter();
  const [name, setName] = useState(plant?.name ?? '');
  const [species, setSpecies] = useState(plant?.species ?? '');
  const [room, setRoom] = useState(plant?.room ?? '');
  const [exposure, setExposure] = useState(plant?.exposure ?? '');
  const [notes, setNotes] = useState(plant?.notes ?? '');
  const [purchase, setPurchase] = useState(plant?.purchase_date ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl(plant?.photo_path));
  const [cares, setCares] = useState<Record<string, CareState>>(() => initialCares(tasks));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCare(code: string, patch: Partial<CareState>) {
    setCares((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
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

  return (
    <form onSubmit={submit}>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Infos</h2>
        <label className="field">
          Nom *
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma grosse Monstera" />
        </label>
        <label className="field">
          Espèce
          <input type="text" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Monstera deliciosa" />
        </label>
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
            <select value={exposure} onChange={(e) => setExposure(e.target.value)}>
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
        <p className="sub">
          Fréquences en jours. Hiver (nov. à mars) : laisse vide pour garder la fréquence d&apos;été, ou mets 0 pour
          mettre le soin en pause.
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
