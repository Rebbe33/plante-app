# 🌿 Mes plantes

Appli de suivi des soins de plantes vertes : arrosage, brumisation, nettoyage des feuilles, engrais, rempotage et bilan santé.
Stack : Next.js 15 (App Router) + Supabase + Vercel.

## Fonctionnalités

- **Aujourd'hui** : les soins à faire, regroupés par type, avec « Fait ✓ » en un tap (ou « Tout fait » par groupe), retards et soins des 3 prochains jours.
- **Plantes** : liste avec recherche et filtre par pièce, soin le plus urgent affiché.
- **Fiche plante** : photo, infos, soins avec échéances, bilan santé (😀 / 😐 / 🥀 + observation), historique.
- **Saisonnalité** : chaque soin a une fréquence été et une fréquence hiver (nov. à mars). Vide = identique à l'été, 0 = en pause.
- **Bilan** : soins faits, soins en retard, activité par jour, plantes à surveiller (7 / 30 / 90 jours).
- Installable sur le téléphone (« Ajouter à l'écran d'accueil »).

## Mise en place

### 1. Supabase
Ouvre **SQL Editor** dans ton projet existant, colle le contenu de `supabase/plantes_schema.sql` et lance-le.
Il crée les tables `plantes_plants`, `plantes_tasks`, `plantes_logs`, leurs politiques RLS et le bucket public `plantes-photos`.
Le script est relançable sans risque.

### 2. Variables d'environnement
Copie `.env.example` en `.env.local` et renseigne l'URL et la clé **anon** (Supabase > Project Settings > API).

```bash
npm install
npm run dev
```

### 3. GitHub + Vercel
```bash
git init && git add . && git commit -m "Appli plantes"
git branch -M main
git remote add origin git@github.com:TON_COMPTE/plantes-app.git
git push -u origin main
```
Puis sur Vercel : **Add New > Project**, importe le dépôt, ajoute les 2 variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, et déploie.

## ⚠️ Sécurité

Il n'y a pas de login : les politiques RLS autorisent la clé `anon` sur les tables `plantes_*` et sur le bucket `plantes-photos`.
Quiconque connaît l'URL de l'appli (ou la clé anon, visible dans le navigateur) peut lire et modifier tes données de plantes.
Ça n'affecte pas tes autres tables. Pour verrouiller plus tard : ajouter Supabase Auth, ajouter une colonne `user_id` et passer les politiques sur `auth.uid()`.

## Structure

```
app/            pages (Aujourd'hui, plantes, fiche, formulaire, bilan)
components/     Nav, PlantForm, PlantPhoto
lib/            care.ts (types de soins, saisonnalité, échéances), api.ts, supabase.ts, image.ts
supabase/       plantes_schema.sql
```

Pour changer les soins proposés ou leurs fréquences par défaut, édite `CARE_TYPES` dans `lib/care.ts`.
