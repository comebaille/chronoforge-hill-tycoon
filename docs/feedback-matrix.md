# Matrice professionnelle de game feel

## Principes

Les retours confirment la simulation ; ils ne déclenchent jamais eux-mêmes dégâts, pièces ou progression. Chaque événement majeur doit rester compréhensible sans son et avec mouvement réduit. La priorité est : action du héros, impact, mort/récompense, capture, boss, conquête, puis économie de menus.

## Matrice des actions

| Action | Input / déclencheur | Réponse attendue | Anticipation | Phase active | Confirmation | Réaction du monde | Récupération | Paramètres actuels | Option confort | Test principal |
|---|---|---|---|---|---|---|---|---|---|---|
| Construire/améliorer un spawner | Bouton Caserne | Solde et niveau changent au même clic | Bouton affiche coût et disponibilité | Achat synchrone | Son `confirm`, vibration 12 ms, toast de niveau | Carte et cadence recalculées | Sauvegarde immédiate | Achat `x1/x10/Max` | Haptique désactivable | Fonds exacts, insuffisants, achat max |
| Apparition d'une unité | Timer spawner | Entité visible au portail | Aucun danger pendant l'état spawn | Scale vers 1 | Couleur d'équipe, ombre, barre de PV | La ligne se renforce | `move` après 0,24 s | Héros 0,30 s, boss 0,80 s | Pas de bob en mouvement réduit | Spawn sous cap, cap saturé, boss |
| Déplacement | État `move` | Avance fluide vers cible/voie | Cible et voie déjà acquises | Position interpolée | Bob vertical léger | Groupe se reforme autour des trois voies | Arrêt net au windup | Bob `sin(t×10+id)×1,5 px` | Bob supprimé | 30/60/120 Hz, frame longue |
| Windup ennemi/allié | Entrée en portée | Attaque annoncée avant l'effet | Scale 0,92 | 0,16 s standard, 0,38 siège, 0,46 boss | Silhouette contractée | Cible peut mourir avant contact | Passage en attack | Timings centralisés par rôle | Scale conservée sans particules | Réaction lisible sans son |
| Coup d'unité | Fin du windup | Un seul impact au tick prévu | Windup précédent | Scale 1,13 pendant 0,04 s | Flash cible, particules, son impact | PV diminuent ; splash éventuel | Recover `0,28×cooldown` | Son limité à 1/72 ms | Particules désactivables | Cible vivante/morte, foule |
| Soin du soutien | Fin windup + aura | PV de l'allié blessé remontent | Bâton et rôle visibles | Soin direct + aura rayon 0,12 | Barre de PV remonte | Ligne tient plus longtemps | Cooldown normal | Direct `0,9×coup`, aura `0,11×damage×dt` | Aucun flash agressif requis | Aucun blessé, plusieurs blessés |
| Frappe du héros | Bouton ou tap Canvas | Résolution immédiate et prévisible | Bouton actif ; cible implicite | Lunge 8 %, dégâts `×1,9` | Impact audio, flash/particules, vibration 14–18 ms | Ennemi recule seulement visuellement via impact | Cooldown 0,48 s affiché par bouton désactivé | Cible la plus proche du point | Auto-attaque ; haptique off | Sans cible, spam, tap excentré |
| Onde chronale | Bouton compétence | Tous les ennemis proches frappés | Bouton `PRÊT` | Rayon logique 0,28, dégâts `×3,1` | Libellé `Onde chronale`, son `era`, vibration `24/18/36` | Plusieurs flashes, morts et primes possibles | Cooldown 12 s affiché | Résolution sur copie d'unités | Particules et vibration off | Zéro, une, plusieurs cibles |
| Impact reçu | Événement `hit` | Dégât immédiatement identifiable | Windup attaquant | `flash = 1` | Overlay blanc et 2–5 particules | Barre de PV diminue | Flash décroît en 0,20 s | 5 particules, vie 0,35 s | 2 particules en mouvement réduit | Rafale de 28 ennemis |
| Mort ennemie | PV `<= 0` | Cible neutralisée une fois | PV faible et barre jaune | État dead, alpha 0,35 | Événements kill puis coin | Pression +5/+20/+35, pièces ajoutées | Retrait après 0,42 s | Garde anti-double | Lisible sans particules | Multi-hit au même tick |
| Prime de kill | Événement `coin` | Valeur visible et trésor mis à jour | Mort confirmée | Texte `+N` monte | Son coin | Revenu/s et mission évoluent | Texte 0,85 s | Son limité à 1/110 ms | Nombres flottants désactivables | Kills simultanés, gros nombres |
| Pression à 100 | Dernier kill requis | Objectif bascule vers capture | Jauge proche du maximum | Zone devient active | Texte HUD `TENEZ LA COLLINE`, ellipse turquoise | Les poids présents commencent à compter | Capture continue | Pression plafonnée à 100 | Contraste renforcé | Passage exact, surcroît de pression |
| Capture en cours | Poids net dans `y=.39..61` | Jauge monte, stagne ou baisse | Ellipse permanente | `4×clamp(diff,-3,3)%/s` | Jauge et compte alliés/ennemis | Cadence ennemie accélérée | Réversible jusqu'à 100 | Pulse et pointillés animés | Pulse fixe en mouvement réduit | Avantage, égalité, recul |
| Contre-vague | Seuil 25/50/75 | Pic de tension immédiat | Jauge approche du quart | Timer ennemi remis à zéro | Texte central 1,5 s | Nouvelle unité, double possible après 70 % | Retour au rythme courant | Une fois par seuil | Texte conservé sans vibration | Oscillation autour d'un seuil |
| Entrée du boss | Capitale, pression 58 | Menace majeure identifiable | Progression vers 58 | Spawn central 0,80 s | Bannière boss, toast danger, texte central | Musique duckée à 72 % | Combat jusqu'à sa mort | Anneau or, taille accrue | Aucun clignotement | Boss sous forte population |
| Héros à terre | Mort du héros | Cause et absence temporaire claires | Barre faible/jaune | Dead 0,42 s | Toast `retour dans 6 s` | Armée continue sans lui | Respawn après 6 s | Événement unique | Son non requis | Mort pendant frappe/onde |
| Conquête | Capture franchit 100 | Climax et progression sans ambiguïté | Jauge proche de 100 | Nettoyage des unités et récompense | Texte 2,4 s, son `era`, toast, vibration `45/35/70` | Âge/colline et thème changent | Nouvelle rencontre | Prime 25×, capitale 80× | Mouvement réduit et haptique off | Secteur normal, capitale, colline 45 |
| Pause/reprise | Bouton HUD | Simulation figée/reprise | Icône explicite | Aucun tick de simulation | Toast et icône play/pause | Timers et positions stables | Reprise au même état | Pas de coût | Aucun feedback animé requis | Chaque état de la machine |

## Budget visuel Canvas

| Effet | Valeur | Budget / règle |
|---|---:|---|
| Particules d'impact | 5 normales, 2 en mouvement réduit | Vie 0,35 s ; vitesse dispersée |
| Particules totales | 170 maximum | La plus ancienne est supprimée avant ajout |
| Flash d'impact | `flash = 1`, décroissance `5/s` | Environ 0,20 s |
| Texte de pièce | 0,85 s, 12 px | Monte à 28 px/s |
| Texte capture/boss | 1,5 s, 15 px | Centré, contour sombre |
| Texte conquête | 2,4 s, 22 px | Priorité maximale |
| Bob de marche | ±1,5 px à fréquence 10 rad/s | Uniquement en `move` |
| Pulse d'anneau | ±1,2 px à fréquence 4 rad/s | Héros, élite, boss |
| Pulse capture | ±2 px à fréquence 2,5 rad/s | Désactivé en mouvement réduit |
| DPR | maximum 2 ; batterie 1,25 | Ne modifie pas la simulation |

Les textes utilisent un contour sombre de 4 px afin de rester lisibles sur les neuf décors. Les unités sont triées par profondeur avant les particules.

## Budget audio

| Canal | Asset | Gain local | Variation | Limitation |
|---|---|---:|---:|---|
| Impact | `impact.wav` | 0,52 | vitesse 0,94..1,06 | Un déclenchement toutes les 72 ms |
| Pièce | `coin.wav` | 0,42 | vitesse 0,94..1,06 | Un déclenchement toutes les 110 ms |
| Ère / conquête / onde | `era-unlock.wav` | 0,68 | Variable sauf conquête | Pas de limite dédiée |
| UI / achat | `ui-confirm.wav` | 0,68 | vitesse 0,94..1,06 | Uniquement après succès |
| Musique | `chronoforge-loop.wav` | Réglage musique | Aucune | Boucle ; duck à 72 % pendant boss |

Le compresseur final utilise seuil `-8 dB`, knee `8` et ratio `6`. L'échec de chargement ou de décodage audio ne doit jamais empêcher le jeu de démarrer.

## Haptique

| Action | Motif actuel |
|---|---|
| Achat de spawner | `12 ms` |
| Frappe bouton | `18 ms` |
| Frappe par tap Canvas | `14 ms` |
| Onde chronale | `[24, 18, 36] ms` |
| Conquête | `[45, 35, 70] ms` |

Tout motif passe par le réglage `haptics` et la disponibilité de `navigator.vibrate`. Aucune information ne dépend uniquement de la vibration.

## États d'échec à expliquer

- Frappe refusée : bouton désactivé pendant cooldown ou pause ; aucun son/haptique de réussite.
- Achat impossible : toast `Trésor insuffisant` ou `Amélioration verrouillée ou trop coûteuse`.
- Aucun allié blessé : le soutien ne produit pas de faux effet de dégâts.
- Capture bloquée : jauge stable et compte alliés/ennemis visible.
- Héros mort : toast avec durée de retour.
- Audio indisponible : tous les retours visuels, textuels et HUD subsistent.

## Mesures professionnelles

Mesurer sur appareils réels :

- délai `pointerdown -> heroStrike()` ; cible < 50 ms hors frame longue ;
- délai transition `windup -> hit visible` ; même frame de rendu ou suivante ;
- exactitude du cooldown frappe à 0,48 s et de l'Onde à 12 s ;
- nombre de particules concurrentes dans une contre-vague à 28 ennemis ;
- densité audio après limitation 72/110 ms ;
- stabilité de l'interpolation à 30, 60 et 120 Hz d'affichage ;
- réaction avec six pas de rattrapage puis abandon de l'accumulateur ;
- lisibilité avec son coupé, particules coupées, grands textes et mouvement réduit.

## Contrôle qualité

- [ ] L'entrée acceptée produit une réponse prévisible et l'entrée refusée explique pourquoi.
- [ ] Le hit visuel correspond au tick de dégâts, jamais au début du windup.
- [ ] Aucun son ou haptique de succès n'est joué si l'action échoue.
- [ ] Le feedback de foule reste sous 170 particules et ne masque pas le boss.
- [ ] Les pièces simultanées sont regroupées par la limitation audio sans perte économique.
- [ ] La capture reste compréhensible sans pulse et sans son.
- [ ] Les équipes restent distinguables avec les palettes d'accessibilité.
- [ ] La caméra et le rendu ne modifient jamais la cible logique.
- [ ] La conquête normale et la capitale produisent des libellés distincts.
- [ ] Toutes les actions centrales restent compréhensibles avec effets réduits.
