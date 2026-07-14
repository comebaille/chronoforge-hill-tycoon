# Chronoforge Hill Tycoon — Spécification de gameplay

## Vision

`Chronoforge Hill Tycoon` est un tycoon d'action mobile en vue 2D verticale. La base alliée se trouve en bas du champ de bataille, la colline au centre et le portail ennemi en haut. Le joueur construit des spawners, améliore six familles de soldats, combat avec son héros et conquiert 45 secteurs répartis sur neuf âges, de la préhistoire à l'hyperfutur.

Objectifs de production :

- première victoire de campagne en environ 9 à 13 heures de jeu actif ;
- premier prestige utile après 1 h 30 à 2 h ;
- une Frontière paradoxale sans fin et des reboucles de prestige pour prolonger la progression après la campagne ;
- sessions mobiles de 3 à 8 minutes, sans énergie artificielle ni attente obligatoire ;
- contenu piloté par les données, avec six comportements alliés, des archétypes ennemis réutilisables et neuf boss spécifiques.

## Boucle principale

1. Récupérer les gains précédents et le revenu hors ligne.
2. Acheter ou améliorer jusqu'à six spawners.
3. Régler la composition de l'armée, son équipement et celui du héros.
4. Lancer un assaut et tuer des ennemis pour obtenir immédiatement des pièces.
5. Produire 100 points de pression militaire afin de rendre la colline capturable.
6. Occuper la colline tout en repoussant trois contre-vagues.
7. Recevoir le coffre de conquête, améliorer la base et passer au secteur suivant.
8. Vaincre la capitale pour faire évoluer tous les systèmes vers l'âge suivant.

Une défaite ne détruit aucun achat. Le joueur conserve 75 % des pièces gagnées pendant l'assaut, revient à sa base et peut immédiatement retenter le secteur.

## Champ de bataille et capture

Le champ de bataille tient sur un écran mobile en portrait : base et spawners en bas, trois couloirs de navigation invisibles, colline centrale et portail ennemi en haut. Les soldats se déplacent automatiquement. Le héros utilise un joystick tactile, une frappe ciblée et l'Onde chronale ; le pilote automatique reste entièrement optionnel.

Chaque famille alliée reçoit aussi un ordre collectif : **Colline** pour pousser, **Escorte** pour protéger le héros, **Chasse** pour viser l'arrière-garde ou **Défense** pour tenir près de la base. La Caserne explique directement le rôle, la cadence, la population et l'effet concret de chaque spawner.

Pression préalable à la capture :

| Action | Pression |
|---|---:|
| Ennemi normal vaincu | 5 |
| Ennemi spécialisé vaincu | 8 |
| Élite vaincu | 20 |
| Structure détruite | 25 |

La capture évolue selon :

```text
captureParSeconde = 4 × clamp(poidsAllié - poidsEnnemi, -3, 3) %
```

- soldat normal ou soutien : poids `1` ;
- tank : poids `1,5` ;
- héros : poids `2` ;
- une unité seule capture en 25 secondes ;
- une zone à poids égal est contestée et ne progresse plus ;
- une contre-vague apparaît à 25 %, 50 % et 75 %.

## Les six rôles de spawner

Le joueur commence avec le rôle Assaut et débloque progressivement les six familles jusqu'aux Couronnes médiévales. La bataille accepte 22 points de population alliée hors héros ; chaque spawner acheté peut ensuite être amélioré jusqu'au niveau 108.

| Rôle | Déblocage | Population | Spawn de base | PV | DPS | Coût | Comportement |
|---|---|---:|---:|---:|---:|---:|---|
| Assaut | Départ | 1 | 5 s | 1,00× | 1,00× | 1,00× | Ligne polyvalente, pousse la colline |
| Distance | Âge 1, secteur 2 | 1 | 6 s | 0,65× | 1,28× | 1,15× | Reste derrière les alliés, cible les plus fragiles |
| Tank | Âge 1, secteur 4 | 2 | 9 s | 2,60× | 0,62× | 1,60× | Blocage et fort poids de capture |
| Éclaireur | Âge 2, secteur 2 | 1 | 6,8 s | 0,76× | 1,36× | 1,30× | Contourne la ligne et chasse l'arrière-garde |
| Soutien | Âge 3, secteur 2 | 2 | 10,5 s | 0,90× | 0,42× | 1,80× | Soigne les alliés proches |
| Siège | Âge 4, secteur 2 | 3 | 14 s | 1,45× | 2,40× | 2,30× | Inflige des dégâts de zone depuis l'arrière |

Chaque spawner possède une piste longue jusqu'au niveau 108 :

- +8 % aux PV et dégâts par niveau ;
- délai de spawn réduit de 1,5 % par niveau jusqu'à un plancher de 82 % du délai de base ;
- évolution vers un nouveau modèle après chaque capitale ;
- les niveaux restent conservés au changement d'âge et continuent d'améliorer PV, dégâts et cadence.

## Structure des cinq secteurs d'un âge

| Position | Fonction de gameplay |
|---|---|
| 1. Frontière | Présentation du décor, des ennemis et du nouveau palier de puissance |
| 2. Ressource | Composition à distance et amélioration de l'économie |
| 3. Atelier | Danger environnemental et nouvel équipement |
| 4. Rempart | Élites, structures et forte pression sur la base |
| 5. Capitale | Boss à mécanique télégraphiée unique, coffre majeur et passage d'âge |

Chaque secteur conquis attribue une étoile cumulative. La reboucle de prestige conserve ces étoiles comme archive de profondeur.

## Contenu des neuf âges

| Âge | Soldats représentatifs | Les 5 secteurs | Ennemis caractéristiques | Boss et mécanique |
|---|---|---|---|---|
| 1. Âge des Braises | Massueur / Lance-silex / Gardien-mammouth / Chaman des braises | Camp des Cendres ; Vallée des Crocs ; Cromlech fendu ; Grotte du Tonnerre ; Sommet Mammouth | Croc-d'Os, Frondeur cendre, Chasseur raptor, Brute mammouth | **Mâchoire-de-Roc** : charges annoncées, rochers roulants et armure d'os destructible |
| 2. Royaumes du Bronze | Hoplite / Archer solaire / Porte-pavois / Augure | Dunes d'Ambre ; Oasis des Lances ; Temple solaire ; Mur cyclopéen ; Palais du Taureau | Pillard bronze, Lanceur scarabée, Char de guerre, Prêtre-serpent | **Roi-Taureau** : bouclier frontal, ruées et piliers à utiliser comme obstacles |
| 3. Légions de Fer | Légionnaire / Lance-pilum / Mur de scuta / Aquilifer | Route de Fer ; Arène des Chaînes ; Camp de l'Aigle ; Pont des Scuta ; Citadelle Ferratus | Gladiateur-chaîne, Archer noir, Porte-aigle, Éléphant cuirassé | **Imperator Ferratus** : formations défensives et bannières qui renforcent ses troupes |
| 4. Couronnes médiévales | Épéiste / Arbalétrier / Chevalier pavois / Chapelain | Hameau du Guet ; Forêt des Longs-Arcs ; Douves noires ; Haut Rempart ; Bastion royal | Vougier, Long-arc, Assassin, Alchimiste | **Reine du Bastion** : tours, huile enflammée et armure à briser avec la masse ou la capture |
| 5. Ère des Poudres | Piquier / Arquebusier / Cuirassier / Chirurgien porte-étendard | Port des Brumes ; Champs de Piques ; Arsenal rouge ; Fort des Canons ; Vaisseau-amiral | Mousquetaire noir, Grenadier, Corsaire, Canonnier | **Amiral Cendre** : barils explosifs, bordées télégraphiées et changements de côté |
| 6. Révolution de Vapeur | Garde riveté / Carabinier à bobine / Exo-chaudière / Mécanicien | Faubourg du Smog ; Gare rivetée ; Grande Fonderie ; Ligne des Automates ; Colosse-usine | Automate ouvrier, Sniper du smog, Scie mécanique, Drone à engrenages | **Colosse-Usine** : jauge de surchauffe, évents vulnérables et phase blindée |
| 7. Monde Moderne | Fantassin / Tireur tactique / Bouclier composite / Médecin | Banlieue rouge ; Centre logistique ; Zone drone ; Bunker Zéro ; Complexe central | Commando, Drone d'assaut, Mastodonte, Saboteur | **Commandant Zéro** : frappes de zone annoncées et véhicule blindé à neutraliser |
| 8. Ère Néon | Lame synthétique / Railgunner / Gardien holo / Nanomédecin | Rue Chromée ; Marché holographique ; Nœud piraté ; Tour EMP ; Matrice Néon | Chrome-runner, Hacker, Essaim drone, Sentinelle plasma | **Matriarche Néon** : piratage temporaire d'un spawner et doubles holographiques |
| 9. Hyperfutur quantique | Phasique / Lance-flux / Titan graviton / Oracle causal | Jardin phasique ; Mer photonique ; Archive causale ; Anneau du Vide ; Trône de l'Après | Clone paradoxal, Essaim photonique, Annulateur, Gardien du vide | **Souverain de l'Après** : rembobinage local, clones temporels et singularités |

Les mécaniques de boss sont implémentées comme de petites machines à états de deux ou trois phases. Elles réemploient déplacement, projectile, zone télégraphiée, invocation et statut, sans nécessiter neuf moteurs de combat différents.

## Équipement

Le héros peut posséder trois familles d'armes par âge : rapide, distance et lourde/zone. L'armée reçoit des améliorations collectives afin d'éviter la microgestion individuelle.

| Âge | Armes de héros représentatives | Progression de plastron |
|---|---|---|
| Braises | Lame de silex, lance de chasse, massue mammouth | Peau → cuir épais → plaques d'os → fourrure mammouth |
| Bronze | Xiphos, arc composite, hache labrys | Lin renforcé → écailles bronze → cuirasse → bronze solaire |
| Fer | Spatha, pilums, marteau d'arène | Mailles → segments → fer noir → armure de l'Aigle |
| Médiéval | Épée longue, arbalète, marteau de guerre | Gambison → cotte de mailles → brigandine → armure de plates |
| Poudres | Rapière, mousquet, tromblon | Manteau de buffle → plastron → cuirasse → tenue du Grand Amiral |
| Vapeur | Matraque Tesla, carabine à bobine, marteau-piston | Cuir riveté → chaudière → exosquelette → armure Tesla |
| Moderne | Pistolet-mitrailleur, fusil de précision, lance-grenades | Kevlar → plaques → exosquelette → composite tactique |
| Néon | Monolame, pistolet rail, canon plasma | Maille carbone → plaques holo → nanoarmure → Égide néon |
| Hyperfutur | Lame phasique, fusil causal, gantelet singularité | Tissu de phase → plaques gravitiques → manteau causal → coque Oméga |

Pistes collectives : arme, plastron, bottes et bannière. Le nom de l'arme et du plastron courants suit l'âge et le rang atteint dans la Forge.

## Échelle de puissance et récompenses

Les indices commencent à zéro : `a ∈ [0,8]` pour l'âge, `h ∈ [0,4]` pour le secteur et `z = 5a + h`.

```text
P(a,h) = 3,10^a × 1,16^h       // puissance de combat
G(a,h) = 2,45^a × 1,13^h       // échelle monétaire
K(a,h) = 7 × G(a,h)             // prime d'un ennemi standard
```

### Ennemis

```text
PV = 52 × P(a,h) × multiplicateurPV
DPS = 5,2 × P(a,h)^0,88 × multiplicateurDPS
Récompense = K(a,h) × multiplicateurPrime
```

| Archétype | PV | DPS | Prime |
|---|---:|---:|---:|
| Nuée | 0,55× | 0,70× | 0,55× |
| Standard | 1,00× | 1,00× | 1,00× |
| Tireur | 0,70× | 1,25× | 1,10× |
| Brute | 2,30× | 1,10× | 2,00× |
| Soutien | 0,85× | 0,55× | 1,50× |
| Élite | 3,30× | 1,45× | 5,00× |
| Boss | 18,00× | 2,20× | 60,00× |

La prime de base est toujours versée, quel que soit l'auteur du kill. Un kill finalisé par le héros ajoute une prime d'activité de 25 %, sans retirer le revenu normalement produit par les soldats.

### Soldats et héros

```text
PVSoldat =
  70 × multiplicateurPVRole × 3,10^a
  × 1,08^niveauSpawner
  × 1,11^rangPlastron
  × bonusMeta

DPSSoldat =
  8 × multiplicateurDPSRole × 3,10^a
  × 1,08^niveauSpawner
  × 1,09^rangArme
  × bonusMeta

PVHéros = 260 × 3,10^a × 1,12^niveauArmure × bonusMetaHéros
DPSHéros = 14 × 3,10^a × 1,10^niveauArme × bonusMetaHéros
```

## Formules de coûts

Avec `Ka = 7 × 2,45^a`, soit la valeur d'un kill standard au début de l'âge :

```text
nouveauSpawner =
  12 × Ka × coûtRole × 1,75^nombreDeCopiesDuRôle

améliorationSpawner =
  6 × Ka × coûtRole × 1,25^niveau

évolutionVersÂgeSuivant =
  35 × K(a+1,0) × coûtRole

équipementArmée =
  14 × Ka × 1,50^rang

équipementHéros =
  10 × Ka × 1,45^rang
```

Récompenses de progression :

- conquête d'un secteur : `25 × K(a,h)` ;
- capitale et boss : `80 × K(a,4)` ;
- nouvelle étoile : coffre de `8 × K(a,h)` ;
- premier nettoyage d'un âge : plan permanent et coffre d'évolution.

## Durée visée

| Âge | Temps cible | Cumul approximatif |
|---|---:|---:|
| Braises | 20–30 min | 20–30 min |
| Bronze | 30–40 min | 50–70 min |
| Fer | 40–55 min | 1 h 30–2 h 05 |
| Médiéval | 50–70 min | 2 h 20–3 h 15 |
| Poudres | 60–80 min | 3 h 20–4 h 35 |
| Vapeur | 70–95 min | 4 h 30–6 h 10 |
| Moderne | 85–115 min | 6–8 h |
| Néon | 100–140 min | 7 h 40–10 h 20 |
| Hyperfutur | 120–170 min | 9 h 40–13 h 10 |

Les 45 assauts, la pression minimale, les captures, les achats et les boss empêchent une fin en vingt minutes. Le contenu long repose sur de nouvelles compositions et décisions, pas sur des temps d'attente bloquants.

## Revenu hors ligne

```text
revenuHorsLigne =
  meilleurRevenuStableParSeconde
  × secondesAbsence
  × (0,10 + 0,05 × rangBanque)
```

- absence comptabilisée pendant huit heures maximum ;
- rendement plafonné à 35 % du revenu actif ;
- aucun secteur ni boss n'est vaincu automatiquement ;
- le joueur revient avec des achats à effectuer, pas avec une campagne terminée.

## Prestige : la Reboucle historique

La Reboucle est débloquée après la capitale de l'Âge du Fer.

```text
chronocristaux = floor(
  5 × âgesTerminés^1,6
  + secteursTerminés / 2
  + étoilesDeLaBoucle / 6
  + 3 × bossVaincus
)
```

Une première reboucle après trois âges rapporte environ 45 à 55 chronocristaux.

Sont réinitialisés : pièces, carte, niveaux de spawners, rangs d'équipement et missions. Sont conservés : chronocristaux, étoiles, statistiques cumulées et arbre temporel.

| Branche permanente | Bonus par rang |
|---|---:|
| Chronoforge | +4 % dégâts des soldats |
| Ligne renforcée | +5 % PV des soldats et de la base |
| Logistique | +3 % vitesse de spawn |
| Trésor de guerre | +5 % pièces |
| Héritage du héros | +4 % statistiques du héros |
| Empire dormant | +5 % efficacité hors ligne |

Chaque branche possède dix rangs. Le prix d'un rang est `8 × 1,65^rang`. Les bonus sont additifs et plafonnés afin d'accélérer les secteurs maîtrisés sans supprimer le défi des nouveaux âges.

## Endgame

Après le Souverain de l'Après :

- **Frontière paradoxale** : après la 45e colline, l'hyperfutur recombine ses cinq secteurs à l'infini ;
- **profondeur croissante** : chaque palier de cinq collines renforce la puissance ennemie et les récompenses ;
- **reboucle historique** : disponible dès l'Âge du Fer, elle remet la campagne à zéro contre des cristaux permanents ;
- **arbre temporel** : six branches permanentes renforcent dégâts, PV, logistique, revenus, héros et gains hors ligne.

## Direction visuelle, sonore et faisabilité

- Style 2D peint aux silhouettes épaisses : alliés turquoise/or, ennemis carmin/violet, héros détouré en blanc.
- La base, le ciel, les projectiles et l'interface changent à chaque âge.
- Chaque transition d'âge possède une célébration courte et skippable.
- Boucle musicale originale, impacts, gains, interface et transition d'âge mixés sur des bus séparés.
- Budget d'exécution : 22 points de population alliée, 28 ennemis et 58 entités au total.
- Cinq dispositions de secteur sont réhabillées par neuf thèmes au lieu de créer 45 moteurs différents.
- Sprites modulaires : corps, casque, arme et effet d'âge séparés.
- Object pooling pour soldats, ennemis, projectiles, nombres et particules.
- Sauvegarde locale versionnée et simulation hors ligne mathématique.
- Canvas réservé à la bataille ; HUD, menus et contrôles restent en HTML accessible.
