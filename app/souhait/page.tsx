'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/supabase';
import { errMsg } from '@/lib/api';
import type { Wish } from '@/lib/types';

type Filter = 'todo' | 'owned' | 'all';

function fullName(w: Pick<Wish, 'genus' | 'name'>): string {
  return w.name.toLowerCase() === w.genus.toLowerCase() ? w.genus : `${w.genus} ${w.name}`;
}

function newPlantHref(w: Wish): string {
  const n = fullName(w);
  const p = new URLSearchParams({ souhait: w.id, nom: n, espece: n });
  return `/plantes/nouvelle?${p.toString()}`;
}

export default function WishlistPage() {
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [adding, setAdding] = useState(false);
  const [newGenus, setNewGenus] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await db().from('plantes_wishlist').select('*').order('genus').order('name').limit(5000);
    if (error) {
      setError(
        error.message.includes('plantes_wishlist')
          ? "La table des souhaits n'existe pas encore : lance supabase/plantes_wishlist.sql dans le SQL Editor de Supabase."
          : errMsg(error)
      );
      return;
    }
    setError(null);
    setWishes((data ?? []) as Wish[]);
  }

  useEffect(() => {
    load();
  }, []);

  const genera = useMemo(() => Array.from(new Set((wishes ?? []).map((w) => w.genus))).sort((a, b) => a.localeCompare(b, 'fr')), [wishes]);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const m = new Map<string, Wish[]>();
    for (const w of wishes ?? []) {
      if (filter === 'todo' && w.owned) continue;
      if (filter === 'owned' && !w.owned) continue;
      if (s && !fullName(w).toLowerCase().includes(s)) continue;
      if (!m.has(w.genus)) m.set(w.genus, []);
      m.get(w.genus)!.push(w);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [wishes, q, filter]);

  const total = wishes?.length ?? 0;
  const ownedCount = (wishes ?? []).filter((w) => w.owned).length;

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    if (error) setError(error.message);
    else await load();
    setBusy(false);
  }

  const toggleOwned = (w: Wish) => run(() => db().from('plantes_wishlist').update({ owned: !w.owned }).eq('id', w.id));

  const remove = (w: Wish) => {
    if (!confirm(`Retirer « ${fullName(w)} » de la liste ?`)) return;
    return run(() => db().from('plantes_wishlist').delete().eq('id', w.id));
  };

  async function addWish(e: React.FormEvent) {
    e.preventDefault();
    const genus = newGenus.trim();
    const name = newName.trim() || genus;
    if (!genus) return;
    await run(() => db().from('plantes_wishlist').insert({ genus: genus[0].toUpperCase() + genus.slice(1), name }));
    setNewName('');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes souhaits 💚</h1>
          <p className="sub">
            {wishes ? `${total - ownedCount} à trouver · ${ownedCount} acquise${ownedCount > 1 ? 's' : ''} · ${genera.length} genres` : ' '}
          </p>
        </div>
        <button className="btn primary sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Fermer' : '+ Ajouter'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {adding && (
        <form className="card" onSubmit={addWish}>
          <div className="grid2">
            <label className="field">
              Genre / type
              <input type="text" value={newGenus} onChange={(e) => setNewGenus(e.target.value)} placeholder="Alocasia" list="wish-genera" />
              <datalist id="wish-genera">
                {genera.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className="field">
              Variété
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Frydek variegata" />
            </label>
          </div>
          <button className="btn primary" disabled={busy || !newGenus.trim()}>
            Ajouter à ma liste
          </button>
        </form>
      )}

      {!wishes && !error && <p className="muted">Chargement…</p>}

      {wishes && (
        <>
          <input type="text" className="search" placeholder="Rechercher (ex. pink princess, hoya…)" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {(
              [
                ['todo', 'À trouver'],
                ['owned', 'Acquises'],
                ['all', 'Toutes'],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {wishes && groups.length === 0 && (
        <div className="empty">
          <span className="big">💚</span>
          {total === 0 ? 'Ta liste est vide.' : 'Rien à afficher avec ce filtre.'}
        </div>
      )}

      {groups.map(([genus, list]) => (
        <details key={genus} className="card flush wish-group" open={q.trim().length > 0 || groups.length === 1}>
          <summary className="group-head">
            <h2>
              {genus} <span className="muted">({list.length})</span>
            </h2>
          </summary>
          {list.map((w) => (
            <div className="row" key={w.id}>
              <button
                type="button"
                className={`check ${w.owned ? 'on' : ''}`}
                aria-label={w.owned ? 'Marquer comme à trouver' : 'Marquer comme acquise'}
                disabled={busy}
                onClick={() => toggleOwned(w)}
              >
                {w.owned ? '✓' : ''}
              </button>
              <div className="grow">
                <div className="name" style={w.owned ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                  {w.name}
                </div>
              </div>
              {w.owned && w.plant_id ? (
                <Link href={`/plantes/${w.plant_id}`} className="btn sm">
                  Voir
                </Link>
              ) : (
                <Link href={newPlantHref(w)} className="btn sm" title="Créer la fiche de cette plante">
                  Je l&apos;ai ! 🪴
                </Link>
              )}
              <button type="button" className="icon-btn" aria-label="Retirer" disabled={busy} onClick={() => remove(w)}>
                ✕
              </button>
            </div>
          ))}
        </details>
      ))}
    </>
  );
}
