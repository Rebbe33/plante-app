/** Recherche de plantes sur Wikipédia (API publique, sans clé, CORS ouvert avec origin=*). */

export type WikiResult = {
  title: string;
  extract: string;
  thumb: string | null;
};

type WikiPage = {
  title?: string;
  index?: number;
  extract?: string;
  thumbnail?: { source?: string };
};

export async function searchPlants(query: string, signal?: AbortSignal): Promise<WikiResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${q} plante`,
    gsrlimit: '6',
    prop: 'pageimages|extracts',
    piprop: 'thumbnail',
    pithumbsize: '120',
    exintro: '1',
    explaintext: '1',
    exchars: '220',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://fr.wikipedia.org/w/api.php?${params.toString()}`, { signal });
  if (!res.ok) throw new Error('Recherche indisponible');
  const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const pages = Object.values(json.query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .filter((p) => !!p.title)
    .map((p) => ({
      title: p.title as string,
      extract: (p.extract ?? '').trim(),
      thumb: p.thumbnail?.source ?? null,
    }));
}
