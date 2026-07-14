# Contrat d'animation des unités

## Portée et principe

La version actuelle utilise un atlas SVG statique et des transformations procédurales dans le Canvas. Il n'existe ni spritesheet multi-frames, ni root motion, ni squelette. L'animation doit refléter exactement l'état gameplay `spawn | move | windup | attack | recover | dead`; la simulation reste la source de vérité pour les positions, impacts et morts.

Le rendu s'effectue à la fréquence de l'écran, tandis que le gameplay avance à 30 Hz. La position affichée est interpolée :

```text
positionRendue = previousPosition + (positionSimulation - previousPosition) × alpha
```

## Inventaire des sources

Source commune : `public/assets/original/unit-sprites.svg`, dimensions `768 × 128`, six cellules de `128 × 128`.

| Cellule X | Rôle | Pose source | Boucle | Root motion | Variante d'âge | Variante d'équipe |
|---:|---|---|---|---|---|---|
| 0 | Assaut | Arme levée | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |
| 128 | Tireur | Arc en joue | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |
| 256 | Gardien | Bouclier avancé | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |
| 384 | Éclaireur | Double arme, jambes écartées | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |
| 512 | Soutien | Bâton vertical | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |
| 640 | Siège | Canon porté | Non | Non | Nom, palette et contexte | Ennemi retourné horizontalement |

Le héros réutilise la cellule Assaut avec anneau blanc. Les élites utilisent l'anneau de la palette d'âge ; le boss utilise la cellule Gardien, une taille supérieure et un anneau or.

Fallback de chargement : si l'atlas n'est pas disponible, rendre un disque rempli avec la couleur principale de l'âge. Le fallback doit conserver taille, équipe, barre de vie et états procéduraux.

## Paramètres d'animation

| Paramètre | Type | Producteur | Consommateur | Valeurs / contrat |
|---|---|---|---|---|
| `state` | enum | Simulation | Pose procédurale | `spawn`, `move`, `windup`, `attack`, `recover`, `dead` |
| `stateTimer` | float | Simulation | Scale et durée d'état | Secondes restantes |
| `x`, `y` | float | Simulation | Translation | Espace normalisé |
| `previousX`, `previousY` | float | Simulation | Interpolation | État du tick précédent |
| `alpha` | float | Boucle principale | Interpolation | `0..1` |
| `team` | enum | Entité | Couleur et miroir | `ally`, `enemy` |
| `role` | enum | Entité | Cellule atlas | Six rôles |
| `isHero` | bool | Entité | Anneau blanc | Héros uniquement |
| `isBoss` | bool | Entité | Taille et anneau or | Boss uniquement |
| `elite` | bool | Entité | Anneau de rareté | Élites et paliers de spawner |
| `radius` | float | Entité | Taille de base | `0,021..0,055` |
| `flash` | float | Dégâts | Overlay blanc | `1 -> 0` à `5 unités/s` |
| `reducedMotion` | bool | Réglage | Bob, pulse, particules | Supprime le mouvement décoratif |

## États et poses procédurales

| État | Durée actuelle | Pose / transformation | Entrée | Sortie | Interruptions | Priorité | Fallback |
|---|---:|---|---|---|---|---:|---|
| `spawn` soldat/ennemi | 0,24 s | Scale croissante vers 1 | Création d'entité | Timer `<= 0` vers `move` | Mort | 30 | Fondu/scale simple |
| `spawn` héros | 0,30 s | Scale croissante vers 1 | Début ou respawn | Timer `<= 0` vers `move` | Mort | 30 | Cercle blanc stable |
| `spawn` boss | 0,80 s | Scale depuis 0,20 | Pression 58 en capitale | Timer `<= 0` vers `move` | Mort | 30 | Anneau or stable |
| `move` | Indéfinie | Bob vertical `sin(time × 10 + id) × 1,5 px` | Fin de spawn/recover | Portée + cooldown vers `windup` | Mort | 10 | Sprite interpolé sans bob |
| `windup` standard | 0,16 s | Scale `0,92` | Cible en portée, cooldown prêt | `attack` | Mort | 40 | Réduction de silhouette |
| `windup` siège | 0,38 s | Scale `0,92` | Identique | `attack` | Mort | 40 | Réduction de silhouette |
| `windup` boss | 0,46 s | Scale `0,92` | Identique | `attack` | Mort | 40 | Réduction et anneau or |
| `attack` | 0,04 s | Scale `1,13`; effet gameplay à l'entrée | Fin du windup | `recover` | Mort | 50 | Impulsion d'échelle |
| `recover` | `cooldown × 0,28` | Scale neutre, position fixe | Fin d'attack | `move` | Mort | 20 | Pose source |
| `dead` | 0,42 s | Alpha sprite `0,35`, barre à zéro | PV `<= 0` | Suppression | Aucune | 100 | Silhouette translucide |

Formules de rendu actuelles :

```text
spawnScale = max(0,20 ; 1 - stateTimer × 1,90)
attackScale = 1,13 si attack ; 0,92 si windup ; 1 sinon
taille = baseSize × spawnScale × attackScale
baseSize = clamp(widthCanvas × radius × facteur, 27, 50)
```

Le facteur de taille vaut `1,8` pour une unité normale et `2,25` pour un boss avant clamp. Le dessin est trié par `y` croissant pour simuler la profondeur.

## Transitions déterministes

| Source | Condition | Destination | Événement gameplay synchronisé |
|---|---|---|---|
| Création | Entité ajoutée | `spawn` | Événement visuel `spawn` |
| `spawn` | `stateTimer <= 0` | `move` | Aucun |
| `move` | Cible en portée et `attackTimer <= 0` | `windup` | Cooldown armé immédiatement |
| `windup` | `stateTimer <= 0` | `attack` | Dégâts ou soin résolu exactement ici |
| `attack` | 0,04 s écoulée | `recover` | Aucun nouvel impact |
| `recover` | `stateTimer <= 0` | `move` | Mouvement de nouveau autorisé |
| Tout état vivant | `hp <= 0` | `dead` | `kill`, prime et pression une seule fois |
| `dead` | 0,42 s écoulée | supprimé | Nettoyage de l'entité |

Il n'y a aucun crossfade de clip ; l'interpolation spatiale et les changements d'échelle évitent la coupure principale. Une future spritesheet doit préserver ces instants d'événements, même si les clips changent.

## Événements d'animation et anti-double

| Événement | Instant | Effet gameplay | Effet rendu/audio | Règle anti-double |
|---|---|---|---|---|
| `spawn` | Ajout de l'entité | Aucun dégât | Scale d'entrée ; événement disponible | Une émission par création |
| `attack-contact` | `windup -> attack` | Dégât, soin ou splash | Impulsion 1,13, `hit` si applicable | Résolution unique dans la transition |
| `hit` | Dégât appliqué | Baisse des PV, `flash = 1` | Flash blanc 0,20 s, particules, impact audio limité | Cible morte rejetée avant application |
| `kill` | PV franchissent zéro | État `dead`, prime/pression | Alpha 0,35 pendant 0,42 s | Garde `state === dead` |
| `coin` | Mort ennemie validée | Ajout de pièces | Texte `+valeur` et son limité | Hérite de la garde de mort |
| `hero-down` | Mort du héros | Respawn armé à 6 s | Toast dédié | Uniquement lors du passage à `dead` |
| `capture` | Seuil 25/50/75 ou Onde | Spawn forcé / zone de dégâts | Libellé central | `pressureWave` interdit le doublon |
| `sector` | Capture franchit 100 | Progression et nettoyage | Texte de victoire 2,4 s | Test `previous < 100` |

## Orientation, profondeur et silhouettes

- Les alliés utilisent l'orientation source ; tous les ennemis sont retournés horizontalement.
- L'orientation ne suit pas la cible latérale. Le contrat actuel privilégie la lecture d'équipe à la précision directionnelle.
- L'ombre au sol suit la position rendue et ne reçoit pas l'alpha de mort du sprite.
- Les barres de PV restent au-dessus de la silhouette, avec couleur jaune sous 28 %.
- Héros, élites et boss possèdent un anneau pulsé ; le pulse est supprimé en mouvement réduit.
- Le bob n'existe que dans `move`; aucun glissement décoratif ne doit apparaître en windup, attack ou recover.

## Frappe du héros

La frappe active est actuellement résolue immédiatement hors machine d'états : le héros se déplace de 8 % vers la cible et inflige `1,9 × dégâtsHéros`. Il n'existe donc pas de clip windup dédié à cette action. Le contrat de synchronisation est :

```text
input accepté -> lunge 8 % + dégâts + hit au même tick -> cooldown 0,48 s
```

Le feedback d'impact compense l'absence de clip, mais ne doit jamais être déclenché si `heroStrike()` retourne `false`.

## Pause, reprise et mouvement réduit

- La pause fige tous les timers et positions de simulation.
- Le rendu continue actuellement à faire avancer son temps local ; le bob et les anneaux peuvent donc continuer visuellement pendant une pause. C'est un écart connu à contrôler si une pause visuellement figée devient obligatoire.
- Une reprise conserve état, timer, cible et interpolation valides.
- `reducedMotion` supprime bob et pulse, réduit les particules d'impact de cinq à deux et garde flash, couleurs, barres de PV et textes.
- La désactivation des particules ou nombres flottants ne supprime aucun événement gameplay.

## Contrôles professionnels

- [ ] Les six cellules SVG existent et correspondent à l'ordre des rôles.
- [ ] Chaque état est visible ou possède un fallback lisible.
- [ ] L'impact intervient au passage `windup -> attack`, jamais au début du windup.
- [ ] Un seek, une frame longue ou un rattrapage ne produit pas deux impacts.
- [ ] Les unités ne glissent pas en état windup, attack ou recover.
- [ ] La position interpolée ne dépasse pas les limites normalisées.
- [ ] Les morts interrompent tout état et disparaissent après 0,42 s.
- [ ] Le héros réapparaît en `spawn`, pas directement en `move`.
- [ ] L'ennemi reste identifiable lorsque le sprite est retourné.
- [ ] Le boss reste lisible parmi 28 ennemis et les particules.
- [ ] Pause/reprise ne corrompt ni timer ni cible.
- [ ] Mouvement réduit conserve anticipation, impact, mort et capture compréhensibles.
- [ ] Le fallback sans SVG permet de terminer une colline.

