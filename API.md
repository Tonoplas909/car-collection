# Contrat HTTP

Base : `/api` (le serveur de dev Angular la proxifie vers `http://localhost:3000`). Les types échangés sont définis dans [`shared/api.ts`](shared/api.ts).

Sauf mention « public », envoyer `Authorization: Bearer <token>`. Toutes les mutations répondent avec le `Snapshot` complet du joueur (profil, stats, garage, annonces, offres, activité, amis, événements, saison), éventuellement accompagné d'un résultat.

## Routes

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/health` (public) | – | `{ status: "ok", db: "up" }` |
| GET | `/catalog` (public) | – | `{ cars, packs, events }` |
| POST | `/auth/register` (public) | `{ username, email, password }` | `201 { token, snapshot }` |
| POST | `/auth/login` (public) | `{ email, password }` | `{ token, snapshot }` |
| GET | `/me` | – | `Snapshot` |
| PUT | `/me` | `{ username, email, region, settings }` | `Snapshot` |
| POST | `/me/onboarding` | `{ tastes: TasteId[] }` | `{ snapshot, carIds }` (pack de départ, une seule fois) |
| POST | `/packs/:packId/open` | – (`street`, `heritage`, `apex`) | `{ snapshot, opening }` |
| POST | `/packs/free/open` | – | `{ snapshot, opening }` (une fois par 24 h) |
| POST | `/garage/:carId/upgrade` | – | `Snapshot` |
| PUT | `/garage/showcase` | `{ carIds }` (3 max) | `Snapshot` |
| POST | `/market/listings` | `{ carId, price }` | `201 Snapshot` (la voiture quitte le garage) |
| DELETE | `/market/listings/:id` | – | `Snapshot` (la voiture revient) |
| POST | `/market/listings/:id/buy` | – | `Snapshot` (le vendeur reçoit le prix moins 5 %) |
| POST | `/market/listings/:id/offers` | `{ price }` | `Snapshot` (offre enregistrée dans l'activité) |
| POST | `/swaps` | `{ to, give, get, credits }` | `201 Snapshot` |
| POST | `/swaps/:id/accept` | – | `Snapshot` |
| POST | `/swaps/:id/decline` | – | `Snapshot` |
| POST | `/races` | `{ eventId, carId }` | `201 { snapshot, entry }` (frais d'inscription débités) |
| POST | `/races/:id/finish` | `{ shiftSteps: number[] }` | `{ snapshot, result }` (course rejouée côté serveur) |
| POST | `/credits/top-up` | `{ bundleId }` | `Snapshot` (projet local : pas de paiement réel) |
| POST | `/friends` | `{ username }` | `201 Snapshot` |
| GET | `/leaderboard?metric=race\|value\|size&scope=global\|friends\|region` | – | `Leaderboard` |

## Erreurs

Corps : `{ "error": { "code": "...", "message": "...", "needed"?: number } }`

| Code | HTTP | Exemple |
|---|---|---|
| `invalid` | 400 (409 si email / pseudo déjà pris) | prix < 100 CR, pack gratuit pas encore prêt |
| `unauthenticated` | 401 | token absent, expiré, mauvais mot de passe |
| `insufficient_credits` | 402 | `needed` = montant requis |
| `not_found` | 404 | annonce terminée, voiture absente du garage |
