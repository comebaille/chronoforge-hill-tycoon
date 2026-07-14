import { createDefaultSettings, createDefaultState, SAVE_VERSION } from '../core/economy';
import type { GameState, SettingsState, UnitRole } from '../types';

const SAVE_KEY = 'chronoforge.save.v3';
const BACKUP_KEY = 'chronoforge.save.backup';
const SETTINGS_KEY = 'chronoforge.settings.v1';

type UnknownRecord = Record<string, unknown>;

const ROLE_IDS = ['assault', 'ranger', 'guardian', 'scout', 'support', 'siege'] as const satisfies readonly UnitRole[];
const GEAR_KEYS = ['heroWeapon', 'heroArmor', 'armyWeapon', 'armyArmor', 'boots', 'banner'] as const satisfies readonly (keyof GameState['gear'])[];
const GEAR_LIMITS: Record<(typeof GEAR_KEYS)[number], number> = {
  heroWeapon: 108,
  heroArmor: 108,
  armyWeapon: 108,
  armyArmor: 108,
  boots: 108,
  banner: 108,
};
const PRESTIGE_IDS = ['damage', 'health', 'logistics', 'income', 'hero', 'offline'] as const satisfies readonly (keyof GameState['prestige']['ranks'])[];
const MISSION_IDS = ['kills', 'hero', 'upgrades'] as const;
const SPAWNER_ORDERS = ['push', 'hero', 'hunt', 'defend'] as const;
const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER;
const MAX_FINITE_VALUE = Number.MAX_VALUE;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInRange(value: unknown, minimum = 0, maximum = MAX_FINITE_VALUE): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isIntegerInRange(value: unknown, minimum = 0, maximum = MAX_SAFE_VALUE): value is number {
  return isFiniteInRange(value, minimum, maximum) && Number.isInteger(value);
}

function isSaveId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 4 && value.length <= 128;
}

function hasRequiredKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  return keys.every((key) => Object.hasOwn(record, key));
}

function numberOr(value: unknown, fallback: number, minimum = 0, maximum = MAX_FINITE_VALUE): number {
  return isFiniteInRange(value, minimum, maximum) ? value : fallback;
}

function integerOr(value: unknown, fallback: number, minimum = 0, maximum = MAX_SAFE_VALUE): number {
  return isIntegerInRange(value, minimum, maximum) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeLegacySpawners(value: unknown, defaults: GameState['spawners']): GameState['spawners'] {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(ROLE_IDS.map((role) => {
    const entry = isRecord(source[role]) ? source[role] : {};
    const fallback = defaults[role];
    const level = integerOr(entry.level, fallback.level, 0, 108);
    const savedCount = integerOr(entry.count, level > 0 ? 1 : fallback.count, 0, 64);
    const count = level === 0 ? 0 : Math.max(1, savedCount);
    const order = SPAWNER_ORDERS.includes(entry.order as (typeof SPAWNER_ORDERS)[number])
      ? entry.order as GameState['spawners'][UnitRole]['order']
      : fallback.order;
    return [role, {
      role,
      level,
      count,
      timer: numberOr(entry.timer, fallback.timer, -MAX_SAFE_VALUE, MAX_SAFE_VALUE),
      order,
    }];
  })) as GameState['spawners'];
}

function normalizeLegacyGear(value: unknown, defaults: GameState['gear']): GameState['gear'] {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(GEAR_KEYS.map((key) => [
    key,
    integerOr(source[key], defaults[key], 0, GEAR_LIMITS[key]),
  ])) as unknown as GameState['gear'];
}

function normalizeLegacyPrestige(value: unknown, defaults: GameState['prestige']): GameState['prestige'] {
  const source = isRecord(value) ? value : {};
  const sourceRanks = isRecord(source.ranks) ? source.ranks : {};
  const crystals = integerOr(source.crystals, defaults.crystals);
  const lifetimeCrystals = Math.max(crystals, integerOr(source.lifetimeCrystals, defaults.lifetimeCrystals));
  const ranks = Object.fromEntries(PRESTIGE_IDS.map((id) => [
    id,
    integerOr(sourceRanks[id], defaults.ranks[id], 0, 10),
  ])) as GameState['prestige']['ranks'];
  return { crystals, lifetimeCrystals, ranks };
}

function normalizeLegacyMissions(value: unknown, defaults: GameState['missions']): GameState['missions'] {
  const source = Array.isArray(value) ? value : [];
  return MISSION_IDS.map((id) => {
    const entry = source.find((candidate) => isRecord(candidate) && candidate.id === id);
    const fallback = defaults.find((mission) => mission.id === id)!;
    if (!isRecord(entry)) return { ...fallback };
    return {
      id,
      progress: numberOr(entry.progress, fallback.progress),
      claimed: booleanOr(entry.claimed, fallback.claimed),
    };
  });
}

function normalizeLegacyStats(value: unknown, defaults: GameState['stats']): GameState['stats'] {
  const source = isRecord(value) ? value : {};
  return {
    kills: integerOr(source.kills, defaults.kills),
    heroKills: integerOr(source.heroKills, defaults.heroKills),
    bosses: integerOr(source.bosses, defaults.bosses),
    coinsEarned: numberOr(source.coinsEarned, defaults.coinsEarned),
    taps: integerOr(source.taps, defaults.taps),
    playSeconds: numberOr(source.playSeconds, defaults.playSeconds),
    highestDps: numberOr(source.highestDps, defaults.highestDps),
  };
}

function normalizeLegacySave(source: UnknownRecord): GameState {
  const defaults = createDefaultState();
  const legacyAge = integerOr(source.ageIndex, defaults.ageIndex, 0, 8);
  const legacySector = integerOr(source.sectorInAge, defaults.sectorInAge, 0, 4);
  const totalSectors = isIntegerInRange(source.totalSectors)
    ? source.totalSectors
    : legacyAge * 5 + legacySector;
  const ageIndex = Math.min(8, Math.floor(totalSectors / 5));
  const sectorInAge = totalSectors % 5;
  const lastActiveAt = integerOr(source.lastActiveAt, defaults.lastActiveAt);
  const updatedAt = integerOr(source.updatedAt, lastActiveAt);

  return {
    version: SAVE_VERSION,
    saveId: isSaveId(source.saveId) ? source.saveId : defaults.saveId,
    updatedAt,
    lastActiveAt,
    coins: numberOr(source.coins, defaults.coins),
    ageIndex,
    sectorInAge,
    totalSectors,
    capture: numberOr(source.capture, defaults.capture, 0, 100),
    pressure: numberOr(source.pressure, defaults.pressure, 0, 100),
    stars: integerOr(source.stars, defaults.stars),
    bestIncomePerSecond: numberOr(source.bestIncomePerSecond, defaults.bestIncomePerSecond),
    spawners: normalizeLegacySpawners(source.spawners, defaults.spawners),
    gear: normalizeLegacyGear(source.gear, defaults.gear),
    prestige: normalizeLegacyPrestige(source.prestige, defaults.prestige),
    missions: normalizeLegacyMissions(source.missions, defaults.missions),
    stats: normalizeLegacyStats(source.stats, defaults.stats),
    tutorialStep: integerOr(source.tutorialStep, defaults.tutorialStep, 0, 6),
    tutorialComplete: booleanOr(source.tutorialComplete, defaults.tutorialComplete),
    claimedOfflineAt: integerOr(source.claimedOfflineAt, lastActiveAt),
  };
}

function migrateV1ToV2(source: UnknownRecord): UnknownRecord {
  return { ...normalizeLegacySave(source), version: 2 };
}

function migrateV2ToV3(source: UnknownRecord): UnknownRecord {
  return normalizeLegacySave(source) as unknown as UnknownRecord;
}

export function migrateSave(value: unknown): GameState | null {
  if (!isRecord(value)) return null;
  let migrated = { ...value };
  const version = Number(migrated.version);
  if (!Number.isInteger(version) || version < 1 || version > SAVE_VERSION) return null;
  if (version < SAVE_VERSION && !isSaveId(migrated.saveId)) return null;
  if (version === 1) migrated = migrateV1ToV2(migrated);
  if (Number(migrated.version) === 2) migrated = migrateV2ToV3(migrated);
  return validateSave(migrated) ? migrated as unknown as GameState : null;
}

export function validateSave(value: UnknownRecord): boolean {
  if (value.version !== SAVE_VERSION) return false;
  if (!isSaveId(value.saveId)) return false;
  if (!isIntegerInRange(value.updatedAt) || !isIntegerInRange(value.lastActiveAt) || !isIntegerInRange(value.claimedOfflineAt)) return false;
  if (!isFiniteInRange(value.coins) || !isFiniteInRange(value.bestIncomePerSecond)) return false;
  if (!isIntegerInRange(value.ageIndex, 0, 8) || !isIntegerInRange(value.sectorInAge, 0, 4) || !isIntegerInRange(value.totalSectors)) return false;
  if (value.ageIndex !== Math.min(8, Math.floor(value.totalSectors / 5)) || value.sectorInAge !== value.totalSectors % 5) return false;
  if (!isFiniteInRange(value.capture, 0, 100) || !isFiniteInRange(value.pressure, 0, 100)) return false;
  if (!isIntegerInRange(value.stars) || !isIntegerInRange(value.tutorialStep, 0, 6) || typeof value.tutorialComplete !== 'boolean') return false;

  if (!isRecord(value.spawners) || !hasRequiredKeys(value.spawners, ROLE_IDS)) return false;
  for (const role of ROLE_IDS) {
    const entry = value.spawners[role];
    if (!isRecord(entry) || entry.role !== role) return false;
    if (!isIntegerInRange(entry.level, 0, 108) || !isIntegerInRange(entry.count, 0, 64)) return false;
    if ((entry.level === 0 && entry.count !== 0) || (entry.level > 0 && entry.count < 1)) return false;
    if (!isFiniteInRange(entry.timer, -MAX_SAFE_VALUE, MAX_SAFE_VALUE)) return false;
    if (!SPAWNER_ORDERS.includes(entry.order as (typeof SPAWNER_ORDERS)[number])) return false;
  }

  if (!isRecord(value.gear) || !hasRequiredKeys(value.gear, GEAR_KEYS)) return false;
  for (const key of GEAR_KEYS) {
    if (!isIntegerInRange(value.gear[key], 0, GEAR_LIMITS[key])) return false;
  }

  if (!isRecord(value.prestige) || !isRecord(value.prestige.ranks)) return false;
  if (!isIntegerInRange(value.prestige.crystals) || !isIntegerInRange(value.prestige.lifetimeCrystals)) return false;
  if (value.prestige.crystals > value.prestige.lifetimeCrystals || !hasRequiredKeys(value.prestige.ranks, PRESTIGE_IDS)) return false;
  for (const id of PRESTIGE_IDS) {
    if (!isIntegerInRange(value.prestige.ranks[id], 0, 10)) return false;
  }

  if (!Array.isArray(value.missions) || value.missions.length !== MISSION_IDS.length) return false;
  const seenMissions = new Set<string>();
  for (const mission of value.missions) {
    if (!isRecord(mission) || !MISSION_IDS.includes(mission.id as (typeof MISSION_IDS)[number]) || seenMissions.has(mission.id as string)) return false;
    if (!isFiniteInRange(mission.progress) || typeof mission.claimed !== 'boolean') return false;
    seenMissions.add(mission.id as string);
  }

  if (!isRecord(value.stats)) return false;
  for (const key of ['kills', 'heroKills', 'bosses', 'taps'] as const) {
    if (!isIntegerInRange(value.stats[key])) return false;
  }
  for (const key of ['coinsEarned', 'playSeconds', 'highestDps'] as const) {
    if (!isFiniteInRange(value.stats[key])) return false;
  }
  return true;
}

function parseStored(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    return migrateSave(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function loadGame(): GameState {
  const primary = parseStored(localStorage.getItem(SAVE_KEY));
  if (primary) return primary;
  const backup = parseStored(localStorage.getItem(BACKUP_KEY));
  if (backup) return backup;
  return createDefaultState();
}

export function saveGame(state: GameState): boolean {
  state.updatedAt = Date.now();
  state.lastActiveAt = state.updatedAt;
  if (!validateSave(state as unknown as UnknownRecord)) return false;
  try {
    const previous = localStorage.getItem(SAVE_KEY);
    if (previous) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): SettingsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return createDefaultSettings();
    return { ...createDefaultSettings(), ...parsed } as SettingsState;
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(settings: SettingsState): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(encoded: string): GameState | null {
  try {
    const raw = decodeURIComponent(escape(atob(encoded.trim())));
    return migrateSave(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(BACKUP_KEY);
}

export const storageKeys = { save: SAVE_KEY, backup: BACKUP_KEY, settings: SETTINGS_KEY } as const;
