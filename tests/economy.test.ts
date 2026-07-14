import { describe, expect, it } from 'vitest';
import {
  MAX_OFFLINE_SECONDS,
  calculateOfflineReport,
  canPrestige,
  claimMission,
  compactNumber,
  createDefaultState,
  frontierEnemyMultiplier,
  frontierRewardMultiplier,
  frontierTier,
  gearUpgradeCost,
  maxGearRank,
  moneyScale,
  performPrestige,
  purchaseSpawnerLevels,
  spawnerUpgradeCost,
} from '../src/core/economy';
import { FIRST_CAMPAIGN_TARGET_MINUTES, ROLES } from '../src/data/content';

describe('économie longue durée', () => {
  it('déclare une cible de campagne très supérieure à vingt minutes', () => {
    expect(FIRST_CAMPAIGN_TARGET_MINUTES).toBeGreaterThan(9 * 60);
    expect(ROLES).toHaveLength(6);
  });

  it('fait croître la monnaie à travers les âges et secteurs', () => {
    expect(moneyScale(0, 1)).toBeGreaterThan(moneyScale(0, 0));
    expect(moneyScale(4, 0)).toBeGreaterThan(moneyScale(3, 4));
  });

  it('augmente la Frontière paradoxale par paliers de cinq collines', () => {
    expect(frontierTier(45)).toBe(0);
    expect(frontierTier(49)).toBe(0);
    expect(frontierTier(50)).toBe(1);
    expect(frontierTier(55)).toBe(2);
    expect(frontierEnemyMultiplier(50)).toBeCloseTo(1.6, 8);
    expect(frontierEnemyMultiplier(55)).toBeCloseTo(1.6 ** 2, 8);
    expect(frontierRewardMultiplier(50)).toBeCloseTo(1.45, 8);
    expect(frontierRewardMultiplier(55)).toBeCloseTo(1.45 ** 2, 8);
  });

  it('indexe coûts, missions et plafonds d’équipement sur la Frontière', () => {
    const baseline = createDefaultState(1000);
    baseline.ageIndex = 8;
    baseline.totalSectors = 45;
    const frontier = createDefaultState(1000);
    frontier.ageIndex = 8;
    frontier.totalSectors = 50;

    expect(spawnerUpgradeCost(frontier, 'assault') / spawnerUpgradeCost(baseline, 'assault')).toBeCloseTo(1.45, 3);
    expect(gearUpgradeCost(frontier, 'heroWeapon') / gearUpgradeCost(baseline, 'heroWeapon')).toBeCloseTo(1.45, 3);
    expect(maxGearRank(baseline, 'heroWeapon')).toBe(36);
    expect(maxGearRank(frontier, 'heroWeapon')).toBe(40);
    frontier.totalSectors = 45 + 100 * 5;
    expect(maxGearRank(frontier, 'armyWeapon')).toBe(108);

    baseline.missions.find((mission) => mission.id === 'kills')!.progress = 50;
    frontier.totalSectors = 50;
    frontier.missions.find((mission) => mission.id === 'kills')!.progress = 50;
    const baselineMission = claimMission(baseline, 'kills');
    const frontierMission = claimMission(frontier, 'kills');
    expect(frontierMission / baselineMission).toBeCloseTo(1.45, 3);
  });

  it('réalise un achat atomique sans solde négatif', () => {
    const state = createDefaultState(1000);
    const cost = spawnerUpgradeCost(state, 'assault');
    state.coins = cost;
    expect(purchaseSpawnerLevels(state, 'assault', 10)).toBe(1);
    expect(state.coins).toBeGreaterThanOrEqual(0);
    expect(state.spawners.assault.level).toBe(1);
    expect(state.spawners.assault.count).toBe(1);
  });

  it('refuse un rôle encore verrouillé sans prélever de pièces', () => {
    const state = createDefaultState(1000);
    state.coins = 1_000_000;
    expect(purchaseSpawnerLevels(state, 'siege', 1)).toBe(0);
    expect(state.coins).toBe(1_000_000);
  });

  it('plafonne les revenus hors ligne à huit heures et sans conquête', () => {
    const now = 100_000_000;
    const state = createDefaultState(now - 72 * 60 * 60 * 1000);
    state.bestIncomePerSecond = 125;
    const report = calculateOfflineReport(state, now);
    expect(report.creditedSeconds).toBe(MAX_OFFLINE_SECONDS);
    expect(report.coins).toBe(Math.floor(125 * MAX_OFFLINE_SECONDS * 0.1));
    expect(state.totalSectors).toBe(0);
  });

  it('conserve l’héritage lors du prestige', () => {
    const state = createDefaultState(1000);
    state.totalSectors = 15;
    state.stats.bosses = 3;
    state.stars = 26;
    expect(canPrestige(state)).toBe(true);
    const fresh = performPrestige(state, 2000);
    expect(fresh.totalSectors).toBe(0);
    expect(fresh.prestige.crystals).toBeGreaterThan(0);
    expect(fresh.stars).toBe(26);
  });

  it('abrège les grands nombres lisiblement', () => {
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(12_500)).toContain('k');
    expect(compactNumber(4_200_000)).toContain('M');
  });
});
