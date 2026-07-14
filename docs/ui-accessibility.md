# UI mobile et accessibilité

## Contrat d'interface

- Cible : mobile web/PWA tactile, portrait prioritaire, paysage pleinement jouable.
- Le Canvas affiche uniquement la guerre. HUD, menus, modales et commandes sont des éléments HTML sémantiques superposés.
- La simulation continue hors de l'écran Guerre. Quand le Canvas n'est pas rendu, afficher `Combat en cours` avec le revenu courant et un bouton de retour.
- La progression principale ne doit jamais dépendre uniquement d'un geste, d'une couleur, d'un son ou d'une vibration.

## Navigation

Barre basse fixe avec icône et libellé :

1. **Guerre** : champ de bataille, héros, capture et objectif.
2. **Caserne** : spawners, composition et améliorations des soldats.
3. **Forge** : équipement du héros et de l'armée.
4. **Âges** : chronologie, secteurs, boss et déblocages.
5. **QG** : recherches, missions, codex, statistiques et réglages.

- Portrait : Caserne et Forge s'ouvrent d'abord en bottom sheets compacts de `38dvh` afin de laisser la colline visible. Un bouton permet de les agrandir à `72dvh` pour la lecture détaillée.
- Paysage : le Canvas occupe environ 68 % de la largeur et le panneau actif 32 %, avec un maximum de 360 px.
- Une rotation conserve combat, sélection, scroll et panneau ouvert.
- En mode grand texte, la barre peut devenir `Guerre / Caserne / Plus`; `Plus` donne accès aux trois autres destinations.

## Écran Guerre

HUD minimal : argent, revenu par seconde, âge, secteur, vague, vie du héros, jauge de capture, objectif et pause.

Commandes tactiles :

- joystick fixe de 80 à 92 px selon la largeur, avec glissement analogique et équivalent clavier ;
- attaque principale 72 px ;
- Onde chronale 56 px ;
- pilote automatique explicite et désactivable ;
- mode gaucher inversant les commandes ;
- mode héros assisté pour rejoindre l'objectif et attaquer automatiquement.

Appliquer `touch-action: none` uniquement au Canvas et aux commandes. Toute action gestuelle doit aussi avoir un bouton.

## Caserne et achats

Chaque carte de spawner indique : visuel, nom, âge, rôle, niveau, intervalle de génération, statistiques essentielles, coût et condition de déblocage.

- Bouton `+` de 48 x 48 px pour acheter rapidement.
- Toucher la carte ouvre les détails et la comparaison.
- Multiplicateurs `x1`, `x10`, `Max`.
- Solde toujours visible dans le panneau.
- Achat ordinaire instantané, sans confirmation.
- Fonds insuffisants : afficher le montant manquant.
- Contenu verrouillé : afficher la condition exacte, jamais un cadenas seul.
- Filtres : Tous, Mêlée, Distance, Tank, Soutien ; tri par coût, niveau ou âge.
- Afficher les prochaines apparitions et leur minuterie.

Un tap ne peut facturer qu'une fois, le solde ne devient jamais négatif et le nouvel état doit apparaître en moins de 150 ms.

## Forge

- Onglets : Héros / Armée.
- Catégories : arme, armure, casque, accessoire.
- Comparaison côte à côte : objet équipé, nouvel objet, statistiques avant/après, différence chiffrée, effet spécial, coût et prérequis.
- Actions explicites : `Améliorer` ou `Équiper`.
- Un gain utilise une flèche, un signe et une valeur, pas seulement du vert.
- Grouper les objets par âge et montrer les deux prochains paliers.

## Chronologie

- Verticale en portrait, horizontale en paysage.
- Chaque âge affiche : état de progression, cinq secteurs, boss, monument, ambiance et temps cible.
- Le prochain objectif reste visible.
- Les âges futurs sont nommés et silhouettés.
- Les âges terminés restent rejouables.
- Virtualiser la liste au-delà de 30 secteurs.

## Tutoriel

Parcours jouable et ignorable, cible inférieure à deux minutes :

1. acheter le premier spawner ;
2. observer sa première apparition ;
3. tuer ou assister sur un ennemi et recevoir l'argent ;
4. contribuer à la capture ;
5. améliorer une arme ;
6. consulter le prochain âge.

Chaque étape contient une phrase, un surlignage et une action réelle. Le tutoriel est rejouable depuis QG. Un conseil rejeté ne réapparaît pas.

## Feedback

Utiliser au moins deux canaux pour tout événement important : visuel, texte, son ou vibration.

- Achat : compteur, état de carte, toast et vibration optionnelle.
- Récompenses de combat : regrouper les gains sur 250 ms pour éviter le spam.
- Colline contestée : jauge, pictogramme et son.
- Nouvel âge : célébration courte, skippable et compatible avec mouvement réduit.
- Toast ordinaire : 3 à 5 secondes. Une erreur persiste jusqu'à correction ou fermeture.

## Dimensions et zones sûres

- Viewport minimal : 320 x 568 CSS px.
- Utiliser `100dvh` et `viewport-fit=cover`.
- Calculer les marges avec `env(safe-area-inset-top)`, `right`, `bottom` et `left`.
- Garder tout contrôle à au moins 12 px d'un bord sûr.
- Cible tactile recommandée : 48 x 48 px ; minimum absolu : 44 x 44 px ; espacement minimal : 8 px.
- Texte courant : 16 px ; secondaire : 14 px ; navigation : 12 px ; titres : 22 à 28 px.
- Barre basse : 64 px en portrait, 52 px en paysage, hors safe area.
- Aucun scroll horizontal.
- La poignée d'une sheet dispose d'une zone interactive de 48 px.

## Accessibilité

Objectif : WCAG 2.2 AA pour le shell HTML, avec alternative textuelle utile au Canvas.

- Contraste du texte normal >= 4,5:1 ; grand texte et composants >= 3:1.
- Placer le HUD sur un fond garantissant son contraste sur tous les décors.
- Utiliser de vrais boutons nommés ; ajouter `aria-current` à l'onglet actif.
- Une modale a un titre, rend l'arrière-plan `inert`, contient le focus et le restitue à sa fermeture.
- Fournir un résumé de bataille dans une région `aria-live="polite"`, actualisée au maximum toutes les deux secondes.
- Respecter `prefers-reduced-motion`.
- Fournir sous-titres, contraste renforcé et palettes protanopie, deutéranopie et tritanopie.
- Autoriser le zoom du navigateur ; conserver toutes les fonctions jusqu'à 200 %.
- Ne produire aucun clignotement supérieur à trois fois par seconde.
- Le parcours Caserne -> achat -> Forge -> Âges doit être utilisable avec VoiceOver et TalkBack.

## Réglages persistants

- Audio : général, musique, effets, interface.
- Confort : shake, flashes, particules, vibrations, sous-titres.
- Affichage : taille texte/UI, contraste, palette, dégâts flottants.
- Contrôles : gaucher, joystick fixe, ciblage par tap et pilote automatique.
- Performance : automatique, 30 ou 60 FPS ; qualité ; économie de batterie.
- Système : langue, tutoriel, export/import de sauvegarde.

Sauvegarder les réglages séparément de la progression. Une remise à zéro exige une modale expliquant les pertes, une case `Je comprends`, puis une confirmation distincte.

## Checklist de recette

- [ ] 320x568, 360x800, 390x844 et 430x932 : aucun débordement ni texte essentiel coupé.
- [ ] 667x375 et 844x390 : bataille et panneau actif restent utilisables.
- [ ] Aucun contrôle ne chevauche encoche, barre système ou home indicator.
- [ ] Une rotation conserve état de combat, sélection, scroll et panneau.
- [ ] Toutes les cibles tactiles mesurent au moins 44 x 44 px.
- [ ] Aucun scroll horizontal sur les viewports supportés.
- [ ] Le tutoriel complet est réalisable exclusivement au tactile.
- [ ] Un achat exact, des fonds insuffisants et un contenu verrouillé produisent les bons états.
- [ ] Aucun double tap involontaire ne produit une double facturation.
- [ ] Les contrastes annoncés passent sur les décors clairs et sombres.
- [ ] Le parcours principal fonctionne avec VoiceOver et TalkBack.
- [ ] À 200 % de zoom, aucune fonction essentielle ni information n'est perdue.
- [ ] Mouvement réduit, vibrations désactivées et mode gaucher sont effectivement appliqués.
- [ ] Aucune action essentielle ne repose uniquement sur swipe, couleur, son, vibration ou appui long.
- [ ] Les modales ferment correctement et restituent le focus.
- [ ] La simulation continue hors de Guerre et son état est annoncé clairement.
- [ ] Le parcours complet se termine sans erreur console.
