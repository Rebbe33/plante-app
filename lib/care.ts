import type { Task } from './types';

export type CareDef = {
  code: string;
  label: string;
  emoji: string;
  /** fréquence par défaut (jours) en été / mi-saison */
  freqSummer: number;
  /** fréquence par défaut en hiver : null = comme l'été, 0 = en pause */
  freqWinter: number | null;
  /** coché par défaut dans le formulaire d'une nouvelle plante */
  defaultActive: boolean;
};

export const CARE_TYPES: CareDef[] = [
  { code: 'arrosage', label: 'Arrosage', emoji: '💧', freqSummer: 7, freqWinter: 14, defaultActive: true },
  { code: 'brumisation', label: 'Brumisation', emoji: '🌫️', freqSummer: 3, freqWinter: 7, defaultActive: false },
  { code: 'nettoyage', label: 'Nettoyage des feuilles', emoji: '🧽', freqSummer: 30, freqWinter: 45, defaultActive: true },
  { code: 'engrais', label: 'Engrais', emoji: '🌱', freqSummer: 30, freqWinter: 0, defaultActive: false },
  { code: 'rempotage', label: 'Rempotage', emoji: '🪴', freqSummer: 365, freqWinter: null, defaultActive: false },
  { code: 'bilan', label: 'Bilan santé', emoji: '🩺', freqSummer: 14, freqWinter: null, defaultActive: true },
];

export function careInfo(code: string): CareDef {
  return (
    CARE_TYPES.find((c) => c.code === code) ?? {
      code,
      label: code,
      emoji: '🌿',
      freqSummer: 7,
      freqWinter: null,
      defaultActive: false,
    }
  );
}

export const HEALTH = [
  { value: 3, label: 'Au top', emoji: '😀' },
  { value: 2, label: 'Moyen', emoji: '😐' },
  { value: 1, label: 'Souci', emoji: '🥀' },
];

// ---------- Dates (toutes en "YYYY-MM-DD", heure locale) ----------

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toISO(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** nombre de jours de a à b (positif si b est après a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return parseISO(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ---------- Saisonnalité ----------

/** Hiver = novembre à mars */
export function isWinter(d: Date = new Date()): boolean {
  const m = d.getMonth() + 1;
  return m >= 11 || m <= 3;
}

/** Fréquence effective aujourd'hui, ou null si le soin est en pause. */
export function effectiveFreq(t: Pick<Task, 'freq_summer' | 'freq_winter'>, d: Date = new Date()): number | null {
  const f = isWinter(d) && t.freq_winter !== null ? t.freq_winter : t.freq_summer;
  return f > 0 ? f : null;
}

/** Prochaine échéance (jamais fait = à faire aujourd'hui). null si en pause. */
export function nextDue(t: Task): string | null {
  const f = effectiveFreq(t);
  if (f === null) return null;
  return t.last_done ? addDays(t.last_done, f) : today();
}

/** > 0 : en retard de n jours · 0 : à faire aujourd'hui · < 0 : dans -n jours */
export function lateBy(t: Task): number | null {
  const due = nextDue(t);
  return due === null ? null : daysBetween(due, today());
}

export function dueLabel(n: number): string {
  if (n > 0) return `en retard de ${n} j`;
  if (n === 0) return "aujourd'hui";
  if (n === -1) return 'demain';
  return `dans ${-n} j`;
}
