'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PlantForm from '@/components/PlantForm';

function NewPlant() {
  const sp = useSearchParams();
  const wishId = sp.get('souhait') ?? undefined;
  const initial = { name: sp.get('nom') ?? '', species: sp.get('espece') ?? '' };
  return (
    <>
      <h1>Nouvelle plante</h1>
      <p className="sub">
        {wishId
          ? 'Elle est dans ta liste de souhaits : vérifie les infos, la fiche sera liée automatiquement.'
          : 'Renseigne ses infos et ses soins, tu pourras tout modifier ensuite.'}
      </p>
      <PlantForm initial={initial} wishId={wishId} />
    </>
  );
}

export default function NewPlantPage() {
  return (
    <Suspense fallback={<p className="muted">Chargement…</p>}>
      <NewPlant />
    </Suspense>
  );
}
