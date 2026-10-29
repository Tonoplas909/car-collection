# Déploiement (Supabase + GitHub Pages)

Le front est publié sur GitHub Pages par `.github/workflows/deploy.yml` à chaque push sur `main`. Sans les variables `VITE_SUPABASE_*`, il tourne sur le backend de démo (localStorage). Les étapes ci-dessous branchent le vrai backend.

Prérequis : un compte Supabase et Node (les commandes passent par `npx supabase`, rien à installer).

## 1. Créer le projet Supabase
supabase.com → New project. Région proche des joueurs (Paris ou Frankfurt). Notez le **project ref** (l'identifiant dans l'URL du dashboard) et le mot de passe de la base.

## 2. Appliquer le schéma
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```
`db push` applique les migrations de `supabase/migrations/` (schéma, RLS, fonctions SQL).

## 3. Charger le catalogue
Dans le dashboard : SQL Editor, collez le contenu de `supabase/catalog.sql` et lancez-le (201 voitures + événements de course, idempotent).

N'utilisez **pas** `supabase/seed.sql` en production : il contient en plus des annonces de démonstration.

## 4. Déployer les Edge Functions
```bash
npx supabase functions deploy packs
npx supabase functions deploy races
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions, il n'y a pas de secret à ajouter.

## 5. Réglages Auth
Dashboard → Authentication :
- URL Configuration : Site URL = `https://tonoplas909.github.io/car-collection/`, et ajoutez la même URL (avec `**`) dans les Redirect URLs.
- Providers → Email : décidez si la confirmation par e-mail est obligatoire.
- Providers → Discord : activé avec le Client ID et le Client Secret de votre application Discord (portail développeur Discord → OAuth2 → Redirects : `https://<project-ref>.supabase.co/auth/v1/callback`).
- Sign In / Providers → **Allow manual linking** : activé, pour que « Connect Discord » des réglages fonctionne sur un compte existant.
- Redirect URLs : la page `/auth/callback` du site doit être autorisée (`https://tonoplas909.github.io/car-collection/**` couvre tout).

## 6. Brancher le front
Dashboard → Project Settings → API : copiez l'URL du projet et la clé `anon`.

Sur GitHub : Settings → Pages → Source = **GitHub Actions**. Puis Settings → Secrets and variables → Actions → onglet **Variables** : créez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. La clé anon est publique par conception (la sécurité repose sur les règles RLS) ; ne mettez jamais la clé `service_role` dans le front.

Relancez le workflow (Actions → Deploy to GitHub Pages → Run workflow).

## 7. Vérifier
Sur le site publié : créer un compte, ouvrir le pack gratuit, lancer une course, mettre une voiture en vente avec un second compte et l'acheter.

## En local contre le vrai projet
Copiez `.env.example` en `.env.local` et renseignez les deux variables ; `npm run dev` utilise alors Supabase au lieu du mock.

## Connexion avec Discord
Le bouton « Continue with Discord » (inscription et connexion) et « Connect Discord » (réglages) utilisent le fournisseur Discord de Supabase. Une migration adapte la création de profil aux comptes Discord (pas de nom d'utilisateur, e-mail parfois absent) :
```bash
npx supabase db push
```
Si l'e-mail Discord est vérifié et correspond à un compte existant, Supabase relie l'identité Discord à ce compte au lieu d'en créer un second.

## Courses sur circuit
Les courses se jouent sur un circuit (freinage et nitro, boîte automatique). Le serveur rejoue les actions du joueur et pilote lui-même les adversaires avec les mêmes règles. Après avoir récupéré ce changement :
```bash
npx supabase db push
npx supabase functions deploy races
```
La migration remplace `enter_race` (plus de liste d'adversaires dans la base) et met à jour les quatre épreuves, dont la nouvelle `touge`. Relancer `supabase/catalog.sql` n'est pas nécessaire (il contient les mêmes lignes). Une course commencée avant la mise à jour ne peut plus être envoyée : le joueur perd simplement ses frais d'entrée.
