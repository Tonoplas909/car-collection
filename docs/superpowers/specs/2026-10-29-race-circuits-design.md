# Courses sur circuit — design

Date : 2026-10-29. Statut : en attente de relecture.

## Objectif

Remplacer la course actuelle (ligne droite, 5 appuis sur espace pour passer les vitesses) par un mini-jeu de course d'environ 45 secondes sur un circuit de 6 à 8 secteurs. Le joueur freine et déclenche son nitro au bon moment. La voiture choisie doit compter : chaque circuit favorise un profil (accélération, vitesse de pointe, tenue de route), donc la meilleure voiture change d'une épreuve à l'autre.

### Ce que le propriétaire du projet a demandé
- Plus de 5 appuis sur espace.
- Plus de lignes droites seules, parce que ça pousse à toujours jouer la même voiture.
- Une course dynamique, « limite un mini-jeu de course complet ».
- Des décisions minutées par secteur (pas du pilotage libre), environ 45 s, 6 à 8 secteurs.
- Design validé en chat le 2026-10-29 (« niquel »).

### Hypothèses (à corriger si fausses)
- Les vitesses sont automatiques.
- Les adversaires ne sont plus calés sur la voiture du joueur.
- Le serveur vérifie toujours la course en la rejouant.
- Les épreuves gardent leur économie (frais d'entrée, gains, points, XP).
- Le backend de démo (localStorage) et Supabase exécutent le même code de règles.

## Pourquoi la voiture ne compte pas aujourd'hui

`calibrateOpponents` règle le temps des adversaires sur le meilleur temps possible de la voiture du joueur (`perfectTime`). Quelle que soit la voiture, un tir parfait gagne de justesse et un tir moyen perd de justesse. Le nouveau modèle supprime ce calibrage : les adversaires sont de vraies voitures du catalogue simulées avec les mêmes règles.

## Règles de course

### Circuit
Un circuit est une liste de secteurs. Chaque secteur a un type (`straight`, `sweeper`, `chicane`, `hairpin`, `climb`), une longueur en mètres et un angle de virage en degrés (0 sur une ligne droite). Les secteurs de virage ont une vitesse cible de référence `vRef` (m/s). Un secteur peut avoir une pente `grade` (0,06 = 6 %, typique d'un `climb`) qui retire `9,81 · grade` m/s² à l'accélération. Chaque circuit déclare aussi les notes qu'il valorise (`focus`), affichées sur l'écran de préparation. Le circuit est une donnée dans `supabase/functions/_shared/game/tracks.ts`, un par épreuve.

### Notes d'une voiture
Trois valeurs dérivées des specs existantes, sans nouvelle donnée dans le catalogue :
- **Accélération** `A` : formule actuelle `(3 + 18·hp/kg) · 1,6 · (1 + 0,02·niveau)`.
- **Vitesse de pointe** `vmax` : `top / 3,6`.
- **Tenue de route** `G` : de 0,75 à 1,4. Elle grandit quand la voiture est légère (`kg`) et quand elle est récente (pneus). Elle gagne 0,01 par niveau d'amélioration.

Le freinage `B` (m/s²) vaut `8 + 4·G`. Les constantes vivent dans une table unique pour pouvoir être réglées ; les tests fixent seulement l'ordre des résultats.

### Pas de simulation
Pas fixe `DT = 1/120 s`, comme aujourd'hui. À chaque pas :
1. Le secteur courant se déduit de la distance parcourue.
2. Sans frein : `v += A · (1 − v/vmax) · DT`. Pendant un nitro : `A ×1,5`, `vmax ×1,04`.
3. Frein maintenu : plus d'accélération. Sans virage devant, `v −= B · DT`. Avec un virage devant, **aide au freinage** : la voiture ralentit pour arriver à la vitesse du virage (`vc`) au moment d'y entrer, avec la décélération qu'il faut, entre 0,3 × B (freinage très tôt) et 1,5 × B (freinage tard), puis tient cette vitesse sans descendre dessous. Si même 1,5 × B ne suffit pas, c'est la glissade (règle 4). Sans cette aide, freiner à la bonne seconde près pour une épingle prise à 300 km/h demande une précision de 0,02 s, que personne ne peut tenir.
4. Dans un virage de vitesse cible `vc = vRef · G` : si `v > vc`, la voiture glisse, `v −= 6 · (v − vc) · DT` ; l'accélération est plafonnée à `vc`.
   Au-dessus de 1,05 × la vitesse du virage à l'entrée, la voiture part en glissade : sa vitesse tombe à `vc · max(0,2 ; 1 − 2,5 · (r − 1,05))` et elle ne peut plus accélérer pendant 1,5 s par 0,5 d'excès (6 s au plus). Sans cette règle, freiner tard serait gratuit, parce que le frottement ci-dessus absorbe l'excès en une fraction de seconde.
5. La distance avance de `v · DT`. La course finit à la ligne, avec interpolation du temps comme aujourd'hui.

La boîte de vitesses est automatique ; l'écran garde une jauge de régime et un rapport affichés, calculés à partir de `v / vmax` (affichage seulement, sans effet sur la physique).

### Entrées du joueur
- **Frein** : maintenu (espace ou flèche bas ; bouton tactile).
- **Nitro** : un appui (touche N ou flèche haut ; bouton tactile). 2 charges par course, 2 s chacune, sans effet pendant le freinage.

Une course est décrite par `RaceInputs = { brake: number[]; nitro: number[] }`. `brake` liste les pas d'enclenchement et de relâchement en alternance (`[on, off, on, off…]`), `nitro` liste les pas d'activation.

### Qualité des virages
À l'entrée de chaque virage, `r = v / vc` : `Early` si `r < 0,93`, `Perfect` entre 0,93 et 1,05, `Late` au-delà. Le résultat remplace la bande « Shifts » actuelle de l'écran de résultats.

### Épreuves
Les identifiants `drag`, `sprint` et `run` sont conservés (lignes déjà en base, événements du calendrier). On ajoute `touge`. Chaque épreuve vise 35 à 55 s pour une voiture médiane de sa catégorie ; les longueurs sont réglées avec le simulateur.

| id | Thème | Ce qui compte |
|---|---|---|
| `drag` | enchaînement de relances, freinages courts | accélération |
| `sprint` | circuit mixte (Suzuka East) | un peu de tout |
| `touge` | col de montagne, épingles et chicanes | tenue de route |
| `run` | autoroute, grands virages rapides | vitesse de pointe |

Frais, gains et points des trois épreuves existantes ne changent pas. `touge` : frais 700, gain 3 800, 160 points.

### Adversaires
- Trois vraies voitures du catalogue, de même rareté que la voiture du joueur, tirées avec un générateur pseudo-aléatoire initialisé par l'identifiant de course (jamais `Math.random`).
- Chaque adversaire est piloté par le planificateur automatique `autoDrive(car, track, rng, skill)` : il freine au point idéal décalé d'une erreur tirée du générateur (±4 à ±12 % de distance selon `skill`) et place son nitro en sortie de virage.
- Même graine et même code des deux côtés : le client et le serveur trouvent les mêmes adversaires et les mêmes temps, sans changer la base de données.
- Les pseudos viennent d'une liste fixe de joueurs fictifs (les trois actuels y restent).

### Récompenses
`raceRewards` ne change pas.

## Architecture

### Modules partagés (`supabase/functions/_shared/game/`)
- `tracks.ts` : types de secteurs, circuits des quatre épreuves, tracé calculé à partir des angles.
- `race.ts` : notes de voiture, `RaceSim` (pas de simulation, entrées frein et nitro, qualité des virages), `replay(car, track, inputs)`, `autoDrive`, `validRaceInputs`, `scoreRace`. Il perd la boîte de vitesses manuelle et `calibrateOpponents`.
- `opponents.ts` : tirage des adversaires depuis l'identifiant de course, liste de pseudos, `skill` par adversaire.
- `index.ts` : exports mis à jour. Imports en `.ts` explicites, aucune API navigateur ni Deno.

### Contrat d'API
- `enterRace(eventId, carId)` renvoie `{ raceId, eventId, carId }`. Les adversaires ne sont plus renvoyés : le client les déduit de `raceId` avec `opponents.ts`.
- `finishRace(raceId, inputs: RaceInputs)` remplace `finishRace(raceId, shiftSteps)`. L'Edge Function `races` reçoit `{ raceId, inputs }`.
- `RaceResult` : `shifts` devient `corners: ShiftQuality[]` (même type `Early | Perfect | Late`, renommé `CornerQuality`), plus `splits: number[]` (temps par secteur) et `nitroUsed: number`.

### Serveur
- Nouvelle migration `20261029000001_race_circuits.sql` : met à jour `enter_race` (plus de liste d'adversaires en dur), met à jour les lignes `race_events` existantes (libellés, longueur totale) et ajoute `touge`. `scripts/gen-seed.ts` régénère `catalog.sql` et `seed.sql` depuis `RACE_EVENTS`.
- Edge Function `races` : valide `inputs`, dérive les adversaires de `raceId`, rejoue, classe, garde le contrôle « pas plus vite que le temps réel » (`SLACK_MS`), appelle `apply_race_result`.
- Une course commencée avec l'ancien client puis envoyée avec l'ancien format sera refusée (`invalid|Malformed race submission.`). Acceptable : le front est déployé en même temps.

### Backend de démo
`src/api/mock.ts` appelle les mêmes fonctions `scoreRace` et `opponents` que le serveur.

### Interface (`src/screens/Race.tsx`, `Race.css`)
- **Préparation** : le panneau de droite remplace la liste fixe d'adversaires par le tracé du circuit (SVG), la liste des secteurs et les notes que l'épreuve valorise. La sélection de voiture, les animations de balayage et le test de timeout restent.
- **Course** : une carte SVG du circuit avec 4 points qui avancent (le joueur en rouge), construite en « tortue » à partir des angles des secteurs, et le classement. Sous la carte, le **repère de virage** : une barre de route sur les 250 m devant, avec un drapeau « BRAKE » à l'endroit où commencer à freiner (freinage normal, il reste de la marge jusqu'à 1,5 × B) ; une jauge de vitesse avec une zone verte (la vitesse à avoir à l'entrée du virage) et une aiguille ; et un mot d'ordre en gros : GO, BRAKE!, RELEASE! ou SLIDING. On freine quand le drapeau arrive, on garde le frein jusqu'au virage, on relâche dans le virage. Deux boutons à l'écran, un grand Frein (maintenu) et un Nitro, utilisés surtout sur mobile (`touch-action: none`, `pointerdown`/`pointerup`).
- **Résultats** : classement identique, plus les temps par secteur et la bande de qualité des virages.
- Le texte « Ready » explique les deux commandes avant le départ.

### Documentation
`README.md` (paragraphe « Race model »), `DEPLOY.md` (appliquer la migration, redéployer `races`) et `TODO.md` sont mis à jour.

## Tests

- **Déterminisme** : une course jouée pas à pas par le client et rejouée par `replay` à partir des entrées donne exactement le même temps, les mêmes qualités de virage et les mêmes temps par secteur.
- **La voiture compte** : sur `touge`, une voiture légère à bonne tenue de route bat une voiture lourde plus puissante du catalogue ; sur `run`, la voiture à plus haute vitesse de pointe gagne ; sur `drag`, la meilleure accélération gagne.
- **Fourchette de temps** : une voiture médiane de chaque rareté termine chaque épreuve en 35 à 55 s en pilotage parfait.
- **Équilibre** : battre trois adversaires tirés au hasard dans sa rareté dépend surtout de la voiture. Mesuré en pilotage parfait sur le circuit mixte : la voiture médiane de sa rareté gagne environ 1 course sur 5, une voiture parmi les 10 % les plus rapides de sa rareté en gagne plus de 6 sur 10, et un pilote très approximatif n'en gagne presque aucune. Les tests fixent ces trois ordres de grandeur. Le seuil de 80 % prévu au départ n'est pas tenable avec trois adversaires tirés au hasard : c'est un choix de conception, à réviser après essai.
- **Validation** : `validRaceInputs` refuse les pas négatifs, non entiers, décroissants, plus de 2 nitros et trop d'événements de frein.
- **Adversaires** : même graine, mêmes adversaires ; trois adversaires distincts ; rareté respectée.
- **Base** : `npm run test:db` exécute la migration, `enter_race`, `apply_race_result` et vérifie la ligne `touge`.
- **Écran** : captures Playwright (bureau et mobile) de la préparation, de la course et des résultats avec le backend de démo.
- `npm test`, `npm run lint` et `npm run build` passent avant le commit.

## Hors périmètre

Pilotage libre au volant, usure des pneus et carburant, arrêts au stand, multijoueur en temps réel, lancement avec temps de réaction, mode d'entraînement. Le réglage fin des constantes se fait après un premier essai jouable.

## Risques

- **Équilibrage** : les notes `G` et `vRef` sont des estimations ; une passe de réglage avec la table de constantes est prévue après le premier essai.
- **Écarts entre moteurs JavaScript** : `Math.pow` et `Math.exp` peuvent différer au dernier bit entre navigateurs et serveur. Le résultat officiel est toujours celui du serveur ; l'animation en direct n'est qu'un aperçu.
- **Triche** : le serveur ne peut pas distinguer un joueur d'un script qui envoie des entrées parfaites. C'est déjà le cas aujourd'hui et ça ne change pas.
