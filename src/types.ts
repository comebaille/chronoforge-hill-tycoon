export type Team = 'ally' | 'enemy';
export type UnitRole = 'assault' | 'ranger' | 'guardian' | 'scout' | 'support' | 'siege';
export type BossMechanicId = 'rockfall' | 'bull-rush' | 'war-banner' | 'burning-oil' | 'broadside' | 'overheat' | 'airstrike' | 'spawner-hack' | 'time-rewind';
export type GameTab = 'war' | 'barracks' | 'forge' | 'ages' | 'hq';

export interface RoleDefinition {
  id: UnitRole;
  name: string;
  shortName: string;
  description: string;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  range: number;
  spawnSeconds: number;
  population: number;
  classCost: number;
  unlockSector: number;
  targeting: 'nearest' | 'backline' | 'weakest' | 'cluster';
}

export interface AgeDefinition {
  id: string;
  index: number;
  name: string;
  shortName: string;
  tagline: string;
  palette: [string, string, string];
  allyNames: Record<UnitRole, string>;
  enemies: string[];
  boss: string;
  bossMechanic: string;
  heroWeapons: [string, string, string];
  armorTrack: [string, string, string, string];
  landmark: string;
  targetMinutes: [number, number];
}

export interface SpawnerState {
  role: UnitRole;
  level: number;
  count: number;
  timer: number;
  order: 'push' | 'hero' | 'hunt' | 'defend';
}

export interface GearState {
  heroWeapon: number;
  heroArmor: number;
  armyWeapon: number;
  armyArmor: number;
  boots: number;
  banner: number;
}

export interface PrestigeState {
  crystals: number;
  lifetimeCrystals: number;
  ranks: Record<PrestigeUpgradeId, number>;
}

export type PrestigeUpgradeId = 'damage' | 'health' | 'logistics' | 'income' | 'hero' | 'offline';

export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface PlayerStats {
  kills: number;
  heroKills: number;
  bosses: number;
  coinsEarned: number;
  taps: number;
  playSeconds: number;
  highestDps: number;
}

export interface GameState {
  version: 3;
  saveId: string;
  updatedAt: number;
  lastActiveAt: number;
  coins: number;
  ageIndex: number;
  sectorInAge: number;
  totalSectors: number;
  capture: number;
  pressure: number;
  stars: number;
  bestIncomePerSecond: number;
  spawners: Record<UnitRole, SpawnerState>;
  gear: GearState;
  prestige: PrestigeState;
  missions: MissionState[];
  stats: PlayerStats;
  tutorialStep: number;
  tutorialComplete: boolean;
  claimedOfflineAt: number;
}

export interface SettingsState {
  version: 1;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  uiVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  haptics: boolean;
  particles: boolean;
  floatingNumbers: boolean;
  autoAttack: boolean;
  leftHanded: boolean;
  batterySaver: boolean;
}

export interface UnitEntity {
  id: number;
  displayName: string;
  variantId: string;
  team: Team;
  role: UnitRole;
  ageIndex: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  lane: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  cooldown: number;
  attackTimer: number;
  state: 'spawn' | 'move' | 'windup' | 'attack' | 'recover' | 'dead';
  stateTimer: number;
  isHero: boolean;
  isBoss: boolean;
  elite: boolean;
  radius: number;
  targetId: number | null;
  reward: number;
  flash: number;
}

export interface CombatEvent {
  type: 'hit' | 'kill' | 'coin' | 'spawn' | 'capture' | 'boss' | 'mechanic' | 'sector' | 'hero-down';
  x: number;
  y: number;
  value?: number;
  team?: Team;
  label?: string;
  mechanicId?: BossMechanicId;
  stage?: 'warning' | 'impact';
}

export interface SimulationSnapshot {
  state: GameState;
  units: readonly UnitEntity[];
  events: readonly CombatEvent[];
  enemyIntensity: number;
  bossActive: boolean;
  bossMechanicId: BossMechanicId | null;
  bossMechanicPhase: number;
  bossMechanicTimer: number;
  bossMechanicWarning: boolean;
  incomePerSecond: number;
  allyCount: number;
  enemyCount: number;
  heroCooldown: number;
  abilityCooldown: number;
  paused: boolean;
}

export interface OfflineReport {
  elapsedSeconds: number;
  creditedSeconds: number;
  efficiency: number;
  coins: number;
}
