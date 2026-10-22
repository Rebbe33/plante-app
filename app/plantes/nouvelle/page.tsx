'use client';

import PlantForm from '@/components/PlantForm';

export default function NewPlantPage() {
  return (
    <>
      <h1>Nouvelle plante</h1>
      <p className="sub">Renseigne ses infos et ses soins, tu pourras tout modifier ensuite.</p>
      <PlantForm />
    </>
  );
}
