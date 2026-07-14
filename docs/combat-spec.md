# Contrat IA et combat

## Combat global

- **Simulation :** pas fixe de `1/30 s`, six rattrapages maximum par frame ; le rendu interpole entre position précédente et courante.
- **Verbes joueur :** construire, améliorer, déplacer librement le héros au joystick, déclencher une frappe ciblée, activer l'Onde chronale, choisir le pilote automatique, donner un ordre collectif à chaque classe et mettre en pause.
- **Portées :** coordonnées normalisées ; mêlée autour de `0,052..0,060`, distance `0,15..0,24`, héros `0,09` pour son entité mais frappe active globale sur la cible choisie.
- **TTK de référence :** produit par `PV / DPS effectif`; il doit rester proche de 2–5 s pour un standard équivalent et 30–120 s pour le boss selon l'investissement.
- **Population :** 22 points alliés hors héros, 28 ennemis vivants et 58 entités totales.
- **Attaquants simultanés :** non limité directement ; la séparation en trois voies, les portées et les cooldowns constituent la régulation actuelle.
- **Perception :** globale sur toutes les cibles vivantes ; aucune ligne de vue ni obstacle logique.
- **Recalcul des cibles :** toutes les `0,16 s`.
- **Invulnérabilité / stun :** aucun dans l'implémentation actuelle.
- **Mort :** état `dead` pendant `0,42 s`, puis retrait ; le héros revient après six secondes.

Sans pilote automatique, le héros reste exactement à la position choisie et ne poursuit plus les ennemis tout seul. Un mouvement au joystick interrompt immédiatement sa poursuite automatique. Les soldats restent autonomes mais leur sélection de cible et leur point d'attente dépendent de l'ordre de leur spawner.

## Machine d'états commune

```text
spawn -> move -> windup -> attack -> recover -> move
   \        \         \        \          \
    +---------------------------------------> dead
```

| État | Durée / condition | Mouvement | Ciblage | Sortie |
|---|---|---|---|---|
| `spawn` | Soldat/ennemi `0,24 s`, héros `0,30 s`, boss `0,80 s` | Non | La cible peut être acquise globalement | `move` à expiration |
| `move` | Jusqu'à portée et cooldown prêt | Direct vers cible ou destination de voie | Recalcul global toutes les `0,16 s` | `windup` ou `dead` |
| `windup` | Standard `0,16 s`, siège `0,38 s`, boss `0,46 s` | Non | Cible mémorisée par `targetId` | `attack`; effet résolu si cible encore vivante |
| `attack` | `0,04 s` | Non | Aucun nouveau choix | `recover` |
| `recover` | `cooldown × 0,28` | Non | Le recalcul global peut préparer la suite | `move` |
| `dead` | `0,42 s` | Non | Exclu de toutes les listes vivantes | Retrait de l'entité |

Le timer complet d'une attaque est protégé par `attackTimer = cooldown`, décrémenté en parallèle de l'état. L'unité ne peut recommencer un windup que lorsque ce timer atteint zéro.

## Rôles alliés et ennemis

| Rôle | PV | DPS | Vitesse | Portée | Cooldown | Spawn | Pop. | Ciblage / fonction |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Assaut | 1,00× | 1,00× | 1,00× | 0,055 | 0,88 s | 4,8 s | 1 | Ennemi le plus proche |
| Tireur | 0,65× | 1,28× | 0,92× | 0,190 | 1,25 s allié | 6 s | 1 | Distance pondérée par les PV manquants |
| Gardien | 2,60× | 0,62× | 0,72× | 0,052 | 0,88 s | 9 s | 2 | Ligne proche et poids de capture 1,5 |
| Éclaireur | 0,76× | 1,36× | 1,42× | 0,060 | 0,88 s | 6,8 s | 1 | Tireur/soutien de l'arrière-garde |
| Soutien | 0,90× | 0,42× | 0,90× | 0,150 | 0,88 s | 10,5 s | 2 | Unité de son équipe au plus faible ratio de PV lors de la résolution |
| Siège | 1,45× | 2,40× | 0,58× | 0,240 | 2,15 s | 14 s | 3 | Groupe proche ; 42 % de splash dans 0,095 |

Les noms et apparences évoluent selon les neuf âges. Les six contrats comportementaux restent constants, mais leurs pondérations forment un deck différent par âge.

## Sélection de cible

Soit `d` la distance euclidienne entre deux entités :

```text
nearest  = d - 0,05 si la cible est le héros ennemi
weakest  = 0,55d + 0,18 × (PV / PVmax)
backline = d - 0,34 si la cible est tireur ou soutien
cluster  = d - 0,08 si la cible est un boss
```

La plus petite valeur gagne. Si aucune cible n'existe, les alliés avancent vers leur voie à `y = 0,32` et les ennemis vers `y = 0,68`. Il n'existe pas de recherche de chemin ni d'évitement ; les corps peuvent se superposer sans collision bloquante.

## Population ennemie

| Âge | Assaut | Tireur | Éclaireur | Gardien | Soutien | Siège |
|---|---:|---:|---:|---:|---:|---:|
| Braises | 44 % | 28 % | 16 % | 12 % | 0 % | 0 % |
| Bronze | 30 % | 26 % | 22 % | 16 % | 6 % | 0 % |
| Fer | 25 % | 24 % | 16 % | 20 % | 15 % | 0 % |
| Couronnes | 22 % | 25 % | 18 % | 20 % | 15 % | 0 % |
| Poudres | 18 % | 24 % | 17 % | 14 % | 12 % | 15 % |
| Vapeur | 15 % | 22 % | 20 % | 13 % | 14 % | 16 % |
| Moderne | 18 % | 20 % | 18 % | 16 % | 12 % | 16 % |
| Néon | 14 % | 23 % | 22 % | 13 % | 14 % | 14 % |
| Hyperfutur | 16 % | 18 % | 18 % | 18 % | 14 % | 16 % |

Chaque entrée du deck fournit aussi le nom historique de l'unité à `UnitEntity.displayName`. Les élites et boss affichent ce nom dans le rendu. Le rôle Siège entre dans les decks à partir de l'Ère des Poudres avec sa portée `0,24`, son cooldown `2,15 s` et son splash de 42 %.

- Chance d'élite : `0,06 + 0,014 × secteur`, soit 6 à 11,6 %.
- Boss : rôle Gardien, voie centrale, vitesse de base `0,026`, cooldown `1,75 s`.
- Ennemi normal : vitesse de base `0,052 × vitesseRôle` ; tireur cooldown `1,35 s`, siège `2,15 s`, autres `0,95 s`.
- Boss de capitale : apparition unique lorsque la pression atteint 58.

## Phases d'attaque

| Attaquant | Windup | Orientation verrouillée | Active | Résolution | Interruptible | Recovery |
|---|---:|---|---:|---|---|---:|
| Standard mêlée/distance | 0,16 s | Position verrouillée, sprite orienté par équipe | 0,04 s | `damage × cooldown` sur cible vivante | Seulement par mort | `0,28 × cooldown` |
| Siège | 0,38 s | Oui | 0,04 s | Cible + 42 % aux ennemis dans un rayon 0,095 | Seulement par mort | 0,602 s |
| Boss | 0,46 s | Oui | 0,04 s | Coup direct `damage × 1,75` via son cooldown | Seulement par mort | 0,49 s |
| Soutien allié ou ennemi | 0,16 s | Oui | 0,04 s | Soin `0,90 × damage × cooldown` à l'unité de son équipe au plus faible ratio de PV | Seulement par mort | 0,246 s |

Le dommage est appliqué au passage `windup -> attack`. Si la cible est déjà morte, l'attaque visuelle se termine sans nouvel effet et sans double récompense.

## Frappe du héros

La frappe du héros est une action directe, distincte de la machine d'états des soldats.

```text
cooldown = 0,48 s
cible = ennemi vivant le plus proche du point touché
déplacement = 8 % du vecteur héros -> cible
dégâts = dégâtsHéros × 1,90
```

- Un appui sur le bouton frappe la cible la plus proche du centre par défaut.
- Un appui sur le Canvas fournit un point de ciblage normalisé.
- La frappe échoue sans coût si le jeu est en pause, si le cooldown est actif, si le héros est mort ou si aucun ennemi n'existe.
- L'auto-attaque ne tente une frappe que si l'ennemi le plus proche est à moins de `0,18` verticalement du héros.
- Un kill du héros applique un multiplicateur de prime `1,25`.
- Une frappe manuelle incrémente les statistiques de taps et la mission du héros.

## Onde chronale

```text
cooldown = 12 s
rayon = 0,28 autour du héros
dégâts = dégâtsHéros × 3,10 sur chaque ennemi vivant dans le rayon
```

La résolution parcourt une copie des unités afin que les morts et récompenses multiples restent déterministes pendant l'effet de zone.

## Moteur des neuf souverains

Chaque boss arme une mécanique cyclique à son apparition. Le timer s'arrête avec la pause et l'effet est annulé si le boss meurt pendant son télégraphe. Un événement `mechanic` de stage `warning` place le marqueur et son libellé, puis un événement de stage `impact` confirme la résolution. Sous 45 % de PV, l'intervalle suivant est multiplié par `0,82` ; la durée du télégraphe ne raccourcit jamais.

| Âge / mécanique | Intervalle | Télégraphe | Résolution testable |
|---|---:|---:|---|
| Braises · Chute de rocher | 7,2 s | 1,25 s sur une position alliée | 8 % des PV max dans un rayon `0,14` ; sortir de la zone évite l'impact |
| Bronze · Ruée du Taureau | 7,8 s | 1,15 s sur une cible | Dash maximal `0,16`, puis 12 % des PV max si la cible reste à moins de `0,30` |
| Fer · Bannière impériale | 8,4 s | 1,30 s autour du boss | Soigne les renforts de 15 % et réduit leur timer d'attaque à 45 % |
| Couronnes · Huile brûlante | 7,6 s | 1,35 s sur une voie | Dans la zone de capture : 8 % des PV max et recul de `0,07` vers la base |
| Poudres · Bordée | 8,1 s | 1,40 s sur une voie | 10 % des PV max à tous les alliés restés dans la voie |
| Vapeur · Surchauffe | 8,8 s | 1,20 s sur le Colosse | Les évents retirent 6 % des PV max du boss, sans pouvoir l'achever |
| Moderne · Frappe orbitale | 7,4 s | 1,45 s sur le héros | 15 % des PV max à la cible suivie par la balise |
| Néon · Piratage | 9,0 s | 1,50 s sur les spawners | Ajoute `2,4 s` au timer de chaque spawner actif |
| Hyperfutur · Rembobinage | 8,2 s | 1,35 s autour du héros | Soigne 8 % du boss et recule les alliés de `0,10` vers leur base |

Le snapshot expose `bossMechanicId`, `bossMechanicPhase`, `bossMechanicTimer` et `bossMechanicWarning` pour le HUD, les tests et l'accessibilité, sans ajouter d'état à la sauvegarde.

## Dégâts, soins et récompenses

```text
P(a,h) = 3,10^a × 1,16^h
PVEnnemi = 52 × P(a,h) × multiplicateurType
DPSEnnemi = 5,2 × P(a,h)^0,88 × multiplicateurDPSRôle × multiplicateurType
dégâtsParCoup = DPSStocké × cooldownAttaque
```

- Les alliés gagnent leur puissance avec l'âge, le niveau de spawner, l'arme collective et le prestige.
- Le soutien possède aussi une aura continue de rayon `0,12`, soignant `damage × 0,11 × dt`.
- Tout impact émet `hit`; toute mort émet `kill`; une mort ennemie émet aussi `coin`; les capacités de boss émettent `mechanic` avant et après résolution.
- La garde `target.state === dead` empêche les dégâts et récompenses doubles.
- Pression gagnée : normal `+5`, élite `+20`, boss `+35`, plafonnée à 100.

## Capture comme système de combat

La capture ne démarre qu'à 100 de pression. Sont comptées les unités vivantes entre `y = 0,39` et `y = 0,61`.

```text
poidsHéros = 2
poidsBoss = 3
poidsGardien = 1,5
poidsAutre = 1
deltaCapture = 4 × clamp(poidsAllié - poidsEnnemi, -3, 3) × dt
capture = clamp(capture + deltaCapture, 0, 100)
```

Le boss est instancié comme Gardien mais son test `isBoss` est prioritaire : il contribue avec un poids de 3. La capture peut régresser. Les seuils 25/50/75 remettent le timer de spawn à zéro et ne se redéclenchent pas pendant la même colline.

Une capitale ne peut jamais appeler `completeSector()` tant que son boss est vivant. Si la capture atteint 100 % pendant le combat, elle reste acquise et le secteur se valide au tick suivant la mort du souverain.

## Frontière paradoxale

Après les 45 collines, l'âge reste à l'Hyperfutur et les cinq secteurs continuent de cycler. Aucun champ supplémentaire n'est sauvegardé : la profondeur dérive de `totalSectors`.

```text
tierFrontière = floor(max(0, totalSectors - 45) / 5)
puissanceEnnemie = 1,60^tierFrontière
primesEtCoffres = 1,45^tierFrontière
```

Le palier 0 couvre les cinq premières collines paradoxales, puis chaque groupe de cinq augmente simultanément PV/DPS ennemis, primes de kill, coffres de secteur et plancher de revenu hors ligne. Le même multiplicateur `1,45^tier` indexe les coûts de spawner, de forge et les récompenses de mission afin de préserver les arbitrages. Chaque tier ajoute 3 rangs de bannière, 4 rangs d'équipement héros et 5 rangs aux autres pièces, avec un plafond absolu de 108.

## Contraintes de lisibilité et de justice

- Le windup doit rester visible sans dépendre du son.
- Les silhouettes alliées sont turquoise, ennemies carmin ; héros, élite et boss ont un anneau distinct.
- Aucun spawn ne cause directement des dégâts.
- Le boss possède 0,8 s d'apparition avant de pouvoir bouger.
- Les dégâts n'ont ni critique caché ni esquive aléatoire.
- La visée active du héros choisit toujours la cible la plus proche du point touché.
- Les options `reducedMotion`, particules et nombres flottants ne changent jamais la simulation.

## Scénarios obligatoires

- [ ] Aucun ennemi : unités vers leur destination de voie, frappe refusée proprement.
- [ ] Cible tuée pendant le windup : aucune récompense ou frappe doublée.
- [ ] Cible hors portée : poursuite jusqu'à portée, puis windup unique.
- [ ] Population alliée saturée : timer conservé, aucun dépassement des 22 points.
- [ ] 28 ennemis actifs : aucun nouveau spawn ni boss hors cap.
- [ ] 58 entités : aucun ajout supplémentaire.
- [ ] Tireur, gardien, éclaireur, soutien et siège combinés : ciblage conforme.
- [ ] Soutien sans allié blessé : attaque consommée sans soin invalide.
- [ ] Siège au milieu de plusieurs ennemis : une cible principale, splash unique à 42 %.
- [ ] Mort du héros : événement unique et réapparition après six secondes.
- [ ] Boss à pression 58 : une seule apparition, jamais dans les secteurs 0 à 3.
- [ ] Chaque souverain : warning unique, impact du bon `mechanicId`, effet annulé si le boss meurt pendant le télégraphe.
- [ ] Capitale à 100 % : aucun passage d'âge avec un boss vivant ; validation immédiate après sa mort.
- [ ] Decks des neuf âges : somme de 100 %, noms cohérents et rôle Siège uniquement à partir des Poudres.
- [ ] Frontière tiers 0/1/2 : multiplicateurs respectifs `1 / 1,60 / 2,56` et primes `1 / 1,45 / 2,1025`.
- [ ] Capture contestée puis reprise : jauge stable à poids égal, réversible sinon.
- [ ] Pause et reprise : aucun timer de simulation avancé pendant la pause.
- [ ] 30 FPS et frame longue : résultat stable dans la limite de six pas rattrapés.
