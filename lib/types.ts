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
  created_at: string;
};
