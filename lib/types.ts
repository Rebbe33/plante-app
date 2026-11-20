export type Plant = {
  id: string;
  name: string;
  species: string | null;
  room: string | null;
  exposure: string | null;
  notes: string | null;
  purchase_date: string | null;
  photo_path: string | null;
  archived: boolean;
  created_at: string;
  // ajoutés par supabase/plantes_emplacements.sql (absents tant que le script n'est pas lancé)
  spot_id?: string | null;
  pot_material?: string | null;
  pot_drainage?: string | null;
  cond_factors?: Record<string, number> | null;
};

export type Spot = {
  id: string;
  name: string;
  orientation: string | null; // nord | est | sud | ouest | aucune
  distance: string | null; // vitre | proche | moyen | loin
  sheer: boolean;
  temp_winter: string | null; // fraiche | temperee | chaude
  humidity: string | null; // seche | normale | humide
  draft: boolean;
  radiator: boolean;
  notes: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  plant_id: string;
  care_type: string;
  freq_summer: number;
  freq_winter: number | null;
  last_done: string | null;
  active: boolean;
};

export type Wish = {
  id: string;
  genus: string;
  name: string;
  owned: boolean;
  plant_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Log = {
  id: string;
  plant_id: string;
  care_type: string;
  done_on: string;
  health: number | null;
  note: string | null;
  soil: string | null;
  symptoms: string[] | null;
  created_at: string;
};
