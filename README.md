# Chronoforge: Hill Tycoon

Tycoon de guerre mobile jouable dans le navigateur. Construisez six familles de spawners, accompagnez vos troupes avec le héros, brisez la ligne ennemie puis tenez la colline à travers neuf âges, de la préhistoire à l'hyperfutur quantique.

## Contenu jouable

- 45 collines, 9 âges et 9 capitales avec boss ;
- 6 rôles qui changent de nom et d'apparence à chaque âge, soit 54 variantes alliées ;
- plus de 40 ennemis nommés, élites et compositions qui s'enrichissent avec la progression ;
- 27 armes de héros et 36 paliers de plastron thématiques ;
- forge collective, missions, gains hors ligne, sauvegarde versionnée et arbre de prestige ;
- campagne principale calibrée pour environ 9 h 35 à 13 h 10, puis Frontière paradoxale infinie à difficulté croissante ;
- interface tactile portrait/paysage, mode gaucher, contraste renforcé, texte agrandi, réduction des mouvements et réglages audio ;
- PWA installable, jouable hors ligne après la première visite.

## Jouer

```bash
npm install
npm run dev
```

Ouvrez ensuite <http://127.0.0.1:5173/>. Le tutoriel intégré mène au premier spawner, à la frappe du héros, à la forge et à la lecture de la frise des âges.

## Jouer et installer sur mobile

Version publique : <https://comebaille.github.io/chronoforge-hill-tycoon/>.

- iPhone ou iPad : ouvrir le lien dans Safari, toucher **Partager**, puis **Sur l'écran d'accueil**.
- Android : ouvrir le lien dans Chrome, ouvrir le menu, puis choisir **Installer l'application** ou **Ajouter à l'écran d'accueil**.

L'icône Chronoforge apparaît ensuite comme une application et le jeu reste disponible hors ligne après son premier chargement complet.

## Vérifier la production

```bash
npm run check
npm run preview
```

`npm run check` exécute le typage strict, toute la suite de tests automatisés et le build Vite. Les contrats de conception et de production se trouvent dans [`docs/`](docs/), avec les manifests d'assets et d'audio à la racine.

## Données locales

La partie est sauvegardée dans le navigateur avec copie de secours et migrations `v1 → v2 → v3`. Le menu **QG → Sauvegarde** permet l'export/import manuel. Aucune connexion ni aucun compte ne sont nécessaires.
