# MARQUE — reste à faire

- [x] **Relire le catalogue** : 201 fiches relues (specs et textes de mémoire, arbitrages faits avec le propriétaire du projet). Les photos restent à contrôler à l'œil dans `data/review.html` (`npm run cars:enrich`).
- [x] **Photo manquante** : Fiesta ST Mk6 ajoutée (Calreyn88, CC BY-SA 4.0). Les 201 voitures ont une photo ; vérifier les crédits Commons.
- [ ] **Paiements** : `topUp` dans `src/api/supabase.ts` lève `not_configured`. Brancher un fournisseur (checkout + webhook qui crédite le compte) ou retirer l'écran de recharge.
- [ ] **Déployer Supabase** : migrations, `supabase/catalog.sql`, fonctions `packs` et `races`, `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), hébergement du front.
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
