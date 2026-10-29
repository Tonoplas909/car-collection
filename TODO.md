# MARQUE — reste à faire

- [x] **Relire le catalogue** : 490 fiches (201 relues avec le propriétaire du projet, 289 ajoutées ensuite dont ~175 voitures de 2010 à 2025). Specs et textes écrits de mémoire, sans sources : à recouper si un chiffre vous semble faux. Photos des nouvelles voitures contrôlées à l'œil (une photo est remplacée par une recherche Commons quand elle montrait une mauvaise génération).
- [x] **Photo manquante** : Fiesta ST Mk6 ajoutée (Calreyn88, CC BY-SA 4.0). Les 490 voitures ont une photo avec crédit Commons.
- [ ] **Photos des 271 voitures en attente** : elles sont dans `supabase/cars.pending.json` (fiches prêtes, photo à trouver ou à vérifier). `npm run cars:enrich -- --pending` (à lancer depuis une machine que Wikimedia ne limite pas) cherche leurs photos et déplace dans `cars.json` celles qui en ont trouvé une ; à regarder ensuite dans `data/review.html`.
- [ ] **Mettre à jour la base en ligne** : relancer `supabase/catalog.sql` dans le SQL Editor de Supabase (upsert, ne rien vider) pour ajouter les nouvelles voitures (714 au total), puis redéployer les fonctions `packs` et `races` (elles embarquent la liste des voitures).
- [~] **Paiements** : écran « Credits » masqué sur le backend Supabase (`topUpEnabled` dans `src/api/index.ts`, route `/credits` redirigée vers `/packs`, boutons « Top up » remplacés par « Close »). La recharge reste active dans la démo locale (mock). Reste à brancher un fournisseur (checkout + webhook idempotent qui crédite le compte) puis passer `topUpEnabled` à `true`.
- [x] **Déployer Supabase** : suivre `DEPLOY.md` (projet, `db push`, `catalog.sql`, fonctions `packs` et `races`, réglages Auth, variables GitHub, vérification). Migrations vérifiées avec `npm run test:db` (tous les tests passent).
- [ ] **Vérification de bout en bout** : `npm test`, `npm run test:db`, `npm run lint`, `npm run build`, puis essai sur un vrai Supabase (pas seulement le mock localStorage).
- [ ] **Finir le cahier des charges** : règle de pitié (Légendaire garanti tous les 20 packs), récompenses de saison du classement, défis entre amis. À confirmer dans le code.
- [ ] **Nom et licences** : « MARQUE » est provisoire ; noms et images de voitures réelles demandent des droits.
- [ ] **Liaison par compte Discord**
  - Décidé : Discord sert à la fois à créer un compte (connexion) et à lier un compte existant.
  - Création : activer le fournisseur Discord dans Supabase Auth (client ID/secret, URL de redirection) ; bouton « Continuer avec Discord » dans `src/screens/Onboarding.tsx` (crée le compte s'il n'existe pas).
  - Liaison : `linkIdentity` pour un compte existant ; bloc « Compte lié » dans les réglages (`src/screens/Extras.tsx`) avec pseudo Discord et bouton pour délier.
  - Mock : simuler la liaison dans `src/api/mock.ts` pour que le mode sans `.env.local` continue de marcher.
  - Amis (facultatif) : proposer d'ajouter les amis Discord qui jouent aussi.
  - Cas limite : si l'e-mail Discord correspond déjà à un compte, lier l'identité plutôt que créer un doublon.
