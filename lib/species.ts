/**
 * Programmes de soins conseillés.
 * - CATEGORIES : profils génériques (tropicale, succulente, orchidée…)
 * - SPECIES    : plantes courantes qui pointent vers une catégorie, avec des ajustements éventuels
 * Fréquences en jours. winter: null = comme l'été, 0 = en pause l'hiver.
 */

export type CareRule = { active: boolean; summer: number; winter: number | null };

export type Profile = {
  label: string;
  exposure: string;
  tip: string;
  cares: Record<string, CareRule>;
};

const on = (summer: number, winter: number | null = null): CareRule => ({ active: true, summer, winter });
const off: CareRule = { active: false, summer: 0, winter: null };

export const CATEGORIES: Record<string, Profile> = {
  tropicale: {
    label: 'Plante tropicale (feuillage)',
    exposure: 'Lumineux',
    tip: 'Arrose quand les 2-3 premiers cm de terre sont secs. Aime une humidité correcte.',
    cares: {
      arrosage: on(7, 14),
      brumisation: on(4, 0),
      nettoyage: on(21, 30),
      engrais: on(14, 0),
      rempotage: on(730),
      bilan: on(14),
    },
  },
  robuste: {
    label: 'Plante robuste (peu d\'eau)',
    exposure: 'Mi-ombre',
    tip: 'Très tolérante : mieux vaut un oubli qu\'un excès d\'eau. Laisse la terre sécher entre deux arrosages.',
    cares: {
      arrosage: on(14, 30),
      brumisation: off,
      nettoyage: on(30, 45),
      engrais: on(45, 0),
      rempotage: on(730),
      bilan: on(21),
    },
  },
  succulente: {
    label: 'Succulente / cactus',
    exposure: 'Plein soleil',
    tip: 'Beaucoup de lumière, peu d\'eau. En hiver, quasi aucun arrosage.',
    cares: {
      arrosage: on(14, 45),
      brumisation: off,
      nettoyage: on(60, 90),
      engrais: on(45, 0),
      rempotage: on(730),
      bilan: on(21),
    },
  },
  humide: {
    label: 'Plante d\'humidité (calathea, fougère…)',
    exposure: 'Mi-ombre',
    tip: 'Terre légèrement humide en permanence, eau non calcaire, air humide. Évite le soleil direct.',
    cares: {
      arrosage: on(4, 7),
      brumisation: on(2, 3),
      nettoyage: on(30, 45),
      engrais: on(21, 0),
      rempotage: on(730),
      bilan: on(10),
    },
  },
  orchidee: {
    label: 'Orchidée',
    exposure: 'Lumineux',
    tip: 'Trempage 10-15 min puis bien égoutter. Jamais d\'eau stagnante dans le cache-pot.',
    cares: {
      arrosage: on(7, 10),
      brumisation: on(3, 5),
      nettoyage: on(30, 45),
      engrais: on(14, 30),
      rempotage: on(730),
      bilan: on(14),
    },
  },
  aromatique: {
    label: 'Aromatique / plante à fleurs',
    exposure: 'Plein soleil',
    tip: 'Aime le soleil et une terre qui sèche légèrement en surface entre deux arrosages.',
    cares: {
      arrosage: on(4, 10),
      brumisation: off,
      nettoyage: on(45, 60),
      engrais: on(14, 0),
      rempotage: on(365),
      bilan: on(14),
    },
  },
  palmier: {
    label: 'Palmier / yucca / dracaena',
    exposure: 'Lumineux',
    tip: 'Arrosage modéré, feuilles à dépoussiérer régulièrement. Pointes brunes = air trop sec ou eau trop calcaire.',
    cares: {
      arrosage: on(10, 18),
      brumisation: on(7, 0),
      nettoyage: on(21, 30),
      engrais: on(30, 0),
      rempotage: on(1095),
      bilan: on(14),
    },
  },
};

type SpeciesEntry = {
  name: string; // nom affiché
  aliases: string[]; // autres noms (sans accents, minuscules)
  category: keyof typeof CATEGORIES;
  /** ajustements par rapport à la catégorie */
  override?: Partial<Record<string, CareRule>>;
  exposure?: string;
  tip?: string;
};

export const SPECIES: SpeciesEntry[] = [
  { name: 'Monstera deliciosa', aliases: ['monstera', 'plante gruyere', 'faux philodendron'], category: 'tropicale', tip: 'Tuteur conseillé. Nettoie les grandes feuilles pour la photosynthèse.' },
  { name: 'Pothos', aliases: ['epipremnum', 'scindapsus', 'lierre du diable'], category: 'robuste', override: { arrosage: on(10, 18), brumisation: on(7, 0) }, exposure: 'Mi-ombre', tip: 'Très facile. Les feuilles qui pendent mollement signalent la soif.' },
  { name: 'Philodendron', aliases: ['philodendron', 'philo'], category: 'tropicale', exposure: 'Mi-ombre' },
  { name: 'Ficus lyrata', aliases: ['ficus lyrata', 'figuier lyre', 'ficus lyre'], category: 'tropicale', override: { arrosage: on(8, 15) }, tip: 'N\'aime pas être déplacé ni les courants d\'air.' },
  { name: 'Ficus elastica', aliases: ['ficus elastica', 'caoutchouc', 'ficus caoutchouc', 'ficus robusta'], category: 'tropicale', override: { arrosage: on(8, 15), brumisation: off } },
  { name: 'Ficus benjamina', aliases: ['ficus benjamina', 'benjamin', 'ficus'], category: 'tropicale', override: { arrosage: on(7, 12) }, tip: 'Perd ses feuilles s\'il est déplacé ou en cas de courant d\'air.' },
  { name: 'Zamioculcas', aliases: ['zamioculcas', 'zz plant', 'zamie'], category: 'robuste', override: { arrosage: on(18, 35), nettoyage: on(45, 60) }, exposure: 'Ombre', tip: 'Quasi increvable. Arrose très peu.' },
  { name: 'Sansevieria', aliases: ['sansevieria', 'langue de belle-mere', 'dracaena trifasciata', 'sanseveria'], category: 'robuste', override: { arrosage: on(18, 35), nettoyage: on(45, 60) }, tip: 'Ne supporte pas l\'eau stagnante.' },
  { name: 'Chlorophytum', aliases: ['chlorophytum', 'plante araignee'], category: 'robuste', override: { arrosage: on(7, 14), brumisation: on(10, 0) }, exposure: 'Lumineux' },
  { name: 'Aloe vera', aliases: ['aloe', 'aloes'], category: 'succulente', override: { arrosage: on(14, 40) } },
  { name: 'Cactus', aliases: ['cactus', 'cactee', 'opuntia', 'echinocactus'], category: 'succulente', override: { arrosage: on(18, 60), engrais: on(60, 0) } },
  { name: 'Succulente', aliases: ['succulente', 'echeveria', 'sedum', 'sempervivum', 'haworthia', 'graptopetalum'], category: 'succulente' },
  { name: 'Crassula (arbre de jade)', aliases: ['crassula', 'arbre de jade', 'plante de jade'], category: 'succulente', override: { arrosage: on(12, 30) }, exposure: 'Lumineux' },
  { name: 'Calathea', aliases: ['calathea', 'goeppertia'], category: 'humide', tip: 'Eau de pluie ou filtrée si possible. Les feuilles qui s\'enroulent = soif ou air trop sec.' },
  { name: 'Maranta', aliases: ['maranta', 'plante priere', 'plante de la priere'], category: 'humide' },
  { name: 'Fougère', aliases: ['fougere', 'nephrolepis', 'boston', 'asplenium', 'nid d\'oiseau'], category: 'humide', override: { arrosage: on(3, 6) } },
  { name: 'Orchidée (Phalaenopsis)', aliases: ['orchidee', 'phalaenopsis', 'orchid'], category: 'orchidee', tip: 'Garde les racines grises/vertes visibles. Coupe la hampe quand elle est sèche.' },
  { name: 'Spathiphyllum', aliases: ['spathiphyllum', 'spatiphyllum', 'fleur de lune', 'lys de la paix'], category: 'humide', override: { arrosage: on(5, 9), brumisation: on(3, 6) }, tip: 'Il s\'affaisse quand il a soif, puis se redresse après arrosage.' },
  { name: 'Anthurium', aliases: ['anthurium'], category: 'humide', override: { arrosage: on(6, 10), engrais: on(21, 45) }, exposure: 'Lumineux' },
  { name: 'Dracaena', aliases: ['dracaena', 'dracena', 'draceana', 'dragonnier', 'dracaena marginata'], category: 'palmier' },
  { name: 'Yucca', aliases: ['yucca', 'yuca'], category: 'palmier', override: { arrosage: on(14, 25), brumisation: off }, exposure: 'Plein soleil' },
  { name: 'Palmier (Areca / Kentia)', aliases: ['palmier', 'areca', 'kentia', 'howea', 'chamaedorea', 'palmier areca'], category: 'palmier', override: { arrosage: on(7, 14), brumisation: on(4, 0) } },
  { name: 'Pilea', aliases: ['pilea', 'plante a monnaie', 'pilea peperomioides'], category: 'tropicale', override: { arrosage: on(8, 14), brumisation: off }, tip: 'Tourne le pot régulièrement pour une croissance régulière.' },
  { name: 'Peperomia', aliases: ['peperomia', 'peperomia obtusifolia'], category: 'robuste', override: { arrosage: on(10, 18) } },
  { name: 'Hoya', aliases: ['hoya', 'fleur de porcelaine', 'hoya carnosa'], category: 'succulente', override: { arrosage: on(10, 25), brumisation: on(7, 0) }, exposure: 'Lumineux' },
  { name: 'Tradescantia', aliases: ['tradescantia', 'misere', 'plante misere'], category: 'tropicale', override: { arrosage: on(6, 12), brumisation: off }, exposure: 'Lumineux' },
  { name: 'Lierre (Hedera)', aliases: ['lierre', 'hedera'], category: 'tropicale', override: { arrosage: on(7, 12), brumisation: on(5, 0) }, exposure: 'Mi-ombre' },
  { name: 'Strelitzia', aliases: ['strelitzia', 'oiseau de paradis'], category: 'tropicale', override: { arrosage: on(7, 14), brumisation: on(7, 0) }, exposure: 'Plein soleil' },
  { name: 'Alocasia', aliases: ['alocasia', 'oreille d\'elephant'], category: 'humide', override: { arrosage: on(5, 10) }, exposure: 'Lumineux', tip: 'Sensible : perd facilement ses feuilles en hiver, c\'est normal.' },
  { name: 'Begonia', aliases: ['begonia'], category: 'aromatique', override: { arrosage: on(5, 10), brumisation: off }, exposure: 'Lumineux' },
  { name: 'Violette africaine', aliases: ['saintpaulia', 'violette africaine', 'violette'], category: 'aromatique', override: { arrosage: on(5, 8), engrais: on(14, 45) }, exposure: 'Lumineux', tip: 'Arrose par le bas, évite de mouiller les feuilles.' },
  { name: 'Basilic', aliases: ['basilic'], category: 'aromatique', override: { arrosage: on(2, 4) }, tip: 'Pince les fleurs pour prolonger la récolte.' },
  { name: 'Menthe', aliases: ['menthe'], category: 'aromatique', override: { arrosage: on(2, 5) }, exposure: 'Mi-ombre' },
  { name: 'Romarin / Thym / Lavande', aliases: ['romarin', 'thym', 'lavande', 'sauge'], category: 'aromatique', override: { arrosage: on(7, 20), engrais: on(45, 0) } },
  { name: 'Bonsaï', aliases: ['bonsai'], category: 'aromatique', override: { arrosage: on(3, 6), brumisation: on(4, 0), nettoyage: on(60, 90), rempotage: on(730) }, exposure: 'Lumineux', tip: 'Ne laisse jamais la motte sécher complètement.' },
  { name: 'Citronnier / agrume', aliases: ['citronnier', 'agrume', 'oranger', 'mandarinier', 'kumquat'], category: 'aromatique', override: { arrosage: on(4, 10), brumisation: on(5, 0), engrais: on(14, 30) }, exposure: 'Plein soleil' },
];

// ---------- Recherche ----------

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .trim();
}

export type Suggestion = {
  title: string;
  profile: Profile;
  category: string;
};

function build(entry: SpeciesEntry): Suggestion {
  const base = CATEGORIES[entry.category];
  return {
    title: entry.name,
    category: entry.category as string,
    profile: {
      label: entry.name,
      exposure: entry.exposure ?? base.exposure,
      tip: entry.tip ?? base.tip,
      cares: { ...base.cares, ...(entry.override ?? {}) } as Record<string, CareRule>,
    },
  };
}

/** Cherche un programme à partir de l'espèce et/ou du nom saisis. */
export function findSuggestion(...texts: string[]): Suggestion | null {
  const hay = texts.map(norm).filter((t) => t.length >= 3);
  if (hay.length === 0) return null;
  let best: { e: SpeciesEntry; score: number } | null = null;
  for (const e of SPECIES) {
    const keys = [e.name, ...e.aliases].map(norm);
    for (const k of keys) {
      for (const h of hay) {
        // le texte saisi contient le nom connu (« ma grosse monstera ») ou inversement
        if (h.includes(k) || (h.length >= 4 && k.startsWith(h))) {
          const score = k.length;
          if (!best || score > best.score) best = { e, score };
        }
      }
    }
  }
  return best ? build(best.e) : null;
}

export function categorySuggestion(code: string): Suggestion | null {
  const p = CATEGORIES[code];
  return p ? { title: p.label, profile: p, category: code } : null;
}

/** Noms proposés dans la liste d'autocomplétion du champ Espèce. */
export const SPECIES_NAMES: string[] = SPECIES.map((s) => s.name);

// ---------- Déduction du type de plante à partir d'un texte (ex. description Wikipédia) ----------

const KEYWORDS: Array<[string, string[]]> = [
  ['orchidee', ['orchidee', 'orchidaceae', 'phalaenopsis']],
  ['succulente', ['cactus', 'cactacee', 'cactaceae', 'crassulaceae', 'succulente', 'plante grasse', 'crassulac', 'aloe', 'agave', 'euphorbia']],
  ['humide', ['fougere', 'polypod', 'marantacee', 'calathea', 'sous-bois humide']],
  ['palmier', ['palmier', 'arecacee', 'arecaceae', 'dracaena', 'dracena', 'yucca', 'agavacee', 'asparagacee']],
  ['aromatique', ['aromatique', 'lamiacee', 'condiment', 'herbe', 'agrume', 'rutacee', 'bonsai']],
  ['tropicale', ['tropical', 'equatorial', 'araceae', 'arace', 'moracee', 'ficus', 'liane', 'epiphyte', 'plante d\'interieur', 'plante d\'appartement']],
];

/** Devine un profil générique à partir d'un texte descriptif. */
export function guessCategory(...texts: string[]): Suggestion | null {
  const hay = texts.map(norm).join(' ');
  if (!hay.trim()) return null;
  for (const [cat, words] of KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return categorySuggestion(cat);
  }
  return null;
}
