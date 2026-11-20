/**
 * Besoins des plantes et conditions des emplacements.
 *
 * - Chaque plante a des besoins (lumière, humidité de l'air, température minimale, sensibilité aux courants d'air),
 *   déduits de son genre ou, à défaut, de son type. Ce sont des REPÈRES GÉNÉRAUX d'horticulture, à affiner
 *   pour les variétés rares.
 * - Chaque emplacement a des conditions (fenêtre, distance, voilage, température d'hiver, air, courants d'air, radiateur).
 * - On compare les deux : problèmes détectés, score d'adéquation, meilleur emplacement, ajustement du programme.
 *
 * Échelle de lumière (0 à 4) : 0 très faible · 1 faible · 2 moyenne · 3 vive (indirecte) · 4 soleil direct.
 */

import { norm } from './species';
import { plantKind } from './diagnostic';
import type { Advice, Kind } from './diagnostic';
import type { Plant, Spot, Task } from './types';

// ---------- Besoins d'une plante ----------

export type Humidity = 'low' | 'normal' | 'high';

type NeedsCore = {
  lightMin: number;
  lightMax: number;
  humidity: Humidity;
  /** température minimale supportée, en °C */
  tempMin: number;
  /** sensible aux courants d'air */
  drafts: boolean;
};

export type Needs = NeedsCore & {
  /** variété panachée (moins de chlorophylle : demande plus de lumière) */
  variegated: boolean;
  source: 'genre' | 'type' | 'defaut';
};

const n = (lightMin: number, lightMax: number, humidity: Humidity, tempMin: number, drafts = false): NeedsCore => ({
  lightMin,
  lightMax,
  humidity,
  tempMin,
  drafts,
});

const KIND_NEEDS: Record<Kind, NeedsCore> = {
  tropicale: n(2.2, 3.6, 'normal', 14),
  robuste: n(1.0, 3.4, 'normal', 12),
  succulente: n(3.0, 4.0, 'low', 10),
  humide: n(1.6, 2.9, 'high', 16, true),
  orchidee: n(2.4, 3.3, 'normal', 15, true),
  aromatique: n(3.0, 4.0, 'normal', 8),
  palmier: n(2.2, 3.6, 'normal', 12),
};

const DEFAULT_NEEDS: NeedsCore = n(2.0, 3.6, 'normal', 12);

/** Besoins par genre ou espèce (la clé la plus longue trouvée dans le nom l'emporte). */
const OVERRIDES: { keys: string[]; needs: NeedsCore }[] = [
  { keys: ['alocasia'], needs: n(2.6, 3.4, 'high', 16, true) },
  { keys: ['anthurium'], needs: n(2.5, 3.3, 'high', 15) },
  { keys: ['aglaonema', 'aglaoneme'], needs: n(1.2, 3.0, 'normal', 15, true) },
  { keys: ['begonia'], needs: n(2.4, 3.3, 'high', 13) },
  { keys: ['caladium'], needs: n(2.5, 3.3, 'high', 16, true) },
  { keys: ['calathea', 'goeppertia'], needs: n(1.6, 2.8, 'high', 16, true) },
  { keys: ['maranta', 'ctenanthe', 'stromanthe', 'stomanthe'], needs: n(1.8, 2.9, 'high', 16, true) },
  { keys: ['cissus'], needs: n(2.2, 3.2, 'high', 15) },
  { keys: ['coleus'], needs: n(3.2, 4.0, 'normal', 10) },
  { keys: ['dieffenbachia'], needs: n(2.0, 3.2, 'normal', 15, true) },
  { keys: ['dischidia'], needs: n(2.6, 3.6, 'normal', 14) },
  { keys: ['episcia'], needs: n(2.2, 3.0, 'high', 16) },
  { keys: ['fittonia'], needs: n(1.4, 2.6, 'high', 16, true) },
  {
    keys: ['hemionitis', 'hemiontis', 'nephrolepis', 'nephrolepsis', 'blechnum', 'phlebodium', 'davallia', 'davana', 'fougere'],
    needs: n(1.6, 2.8, 'high', 12),
  },
  { keys: ['iresine', 'herbstii', 'bloodleaf'], needs: n(3.0, 4.0, 'normal', 10) },
  { keys: ['hoya'], needs: n(2.8, 3.8, 'normal', 13) },
  { keys: ['hypoestes'], needs: n(2.2, 3.2, 'normal', 14) },
  { keys: ['jewel orchid', 'macodes', 'ludisia', 'anoectochilus'], needs: n(1.4, 2.4, 'high', 16, true) },
  { keys: ['ledebouria'], needs: n(3.0, 4.0, 'low', 8) },
  { keys: ['monstera'], needs: n(2.4, 3.6, 'normal', 13) },
  { keys: ['oxalis'], needs: n(3.0, 3.8, 'normal', 8) },
  { keys: ['peperomia'], needs: n(1.8, 3.2, 'normal', 13) },
  { keys: ['philodendron'], needs: n(2.4, 3.5, 'normal', 14) },
  { keys: ['piper'], needs: n(2.0, 3.0, 'high', 15) },
  { keys: ['rhaphidophora', 'raphidophora'], needs: n(2.4, 3.5, 'normal', 14) },
  {
    keys: ['schismatoglottis', 'apoballis', 'cercestis', 'homalomena', 'xanthosoma', 'colocasia', 'amydrium'],
    needs: n(2.0, 3.2, 'high', 16, true),
  },
  { keys: ['syngonium'], needs: n(2.0, 3.2, 'normal', 13) },
  { keys: ['pilea'], needs: n(2.4, 3.3, 'normal', 13) },
  { keys: ['ficus lyrata', 'ficus benjamina', 'benjamina', 'lyrata'], needs: n(3.0, 3.8, 'normal', 13, true) },
  { keys: ['ficus elastica', 'caoutchouc'], needs: n(2.6, 3.6, 'normal', 12) },
  { keys: ['ficus'], needs: n(2.6, 3.6, 'normal', 12, true) },
  { keys: ['schefflera', 'arbre ombrelle'], needs: n(2.0, 3.4, 'normal', 10) },
  { keys: ['polyscias'], needs: n(2.4, 3.4, 'normal', 14, true) },
  { keys: ['fatsia', 'fatshedera'], needs: n(1.4, 2.8, 'normal', 3) },
  { keys: ['strelitzia'], needs: n(3.2, 4.0, 'normal', 10) },
  { keys: ['musa', 'bananier'], needs: n(3.4, 4.0, 'high', 12) },
  { keys: ['howea', 'kentia', 'areca'], needs: n(2.2, 3.4, 'normal', 13) },
  { keys: ['dracaena', 'dracena', 'dracanea'], needs: n(1.6, 3.2, 'normal', 12) },
  { keys: ['cordyline'], needs: n(2.4, 3.4, 'normal', 10) },
  { keys: ['yucca'], needs: n(3.2, 4.0, 'low', 0) },
  { keys: ['codiaeum', 'croton'], needs: n(3.2, 4.0, 'high', 15, true) },
  { keys: ['araucaria'], needs: n(2.8, 3.6, 'normal', 8) },
  { keys: ['chlorophytum', 'chlorophyttum'], needs: n(1.8, 3.4, 'normal', 8) },
  { keys: ['spathiphyllum'], needs: n(1.4, 2.8, 'high', 14) },
  { keys: ['zamioculcas', 'zz plant'], needs: n(0.8, 3.2, 'low', 12) },
  { keys: ['sansevieria'], needs: n(1.0, 4.0, 'low', 10) },
  { keys: ['pothos', 'epipremnum', 'scindapsus'], needs: n(1.2, 3.4, 'normal', 13) },
  { keys: ['gynura'], needs: n(3.0, 3.8, 'normal', 13) },
  { keys: ['camellia', 'camelia'], needs: n(2.0, 3.0, 'normal', 0) },
  { keys: ['eucalyptus'], needs: n(3.4, 4.0, 'low', 0) },
  { keys: ['asparagus'], needs: n(2.4, 3.3, 'normal', 8) },
  { keys: ['epiphyllum'], needs: n(1.8, 3.0, 'normal', 10) },
  { keys: ['saxifraga'], needs: n(1.8, 3.0, 'normal', 0) },
  { keys: ['senecio', 'rowleyanus', 'ceropegia', 'portulacaria'], needs: n(3.0, 4.0, 'low', 8) },
  { keys: ['adenium'], needs: n(3.6, 4.0, 'low', 12) },
  { keys: ['aeschynanthus', 'aedchynantus', 'aeshynantus'], needs: n(2.4, 3.3, 'high', 15) },
  { keys: ['aloe'], needs: n(3.0, 4.0, 'low', 5) },
  { keys: ['cactus'], needs: n(3.4, 4.0, 'low', 5) },
  { keys: ['orchidee', 'phalaenopsis'], needs: n(2.4, 3.3, 'normal', 15, true) },
  { keys: ['bonsai'], needs: n(3.0, 4.0, 'normal', 5) },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KEY_RULES = OVERRIDES.flatMap((o) =>
  o.keys.map((k) => ({ key: norm(k), re: new RegExp(`(^|[^a-z])${esc(norm(k))}([^a-z]|$)`), needs: o.needs }))
);

/** Variétés panachées ou très colorées : elles ont moins de chlorophylle et demandent plus de lumière. */
const VARIEGATED = /variegat|aurea|albo|constellation|tricolor|moonshine|pink princess|white knight|snowdrift|snow country|marble/;

export function needsFor(species: string | null | undefined, name: string): Needs {
  const hay = norm(`${species ?? ''} ${name}`);
  const kind = plantKind(species, name);
  let best: (typeof KEY_RULES)[number] | null = null;
  for (const r of KEY_RULES) {
    if (r.re.test(hay) && (!best || r.key.length > best.key.length)) best = r;
  }
  const core = best ? best.needs : kind ? KIND_NEEDS[kind] : DEFAULT_NEEDS;
  return { ...core, variegated: VARIEGATED.test(hay), source: best ? 'genre' : kind ? 'type' : 'defaut' };
}

// ---------- Lumière d'un emplacement ----------

const ORIENTATIONS: { value: string; label: string; base: number }[] = [
  { value: 'sud', label: 'Sud', base: 4 },
  { value: 'ouest', label: 'Ouest', base: 3.6 },
  { value: 'est', label: 'Est', base: 3.2 },
  { value: 'nord', label: 'Nord', base: 2 },
  { value: 'aucune', label: 'Pas de fenêtre', base: 0.3 },
];

export const ORIENTATION_OPTIONS = ORIENTATIONS.map(({ value, label }) => ({ value, label }));

const DISTANCES: { value: string; label: string; penalty: number }[] = [
  { value: 'vitre', label: 'Contre la vitre (moins de 50 cm)', penalty: 0 },
  { value: 'proche', label: 'Proche (50 cm à 1,5 m)', penalty: 0.8 },
  { value: 'moyen', label: 'Moyen (1,5 à 3 m)', penalty: 1.6 },
  { value: 'loin', label: 'Loin (plus de 3 m)', penalty: 2.4 },
];

export const DISTANCE_OPTIONS = DISTANCES.map(({ value, label }) => ({ value, label }));

export const TEMP_OPTIONS = [
  { value: 'fraiche', label: 'Fraîche (moins de 15 °C)', celsius: 13 },
  { value: 'temperee', label: 'Tempérée (15 à 19 °C)', celsius: 17 },
  { value: 'chaude', label: 'Chaude (20 °C et plus)', celsius: 21 },
];

export const AIR_OPTIONS = [
  { value: 'seche', label: 'Sec (chauffage, peu de plantes)' },
  { value: 'normale', label: 'Normal' },
  { value: 'humide', label: 'Humide (salle de bain, cuisine, regroupement)' },
];

/** Lumière estimée de l'emplacement sur l'échelle 0 à 4 (null si la fenêtre n'est pas renseignée). */
export function lightScore(spot: Pick<Spot, 'orientation' | 'distance' | 'sheer'>): number | null {
  if (!spot.orientation) return null;
  const o = ORIENTATIONS.find((x) => x.value === spot.orientation);
  if (!o) return null;
  const d = spot.orientation === 'aucune' ? 0 : (DISTANCES.find((x) => x.value === spot.distance)?.penalty ?? 0.8);
  const s = o.base - d - (spot.sheer ? 0.6 : 0);
  return Math.min(4, Math.max(0, Math.round(s * 10) / 10));
}

export function lightLabel(score: number): string {
  if (score < 0.6) return 'très faible';
  if (score < 1.4) return 'faible';
  if (score < 2.4) return 'moyenne';
  if (score < 3.5) return 'vive (indirecte)';
  return 'soleil direct';
}

/** Lumière demandée par la plante, en mots (variétés panachées comprises). */
export function lightWanted(needs: Needs): { min: number; max: number; label: string } {
  const min = Math.min(3.9, needs.lightMin + (needs.variegated ? 0.4 : 0));
  const max = Math.max(needs.lightMax, min + 0.2);
  const a = lightLabel(min);
  const b = lightLabel(Math.min(4, max));
  return { min, max, label: a === b ? a : `${a} à ${b}` };
}

export function humidityLabel(h: Humidity): string {
  return h === 'high' ? 'élevée (60 % et plus)' : h === 'low' ? 'faible (air sec toléré)' : 'normale';
}

export function spotSummary(spot: Spot): string {
  const parts: string[] = [];
  const l = lightScore(spot);
  if (l !== null) parts.push(`lumière ${lightLabel(l)}`);
  const t = TEMP_OPTIONS.find((x) => x.value === spot.temp_winter);
  if (t) parts.push(`hiver ${t.value === 'fraiche' ? 'frais' : t.value === 'chaude' ? 'chaud' : 'tempéré'}`);
  const a = AIR_OPTIONS.find((x) => x.value === spot.humidity);
  if (a) parts.push(`air ${a.value === 'seche' ? 'sec' : a.value === 'humide' ? 'humide' : 'normal'}`);
  if (spot.draft) parts.push("courants d'air");
  if (spot.radiator) parts.push('près d\'un radiateur');
  return parts.join(' · ') || 'conditions non renseignées';
}

// ---------- Comparaison plante / emplacement ----------

export type Issue = {
  kind: 'light' | 'temp' | 'humidity' | 'draft';
  /** pour la lumière : trop peu (low) ou trop (high) */
  dir?: 'low' | 'high';
  level: 'alert' | 'warn';
  text: string;
  fix: string;
};

export type Evaluation = {
  /** adéquation de 0 à 100 */
  fit: number;
  issues: Issue[];
  worst: 'ok' | 'warn' | 'alert';
  light: number | null;
};

/** Humidité réelle de l'emplacement : un radiateur à côté assèche l'air d'un cran. */
function effectiveAir(spot: Spot): 'seche' | 'normale' | 'humide' {
  const a = (spot.humidity as 'seche' | 'normale' | 'humide' | null) ?? 'normale';
  if (!spot.radiator) return a;
  return a === 'humide' ? 'normale' : 'seche';
}

export function evaluateSpot(needs: Needs, spot: Spot): Evaluation {
  const issues: Issue[] = [];
  let penalty = 0;

  // Lumière
  const score = lightScore(spot);
  if (score !== null) {
    const w = lightWanted(needs);
    const d = score < w.min ? w.min - score : score > w.max ? score - w.max : 0;
    if (d > 0) {
      const low = score < w.min;
      penalty += Math.min(50, d * 40);
      if (d >= 0.8 || d >= 0.3) {
        issues.push({
          kind: 'light',
          dir: low ? 'low' : 'high',
          level: d >= 0.8 ? 'alert' : 'warn',
          text: low
            ? `${d >= 0.8 ? 'Trop sombre' : 'Un peu sombre'} : lumière ${lightLabel(score)} ici, elle préfère ${w.label}.${needs.variegated ? ' Les variétés panachées ont besoin de plus de lumière.' : ''}`
            : `${d >= 0.8 ? 'Trop de soleil' : 'Un peu trop de soleil'} : lumière ${lightLabel(score)} ici, elle préfère ${w.label}. Risque de feuilles brûlées.`,
          fix: low
            ? 'Rapproche-la de la fenêtre, enlève un voilage ou choisis un emplacement plus lumineux.'
            : 'Éloigne-la de la vitre ou ajoute un voilage pour filtrer le soleil.',
        });
      }
    }
  }

  // Température d'hiver
  const temp = TEMP_OPTIONS.find((t) => t.value === spot.temp_winter);
  if (temp) {
    if (temp.celsius < needs.tempMin) {
      penalty += 35;
      issues.push({
        kind: 'temp',
        level: 'alert',
        text: `Trop froid l'hiver : environ ${temp.celsius} °C ici, elle craint en dessous de ${needs.tempMin} °C.`,
        fix: "Choisis une pièce plus chaude pour l'hiver, loin des fenêtres froides, et espace ses arrosages tant qu'il fait frais.",
      });
    } else if (temp.celsius < needs.tempMin + 2) {
      penalty += 10;
      issues.push({
        kind: 'temp',
        level: 'warn',
        text: `Température d'hiver un peu juste : environ ${temp.celsius} °C ici pour un minimum de ${needs.tempMin} °C.`,
        fix: "Éloigne-la des vitres froides la nuit et évite de trop l'arroser quand il fait frais.",
      });
    }
  }

  // Humidité de l'air
  const air = effectiveAir(spot);
  const radiatorNote = spot.radiator ? " (un radiateur à côté assèche l'air)" : '';
  if (needs.humidity === 'high') {
    if (air === 'seche') {
      penalty += 30;
      issues.push({
        kind: 'humidity',
        level: 'alert',
        text: `Air trop sec${radiatorNote} : elle demande une humidité élevée.`,
        fix: "Regroupe-la avec d'autres plantes, pose-la sur un plateau de billes d'argile humides, utilise un humidificateur ou choisis une pièce plus humide.",
      });
    } else if (air === 'normale') {
      penalty += 12;
      issues.push({
        kind: 'humidity',
        level: 'warn',
        text: "Air un peu juste : elle préfère une humidité élevée.",
        fix: 'Un plateau humide, un regroupement de plantes ou une brumisation régulière aident.',
      });
    }
  } else if (needs.humidity === 'normal' && air === 'seche') {
    penalty += 12;
    issues.push({
      kind: 'humidity',
      level: 'warn',
      text: `Air sec${radiatorNote} : acceptable mais pas idéal pour elle.`,
      fix: "Éloigne-la du radiateur et surveille les pointes des feuilles.",
    });
  } else if (needs.humidity === 'low' && air === 'humide') {
    penalty += 12;
    issues.push({
      kind: 'humidity',
      level: 'warn',
      text: 'Air humide : elle préfère un air sec, risque de pourriture et de champignons.',
      fix: "Choisis un endroit mieux aéré et arrose avec parcimonie.",
    });
  }

  // Courants d'air
  if (spot.draft && needs.drafts) {
    penalty += 10;
    issues.push({
      kind: 'draft',
      level: 'warn',
      text: "Courants d'air : elle y est sensible (chute de feuilles, feuilles abîmées).",
      fix: "Éloigne-la des portes et des fenêtres qu'on ouvre souvent.",
    });
  }

  const worst = issues.some((i) => i.level === 'alert') ? 'alert' : issues.length > 0 ? 'warn' : 'ok';
  return { fit: Math.max(0, Math.round(100 - penalty)), issues, worst, light: score };
}

export function rankSpots(needs: Needs, spots: Spot[]): { spot: Spot; ev: Evaluation }[] {
  return spots
    .map((spot) => ({ spot, ev: evaluateSpot(needs, spot) }))
    .sort((a, b) => b.ev.fit - a.ev.fit || a.spot.name.localeCompare(b.spot.name, 'fr'));
}

// ---------- Programme affiné par les conditions ----------

export const POT_MATERIALS = [
  { value: 'plastique', label: 'Plastique' },
  { value: 'terre_cuite', label: 'Terre cuite (poreuse)' },
  { value: 'ceramique', label: 'Céramique émaillée' },
  { value: 'autre', label: 'Autre' },
];

export const POT_DRAINAGES = [
  { value: 'perce', label: 'Percé (trou de drainage)' },
  { value: 'non_perce', label: 'Non percé' },
];

export type ConditionFactors = {
  arrosage: number;
  brumisation: number;
  reasons: { arrosage: string[]; brumisation: string[] };
};

/**
 * Facteurs appliqués au programme de base de la plante selon ses conditions réelles.
 * > 1 : espacer les soins · < 1 : les rapprocher. 1 = aucun ajustement.
 */
export function conditionFactors(
  needs: Needs,
  spot: Spot | null,
  pot: { material?: string | null; drainage?: string | null }
): ConditionFactors {
  const reasons = { arrosage: [] as string[], brumisation: [] as string[] };
  let arrosage = 1;
  let brumisation = 1;

  const score = spot ? lightScore(spot) : null;
  if (score !== null) {
    const w = lightWanted(needs);
    const diff = score - (w.min + w.max) / 2;
    if (diff <= -0.8) {
      arrosage *= 1.3;
      reasons.arrosage.push('Son emplacement offre peu de lumière : elle consomme moins d\'eau.');
    } else if (diff <= -0.4) {
      arrosage *= 1.15;
      reasons.arrosage.push("Son emplacement est un peu moins lumineux que l'idéal : elle consomme un peu moins d'eau.");
    } else if (diff >= 0.8) {
      arrosage *= 0.8;
      reasons.arrosage.push('Son emplacement est très lumineux : elle consomme plus d\'eau.');
    } else if (diff >= 0.4) {
      arrosage *= 0.9;
      reasons.arrosage.push("Son emplacement est plus lumineux que la moyenne : elle consomme un peu plus d'eau.");
    }
  }
  if (pot.material === 'terre_cuite') {
    arrosage *= 0.85;
    reasons.arrosage.push('Pot en terre cuite : la terre sèche plus vite.');
  }
  if (pot.drainage === 'non_perce') {
    arrosage *= 1.3;
    reasons.arrosage.push("Pot sans trou de drainage : l'eau stagne, arrose moins et vérifie bien la terre. Idéalement, utilise un pot percé dans un cache-pot.");
  }

  if (spot && needs.humidity !== 'low') {
    const air = effectiveAir(spot);
    if (needs.humidity === 'high' && air === 'seche') {
      brumisation *= 0.7;
      reasons.brumisation.push("Air sec pour une plante qui aime l'humidité : brumise plus souvent.");
    } else if (needs.humidity === 'high' && air === 'normale') {
      brumisation *= 0.85;
      reasons.brumisation.push("Air un peu juste pour une plante qui aime l'humidité : brumise un peu plus souvent.");
    } else if (needs.humidity === 'normal' && air === 'seche') {
      brumisation *= 0.85;
      reasons.brumisation.push("Air sec (radiateur ou chauffage) : brumise un peu plus souvent.");
    } else if (needs.humidity === 'normal' && air === 'humide') {
      brumisation *= 1.3;
      reasons.brumisation.push("L'air est déjà humide à cet endroit : tu peux espacer la brumisation.");
    }
  }

  const clamp = (x: number) => Math.round(Math.min(1.8, Math.max(0.6, x)) * 100) / 100;
  return { arrosage: clamp(arrosage), brumisation: clamp(brumisation), reasons };
}

/**
 * Conseils de réglage du programme selon les conditions.
 * Idempotent : on compare aux facteurs déjà appliqués (plant.cond_factors), on ne propose que la différence.
 */
export function conditionAdvice(args: {
  plant: Plant;
  kind: Kind | null;
  needs: Needs;
  spot: Spot | null;
  tasks: Task[];
}): Advice[] {
  const { plant, kind, needs, spot, tasks } = args;
  const f = conditionFactors(needs, spot, { material: plant.pot_material, drainage: plant.pot_drainage });
  const old = plant.cond_factors ?? {};
  const out: Advice[] = [];

  const mistActive = tasks.some((t) => t.care_type === 'brumisation' && t.active);
  const mistFriendly = !(kind === 'succulente' || kind === 'orchidee' || kind === 'robuste' || kind === 'aromatique');

  for (const care of ['arrosage', 'brumisation'] as const) {
    const target = f[care];
    const before = old[care] ?? 1;
    const ratio = target / before;
    if (Math.abs(ratio - 1) < 0.1) continue;
    if (care === 'brumisation' && ratio < 1 && !(mistActive || mistFriendly)) continue;
    if (care === 'brumisation' && ratio < 1 && needs.humidity === 'low') continue;

    const label = care === 'arrosage' ? 'Arrosage' : 'Brumisation';
    const why = f.reasons[care].length
      ? f.reasons[care].join(' ')
      : 'Ses conditions ont changé : on revient au programme de base pour ce soin.';
    out.push({
      id: `cond-${care}`,
      level: 'adjust',
      title: `${label} : ${ratio > 1 ? 'espacer' : 'rapprocher'} selon ses conditions`,
      why: `${why} Ce réglage s'ajoute au programme de base de la plante.`,
      actions: [{ type: 'freq_all', care, factor: ratio }],
      cond: { care, value: target },
    });
  }
  return out;
}
