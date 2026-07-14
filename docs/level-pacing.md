# Contrat des niveaux et du pacing

## Portée

Ce document décrit les 45 collines réellement exposées par la campagne : neuf âges de cinq secteurs. La simulation conserve la même arène Canvas normalisée et fait varier le thème, les statistiques, la cadence ennemie, la fréquence des élites et le boss. Le pacing doit produire des sessions de 3 à 8 minutes et une première campagne d'environ 9 à 13 heures, achats et retours à la base compris.

## Contrat global d'une colline

- **Départ :** portail allié au sud, héros à `(0,50 ; 0,72)`, soldats à `y = 0,89..0,92`.
- **Fin :** capture à 100 % après avoir atteint 100 points de pression.
- **Verbes :** générer, avancer, cibler, frapper, soigner, détruire, tenir, améliorer.
- **Durée active cible :** 3 à 8 minutes ; une capitale peut atteindre 10 minutes.
- **Compétence testée :** adapter la composition et l'investissement au multiplicateur de secteur.
- **Récompense :** `25 × 7 × G(a,h)` ; capitale `80 × 7 × G(a,4)`.
- **Checkpoint :** chaque conquête incrémente `totalSectors`, remet pression et capture à zéro, sauvegarde et ouvre le secteur suivant.
- **Échec doux :** la mort du héros entraîne six secondes d'absence, sans interrompre la production ni effacer les gains.

## Métriques spatiales de l'arène

Toutes les coordonnées sont normalisées, indépendantes de la résolution du Canvas.

| Élément | Valeur implémentée | Fonction de lisibilité |
|---|---:|---|
| Limites horizontales des unités | `x = 0,18..0,82` | Conserve les combattants dans le chemin visible |
| Limites verticales | `y = 0,045..0,945` | Réserve les extrémités aux portails |
| Voies | `x = 0,29 / 0,50 / 0,71` | Sépare les groupes sans navigation complexe |
| Portail ennemi | `y ≈ 0,055` | Origine visuelle des menaces |
| Spawn ennemi normal | `y = 0,06..0,10` | Anticipation avant le contact |
| Spawn boss | `(0,50 ; 0,10)` | Entrée centrale immédiatement identifiable |
| Portail allié | `y ≈ 0,93` | Ancre la zone de production |
| Destination alliée sans cible | `y = 0,32` | Maintient la pression vers le nord |
| Destination ennemie sans cible | `y = 0,68` | Maintient la pression vers le sud |
| Zone de capture logique | `y = 0,39..0,61` | Bande assez profonde pour plusieurs lignes |
| Ellipse de capture rendue | centre `(0,50 ; 0,50)` | Landmark central permanent |

Le déplacement est direct vers la cible ; il n'existe ni mur ni impasse dans l'arène actuelle. Le chemin peint et les trois voies doivent toujours rester lisibles derrière les silhouettes.

## Graphe de progression d'une colline

```text
Entrée et spawn
  -> Briser la ligne : pression 0..58
  -> [Capitale : apparition unique du boss à 58]
  -> Atteindre 100 de pression
  -> Capture 0..25
  -> Contre-vague 25
  -> Capture 25..50
  -> Contre-vague 50
  -> Capture 50..75
  -> Contre-vague 75 + cadence maximale
  -> Capture 75..100
  -> Récompense, nettoyage, checkpoint, secteur suivant
```

## Beats d'une rencontre

| Beat | Durée cible | Intensité | Décision | Menace | Landmark / feedback | Sortie visible |
|---|---:|---:|---|---|---|---|
| Déploiement | 5–15 s | 1/5 | Observer les spawners actifs | Premier ennemi après le délai initial | Portails et cercle de capture | Première cible acquise |
| Rupture de ligne | 60–180 s | 2/5 | Investir, activer la frappe, choisir les rôles | Flux ennemi régulier | Jauge `pression / 100` | Capture ou boss annoncé |
| Boss de capitale | 30–120 s | 4/5 | Concentrer les dégâts et maintenir les soutiens | Boss `18× PV`, attaques plus lentes mais lourdes | Bannière et anneau or | Boss mort ou ligne repoussée |
| Prise initiale | 20–60 s | 3/5 | Amener du poids dans la zone | Capture réversible | Ellipse turquoise et jauge | Seuil 25 % |
| Contre-vagues | 45–150 s | 4/5 | Tenir plutôt que poursuivre | Spawn forcé à 25/50/75 % | Libellé central du seuil | Retour à un avantage de poids |
| Dernière poussée | 20–75 s | 5/5 | Dépenser la frappe et l'Onde chronale | Double spawn possible au-delà de 70 % | Capture proche de 100 % | Célébration de conquête |
| Récupération | 2–5 s | 1/5 | Lire la prime et ouvrir un panneau | Aucune perte persistante | `Colline conquise` ou `Âge conquis` | Prochaine colline affichée |

Les durées sont des bandes de recette, pas des minuteurs forcés. La progression dépend de la puissance de l'armée et de la capacité à conserver du poids sur la colline.

## Les cinq secteurs répétés par âge

| Index `h` | Nom affiché | Variation actuellement appliquée | Fonction de pacing |
|---:|---|---|---|
| 0 | Lisière | Base de l'âge | Présenter le nouveau thème et son échelle de puissance |
| 1 | Carrière | `PV × 1,16`, cadence ennemie `× 1,06` | Vérifier que le joueur réinvestit ses premières primes |
| 2 | Atelier | `PV × 1,16²`, cadence `× 1,12` | Premier mur de composition de l'âge |
| 3 | Rempart | `PV × 1,16³`, cadence `× 1,18` | Pic d'élites et préparation de la capitale |
| 4 | Capitale | `PV × 1,16⁴`, cadence `× 1,24`, boss à 58 pression | Climax et changement d'âge |

La probabilité d'élite vaut `6 % + 1,4 % × h`, soit 6 %, 7,4 %, 8,8 %, 10,2 % et 11,6 %. Les différences de secteur reposent aujourd'hui sur ces courbes et sur le boss ; aucun obstacle spécifique ne doit être supposé par la recette.

## Courbe de spawn ennemie

```text
facteurSecteur = 1 + 0,06 × h
facteurCapture = 1 + capture / 260
délaiEnnemi = max(0,72 ; 2,25 / facteurSecteur / facteurCapture)
```

- Une unité apparaît à chaque échéance.
- Au-delà de 70 % de capture, une seconde unité apparaît avec 42 % de probabilité, sous le cap ennemi.
- Franchir 25 %, 50 % ou 75 % remet immédiatement le timer ennemi à zéro.
- Le cap est de 28 ennemis vivants ; la simulation entière reste sous 58 entités.

## Carte des 45 collines

| Collines | Âge | Landmark de thème | Boss de capitale | Temps d'âge cible |
|---:|---|---|---|---:|
| 1–5 | Âge des Braises | Cercle des Mégalithes | Mâchoire-de-Roc | 20–30 min |
| 6–10 | Royaumes du Bronze | Porte du Soleil | Roi-Taureau | 30–40 min |
| 11–15 | Légions de Fer | Arc des Conquérants | Imperator Ferratus | 40–55 min |
| 16–20 | Couronnes médiévales | Bastion des Sept Bannières | Reine du Bastion | 50–70 min |
| 21–25 | Ère des Poudres | Fort de la Mèche Rouge | Amiral Cendre | 60–80 min |
| 26–30 | Révolution de Vapeur | Grand Rouage Atmosphérique | Colosse-Usine | 70–95 min |
| 31–35 | Monde Moderne | Complexe Horizon | Commandant Zéro | 85–115 min |
| 36–40 | Ère Néon | Flèche de Verre Quantique | Matriarche Néon | 100–140 min |
| 41–45 | Hyperfutur quantique | Citadelle de l'Après | Souverain de l'Après | 120–170 min |

## Difficulté et économie spatiale

```text
P(a,h) = 3,10^a × 1,16^h
G(a,h) = 2,45^a × 1,13^h
PVEnnemiStandard = 52 × P(a,h)
DégâtsEnnemis = 5,2 × P(a,h)^0,88 × multiplicateurRôle
PrimeStandard = round(7 × G(a,h))
```

La puissance avance plus vite que la monnaie. Le joueur doit donc acheter des niveaux, de l'équipement et des bonus de prestige plutôt que simplement accumuler des pièces. Le boss utilise `18× PV`, `2,2× dégâts de rôle` et `60× prime`.

## Checkpoints et reprise

- La progression persistante se produit à la conquête, lors des achats et à l'autosauvegarde de 12 secondes.
- Une conquête supprime les combattants non héros, replace le héros à `(0,50 ; 0,72)` et remet pression/capture à zéro.
- Le héros récupère ses PV au passage, puis prend le thème du nouvel âge.
- Une capitale est le cinquième secteur de chaque âge ; le secteur suivant revient à `h = 0` et incrémente l'âge.
- La Reboucle devient disponible après 15 collines, soit la fin de l'Âge du Fer.

## Instrumentation de recette professionnelle

Pour chaque colline représentative, enregistrer :

- temps jusqu'à 58 et 100 de pression ;
- temps passé dans chaque quart de capture ;
- capture gagnée puis reperdue ;
- nombre maximal d'alliés, d'ennemis et d'entités ;
- DPS moyen du héros et de l'armée ;
- nombre de frappes manuelles, morts du héros et doubles spawns ;
- revenu par seconde, dépenses effectuées et puissance à l'entrée ;
- durée totale, abandon et nouvelle tentative.

Échantillon minimal : collines 1, 5, 6, 15, 20, 30, 40 et 45 ; ajouter toute colline dépassant 1,5× sa bande cible.

## Contrôles de niveau

- [ ] Les trois voies et la zone de capture sont distinguables sur 320 × 568.
- [ ] Aucun décor ne masque les unités, les portails ou la jauge de capture.
- [ ] Une unité sans cible avance et ne reste pas bloquée.
- [ ] Le boss n'apparaît qu'une fois dans chaque capitale, après 58 de pression.
- [ ] Les contre-vagues se déclenchent une seule fois à 25/50/75 %.
- [ ] La capture peut progresser, se figer et régresser selon le poids présent.
- [ ] Le cap ennemi n'est jamais dépassé pendant la dernière poussée.
- [ ] La conquête mène toujours au bon index parmi les 45 collines.
- [ ] La colline 45 ne produit ni index d'âge invalide ni écran vide.
- [ ] Une reprise de sauvegarde conserve âge, secteur, pièces et améliorations cohérents.

