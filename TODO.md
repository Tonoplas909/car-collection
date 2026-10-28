# MARQUE — reste à faire

- [ ] **Relire le catalogue** : 173 voitures sur 201 ont `reviewed: false` (specs et blurb en brouillon). Aide : `npm run cars:enrich` puis `data/review.html`.
- [ ] **Photo manquante** : 200 voitures sur 201 ont une photo. Retrouver la dernière (`photoMatch` / `photoQuery`) et vérifier les crédits Commons.
- [ ] **Paiements** : `topUp` dans `src/api/supabase.ts` lève `not_configured`. Brancher un fournisseur (checkout + webhook qui crédite le compte) ou retirer l'écran de recharge.
- [ ] **Déployer Supabase** : migrations, `supabase/catalog.sql`, fonctions `packs` et `races`, `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), hébergement du front.
- [ ] **Vérification de bout en bout** : `npm test`, `npm run test:db`, `npm run lint`, `npm run build`, puis essai sur un vrai Supabase (pas seulement le mock localStorage).
- [ ] **Finir le cahier des charges** : règle de pitié (Légendaire garanti tous les 20 packs), récompenses de saison du classement, défis entre amis. À confirmer dans le code.
- [ ] **Nom et licences** : « MARQUE » est provisoire ; noms et images de voitures réelles demandent des droits.
- [ ] **Liaison par compte Discord**
  - Auth : activer le fournisseur Discord dans Supabase Auth (client ID/secret, URL de redirection) ; bouton « Se connecter avec Discord » dans `src/screens/Onboarding.tsx`.
  - Liaison : `linkIdentity` pour un compte existant ; bloc « Compte lié » dans les réglages (`src/screens/Extras.tsx`) avec pseudo Discord et bouton pour délier.
  - Mock : simuler la liaison dans `src/api/mock.ts` pour que le mode sans `.env.local` continue de marcher.
  - Amis (facultatif) : proposer d'ajouter les amis Discord qui jouent aussi.
  - À trancher : Discord sert-il aussi à créer un compte, ou seulement à lier un compte existant ?
