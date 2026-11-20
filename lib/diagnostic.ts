/**
 * Diagnostic du bilan : état de la terre + symptômes observés (+ type de plante) → conseils et ajustements.
 *
 * Principes :
 * - On ne change JAMAIS le programme tout seul : chaque ajustement est une suggestion que tu valides.
 * - Les feuilles jaunes viennent plus souvent d'un EXCÈS d'eau que d'un manque : on regarde d'abord la terre.
 * - Le type de plante (déduit de l'espèce) change l'interprétation : une terre sèche est normale pour un cactus,
 *   pas pour une calathea ; la brumisation est utile aux plantes d'humidité, mauvaise pour les succulentes.
 * - Les fréquences sont bornées (selon le type) pour éviter les dérives.
 */

import { careInfo, effectiveFreq, isWinter } from './care';
import { findSuggestion, guessCategory } from './species';
import type { Issue } from './besoins';
import type { Task } from './types';

// ---------- Type de plante ----------

export type Kind = 'succulente' | 'humide' | 'orchidee' | 'robuste' | 'tropicale' | 'aromatique' | 'palmier';

/** Déduit le type de plante de son espèce / nom (null si on ne la reconnaît pas). */
export function plantKind(species: string | null | undefined, name: string): Kind | null {
  const s = findSuggestion(species ?? '', name) ?? guessCategory(species ?? '', name);
  return s ? (s.category as Kind) : null;
}

/** Facteur appliqué à la fréquence d'arrosage quand il y a trop d'eau (> 1 : on espace). */
const EXCESS: Record<Kind, number> = {
  succulente: 1.5,
  robuste: 1.5,
  orchidee: 1.5,
  humide: 1.3,
  tropicale: 1.4,
  palmier: 1.4,
  aromatique: 1.4,
};

/** Facteur appliqué quand la plante manque d'eau (< 1 : on rapproche). */
const THIRST: Record<Kind, number> = {
  succulente: 0.8,
  robuste: 0.85,
  orchidee: 0.8,
  humide: 0.7,
  tropicale: 0.75,
  palmier: 0.75,
  aromatique: 0.75,
};

/** Limites de la fréquence d'arrosage (en jours) selon le type. */
const ARROSAGE_BOUNDS: Record<Kind, { min: number; max: number }> = {
  succulente: { min: 7, max: 90 },
  robuste: { min: 5, max: 60 },
  orchidee: { min: 5, max: 21 },
  humide: { min: 2, max: 21 },
  tropicale: { min: 3, max: 45 },
  palmier: { min: 4, max: 45 },
  aromatique: { min: 2, max: 30 },
};

// ---------- Questions ----------

export type Soil = 'seche' | 'normale' | 'detrempee';

export const SOILS: { value: Soil; label: string; emoji: string }[] = [
  { value: 'seche', label: 'Sèche', emoji: '🏜️' },
  { value: 'normale', label: 'Normale', emoji: '👌' },
  { value: 'detrempee', label: 'Détrempée', emoji: '💦' },
];

export type SymptomItem = { code: string; label: string };
export type SymptomGroup = { title: string; items: SymptomItem[] };

export const SYMPTOM_GROUPS: SymptomGroup[] = [
  {
    title: 'Les feuilles',
    items: [
      { code: 'jaunes', label: 'Feuilles jaunes' },
      { code: 'pointes_brunes', label: 'Pointes ou bords bruns et secs' },
      { code: 'taches_molles', label: 'Taches brunes ou noires, molles' },
      { code: 'molles', label: 'Feuilles molles, affaissées' },
      { code: 'enroulees', label: 'Feuilles enroulées' },
      { code: 'chute', label: 'Feuilles qui tombent' },
      { code: 'decolorees', label: 'Feuilles blanchies ou brûlées' },
      { code: 'poussiere', label: 'Feuilles poussiéreuses, ternes' },
    ],
  },
  {
    title: 'Tige et croissance',
    items: [
      { code: 'tige_molle', label: 'Base ou tige molle, noircie' },
      { code: 'etiree', label: 'Pousse étirée, feuilles pâles' },
      { code: 'stagne', label: 'Ne pousse plus' },
      { code: 'racines', label: 'Racines qui sortent du pot' },
    ],
  },
  {
    title: 'Parasites',
    items: [
      { code: 'toiles', label: 'Fines toiles' },
      { code: 'cochenilles', label: 'Amas blancs cotonneux ou petits boucliers' },
      { code: 'moucherons', label: 'Moucherons dans la terre' },
    ],
  },
];

export function symptomLabel(code: string): string {
  for (const g of SYMPTOM_GROUPS) {
    const f = g.items.find((i) => i.code === code);
    if (f) return f.label;
  }
  return code;
}

export function soilLabel(code: string | null | undefined): string {
  return SOILS.find((s) => s.value === code)?.label.toLowerCase() ?? '';
}

// ---------- Conseils et actions ----------

export type Action =
  | { type: 'freq'; care: string; factor: number } // saison en cours · factor > 1 : espacer · factor < 1 : rapprocher
  | { type: 'freq_all'; care: string; factor: number } // été ET hiver (ajustement lié aux conditions durables)
  | { type: 'due_now'; care: string }; // à faire dès maintenant

export type AdviceLevel = 'alert' | 'adjust' | 'info' | 'ok';

export type Advice = {
  id: string;
  level: AdviceLevel;
  title: string;
  why: string;
  actions: Action[];
  /** ajustement lié aux conditions : facteur total à mémoriser une fois appliqué */
  cond?: { care: string; value: number };
};

export type DiagnosticInput = {
  health: number; // 1 souci · 2 moyen · 3 au top
  soil: Soil | null;
  symptoms: string[];
  /** type de la plante (voir plantKind) ; null = conseils généraux */
  kind?: Kind | null;
  /** programme actuel de la plante : sert à savoir si la brumisation en fait déjà partie */
  tasks?: Task[];
  /** emplacement actuel de la plante et problèmes détectés (voir evaluateSpot) */
  placement?: { spotName: string; issues: Issue[] } | null;
  date?: Date;
};

const LEVEL_RANK: Record<AdviceLevel, number> = { alert: 0, adjust: 1, info: 2, ok: 3 };

export function buildAdvice({
  health,
  soil,
  symptoms,
  kind = null,
  tasks = [],
  placement = null,
  date = new Date(),
}: DiagnosticInput): Advice[] {
  const has = (c: string) => symptoms.includes(c);
  const winter = isWinter(date);
  const out: Advice[] = [];
  const add = (a: Advice) => out.push(a);

  const succ = kind === 'succulente';
  const humide = kind === 'humide';
  const excess = kind ? EXCESS[kind] : 1.4;
  const thirst = kind ? THIRST[kind] : 0.75;

  const water = (factor: number): Action => ({ type: 'freq', care: 'arrosage', factor });
  const spacer = (): Action => water(excess); // trop d'eau → espacer
  const closer = (): Action => water(thirst); // pas assez d'eau → rapprocher
  const mist = (factor: number): Action => ({ type: 'freq', care: 'brumisation', factor });
  const dueNow = (care: string): Action => ({ type: 'due_now', care });

  // La brumisation n'est proposée que si elle convient au type de plante, ou si elle fait déjà partie de son programme
  const mistActive = tasks.some((t) => t.care_type === 'brumisation' && t.active);
  const mistFriendly = !(kind === 'succulente' || kind === 'orchidee' || kind === 'robuste' || kind === 'aromatique');
  const canMist = mistActive || mistFriendly;

  // --- Feuilles jaunes : la terre décide, le type de plante nuance ---
  if (has('jaunes')) {
    if (succ && soil === 'seche') {
      add({
        id: 'jaunes-succulente-sec',
        level: 'info',
        title: 'Succulente aux feuilles jaunes, terre sèche : pas de manque d\'eau',
        why: "Une succulente aime que sa terre sèche complètement. De vieilles feuilles du bas qui jaunissent et sèchent, c'est normal. Si elles sont plutôt translucides ou molles, c'est la trace d'un arrosage trop récent. Je ne propose pas d'arroser plus.",
        actions: [],
      });
    } else if (soil === 'detrempee') {
      add({
        id: 'jaunes-eau',
        level: 'adjust',
        title: "Feuilles jaunes + terre détrempée : trop d'eau",
        why: "C'est la cause n°1 des feuilles jaunes : les racines manquent d'air et commencent à s'abîmer. Laisse la terre sécher en surface avant le prochain arrosage, vide le cache-pot et vérifie que le pot est bien percé.",
        actions: [spacer()],
      });
    } else if (succ && soil === 'normale') {
      add({
        id: 'jaunes-succulente-eau',
        level: 'adjust',
        title: "Succulente aux feuilles jaunes : trop d'eau probable",
        why: "Chez une succulente ou un cactus, des feuilles jaunes, translucides ou molles viennent presque toujours d'un excès d'eau, même si la terre ne paraît pas détrempée en surface. Espace les arrosages et attends que le pot soit sec jusqu'au fond.",
        actions: [spacer()],
      });
    } else if (soil === 'seche') {
      add({
        id: 'jaunes-soif',
        level: 'adjust',
        title: "Feuilles jaunes + terre sèche : manque d'eau",
        why: "Une plante qui manque d'eau jaunit puis se dessèche. Arrose à fond (le pot doit bien s'égoutter) et rapproche un peu les arrosages.",
        actions: [closer()],
      });
    } else {
      add({
        id: 'jaunes-test',
        level: 'info',
        title: "Feuilles jaunes : fais d'abord le test de la terre",
        why: "Une ou deux vieilles feuilles du bas qui jaunissent de temps en temps, c'est normal. Si c'est plus général, il y a trop d'eau (le plus fréquent), pas assez d'eau, un manque de lumière ou une carence. Enfonce un doigt à 3 cm : humide, espace les arrosages ; sèche, rapproche-les. Je ne change rien sans cette information.",
        actions: [],
      });
      if (soil === 'normale' && !winter) {
        add({
          id: 'jaunes-engrais',
          level: 'info',
          title: 'Une carence est possible',
          why: "Terre normale et jaunissement général en pleine saison de croissance : un manque de nutriments peut être en cause. Un engrais un peu plus régulier peut aider.",
          actions: [{ type: 'freq', care: 'engrais', factor: 0.8 }],
        });
      }
    }
  }

  // --- Pointes brunes ---
  if (has('pointes_brunes')) {
    if (soil === 'detrempee') {
      add({
        id: 'pointes-eau',
        level: 'adjust',
        title: "Pointes brunes + terre détrempée : racines abîmées par l'excès d'eau",
        why: "Quand les racines souffrent d'un excès d'eau, le bout des feuilles brunit. Laisse la terre sécher davantage entre deux arrosages.",
        actions: [spacer()],
      });
    } else if (soil === 'seche' && !succ) {
      add({
        id: 'pointes-soif',
        level: 'adjust',
        title: 'Pointes brunes + terre sèche : arrosages trop espacés',
        why: humide
          ? "Les plantes d'humidité supportent très mal que la terre sèche : le bout des feuilles brunit vite. Garde la terre légèrement humide en permanence, et brumise plus souvent si l'air est sec."
          : "Des arrosages irréguliers dessèchent le bout des feuilles. Arrose plus régulièrement, sans jamais laisser la motte se dessécher complètement.",
        actions: humide && canMist ? [closer(), mist(0.75)] : [closer()],
      });
    } else if (canMist) {
      add({
        id: 'pointes-air',
        level: 'adjust',
        title: 'Pointes brunes : air trop sec ou eau trop calcaire',
        why: "C'est le signe classique d'un air sec (chauffage) ou d'une eau du robinet trop calcaire. Brumise un peu plus souvent, éloigne la plante des radiateurs et arrose si possible à l'eau de pluie ou filtrée. Les pointes déjà brunes ne reverdiront pas : tu peux les couper en suivant la forme de la feuille.",
        actions: [mist(humide ? 0.65 : 0.75)],
      });
    } else {
      add({
        id: 'pointes-sels',
        level: 'info',
        title: 'Pointes brunes : eau calcaire, chauffage ou trop d\'engrais',
        why: "Chez ce type de plante, la brumisation n'est pas adaptée. Les pointes brunes viennent plutôt d'une eau du robinet trop calcaire, du chauffage, d'un coup de soleil ou d'un excès d'engrais (sels). Arrose à l'eau de pluie ou filtrée, rince la terre de temps en temps avec beaucoup d'eau claire et éloigne la plante des radiateurs. Les pointes déjà brunes ne reverdiront pas : coupe-les.",
        actions: [],
      });
    }
  }

  // --- Pourriture ---
  if (has('taches_molles')) {
    add({
      id: 'taches-pourriture',
      level: 'alert',
      title: 'Taches molles ou noires : risque de pourriture',
      why: "Souvent causées par un excès d'eau ou des feuilles qui restent mouillées. Arrête d'arroser tant que la terre n'est pas sèche, retire les feuilles atteintes et garde un air qui circule. Si ça progresse, sors la plante du pot : des racines brunes, molles ou qui sentent mauvais sont à couper, puis rempote dans de la terre neuve.",
      actions: soil === 'seche' ? [] : [water(1.6)],
    });
  }
  if (has('tige_molle')) {
    add({
      id: 'tige-pourriture',
      level: 'alert',
      title: 'Base ou tige molle : urgence pourriture',
      why: "Une base noircie ou molle indique que les racines ou le collet pourrissent. Arrête les arrosages, sors la plante du pot, coupe tout ce qui est brun et mou et rempote dans un mélange neuf et bien drainant. Si la tige est atteinte, tu peux souvent sauver la plante en bouturant une partie saine.",
      actions: soil === 'seche' ? [] : [water(1.6)],
    });
  }

  // --- Feuilles molles ---
  if (has('molles')) {
    if (soil === 'seche') {
      add({
        id: 'molles-soif',
        level: 'adjust',
        title: succ ? 'Succulente flétrie ou ridée + terre sèche : elle a soif' : 'Plante affaissée + terre sèche : elle a soif',
        why: "Arrose à fond : elle devrait se redresser en quelques heures ou quelques jours. Si ça arrive souvent entre deux arrosages, rapproche-les.",
        actions: [closer()],
      });
    } else if (soil === 'detrempee') {
      add({
        id: 'molles-eau',
        level: 'alert',
        title: 'Plante affaissée + terre détrempée : racines asphyxiées',
        why: "Trop d'eau étouffe les racines, qui ne nourrissent plus la plante. N'arrose plus, laisse sécher, et regarde les racines si ça ne s'améliore pas en quelques jours.",
        actions: [water(1.5)],
      });
    } else {
      add({
        id: 'molles-choc',
        level: 'info',
        title: 'Plante affaissée avec une terre normale',
        why: "Cherche un choc : courant d'air, froid, chaleur d'un radiateur, déplacement récent. Si ça dure, regarde l'état des racines.",
        actions: [],
      });
    }
  }

  // --- Feuilles enroulées ---
  if (has('enroulees')) {
    if (soil === 'seche') {
      add({
        id: 'enroulees-soif',
        level: 'adjust',
        title: "Feuilles enroulées + terre sèche : elle manque d'eau",
        why: "Les feuilles s'enroulent pour limiter la perte d'eau. Arrose à fond et rapproche un peu les arrosages.",
        actions: [closer()],
      });
    } else if (soil === 'detrempee') {
      add({
        id: 'enroulees-eau',
        level: 'adjust',
        title: "Feuilles enroulées + terre détrempée : trop d'eau",
        why: "Un excès d'eau abîme les racines, et les feuilles réagissent. Laisse la terre sécher davantage entre deux arrosages.",
        actions: [spacer()],
      });
    } else if (canMist) {
      add({
        id: 'enroulees-air',
        level: 'adjust',
        title: 'Feuilles enroulées : air trop sec ?',
        why: "Calathea, maranta et autres plantes d'humidité enroulent leurs feuilles quand l'air est sec ou l'eau trop calcaire. Brumise plus souvent ou regroupe-les avec d'autres plantes.",
        actions: [mist(humide ? 0.65 : 0.75)],
      });
    } else {
      add({
        id: 'enroulees-chaleur',
        level: 'info',
        title: 'Feuilles enroulées : chaleur, soleil ou soif',
        why: "Elles s'enroulent aussi sous une chaleur ou un soleil trop forts. Vérifie la terre en profondeur avant d'arroser et éloigne la plante d'une source de chaleur. La brumisation n'est pas adaptée à ce type de plante.",
        actions: [],
      });
    }
  }

  // --- Chute de feuilles ---
  if (has('chute')) {
    if (soil === 'detrempee') {
      add({
        id: 'chute-eau',
        level: 'adjust',
        title: "Chute de feuilles + terre détrempée : trop d'eau",
        why: "Les racines étouffées lâchent des feuilles. Laisse la terre sécher en surface entre deux arrosages.",
        actions: [spacer()],
      });
    } else if (soil === 'seche') {
      add({
        id: 'chute-soif',
        level: 'adjust',
        title: "Chute de feuilles + terre sèche : manque d'eau",
        why: "Une plante trop assoiffée sacrifie des feuilles. Arrose à fond et rapproche un peu les arrosages.",
        actions: [closer()],
      });
    } else {
      add({
        id: 'chute-choc',
        level: 'info',
        title: 'Chute de feuilles : cherche un choc',
        why: "Un déplacement, un courant d'air, un changement de lumière ou la saison (en automne, un peu de chute est normale) font tomber des feuilles. Évite de changer le programme à l'aveugle : laisse-lui quelques semaines de stabilité.",
        actions: [],
      });
    }
  }

  // --- Lumière ---
  if (has('decolorees')) {
    add({
      id: 'soleil',
      level: 'info',
      title: 'Feuilles blanchies ou brûlées : trop de soleil direct',
      why: "Le soleil derrière une vitre brûle surtout aux heures chaudes. Éloigne la plante de la fenêtre ou ajoute un voilage, et change son exposition dans sa fiche si besoin.",
      actions: [],
    });
  }
  if (has('etiree')) {
    add({
      id: 'lumiere',
      level: 'info',
      title: 'Pousse étirée et pâle : manque de lumière',
      why: "Les tiges s'allongent pour chercher la lumière. Rapproche la plante d'une fenêtre (sans soleil direct brûlant). Avec moins de lumière, elle boit aussi moins : attention à ne pas trop arroser.",
      actions: [],
    });
  }

  // --- Entretien ---
  if (has('poussiere')) {
    add({
      id: 'poussiere',
      level: 'adjust',
      title: 'Feuilles poussiéreuses : nettoie plus souvent',
      why: "La poussière bloque la lumière et gêne la photosynthèse. Un coup d'éponge humide sur chaque feuille, ou une douche tiède, suffit.",
      actions: [{ type: 'freq', care: 'nettoyage', factor: 0.7 }],
    });
  }
  if (has('stagne')) {
    if (winter) {
      add({
        id: 'stagne-hiver',
        level: 'info',
        title: "Pas de croissance en hiver : c'est normal",
        why: "En hiver, la plupart des plantes se reposent. Pas d'engrais ni de rempotage maintenant, et un arrosage modéré.",
        actions: [],
      });
    } else {
      add({
        id: 'stagne-saison',
        level: 'adjust',
        title: 'Pas de croissance en pleine saison',
        why: "Elle manque peut-être de nutriments, ou le pot est devenu trop petit. Un engrais un peu plus régulier peut relancer la pousse ; sinon pense au rempotage.",
        actions: [{ type: 'freq', care: 'engrais', factor: 0.8 }],
      });
    }
  }
  if (has('racines')) {
    if (winter) {
      add({
        id: 'racines-hiver',
        level: 'info',
        title: 'Racines qui sortent : rempote au printemps',
        why: "Le pot devient trop petit, mais évite de rempoter en plein hiver sauf urgence : attends mars-avril.",
        actions: [],
      });
    } else {
      add({
        id: 'racines',
        level: 'adjust',
        title: 'Racines qui sortent : il est temps de rempoter',
        why: "Choisis un pot 2 à 3 cm plus large avec un trou de drainage, et de la terre neuve adaptée à la plante.",
        actions: [dueNow('rempotage')],
      });
    }
  }

  // --- Parasites ---
  if (has('toiles')) {
    add({
      id: 'acariens',
      level: 'alert',
      title: 'Fines toiles : probablement des araignées rouges (acariens)',
      why: canMist
        ? "Elles adorent l'air sec. Isole la plante, rince bien les feuilles (dessous aussi) sous une douche tiède, puis pulvérise du savon noir dilué ou de l'huile de neem. Recommence chaque semaine pendant 3 semaines."
        : "Elles adorent l'air sec et la chaleur. Isole la plante, nettoie les feuilles (dessous aussi) avec une éponge humide ou une douche tiède en protégeant la terre, puis passe du savon noir dilué ou de l'huile de neem. Recommence chaque semaine pendant 3 semaines. Pas de brumisation pour ce type de plante.",
      actions: canMist ? [dueNow('nettoyage'), mist(0.6)] : [dueNow('nettoyage')],
    });
  }
  if (has('cochenilles')) {
    add({
      id: 'cochenilles',
      level: 'alert',
      title: 'Cochenilles',
      why: "Isole la plante. Retire-les une à une avec un coton-tige imbibé d'alcool à 70°, puis passe du savon noir dilué ou de l'huile de neem sur toute la plante. Contrôle chaque semaine pendant un mois : elles reviennent souvent.",
      actions: [dueNow('nettoyage')],
    });
  }
  if (has('moucherons')) {
    add({
      id: 'moucherons',
      level: 'adjust',
      title: 'Moucherons : terre trop humide en surface',
      why: "Les larves vivent dans la terre qui reste humide. Laisse sécher les premiers centimètres entre deux arrosages, pose des pièges jaunes collants et couvre la terre d'une fine couche de sable.",
      actions: soil === 'seche' ? [] : [water(1.3)],
    });
  }

  // --- Cause probable : l'emplacement ---
  if (placement) {
    const find = (k: Issue['kind'], dir?: 'low' | 'high') =>
      placement.issues.find((i) => i.kind === k && (!dir || i.dir === dir));
    const cause = (id: string, label: string, symptomCodes: string[], issue?: Issue) => {
      if (!issue || !symptomCodes.some(has)) return;
      add({
        id,
        level: issue.level === 'alert' ? 'alert' : 'info',
        title: `Son emplacement « ${placement.spotName} » : ${label}`,
        why: `${issue.text} ${issue.fix}`,
        actions: [],
      });
    };
    cause('place-sombre', 'trop sombre', ['etiree', 'jaunes', 'stagne', 'chute'], find('light', 'low'));
    cause('place-soleil', 'trop de soleil', ['decolorees', 'pointes_brunes', 'enroulees'], find('light', 'high'));
    cause('place-air', 'air mal adapté', ['pointes_brunes', 'enroulees', 'molles'], find('humidity'));
    cause('place-froid', 'température', ['chute', 'molles', 'jaunes'], find('temp'));
    cause('place-courant', "courants d'air", ['chute', 'molles', 'enroulees'], find('draft'));
  }

  // --- Aucun symptôme ---
  if (symptoms.length === 0) {
    if (soil === 'detrempee') {
      add({
        id: 'detrempee',
        level: 'adjust',
        title: 'Terre détrempée : espace un peu les arrosages',
        why: "Même sans symptôme, une terre qui reste détrempée finit par abîmer les racines. Laisse-la sécher davantage entre deux arrosages.",
        actions: [water(1.3)],
      });
    } else if (humide && soil === 'seche') {
      add({
        id: 'humide-seche',
        level: 'adjust',
        title: "Terre sèche : une plante d'humidité ne doit pas sécher",
        why: "Calathea, maranta, fougères et leurs cousines apprécient une terre légèrement humide en permanence. Arrose avant que la terre ne soit sèche en profondeur : un arrosage un peu plus rapproché leur convient mieux.",
        actions: [closer()],
      });
    } else if (health === 3) {
      add({
        id: 'tout-va-bien',
        level: 'ok',
        title: 'Tout va bien',
        why: "Aucun signe de souci : garde ton programme tel quel. Un bon programme est celui qu'on n'a pas besoin de modifier.",
        actions: [],
      });
    } else {
      add({
        id: 'sans-symptome',
        level: 'info',
        title: 'Pas de symptôme précis',
        why: "Tu as noté une plante moyenne ou en souci sans dire pourquoi. Refais le bilan en cochant ce que tu observes (feuilles, tige, parasites) pour avoir des conseils ciblés.",
        actions: [],
      });
    }
  }

  return consolidate(out).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

/**
 * Évite d'appliquer deux fois le même ajustement (ex. « jaunes + détrempée » et « molles + détrempée »)
 * et écarte les signaux contradictoires sur un même soin.
 */
function consolidate(list: Advice[]): Advice[] {
  type Ref = { a: number; j: number; factor: number };
  const freqBy = new Map<string, Ref[]>();
  const dueBy = new Map<string, Ref[]>();
  list.forEach((adv, a) =>
    adv.actions.forEach((act, j) => {
      if (act.type === 'freq') {
        freqBy.set(act.care, [...(freqBy.get(act.care) ?? []), { a, j, factor: act.factor }]);
      } else if (act.type === 'due_now') {
        dueBy.set(act.care, [...(dueBy.get(act.care) ?? []), { a, j, factor: 1 }]);
      }
    })
  );

  const drop = new Set<string>();
  const key = (r: Ref) => `${r.a}:${r.j}`;
  const extra: Advice[] = [];

  for (const [care, refs] of freqBy) {
    if (refs.length < 2) continue;
    const up = refs.some((r) => r.factor > 1);
    const down = refs.some((r) => r.factor < 1);
    if (up && down) {
      refs.forEach((r) => drop.add(key(r)));
      extra.push({
        id: `conflit-${care}`,
        level: 'info',
        title: `Signaux contradictoires : ${careInfo(care).label.toLowerCase()}`,
        why: "Tes observations pointent dans des directions opposées (par exemple trop et pas assez d'eau). Je ne propose aucun changement : vérifie la terre et refais un bilan dans quelques jours.",
        actions: [],
      });
    } else {
      const keep = refs.reduce((best, r) => (Math.abs(Math.log(r.factor)) > Math.abs(Math.log(best.factor)) ? r : best));
      refs.forEach((r) => {
        if (r !== keep) drop.add(key(r));
      });
    }
  }
  for (const refs of dueBy.values()) {
    refs.slice(1).forEach((r) => drop.add(key(r)));
  }

  return [
    ...list.map((adv, a) => ({ ...adv, actions: adv.actions.filter((_, j) => !drop.has(`${a}:${j}`)) })),
    ...extra,
  ];
}

// ---------- Application d'un ajustement ----------

export type Change =
  | { type: 'freq'; care: string; field: 'freq_summer' | 'freq_winter'; from: number | null; to: number; activate: boolean }
  | {
      type: 'freq_all';
      care: string;
      activate: boolean;
      /** nouvelles fréquences (null = inchangée) */
      summer: number | null;
      winter: number | null;
      from: { summer: number; winter: number | null } | null;
    }
  | { type: 'due_now'; care: string; activate: boolean };

const BOUNDS: Record<string, { min: number; max: number }> = {
  arrosage: { min: 2, max: 60 },
  brumisation: { min: 1, max: 30 },
  nettoyage: { min: 7, max: 90 },
  engrais: { min: 14, max: 90 },
  rempotage: { min: 180, max: 1460 },
  bilan: { min: 3, max: 60 },
};

function boundsFor(care: string, kind: Kind | null): { min: number; max: number } {
  return care === 'arrosage' && kind ? ARROSAGE_BOUNDS[kind] : (BOUNDS[care] ?? { min: 1, max: 365 });
}

/** Nouvelle fréquence, toujours dans le sens demandé, ou null si rien ne peut changer (bornes atteintes). */
function scaleFreq(cur: number, factor: number, b: { min: number; max: number }): number | null {
  let to = Math.round(cur * factor);
  to = factor > 1 ? Math.max(to, cur + 1) : Math.min(to, cur - 1);
  to = Math.min(b.max, Math.max(b.min, to));
  if (factor > 1 ? to <= cur : to >= cur) return null;
  return to;
}

/**
 * Calcule ce que ferait une action sur une tâche donnée (sans rien écrire).
 * - 'freq' ajuste la fréquence de la saison en cours (pour ne pas toucher à l'autre saison) ;
 * - 'freq_all' ajuste l'été et l'hiver ensemble (conditions durables : lumière, pot…).
 * Renvoie null si rien n'est à changer (soin en pause, déjà à la limite…).
 */
export function planChange(
  action: Action,
  task: Task | undefined,
  date: Date = new Date(),
  kind: Kind | null = null
): Change | null {
  if (action.type === 'due_now') {
    return { type: 'due_now', care: action.care, activate: !task || !task.active };
  }

  const def = careInfo(action.care);
  const b = boundsFor(action.care, kind);

  if (action.type === 'freq_all') {
    if (!task || !task.active) {
      if (action.factor >= 1 || !def.freqSummer || def.freqSummer <= 0) return null;
      const w = def.freqWinter && def.freqWinter > 0 ? def.freqWinter : null;
      return { type: 'freq_all', care: action.care, activate: true, summer: def.freqSummer, winter: w, from: null };
    }
    const s = task.freq_summer > 0 ? scaleFreq(task.freq_summer, action.factor, b) : null;
    const w = task.freq_winter !== null && task.freq_winter > 0 ? scaleFreq(task.freq_winter, action.factor, b) : null;
    if (s === null && w === null) return null;
    return {
      type: 'freq_all',
      care: action.care,
      activate: false,
      summer: s,
      winter: w,
      from: { summer: task.freq_summer, winter: task.freq_winter },
    };
  }

  const winter = isWinter(date);
  const field = winter ? 'freq_winter' : 'freq_summer';

  // Soin pas encore programmé : on ne l'active que pour le rapprocher (jamais pour l'espacer)
  if (!task || !task.active) {
    if (action.factor >= 1) return null;
    const base = winter ? (def.freqWinter ?? def.freqSummer) : def.freqSummer;
    if (!base || base <= 0) return null;
    return { type: 'freq', care: action.care, field, from: null, to: base, activate: true };
  }

  const cur = effectiveFreq(task, date);
  if (cur === null) return null; // soin en pause pour la saison

  const to = scaleFreq(cur, action.factor, b);
  if (to === null) return null;
  return { type: 'freq', care: action.care, field, from: cur, to, activate: false };
}

export function describeChange(ch: Change): string {
  const c = careInfo(ch.care);
  if (ch.type === 'due_now') return `${c.emoji} ${c.label} : à faire dès maintenant`;
  if (ch.type === 'freq_all') {
    if (ch.activate) {
      return `${c.emoji} ${c.label} : activé, tous les ${ch.summer} j${ch.winter ? ` (hiver : ${ch.winter} j)` : ''}`;
    }
    const parts: string[] = [];
    if (ch.summer !== null && ch.from) parts.push(`été ${ch.from.summer} j → ${ch.summer} j`);
    if (ch.winter !== null && ch.from && ch.from.winter !== null) parts.push(`hiver ${ch.from.winter} j → ${ch.winter} j`);
    return `${c.emoji} ${c.label} : ${parts.join(' · ')}`;
  }
  const when = ch.field === 'freq_winter' ? ' (hiver)' : '';
  if (ch.activate) return `${c.emoji} ${c.label} : activé, tous les ${ch.to} j${when}`;
  return `${c.emoji} ${c.label} : tous les ${ch.from} j → ${ch.to} j${when}`;
}
