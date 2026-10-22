/* eslint-disable @next/next/no-img-element */
import { photoUrl } from '@/lib/supabase';

export default function PlantPhoto({
  path,
  alt,
  large = false,
}: {
  path: string | null;
  alt: string;
  large?: boolean;
}) {
  const url = photoUrl(path);
  const cls = large ? 'thumb lg' : 'thumb';
  if (!url) return <div className={cls}>🪴</div>;
  return <img className={cls} src={url} alt={alt} loading="lazy" />;
}
