import type { AgeDefinition, BossMechanicId, PrestigeUpgradeId, RoleDefinition, UnitRole } from '../types';

const names = (
  assault: string,
  ranger: string,
  guardian: string,
  scout: string,
  support: string,
  siege: string,
): Record<UnitRole, string> => ({ assault, ranger, guardian, scout, support, siege });

export const ROLES: RoleDefinition[] = [
  {
    id: 'assault', name: 'Assaut', shortName: 'Ligne', description: 'Polyvalent et fiable au cœur de la mêlée.',
    hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, range: 0.055, spawnSeconds: 4.8, population: 1,
    classCost: 1, unlockSector: 0, targeting: 'nearest',
  },
  {
    id: 'ranger', name: 'Tireur', shortName: 'Distance', description: 'Frappe depuis l’arrière mais reste fragile.',
    hpMultiplier: 0.65, damageMultiplier: 1.28, speedMultiplier: 0.92, range: 0.19, spawnSeconds: 6, population: 1,
    classCost: 1.15, unlockSector: 1, targeting: 'weakest',
  },
  {
    id: 'guardian', name: 'Gardien', shortName: 'Tank', description: 'Bloque la ligne et protège les troupes fragiles.',
    hpMultiplier: 2.6, damageMultiplier: 0.62, speedMultiplier: 0.72, range: 0.052, spawnSeconds: 9, population: 2,
    classCost: 1.6, unlockSector: 3, targeting: 'nearest',
  },
  {
    id: 'scout', name: 'Éclaireur', shortName: 'Chasseur', description: 'Rapide, contourne la ligne et chasse les tireurs.',
    hpMultiplier: 0.76, damageMultiplier: 1.36, speedMultiplier: 1.42, range: 0.06, spawnSeconds: 6.8, population: 1,
    classCost: 1.3, unlockSector: 6, targeting: 'backline',
  },
  {
    id: 'support', name: 'Soutien', shortName: 'Aura', description: 'Soigne les alliés et renforce leur cadence.',
    hpMultiplier: 0.9, damageMultiplier: 0.42, speedMultiplier: 0.9, range: 0.15, spawnSeconds: 10.5, population: 2,
    classCost: 1.8, unlockSector: 11, targeting: 'weakest',
  },
  {
    id: 'siege', name: 'Siège', shortName: 'Zone', description: 'Lent, blindé et dévastateur contre les groupes.',
    hpMultiplier: 1.45, damageMultiplier: 2.4, speedMultiplier: 0.58, range: 0.24, spawnSeconds: 14, population: 3,
    classCost: 2.3, unlockSector: 16, targeting: 'cluster',
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((role) => [role.id, role])) as Record<UnitRole, RoleDefinition>;

export const AGES: AgeDefinition[] = [
  {
    id: 'embers', index: 0, name: 'Âge des Braises', shortName: 'Braises', tagline: 'La première étincelle devient une armée.',
    palette: ['#ffb44e', '#49230f', '#69e3d1'], allyNames: names('Massueur', 'Lance-silex', 'Gardien-mammouth', 'Coureur-loup', 'Chaman', 'Lance-rocher'),
    enemies: ['Croc-d’Os', 'Frondeur de cendre', 'Chasseur raptor', 'Brute mammouth'], boss: 'Mâchoire-de-Roc',
    bossMechanic: 'Charges annoncées et rochers roulants', heroWeapons: ['Lame de silex', 'Lance de chasse', 'Massue mammouth'],
    armorTrack: ['Peau tannée', 'Cuir épais', 'Plaques d’os', 'Fourrure mammouth'], landmark: 'Cercle des Mégalithes', targetMinutes: [20, 30],
  },
  {
    id: 'bronze', index: 1, name: 'Royaumes du Bronze', shortName: 'Bronze', tagline: 'Des cités rivales forgent les premières légendes.',
    palette: ['#f2b35c', '#49311f', '#5ed6e5'], allyNames: names('Hoplite', 'Archer solaire', 'Porte-pavois', 'Char léger', 'Augure', 'Bélier'),
    enemies: ['Pillard de bronze', 'Lancier scarabée', 'Char de guerre', 'Prêtre-serpent', 'Garde-taureau'], boss: 'Roi-Taureau',
    bossMechanic: 'Bouclier frontal et ruées', heroWeapons: ['Xiphos', 'Arc composite', 'Hache labrys'],
    armorTrack: ['Lin renforcé', 'Écailles de bronze', 'Cuirasse', 'Bronze solaire'], landmark: 'Porte du Soleil', targetMinutes: [30, 40],
  },
  {
    id: 'iron', index: 2, name: 'Légions de Fer', shortName: 'Fer', tagline: 'Les routes du monde convergent vers le sommet.',
    palette: ['#e6d1b2', '#27313e', '#f2b64b'], allyNames: names('Légionnaire', 'Lance-pilum', 'Mur de scuta', 'Cavalier', 'Aquilifer', 'Baliste'),
    enemies: ['Gladiateur-chaîne', 'Archer noir', 'Porte-aigle', 'Éléphant cuirassé', 'Cavalier auxiliaire'], boss: 'Imperator Ferratus',
    bossMechanic: 'Formations et bannières de guerre', heroWeapons: ['Spatha', 'Pilums', 'Marteau d’arène'],
    armorTrack: ['Mailles', 'Segments de fer', 'Fer noir', 'Armure de l’Aigle'], landmark: 'Arc des Conquérants', targetMinutes: [40, 55],
  },
  {
    id: 'medieval', index: 3, name: 'Couronnes médiévales', shortName: 'Couronnes', tagline: 'La colline devient forteresse.',
    palette: ['#f1c75b', '#172b47', '#7cc9de'], allyNames: names('Épéiste', 'Arbalétrier', 'Chevalier pavois', 'Éclaireur monté', 'Chapelain', 'Trébuchet'),
    enemies: ['Vougier', 'Long-arc', 'Assassin', 'Alchimiste', 'Chevalier noir'], boss: 'Reine du Bastion',
    bossMechanic: 'Tours, huile enflammée et armure à briser', heroWeapons: ['Épée longue', 'Arbalète', 'Marteau de guerre'],
    armorTrack: ['Gambison', 'Cotte de mailles', 'Brigandine', 'Armure de plates'], landmark: 'Bastion des Sept Bannières', targetMinutes: [50, 70],
  },
  {
    id: 'powder', index: 4, name: 'Ère des Poudres', shortName: 'Poudres', tagline: 'Le tonnerre tient désormais dans une main.',
    palette: ['#ffc56b', '#2e2632', '#e85e4d'], allyNames: names('Piquier', 'Arquebusier', 'Cuirassier', 'Duelliste', 'Chirurgien', 'Bombarde'),
    enemies: ['Piquier noir', 'Mousquetaire noir', 'Grenadier', 'Corsaire', 'Médecin de poudre', 'Canonnier'], boss: 'Amiral Cendre',
    bossMechanic: 'Barils explosifs et bordées', heroWeapons: ['Rapière', 'Mousquet', 'Tromblon'],
    armorTrack: ['Manteau de buffle', 'Plastron', 'Cuirasse', 'Tenue du Grand Amiral'], landmark: 'Fort de la Mèche Rouge', targetMinutes: [60, 80],
  },
  {
    id: 'steam', index: 5, name: 'Révolution de Vapeur', shortName: 'Vapeur', tagline: 'L’industrie ne dort jamais.',
    palette: ['#f6a84d', '#273443', '#62d6c9'], allyNames: names('Garde riveté', 'Carabinier à bobine', 'Exo-chaudière', 'Voltigeur', 'Mécanicien', 'Canon vapeur'),
    enemies: ['Automate ouvrier', 'Sniper du smog', 'Scie mécanique', 'Drone à engrenages', 'Réparateur à vapeur', 'Mortier-chaudière'], boss: 'Colosse-Usine',
    bossMechanic: 'Surchauffe, évents et blindage', heroWeapons: ['Matraque Tesla', 'Carabine à bobine', 'Marteau-piston'],
    armorTrack: ['Cuir riveté', 'Chaudière', 'Exosquelette', 'Armure Tesla'], landmark: 'Grand Rouage Atmosphérique', targetMinutes: [70, 95],
  },
  {
    id: 'modern', index: 6, name: 'Monde Moderne', shortName: 'Moderne', tagline: 'Chaque mètre se gagne sous surveillance.',
    palette: ['#f1d38d', '#182836', '#63d6ff'], allyNames: names('Fantassin', 'Tireur tactique', 'Bouclier composite', 'Infiltrateur', 'Médecin', 'Drone-mortier'),
    enemies: ['Commando', 'Tireur orbital', 'Mastodonte', 'Saboteur', 'Drone médical', 'Drone-mortier'], boss: 'Commandant Zéro',
    bossMechanic: 'Frappes télégraphiées et blindé mobile', heroWeapons: ['Pistolet-mitrailleur', 'Fusil de précision', 'Lance-grenades'],
    armorTrack: ['Kevlar', 'Plaques balistiques', 'Exosquelette', 'Composite tactique'], landmark: 'Complexe Horizon', targetMinutes: [85, 115],
  },
  {
    id: 'neon', index: 7, name: 'Ère Néon', shortName: 'Néon', tagline: 'Les armées combattent à la vitesse des données.',
    palette: ['#ff55b8', '#111739', '#55f6ff'], allyNames: names('Lame synthétique', 'Railgunner', 'Gardien holo', 'Coureur blink', 'Nanomédecin', 'Marcheur EMP'),
    enemies: ['Chrome-runner', 'Sniper rail', 'Essaim drone', 'Sentinelle plasma', 'Hacker', 'Marcheur EMP'], boss: 'Matriarche Néon',
    bossMechanic: 'Piratage de spawners et doubles holographiques', heroWeapons: ['Monolame', 'Pistolet rail', 'Canon plasma'],
    armorTrack: ['Maille carbone', 'Plaques holo', 'Nanoarmure', 'Égide néon'], landmark: 'Flèche de Verre Quantique', targetMinutes: [100, 140],
  },
  {
    id: 'quantum', index: 8, name: 'Hyperfutur quantique', shortName: 'Hyperfutur', tagline: 'Le sommet existe dans toutes les lignes du temps.',
    palette: ['#c896ff', '#10132d', '#65f7ed'], allyNames: names('Phasique', 'Lance-flux', 'Titan graviton', 'Coureur temporel', 'Oracle causal', 'Lance-singularité'),
    enemies: ['Clone paradoxal', 'Lance-flux', 'Essaim photonique', 'Gardien du vide', 'Annulateur', 'Lance-singularité'], boss: 'Souverain de l’Après',
    bossMechanic: 'Rembobinage local, clones et singularités', heroWeapons: ['Lame phasique', 'Fusil causal', 'Gantelet singularité'],
    armorTrack: ['Tissu de phase', 'Plaques gravitiques', 'Manteau causal', 'Coque Oméga'], landmark: 'Citadelle de l’Après', targetMinutes: [120, 170],
  },
];

export interface EnemyDeckEntry {
  role: UnitRole;
  name: string;
  weight: number;
}

export const ENEMY_DECKS: readonly (readonly EnemyDeckEntry[])[] = [
  [
    { role: 'assault', name: 'Croc-d’Os', weight: 44 },
    { role: 'ranger', name: 'Frondeur de cendre', weight: 28 },
    { role: 'scout', name: 'Chasseur raptor', weight: 16 },
    { role: 'guardian', name: 'Brute mammouth', weight: 12 },
  ],
  [
    { role: 'assault', name: 'Pillard de bronze', weight: 30 },
    { role: 'ranger', name: 'Lancier scarabée', weight: 26 },
    { role: 'scout', name: 'Char de guerre', weight: 22 },
    { role: 'guardian', name: 'Garde-taureau', weight: 16 },
    { role: 'support', name: 'Prêtre-serpent', weight: 6 },
  ],
  [
    { role: 'assault', name: 'Gladiateur-chaîne', weight: 25 },
    { role: 'ranger', name: 'Archer noir', weight: 24 },
    { role: 'scout', name: 'Cavalier auxiliaire', weight: 16 },
    { role: 'guardian', name: 'Éléphant cuirassé', weight: 20 },
    { role: 'support', name: 'Porte-aigle', weight: 15 },
  ],
  [
    { role: 'assault', name: 'Vougier', weight: 22 },
    { role: 'ranger', name: 'Long-arc', weight: 25 },
    { role: 'scout', name: 'Assassin', weight: 18 },
    { role: 'guardian', name: 'Chevalier noir', weight: 20 },
    { role: 'support', name: 'Alchimiste', weight: 15 },
  ],
  [
    { role: 'assault', name: 'Piquier noir', weight: 18 },
    { role: 'ranger', name: 'Mousquetaire noir', weight: 24 },
    { role: 'scout', name: 'Corsaire', weight: 17 },
    { role: 'guardian', name: 'Grenadier', weight: 14 },
    { role: 'support', name: 'Médecin de poudre', weight: 12 },
    { role: 'siege', name: 'Canonnier', weight: 15 },
  ],
  [
    { role: 'assault', name: 'Automate ouvrier', weight: 15 },
    { role: 'ranger', name: 'Sniper du smog', weight: 22 },
    { role: 'scout', name: 'Scie mécanique', weight: 20 },
    { role: 'guardian', name: 'Drone à engrenages', weight: 13 },
    { role: 'support', name: 'Réparateur à vapeur', weight: 14 },
    { role: 'siege', name: 'Mortier-chaudière', weight: 16 },
  ],
  [
    { role: 'assault', name: 'Commando', weight: 18 },
    { role: 'ranger', name: 'Tireur orbital', weight: 20 },
    { role: 'scout', name: 'Saboteur', weight: 18 },
    { role: 'guardian', name: 'Mastodonte', weight: 16 },
    { role: 'support', name: 'Drone médical', weight: 12 },
    { role: 'siege', name: 'Drone-mortier', weight: 16 },
  ],
  [
    { role: 'assault', name: 'Chrome-runner', weight: 14 },
    { role: 'ranger', name: 'Sniper rail', weight: 23 },
    { role: 'scout', name: 'Essaim drone', weight: 22 },
    { role: 'guardian', name: 'Sentinelle plasma', weight: 13 },
    { role: 'support', name: 'Hacker', weight: 14 },
    { role: 'siege', name: 'Marcheur EMP', weight: 14 },
  ],
  [
    { role: 'assault', name: 'Clone paradoxal', weight: 16 },
    { role: 'ranger', name: 'Lance-flux', weight: 18 },
    { role: 'scout', name: 'Essaim photonique', weight: 18 },
    { role: 'guardian', name: 'Gardien du vide', weight: 18 },
    { role: 'support', name: 'Annulateur', weight: 14 },
    { role: 'siege', name: 'Lance-singularité', weight: 16 },
  ],
];

export function pickEnemyDeckEntry(ageIndex: number, roll: number): EnemyDeckEntry {
  const deck = ENEMY_DECKS[Math.max(0, Math.min(ENEMY_DECKS.length - 1, ageIndex))] ?? ENEMY_DECKS[0]!;
  const totalWeight = deck.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * totalWeight;
  for (const entry of deck) {
    if (cursor < entry.weight) return entry;
    cursor -= entry.weight;
  }
  return deck[deck.length - 1]!;
}

export interface BossMechanicDefinition {
  id: BossMechanicId;
  warningLabel: string;
  impactLabel: string;
  intervalSeconds: number;
  warningSeconds: number;
}

export const BOSS_MECHANICS: readonly BossMechanicDefinition[] = [
  { id: 'rockfall', warningLabel: 'Rocher en approche', impactLabel: 'Impact rocheux', intervalSeconds: 7.2, warningSeconds: 1.25 },
  { id: 'bull-rush', warningLabel: 'Ruée du Taureau', impactLabel: 'Charge brise-ligne', intervalSeconds: 7.8, warningSeconds: 1.15 },
  { id: 'war-banner', warningLabel: 'Bannière impériale', impactLabel: 'Légion ralliée', intervalSeconds: 8.4, warningSeconds: 1.3 },
  { id: 'burning-oil', warningLabel: 'Huile sur la colline', impactLabel: 'Déferlante brûlante', intervalSeconds: 7.6, warningSeconds: 1.35 },
  { id: 'broadside', warningLabel: 'Bordée annoncée', impactLabel: 'Canons de bâbord', intervalSeconds: 8.1, warningSeconds: 1.4 },
  { id: 'overheat', warningLabel: 'Surchauffe critique', impactLabel: 'Évents vulnérables', intervalSeconds: 8.8, warningSeconds: 1.2 },
  { id: 'airstrike', warningLabel: 'Balise de frappe', impactLabel: 'Frappe orbitale', intervalSeconds: 7.4, warningSeconds: 1.45 },
  { id: 'spawner-hack', warningLabel: 'Intrusion des spawners', impactLabel: 'Production piratée', intervalSeconds: 9, warningSeconds: 1.5 },
  { id: 'time-rewind', warningLabel: 'Ancre causale', impactLabel: 'Rembobinage local', intervalSeconds: 8.2, warningSeconds: 1.35 },
];

export const HILL_NAMES = ['Lisière', 'Carrière', 'Atelier', 'Rempart', 'Capitale'] as const;

export interface PrestigeUpgradeDefinition {
  id: PrestigeUpgradeId;
  name: string;
  description: string;
  bonusLabel: string;
}

export const PRESTIGE_UPGRADES: PrestigeUpgradeDefinition[] = [
  { id: 'damage', name: 'Chronoforge', description: 'Affûte toutes les armes de l’armée.', bonusLabel: '+4 % dégâts / rang' },
  { id: 'health', name: 'Ligne renforcée', description: 'Fortifie soldats, héros et base.', bonusLabel: '+5 % PV / rang' },
  { id: 'logistics', name: 'Logistique', description: 'Accélère tous les spawners.', bonusLabel: '+3 % cadence / rang' },
  { id: 'income', name: 'Trésor de guerre', description: 'Augmente les primes de combat.', bonusLabel: '+5 % pièces / rang' },
  { id: 'hero', name: 'Héritage du héros', description: 'Renforce le combattant temporel.', bonusLabel: '+4 % héros / rang' },
  { id: 'offline', name: 'Empire dormant', description: 'Améliore les retours hors ligne.', bonusLabel: '+5 % hors ligne / rang' },
];

export const MISSION_DEFS = [
  { id: 'kills', label: 'Vaincre 50 ennemis', target: 50, rewardFactor: 24 },
  { id: 'hero', label: 'Réussir 12 frappes du héros', target: 12, rewardFactor: 18 },
  { id: 'upgrades', label: 'Acheter 3 améliorations', target: 3, rewardFactor: 28 },
] as const;

export const FIRST_CAMPAIGN_TARGET_MINUTES = AGES.reduce((sum, age) => sum + age.targetMinutes[0], 0);
