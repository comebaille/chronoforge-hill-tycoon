# Architecture technique — Chronoforge Hill Tycoon

## 1. Objectifs et contraintes

Le jeu cible en priorité les navigateurs mobiles et l'installation PWA. Il doit rester fluide lors de batailles comprenant de nombreux soldats, conserver une progression longue et fiable, fonctionner sans connexion après mise en cache et accepter l'ajout de nombreux âges sans multiplier les conditions spéciales dans le moteur.

Choix structurants :

- Vite et TypeScript strict ;
- Canvas 2D pour le champ de bataille ;
- HTML/CSS sémantique pour le HUD, la boutique, la forge et les menus ;
- simulation déterministe à pas fixe, rendu à fréquence variable ;
- contenu piloté par des définitions typées ;
- sauvegarde locale versionnée et transactionnelle ;
- calcul analytique des gains hors-ligne ;
- audio WebAudio chargé localement, complété par des sons procéduraux ;
- instrumentation intégrée pour mesurer avant d'ajuster la qualité.

Le jeu reste entièrement client-side. Aucune règle de progression essentielle ne doit dépendre du réseau.

## 2. Organisation du projet

```text
src/
  app/
    bootstrap.ts
    lifecycle.ts
    config.ts
  core/
    GameClock.ts
    SeededRandom.ts
    EventQueue.ts
    ObjectPool.ts
    Diagnostics.ts
  content/
    schema.ts
    registry.ts
    ages/
    units/
    equipment/
    encounters/
    balance/
  entities/
    EntityStore.ts
    components.ts
    factories.ts
  systems/
    InputSystem.ts
    SpawnSystem.ts
    TargetingSystem.ts
    AISystem.ts
    MovementSystem.ts
    CollisionSystem.ts
    CombatSystem.ts
    DamageSystem.ts
    RewardSystem.ts
    ProgressionSystem.ts
    CleanupSystem.ts
  world/
    Battlefield.ts
    SpatialGrid.ts
    FrontController.ts
    ZoneController.ts
  economy/
    Currency.ts
    PurchaseService.ts
    CostCurves.ts
    PrestigeService.ts
  render/
    CanvasRenderer.ts
    Camera.ts
    SpriteAtlas.ts
    ParticleRenderer.ts
  animation/
    AnimationController.ts
    AnimationDefinitions.ts
  input/
    ActionMap.ts
    TouchController.ts
  ui/
    HudController.ts
    ShopController.ts
    ModalController.ts
    AccessibilityAnnouncer.ts
  audio/
    AudioManager.ts
    ProceduralSounds.ts
    audioManifest.ts
  persistence/
    SaveRepository.ts
    SaveSchema.ts
    SaveMigrations.ts
    OfflineProgress.ts
  pwa/
    ServiceWorkerClient.ts
    ContentCache.ts
  utils/

tests/
  unit/
  integration/
  e2e/
  performance/

public/
  assets/visual/
  assets/audio/
  icons/
  manifest.webmanifest
  sw.js
```

Les dépendances suivent ces règles :

1. `core` ne dépend d'aucun système de jeu ;
2. `content` contient des données immuables et ne connaît pas l'état courant ;
3. `systems` modifie l'état de simulation, jamais le DOM ;
4. `render`, `audio` et `ui` consomment des instantanés ou des événements ;
5. `persistence` sérialise un état cohérent seulement entre deux ticks ;
6. une action d'achat ou d'équipement passe par une commande validée, jamais par une mutation directe de l'interface.

## 3. État, commandes et événements

L'état mutable principal est regroupé dans `GameState` :

- horloge et seed aléatoire ;
- zone, âge, progression du front et boss ;
- entités actives ;
- spawners possédés et améliorations ;
- équipement du héros et de l'armée ;
- monnaies, recherches et prestige ;
- objectifs et tutoriel.

Les interactions entrent sous forme de commandes typées, par exemple :

```ts
type GameCommand =
  | { type: 'buy-spawner'; definitionId: string; amount: number }
  | { type: 'upgrade-spawner'; instanceId: string }
  | { type: 'equip-item'; owner: 'hero' | 'army'; itemId: string }
  | { type: 'activate-skill'; skillId: string; worldX: number; worldY: number }
  | { type: 'claim-offline-reward'; transactionId: string };
```

Chaque commande est validée puis appliquée atomiquement. Les conséquences non déterministes pour la présentation passent par une file d'événements : attaque, impact, mort, gain, achat, capture, boss, nouvel âge, animation et son. Le rendu et l'audio ne peuvent ainsi ni attribuer de l'argent ni infliger des dégâts.

## 4. Boucle de simulation

### 4.1 Pas fixe et rendu variable

La simulation de combat tourne à 30 ticks par seconde (`STEP = 1 / 30`). Le rendu suit `requestAnimationFrame` et peut donc s'afficher à 60 ou 120 Hz sans accélérer le jeu.

```ts
const STEP_MS = 1000 / 30;
const MAX_FRAME_MS = 250;
const MAX_STEPS_PER_FRAME = 6;

function frame(now: number): void {
  const frameMs = Math.min(now - previousFrame, MAX_FRAME_MS);
  previousFrame = now;
  accumulatorMs += frameMs;

  input.samplePointers();

  let steps = 0;
  while (accumulatorMs >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    input.commitActions();
    simulation.fixedUpdate(STEP_MS / 1000);
    accumulatorMs -= STEP_MS;
    steps++;
  }

  if (steps === MAX_STEPS_PER_FRAME && accumulatorMs >= STEP_MS) {
    diagnostics.recordDroppedSimulationTime(accumulatorMs);
    accumulatorMs %= STEP_MS;
  }

  renderer.render(accumulatorMs / STEP_MS);
  requestAnimationFrame(frame);
}
```

Chaque entité conserve sa position précédente et sa position courante. `render(alpha)` les interpole afin de garder des déplacements visuellement fluides.

La simulation n'essaie jamais de rattraper plusieurs minutes après une suspension. Sur `visibilitychange` ou `pagehide`, elle sauvegarde puis se met en pause. Au retour, le temps écoulé passe par `OfflineProgress` avant de reprendre la boucle normale.

### 4.2 Ordre d'un tick

L'ordre est stable et testé :

1. consommation des commandes tactiles ;
2. production des spawners et rencontres ennemies ;
3. perception, ciblage et décision IA ;
4. déplacement et évitement local ;
5. collisions et occupation de la colline ;
6. attaques, projectiles et compétences ;
7. dégâts, morts et assistances ;
8. récompenses et objectifs ;
9. progression du front, boss et changement d'âge ;
10. nettoyage, recyclage et émission des événements de présentation.

Les décisions IA coûteuses et l'acquisition de cible sont cadencées à 5–10 Hz et réparties sur différents ticks. Le HUD est rafraîchi à 4–10 Hz ; il ne provoque pas une reconstruction DOM à chaque image.

Un générateur pseudo-aléatoire seedé fournit les critiques, variantes de spawn et choix IA. Une même seed et la même séquence de commandes doivent produire le même état final.

## 5. Entités, IA et pooling

Le moteur utilise un ECS léger :

- identifiant composé d'un index et d'une génération ;
- tableaux denses ou `TypedArray` pour les données chaudes ;
- définitions statiques référencées par identifiant ;
- listes actives par famille de composants ;
- grille spatiale uniforme pour les recherches de voisinage.

Composants fréquents : position, vitesse, collision, équipe, santé, attaque, cible, rôle, état IA, animation, récompense et durée de vie.

Les états IA de base sont `spawn`, `advance`, `acquire`, `telegraph`, `attack`, `recover`, `retreat` et `dead`. Les rôles — mêlée, distance, tank, soutien, siège ou assassin — configurent leurs priorités sans créer une classe différente pour chaque âge.

Les objets à fort renouvellement sont préchauffés et recyclés :

| Pool | Capacité de départ | Politique de saturation |
|---|---:|---|
| Unités | 256 | le gameplay interdit de dépasser la limite |
| Projectiles | 512 | priorité aux tirs visibles ; conversion possible en hitscan |
| Particules/VFX | 384 | recyclage du plus ancien effet non critique |
| Dégâts flottants | 96 | regroupement des valeurs sur 250 ms |
| Voix audio | 24 actives | priorité aux attaques, alertes et boss |

Les spawners, zones et équipements persistent longtemps et restent des objets ordinaires. Un handle périmé ne doit jamais viser une entité recyclée : la génération est vérifiée à chaque accès externe.

## 6. Contenu piloté par les données

Les âges, unités et équipements sont définis hors des systèmes. Le registre comprend au minimum :

- `AgeDefinition` ;
- `UnitDefinition` et `EnemyDefinition` ;
- `WeaponDefinition` et `ArmorDefinition` ;
- `SpawnerDefinition` ;
- `ZoneDefinition`, `WaveDefinition` et `BossDefinition` ;
- `RewardTable` et `BalanceCurves` ;
- contrats d'animation, sprites et événements audio.

Les identifiants sont stables entre les versions. Les comportements autorisés sont sélectionnés dans un registre fermé ; aucune donnée n'exécute du code arbitraire.

Les pièces utilisent `bigint`, sérialisé comme chaîne décimale. Cela évite la perte de précision lorsque les coûts deviennent très élevés. Les statistiques instantanées de combat restent des `number` bornés et normalisés par zone.

Les packs visuels et audio utilisent des manifestes indiquant source, auteur, licence, transformations et fichiers dérivés. Le noyau, l'âge courant et les éléments UI sont disponibles hors-ligne. L'âge suivant est préchargé en arrière-plan. Une option peut télécharger tous les packs pour une utilisation complètement déconnectée.

Les validations de contenu détectent :

- identifiants dupliqués et références absentes ;
- prérequis cycliques ou âge inaccessible ;
- équipement incompatible ;
- coûts ou récompenses incohérents ;
- temps d'élimination hors des bornes prévues ;
- fichier visuel, clip ou son absent ;
- attribution ou licence manquante.

## 7. Rendu, animation et qualité adaptative

Le Canvas utilise une résolution physique basée sur le DPR, plafonné à 2. Les décors statiques, ombres simples et éléments éloignés sont précalculés dans des surfaces hors-écran. Les sprites proviennent d'atlas pour limiter les changements de source et les appels inutiles.

Les animations sont pilotées par l'état gameplay. L'instant utile d'un clip — apparition du projectile, activation de la hitbox, soin ou mort — est défini comme événement d'animation, pas comme minuteur dispersé. Le rendu peut interrompre proprement un clip lorsqu'un état prioritaire survient.

La qualité adaptative s'active uniquement après mesure d'une dégradation durable. Elle réduit dans cet ordre :

1. particules décoratives ;
2. ombres et lueurs secondaires ;
3. DPR de 2 à 1,5 puis 1 ;
4. fréquence visuelle des animations éloignées.

Elle ne modifie jamais la fréquence de simulation, les dégâts ou le nombre réel d'ennemis.

## 8. Audio WebAudio

`AudioManager` crée quatre bus : général, musique, effets et interface, suivis d'un compresseur/limiteur final.

- création ou reprise de l'`AudioContext` après le premier geste utilisateur ;
- fichiers locaux décodés une fois puis mis en cache ;
- sons procéduraux courts pour gain de pièce, validation, erreur et impact léger ;
- sons enregistrés pour armes, voix, boss, ambiance et musique ;
- variation limitée de hauteur et volume sur les sons répétitifs ;
- limite de voix et priorités par catégorie ;
- suspension quand l'application est masquée ;
- mute et volumes persistants ;
- réduction des sons et vibrations selon les réglages d'accessibilité.

Les générateurs procéduraux sont vérifiés dans un `OfflineAudioContext` : tampon non vide, aucun `NaN` et aucun pic dépassant le seuil de saturation.

## 9. Sauvegarde versionnée

IndexedDB contient la progression. Les préférences sont enregistrées dans un magasin séparé afin qu'une remise à zéro du jeu ne supprime pas les réglages d'accessibilité.

```ts
interface SaveEnvelope {
  schemaVersion: number;
  contentVersion: string;
  saveId: string;
  savedAtMs: number;
  lastActiveAtMs: number;
  currencies: { coins: string };
  progression: ProgressionState;
  spawners: SpawnerState[];
  equipment: EquipmentState;
  world: WorldState;
  rngState: number;
  offlineBasis: OfflineBasis;
}
```

Règles de fiabilité :

- migrations successives et testables, par exemple `v1 -> v2 -> v3` ;
- validation après lecture et après chaque migration ;
- sauvegarde principale et deux checkpoints tournants ;
- écriture transactionnelle ;
- restauration du dernier checkpoint valide après corruption ;
- refus explicite d'une sauvegarde créée par une version future ;
- autosave toutes les 20 secondes et après achat important, boss, âge ou prestige ;
- sauvegarde sur `visibilitychange` et `pagehide` ;
- export/import vérifié pour protéger une progression longue ;
- application d'une mise à jour PWA seulement après une sauvegarde réussie et l'accord du joueur.

L'interface ne présente jamais un achat comme réussi avant la validation économique. La monnaie ne peut devenir négative et un double tap ne peut facturer qu'une fois.

## 10. Gains hors-ligne

Les gains hors-ligne sont calculés analytiquement, jamais en rejouant chaque tick. `OfflineBasis`, écrit avec la sauvegarde, contient notamment :

- puissance effective de l'armée ;
- cadence totale des spawners ;
- DPS et survie moyens ;
- limite de population ;
- dernière zone de farming sécurisée ;
- multiplicateurs de recherche et prestige.

Une fonction pure estime la cadence de victoires depuis le DPS contre les PV moyens, puis la borne par la cadence de spawn et le taux de survie. Elle utilise le même service de récompense que le jeu actif.

Règles initiales :

- aucun rapport sous 60 secondes d'absence ;
- efficacité hors-ligne de 65 %, améliorable ;
- plafond initial de 8 heures, améliorable ;
- aucun premier boss ni nouvel âge débloqué hors-ligne ;
- horloge reculée : zéro gain et diagnostic ;
- durée anormalement élevée : application du plafond ;
- calcul sur timestamps UTC.

Au chargement :

1. lire et valider la sauvegarde ;
2. calculer le temps admissible ;
3. produire un rapport pur ;
4. appliquer la récompense avec un identifiant de transaction ;
5. mettre à jour `lastActiveAtMs` ;
6. sauvegarder ces changements dans une même transaction ;
7. afficher le rapport déjà validé.

Cette séquence rend la réclamation idempotente : recharger l'application ne paie pas une deuxième fois. Sans serveur, une modification volontaire de l'horloge système ne peut pas être empêchée totalement ; les plafonds limitent son intérêt.

## 11. PWA et cycle de vie

Le service worker met en cache l'app shell et les ressources versionnées. Les contenus des âges utilisent une stratégie cache-first après leur première récupération. Les points essentiels sont :

- l'application démarre sans réseau après une première installation complète ;
- une version de cache porte l'identifiant de build ;
- les anciens caches ne sont retirés qu'après activation sûre ;
- une mise à jour en attente n'interrompt jamais un combat ;
- l'utilisateur est averti, le jeu sauvegarde, puis recharge ;
- les erreurs de stockage ou de service worker restent non bloquantes pour une partie déjà chargée.

Les événements de cycle de vie sont centralisés dans `app/lifecycle.ts` afin d'éviter plusieurs sauvegardes ou reprises concurrentes.

## 12. Plan de tests

### 12.1 Portes de qualité

Ordre de vérification recommandé :

1. `npm run typecheck` ;
2. validation des données et manifestes ;
3. `npm run test` ;
4. `npm run build` ;
5. lancement du build dans une session serveur active ;
6. smoke tests navigateur mobile ;
7. profilage de la scène de référence.

`npm run check` doit rester la porte locale rapide. Les suites navigateur et performance peuvent être séparées, car elles nécessitent un serveur et un navigateur réel.

### 12.2 Tests unitaires Vitest

Boucle et cœur :

- des séquences de frames à 60, 90 et 120 Hz produisent le même état ;
- delta maximal, limite de ticks et temps abandonné sont corrects ;
- une reprise d'onglet ne rejoue pas tout le retard ;
- le RNG est reproductible ;
- les files d'événements conservent ordre et typage.

Entités et combat :

- recyclage des pools et invalidation des handles ;
- insertion, déplacement et requête dans la grille spatiale ;
- perception, cible prioritaire, télégraphe et cooldown ;
- armure, dégâts, critique, soin, mort et assistance ;
- un projectile recyclé ne peut plus infliger de dégâts ;
- les rôles ne ciblent pas une entité invalide ou hors portée.

Économie et contenu :

- sérialisation et calculs `bigint` ;
- achat atomique, fonds exacts, fonds insuffisants et double commande ;
- graphe de prérequis sans cycle ;
- chaque âge, unité et équipement est atteignable ;
- toutes les références d'assets et de sons existent ;
- les courbes respectent les bornes de progression décidées.

Sauvegarde et hors-ligne :

- chargement sans sauvegarde ;
- migration depuis chaque version supportée ;
- corruption, checkpoint de secours et refus d'écriture ;
- import/export et rejet d'une version future ;
- absence de 0, 59 secondes, durée normale et plafond ;
- horloge reculée et changement de fuseau ;
- réclamation unique après plusieurs rechargements.

### 12.3 Tests d'intégration headless

Une simulation accélérée exécute la boucle complète sans rendu : spawner, apparition, ciblage, combat, mort, récompense, achat et capture. Elle vérifie qu'aucune stratégie normale ne termine le contenu complet en vingt minutes et qu'aucun âge n'est mathématiquement inaccessible.

Scénarios déterministes :

- mêlée contre mêlée ;
- distance protégée par un tank ;
- soutien et soin ;
- boss avec télégraphe et phase ;
- saturation de population ;
- capture, perte puis reprise de la colline ;
- prestige et reprise de progression.

### 12.4 Smoke tests navigateur mobile

Le build de production est servi dans une session active. Les viewports minimum sont :

- 375 × 667 ;
- 390 × 844 ;
- 412 × 915 ;
- un passage paysage 667 × 375 ou 844 × 390.

Scénario automatisé :

1. charger ou installer la PWA ;
2. effectuer le premier toucher et déverrouiller l'audio ;
3. déplacer le héros et déclencher une attaque ;
4. tuer un ennemi et constater l'augmentation des pièces ;
5. acheter un spawner ;
6. observer l'apparition d'un allié et la progression du front ;
7. acheter ou équiper une arme/armure ;
8. sauvegarder puis recharger ;
9. injecter une absence contrôlée ;
10. réclamer une seule fois le rapport hors-ligne ;
11. couper le réseau et recharger les ressources déjà mises en cache.

Assertions :

- aucune `pageerror`, erreur console ou ressource critique manquante ;
- Canvas présent, visible et correctement dimensionné ;
- `scrollWidth <= innerWidth` ;
- HUD et commandes hors des zones sûres ;
- cibles tactiles d'au moins 44 × 44 px, 48 × 48 px recommandés ;
- pause, reprise et rotation sans perte de progression ;
- aucun achat facturé deux fois ;
- information critique disponible autrement que par la couleur ou le son ;
- capture déterministe du combat et des écrans principaux pour régression visuelle.

Le parcours principal est également essayé sur Safari iOS et Chrome Android réels. Les tests headless ne remplacent pas la vérification de l'installation PWA, de l'audio et des zones sûres sur appareil.

### 12.5 Tests de durée et fiabilité

Un soak test d'une heure enchaîne combat, achats, changement d'écran, pause, reprise et autosaves. Il vérifie :

- absence de croissance mémoire continue ;
- absence de boucle `requestAnimationFrame` dupliquée ;
- pool revenu à son niveau stable après les vagues ;
- aucune transaction de sauvegarde concurrente ;
- audio correctement libéré ou réutilisé ;
- reprise correcte après plusieurs suspensions.

## 13. Budgets performance

Scène de référence : 160 unités actives, 240 projectiles, 300 particules, HUD et audio actifs, sur un mobile milieu de gamme avec viewport proche de 390 × 844.

| Mesure | Budget cible |
|---|---:|
| Fréquence sur appareil moyen | 60 FPS |
| Frame totale p95 | <= 16,7 ms |
| Simulation p95 | <= 6 ms |
| Rendu p95 | <= 8 ms |
| Frame p99 | <= 25 ms |
| Plancher appareil faible | 30 FPS |
| Latence toucher-vers-image p95 | <= 80 ms |
| Longue tâche pendant le combat | aucune > 50 ms |
| Croissance mémoire après chauffe | < 10 Mo sur 20 min |
| Tas JavaScript cible | < 100 Mo |
| Bundle JavaScript initial gzip | < 250 Ko |
| App shell initial | < 2,5 Mo |
| Temps jusqu'au jeu, réseau mobile moyen | < 3 s |
| Voix audio simultanées | <= 24 |

`Diagnostics` conserve un buffer circulaire des durées de simulation, IA, collisions, rendu, UI et sauvegarde. Les percentiles p50, p95 et p99 sont exportables depuis un mode diagnostic non visible en production normale.

Les mesures headless servent de garde-fou contre les régressions. La validation finale des budgets se fait sur au moins un Android milieu de gamme et un iPhone réel, en build de production.

## 14. Critères d'acceptation technique

La tranche est techniquement valide lorsque :

- achat d'un spawner, apparition, combat, récompense et progression fonctionnent de bout en bout ;
- une même seed produit un combat reproductible ;
- la sauvegarde survit à un rechargement et à une migration ;
- les gains hors-ligne sont bornés et impossibles à réclamer deux fois ;
- le jeu redémarre hors-ligne avec les contenus mis en cache ;
- le parcours tactile ne déborde sur aucun viewport supporté ;
- les événements audio principaux démarrent après interaction sans saturation ;
- les pools et la mémoire restent stables durant le soak test ;
- la scène de référence respecte les budgets sur les appareils cibles ;
- les assets, sons, animations, combats, niveaux, UI, sauvegarde et performance possèdent chacun une vérification traçable.
