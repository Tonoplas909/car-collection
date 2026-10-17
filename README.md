# MARQUE

Jeu de collection de voitures réelles : ouvrir des packs, courir pour gagner des voitures, échanger sur le marché et améliorer son garage. La spécification produit et design est dans [SPEC.md](SPEC.md), les maquettes HTML de référence dans `design/`.

## Architecture

```text
frontend/  Angular 22 (standalone, Signals, HttpClient)  →  http://localhost:4200
   │  /api/* (proxy.conf.json)
backend/   Express 5 + Mongoose + JWT                    →  http://localhost:3000/api
   │
MongoDB    URI dans backend/.env, sinon MongoDB embarquée (mongodb-memory-server)
shared/    règles du jeu en TypeScript (packs, physique de course, économie) + catalogue cars.json,
           utilisées par le backend ET le frontend ; shared/api.ts = contrat HTTP typé
```

- Le **backend** applique toutes les règles : tirage des packs (aléatoire côté serveur), crédits, marché (frais 5 %), échanges, améliorations, classement. Une course est jouée dans le navigateur, puis le serveur **rejoue** la simulation à partir des instants de passage de rapport envoyés pour calculer le résultat (le client ne peut pas tricher sur le temps).
- Chaque mutation renvoie le `Snapshot` complet du joueur ; le **frontend** le range dans un store à base de Signals (`frontend/src/app/core/store.ts`) et tous les écrans en dérivent avec `computed()`.
- Authentification : `POST /api/auth/login` renvoie un JWT, stocké dans `localStorage` et ajouté par `authInterceptor` (`Authorization: Bearer …`). Les erreurs serveur `{ error: { code, message } }` deviennent des `GameError` côté Angular.
- Contrat HTTP complet : [API.md](API.md).

## Prérequis

- **Node.js ≥ 22.22.3 ou ≥ 24.15** (exigé par Angular CLI 22) et npm.
- Rien d'autre : sans `MONGODB_URI`, le backend démarre une MongoDB embarquée (le binaire est téléchargé une fois au premier lancement, les données sont gardées dans `backend/data/db`).
- Optionnel : une MongoDB locale ou Atlas. Copier `backend/.env.example` en `backend/.env` et renseigner `MONGODB_URI` (et `JWT_SECRET`).

## Lancer en local

```bash
npm run install:all   # installe la racine, backend/ et frontend/
npm run dev           # backend (port 3000) + frontend (port 4200) en parallèle
```

Ou dans deux terminaux : `cd backend && npm run dev` puis `cd frontend && npm start`.

Ouvrir http://localhost:4200. Au premier démarrage la base est remplie avec des données de démo :

- compte de démonstration : **j.durand@example.com / Demo1234!** (14 voitures, offres d'échange reçues, amis) ;
- 14 autres joueurs (mot de passe `Demo1234!`, emails `<pseudo>@marque.demo`, ex. `apex_julien@marque.demo`) qui alimentent le classement et le marché ;
- annonces « maison », historique de ventes, saison et événements.

On peut aussi créer un compte : l'inscription mène au choix des goûts puis au pack de départ.

`npm run seed:reset` vide la base et recharge la démo.

## Tests

```bash
npm test            # règles du jeu (Vitest) + API de bout en bout sur une MongoDB jetable (node:test)
npm run test:web    # tests unitaires Angular (intercepteur JWT, store, formatage)
npm run build       # build de production du frontend
```

## Arborescence

| Dossier | Contenu |
|---|---|
| `backend/src/app.ts` | routes Express, gestion d'erreurs |
| `backend/src/game.ts` | règles côté serveur (snapshot, packs, marché, échanges, courses, classement) |
| `backend/src/models.ts` | schémas Mongoose : `User` (profil, stats, garage, activité, amis), `Listing`, `Sale`, `SwapOffer`, `Race`, `CalendarEvent`, `Season` |
| `backend/src/auth.ts` | inscription, connexion (bcrypt), middleware JWT |
| `backend/src/seed/` | données de démo |
| `frontend/src/app/core/` | `ApiService`, `authInterceptor`, `Store` (Signals), guards, animations (`motion.ts`), formatage |
| `frontend/src/app/shared/` | composants communs : photo, filtre de rareté, dialogue de confirmation, état vide, en-tête mobile |
| `frontend/src/app/screens/` | un dossier par écran (Landing, Onboarding, Garage, Packs, Market, Race, Leaderboard, Profile, Extras) |
| `frontend/src/styles/` | `ds.css` (design system, copie de `design/ds/styles.css`), `app.css`, une feuille par écran |
| `shared/game/` | règles et catalogue partagés |
| `scripts/` | outils de catalogue (`npm run cars:add`, `npm run cars:enrich`) |

## Direction artistique

Le design system « Modernist » (`design/ds/styles.css`, Archivo, angles droits, séparateurs 2 px, rouge d'accent) est repris tel quel. Les animations du prototype sont portées : volet noir à bord rouge entre les pages, panneaux latéraux (en-tête rouge en `clip-path`, photo, statistiques en cascade, barres qui se remplissent), dalle noire qui balaye la sélection en course, rideau qui se lève sur les cartes de pack, apparitions au scroll et compteurs de la landing, bandeau défilant, boutons magnétiques et balayage au clic. Tout est désactivé avec `prefers-reduced-motion` ou le réglage « Reduce motion ». En dessous de 768 px, l'application affiche les maquettes mobiles (390 px) avec la barre d'onglets.
