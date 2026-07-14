import { AGES, MISSION_DEFS, ROLE_BY_ID, ROLES } from '../data/content';
import type { GameState, OfflineReport, PrestigeUpgradeId, SettingsState, UnitRole } from '../types';

export const SAVE_VERSION = 3 as const;
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export function createDefaultState(now = Date.now()): GameState {
  const spawners = Object.fromEntries(ROLES.map((role) => [role.id, {
    role: role.id,
    level: 0,
    count: 0,
    timer: role.spawnSeconds * 0.45,
    order: 'push' as const,
  }])) as GameState['spawners'];

  return {
    version: SAVE_VERSION,
    saveId: globalThis.crypto?.randomUUID?.() ?? `save-${now}-${Math.random().toString(36).slice(2)}`,
    updatedAt: now,
    lastActiveAt: now,
    coins: 135,
    ageIndex: 0,
    sectorInAge: 0,
    totalSectors: 0,
    capture: 0,
    pressure: 0,
    stars: 0,
    bestIncomePerSecond: 0.35,
    spawners,
    gear: { heroWeapon: 0, heroArmor: 0, armyWeapon: 0, armyArmor: 0, boots: 0, banner: 0 },
    prestige: {
      crystals: 0,
      lifetimeCrystals: 0,
      ranks: { damage: 0, health: 0, logistics: 0, income: 0, hero: 0, offline: 0 },
    },
    missions: MISSION_DEFS.map((mission) => ({ id: mission.id, progress: 0, claimed: false })),
    stats: { kills: 0, heroKills: 0, bosses: 0, coinsEarned: 0, taps: 0, playSeconds: 0, highestDps: 0 },
    tutorialStep: 0,
    tutorialComplete: false,
    claimedOfflineAt: now,
  };
}

export function createDefaultSettings(): SettingsState {
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return {
    version: 1,
    masterVolume: 0.75,
    musicVolume: 0.36,
    effectsVolume: 0.7,
    uiVolume: 0.62,
    muted: false,
    reducedMotion: reduceMotion,
    highContrast: false,
    largeText: false,
    haptics: true,
    particles: true,
    floatingNumbers: true,
    autoAttack: false,
    leftHanded: false,
    batterySaver: false,
  };
}

export function powerScale(ageIndex: number, sectorInAge: number): number {
  return 3.1 ** ageIndex * 1.16 ** sectorInAge;
}

export function moneyScale(ageIndex: number, sectorInAge: number): number {
  return 2.45 ** ageIndex * 1.13 ** sectorInAge;
}

export function killReward(ageIndex: number, sectorInAge: number, multiplier = 1): number {
  return Math.max(1, Math.round(7 * moneyScale(ageIndex, sectorInAge) * multiplier));
}

export function frontierTier(totalSectors: number): number {
  return Math.floor(Math.max(0, totalSectors - 45) / 5);
}

export function frontierEnemyMultiplier(totalSectors: number): number {
  return 1.6 ** frontierTier(totalSectors);
}

export function frontierRewardMultiplier(totalSectors: number): number {
  return 1.45 ** frontierTier(totalSectors);
}

export function spawnerUpgradeCost(state: GameState, role: UnitRole, offset = 0): number {
  const definition = ROLE_BY_ID[role];
  const spawner = state.spawners[role];
  const nextLevel = spawner.level + offset;
  const baseKill = 7 * moneyScale(state.ageIndex, state.sectorInAge) * frontierRewardMultiplier(state.totalSectors);
  const acquisition = spawner.level === 0 ? 12 : 6;
  const copyMultiplier = 1.75 ** Math.max(0, spawner.count - 1);
  return Math.max(10, Math.round(acquisition * baseKill * definition.classCost * copyMultiplier * 1.25 ** nextLevel));
}

export function purchaseSpawnerLevels(state: GameState, role: UnitRole, requested: number): number {
  if (!isRoleUnlocked(state, role) || requested <= 0) return 0;
  const spawner = state.spawners[role];
  let purchased = 0;
  while (purchased < requested && spawner.level < 108) {
    const cost = spawnerUpgradeCost(state, role, purchased);
    if (state.coins + 1e-6 < cost) break;
    state.coins -= cost;
    purchased += 1;
  }
  if (purchased > 0) {
    spawner.level += purchased;
    if (spawner.count === 0) spawner.count = 1;
    incrementMission(state, 'upgrades', purchased);
  }
  return purchased;
}

export type GearKey = keyof GameState['gear'];

export function gearUpgradeCost(state: GameState, key: GearKey): number {
  const rank = state.gear[key];
  const base = key.startsWith('hero') ? 10 : 14;
  return Math.max(18, Math.round(base * 7 * moneyScale(state.ageIndex, 0) * frontierRewardMultiplier(state.totalSectors) * 1.5 ** rank));
}

export function maxGearRank(state: GameState, key: GearKey): number {
  const ranksPerTier = key === 'banner' ? 3 : key === 'heroWeapon' || key === 'heroArmor' ? 4 : 5;
  return Math.min(108, (state.ageIndex + 1 + frontierTier(state.totalSectors)) * ranksPerTier);
}

export function purchaseGear(state: GameState, key: GearKey): boolean {
  if (state.gear[key] >= maxGearRank(state, key)) return false;
  const cost = gearUpgradeCost(state, key);
  if (state.coins < cost) return false;
  state.coins -= cost;
  state.gear[key] += 1;
  incrementMission(state, 'upgrades', 1);
  return true;
}

export function isRoleUnlocked(state: GameState, role: UnitRole): boolean {
  return state.totalSectors >= ROLE_BY_ID[role].unlockSector;
}

export function roleUnlockLabel(role: UnitRole): string {
  const total = ROLE_BY_ID[role].unlockSector;
  const age = Math.floor(total / 5);
  const sector = total % 5;
  return `${AGES[age]?.shortName ?? 'Frontière'} · colline ${sector + 1}`;
}

export function prestigeUpgradeCost(rank: number): number {
  return Math.max(8, Math.floor(8 * 1.65 ** rank));
}

export function buyPrestigeUpgrade(state: GameState, id: PrestigeUpgradeId): boolean {
  const rank = state.prestige.ranks[id];
  if (rank >= 10) return false;
  const cost = prestigeUpgradeCost(rank);
  if (state.prestige.crystals < cost) return false;
  state.prestige.crystals -= cost;
  state.prestige.ranks[id] = rank + 1;
  return true;
}

export function estimatedPrestigeReward(state: GameState): number {
  const agesCompleted = Math.floor(state.totalSectors / 5);
  const bosses = state.stats.bosses;
  return Math.max(0, Math.floor(5 * agesCompleted ** 1.6 + state.totalSectors / 2 + state.stars / 6 + 3 * bosses));
}

export function canPrestige(state: GameState): boolean {
  return state.totalSectors >= 15;
}

export function performPrestige(state: GameState, now = Date.now()): GameState {
  if (!canPrestige(state)) return state;
  const reward = estimatedPrestigeReward(state);
  const fresh = createDefaultState(now);
  fresh.saveId = state.saveId;
  fresh.stars = state.stars;
  fresh.prestige = structuredClone(state.prestige);
  fresh.prestige.crystals += reward;
  fresh.prestige.lifetimeCrystals += reward;
  fresh.stats = { ...fresh.stats, bosses: state.stats.bosses, kills: state.stats.kills, heroKills: state.stats.heroKills, coinsEarned: state.stats.coinsEarned, playSeconds: state.stats.playSeconds };
  fresh.tutorialComplete = true;
  fresh.tutorialStep = 6;
  return fresh;
}

export function calculateOfflineReport(state: GameState, now = Date.now()): OfflineReport {
  const elapsedSeconds = Math.max(0, Math.floor((now - state.lastActiveAt) / 1000));
  const creditedSeconds = Math.min(MAX_OFFLINE_SECONDS, elapsedSeconds);
  const efficiency = Math.min(0.35, 0.1 + state.prestige.ranks.offline * 0.05);
  const coins = elapsedSeconds < 60 ? 0 : Math.floor(state.bestIncomePerSecond * creditedSeconds * efficiency);
  return { elapsedSeconds, creditedSeconds, efficiency, coins };
}

export function claimOfflineReport(state: GameState, now = Date.now()): OfflineReport {
  if (state.claimedOfflineAt >= state.lastActiveAt && state.claimedOfflineAt >= now - 1000) {
    return { elapsedSeconds: 0, creditedSeconds: 0, efficiency: 0, coins: 0 };
  }
  const report = calculateOfflineReport(state, now);
  if (report.coins > 0) {
    state.coins += report.coins;
    state.stats.coinsEarned += report.coins;
  }
  state.lastActiveAt = now;
  state.claimedOfflineAt = now;
  return report;
}

export function incrementMission(state: GameState, id: string, amount: number): void {
  const mission = state.missions.find((entry) => entry.id === id);
  if (mission && !mission.claimed) mission.progress += amount;
}

export function claimMission(state: GameState, id: string): number {
  const definition = MISSION_DEFS.find((mission) => mission.id === id);
  const mission = state.missions.find((entry) => entry.id === id);
  if (!definition || !mission || mission.claimed || mission.progress < definition.target) return 0;
  const reward = Math.round(definition.rewardFactor * killReward(state.ageIndex, state.sectorInAge) * frontierRewardMultiplier(state.totalSectors));
  mission.claimed = true;
  state.coins += reward;
  state.stats.coinsEarned += reward;
  return reward;
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '−' : '';
  const absolute = Math.abs(value);
  if (absolute < 1_000) return `${sign}${Math.floor(absolute).toLocaleString('fr-FR')}`;
  const units = [
    [1e15, 'Q'], [1e12, 'T'], [1e9, 'Md'], [1e6, 'M'], [1e3, 'k'],
  ] as const;
  const unit = units.find(([threshold]) => absolute >= threshold);
  if (!unit) return `${sign}${Math.floor(absolute)}`;
  const scaled = absolute / unit[0];
  return `${sign}${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)} ${unit[1]}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes.toString().padStart(2, '0')}`;
  return `${Math.max(1, minutes)} min`;
}
