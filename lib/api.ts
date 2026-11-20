import { db, BUCKET } from './supabase';
import { careInfo, today } from './care';
import { describeChange, planChange } from './diagnostic';
import type { Action, Kind } from './diagnostic';
import type { Log, Plant, Spot, Task } from './types';

export async function loadAll(includeArchived = false): Promise<{ plants: Plant[]; tasks: Task[] }> {
  let q = db().from('plantes_plants').select('*').order('name');
  if (!includeArchived) q = q.eq('archived', false);
  const [p, t] = await Promise.all([q, db().from('plantes_tasks').select('*').eq('active', true)]);
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  const plants = (p.data ?? []) as Plant[];
  const ids = new Set(plants.map((x) => x.id));
  const tasks = ((t.data ?? []) as Task[]).filter((x) => ids.has(x.plant_id));
  return { plants, tasks };
}

/** Marque un ou plusieurs soins comme faits aujourd'hui. */
export async function markDone(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;
  const day = today();
  const logs = tasks.map((t) => ({ plant_id: t.plant_id, care_type: t.care_type, done_on: day }));
  const ins = await db().from('plantes_logs').insert(logs);
  if (ins.error) throw ins.error;
  const upd = await db()
    .from('plantes_tasks')
    .update({ last_done: day })
    .in('id', tasks.map((t) => t.id));
  if (upd.error) throw upd.error;
}

/** Enregistre un bilan santé (et repousse l'échéance du soin "bilan" si elle existe). */
export async function addBilan(
  plantId: string,
  health: number,
  note: string,
  soil: string | null,
  symptoms: string[]
): Promise<void> {
  const day = today();
  const ins = await db()
    .from('plantes_logs')
    .insert({
      plant_id: plantId,
      care_type: 'bilan',
      done_on: day,
      health,
      note: note.trim() || null,
      soil,
      symptoms: symptoms.length ? symptoms : null,
    });
  if (ins.error) {
    if (/symptoms|soil/.test(ins.error.message)) {
      throw new Error(
        "La base n'est pas à jour : lance supabase/plantes_bilan.sql dans le SQL Editor de Supabase, puis réessaie."
      );
    }
    throw ins.error;
  }
  const upd = await db()
    .from('plantes_tasks')
    .update({ last_done: day })
    .eq('plant_id', plantId)
    .eq('care_type', 'bilan');
  if (upd.error) throw upd.error;
}

/**
 * Applique les ajustements d'un conseil au programme de la plante.
 * Relit les tâches juste avant (pour partir des fréquences à jour) et garde une trace dans l'historique.
 * `cond` : facteurs de conditions à mémoriser sur la plante (ajustements liés à l'emplacement et au pot).
 */
export async function applyActions(
  plantId: string,
  actions: Action[],
  reason: string,
  kind: Kind | null = null,
  cond: { care: string; value: number }[] = []
): Promise<void> {
  const cur = await db().from('plantes_tasks').select('*').eq('plant_id', plantId);
  if (cur.error) throw cur.error;
  const tasks = (cur.data ?? []) as Task[];

  const rows: Array<{
    plant_id: string;
    care_type: string;
    freq_summer: number;
    freq_winter: number | null;
    last_done: string | null;
    active: boolean;
  }> = [];
  const logs: Array<{ plant_id: string; care_type: string; done_on: string; note: string }> = [];

  for (const act of actions) {
    const task = tasks.find((t) => t.care_type === act.care);
    const ch = planChange(act, task, new Date(), kind);
    if (!ch) continue;
    const def = careInfo(act.care);
    const row = {
      plant_id: plantId,
      care_type: act.care,
      freq_summer: task?.freq_summer ?? def.freqSummer,
      freq_winter: task ? task.freq_winter : def.freqWinter,
      last_done: task?.last_done ?? null,
      active: true,
    };
    if (ch.type === 'freq') {
      row[ch.field] = ch.to;
    } else if (ch.type === 'freq_all') {
      if (ch.summer !== null) row.freq_summer = ch.summer;
      if (ch.winter !== null) row.freq_winter = ch.winter;
    } else {
      row.last_done = null; // à faire dès maintenant
    }
    rows.push(row);
    logs.push({ plant_id: plantId, care_type: 'ajustement', done_on: today(), note: `${describeChange(ch)} — ${reason}` });
  }

  if (rows.length > 0) {
    const up = await db().from('plantes_tasks').upsert(rows, { onConflict: 'plant_id,care_type' });
    if (up.error) throw up.error;
    const ins = await db().from('plantes_logs').insert(logs);
    if (ins.error) throw ins.error;
  }

  // On mémorise les facteurs même si une borne a empêché le changement : le conseil ne reviendra pas en boucle
  if (cond.length > 0) {
    const p = await db().from('plantes_plants').select('cond_factors').eq('id', plantId).single();
    if (p.error) throw p.error;
    const merged: Record<string, number> = { ...((p.data?.cond_factors as Record<string, number> | null) ?? {}) };
    for (const c of cond) merged[c.care] = c.value;
    const upd = await db().from('plantes_plants').update({ cond_factors: merged }).eq('id', plantId);
    if (upd.error) throw upd.error;
  }
}

// ---------- Emplacements ----------

export type SpotValues = Omit<Spot, 'id' | 'created_at'>;

export async function loadSpots(): Promise<Spot[]> {
  const { data, error } = await db().from('plantes_spots').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Spot[];
}

export async function saveSpot(values: SpotValues, id?: string): Promise<void> {
  const q = id
    ? db().from('plantes_spots').update(values).eq('id', id)
    : db().from('plantes_spots').insert(values);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteSpot(id: string): Promise<void> {
  const { error } = await db().from('plantes_spots').delete().eq('id', id);
  if (error) throw error;
}

/** Déplace une plante vers un emplacement (null = aucun) et garde une trace dans l'historique. */
export async function moveToSpot(plant: Plant, to: Spot | null, spots: Spot[]): Promise<void> {
  const { error } = await db().from('plantes_plants').update({ spot_id: to ? to.id : null }).eq('id', plant.id);
  if (error) throw error;
  if (to) {
    const from = spots.find((s) => s.id === plant.spot_id);
    const ins = await db().from('plantes_logs').insert({
      plant_id: plant.id,
      care_type: 'ajustement',
      done_on: today(),
      note: `📍 Déplacée : ${from ? from.name : 'sans emplacement'} → ${to.name}`,
    });
    if (ins.error) throw ins.error;
  }
}

export function isMissingSpots(e: unknown): boolean {
  return /plantes_spots|spot_id|cond_factors|pot_material|pot_drainage/.test(errMsg(e));
}

export const SPOTS_HINT =
  "Les emplacements ne sont pas encore activés : lance supabase/plantes_emplacements.sql dans le SQL Editor de Supabase.";

export async function loadPlant(id: string): Promise<{ plant: Plant; tasks: Task[]; logs: Log[] }> {
  const [p, t, l] = await Promise.all([
    db().from('plantes_plants').select('*').eq('id', id).single(),
    db().from('plantes_tasks').select('*').eq('plant_id', id),
    db()
      .from('plantes_logs')
      .select('*')
      .eq('plant_id', id)
      .order('done_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  if (l.error) throw l.error;
  return { plant: p.data as Plant, tasks: (t.data ?? []) as Task[], logs: (l.data ?? []) as Log[] };
}

export async function deletePlant(plant: Plant): Promise<void> {
  if (plant.photo_path) {
    await db().storage.from(BUCKET).remove([plant.photo_path]);
  }
  const { error } = await db().from('plantes_plants').delete().eq('id', plant.id);
  if (error) throw error;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await db().from('plantes_plants').update({ archived }).eq('id', id);
  if (error) throw error;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
