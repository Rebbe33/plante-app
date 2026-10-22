'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PlantForm from '@/components/PlantForm';
import { errMsg, loadPlant } from '@/lib/api';
import type { Plant, Task } from '@/lib/types';

export default function EditPlantPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ plant: Plant; tasks: Task[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlant(id)
      .then((d) => setData({ plant: d.plant, tasks: d.tasks }))
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  return (
    <>
      <h1>Modifier</h1>
      {error && <div className="error">{error}</div>}
      {!data && !error && <p className="muted">Chargement…</p>}
      {data && <PlantForm plant={data.plant} tasks={data.tasks} />}
    </>
  );
}
