import { db, BUCKET } from './supabase';
import { today } from './care';
import type { Log, Plant, Task } from './types';

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
export async function addBilan(plantId: string, health: number, note: string): Promise<void> {
  const day = today();
  const ins = await db()
    .from('plantes_logs')
    .insert({ plant_id: plantId, care_type: 'bilan', done_on: day, health, note: note.trim() || null });
  if (ins.error) throw ins.error;
  const upd = await db()
    .from('plantes_tasks')
    .update({ last_done: day })
    .eq('plant_id', plantId)
    .eq('care_type', 'bilan');
  if (upd.error) throw upd.error;
}

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
