import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mes plantes',
    short_name: 'Plantes',
    description: 'Suivi des soins de mes plantes vertes',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f7f2',
    theme_color: '#3f8f5a',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
