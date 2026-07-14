import { describe, expect, it } from 'vitest';
import { createDefaultState, purchaseSpawnerLevels } from '../src/core/economy';
import { BattleSimulation } from '../src/game/simulation';
import type { UnitEntity } from '../src/types';

function runTicks(simulation: BattleSimulation, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) simulation.fixedUpdate(1 / 30);
}

describe('simulation de bataille', () => {
  it('produit alliés et ennemis sans dépasser le budget d’entités', () => {
    const state = createDefaultState(1000);
    state.coins = 100_000;
    purchaseSpawnerLevels(state, 'assault', 8);
    const simulation = new BattleSimulation(state);
    simulation.setAutoAttack(false);
    runTicks(simulation, 30 * 3);
    expect(simulation.getSnapshot().enemyCount).toBeGreaterThan(0);
    runTicks(simulation, 30 * 42);
    const snapshot = simulation.getSnapshot();
    expect(snapshot.allyCount).toBeGreaterThan(1);
    expect(snapshot.units.length).toBeLessThanOrEqual(58);
    expect(snapshot.state.coins).toBeGreaterThanOrEqual(0);
  });

  it('respecte pause et reprise', () => {
    const state = createDefaultState(1000);
    const simulation = new BattleSimulation(state);
    simulation.setPaused(true);
    runTicks(simulation, 300);
    expect(state.stats.playSeconds).toBe(0);
    simulation.setPaused(false);
    runTicks(simulation, 30);
    expect(state.stats.playSeconds).toBeCloseTo(1, 4);
  });

  it('donne un cooldown clair à la frappe et à l’onde chronale', () => {
    const state = createDefaultState(1000);
    const simulation = new BattleSimulation(state);
    simulation.setAutoAttack(false);
    runTicks(simulation, 120);
    expect(simulation.heroStrike()).toBe(true);
    expect(simulation.heroStrike()).toBe(false);
    expect(simulation.useChronoBurst()).toBe(true);
    expect(simulation.useChronoBurst()).toBe(false);
  });

  it('rafraîchit le héros après un achat en conservant son ratio de PV', () => {
    const state = createDefaultState(1000);
    const simulation = new BattleSimulation(state);
    const hero = simulation.getSnapshot().units.find((unit) => unit.isHero)!;
    const initialMaxHp = hero.maxHp;
    const initialDamage = hero.damage;
    hero.hp = hero.maxHp * 0.4;
    state.gear.heroArmor += 1;
    state.gear.heroWeapon += 1;

    expect(simulation.refreshHeroStats()).toBe(true);
    expect(hero.maxHp).toBeCloseTo(initialMaxHp * 1.12, 8);
    expect(hero.damage).toBeCloseTo(initialDamage * 1.1, 8);
    expect(hero.hp / hero.maxHp).toBeCloseTo(0.4, 8);
  });

  it('attend la mort du boss avant de valider une capitale et actualise le héros au nouvel âge', () => {
    const state = createDefaultState(1000);
    state.sectorInAge = 4;
    state.totalSectors = 4;
    state.pressure = 100;
    state.capture = 100;
    const simulation = new BattleSimulation(state);
    const initialHeroMaxHp = simulation.getSnapshot().units.find((unit) => unit.isHero)!.maxHp;

    simulation.fixedUpdate(1 / 30);
    const boss = simulation.getSnapshot().units.find((unit) => unit.isBoss)!;
    expect(boss).toBeDefined();
    expect(state.totalSectors).toBe(4);
    expect(state.sectorInAge).toBe(4);

    boss.state = 'dead';
    boss.stateTimer = 0;
    simulation.fixedUpdate(1 / 30);

    const hero = simulation.getSnapshot().units.find((unit) => unit.isHero && unit.state !== 'dead')!;
    expect(state.totalSectors).toBe(5);
    expect(state.ageIndex).toBe(1);
    expect(state.sectorInAge).toBe(0);
    expect(hero.maxHp).toBeCloseTo(initialHeroMaxHp * 3.1, 8);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('donne au boss un poids de capture prioritaire de 3 malgré son rôle Gardien', () => {
    const state = createDefaultState(1000);
    state.sectorInAge = 4;
    state.totalSectors = 4;
    state.pressure = 100;
    state.capture = 50;
    const simulation = new BattleSimulation(state);
    simulation.fixedUpdate(1 / 30);
    const hero = simulation.getSnapshot().units.find((unit) => unit.isHero)!;
    const boss = simulation.getSnapshot().units.find((unit) => unit.isBoss)!;
    hero.x = 0.5;
    hero.y = 0.5;
    boss.x = 0.5;
    boss.y = 0.5;
    const before = state.capture;

    simulation.fixedUpdate(1 / 30);

    expect(state.capture).toBeCloseTo(before - 4 / 30, 8);
  });

  it('ne laisse jamais le spawner ennemi dépasser 58 entités', () => {
    const state = createDefaultState(1000);
    const simulation = new BattleSimulation(state);
    const units = simulation.getSnapshot().units as UnitEntity[];
    const hero = units[0]!;
    for (let index = 0; index < 57; index += 1) {
      units.push({
        ...hero,
        id: 10_000 + index,
        isHero: false,
        state: 'dead',
        stateTimer: 10,
      });
    }

    runTicks(simulation, 30);
    expect(simulation.getSnapshot().units).toHaveLength(58);
    expect(simulation.getSnapshot().enemyCount).toBe(0);
  });

  it('renforce réellement ennemis et primes dans la Frontière paradoxale', () => {
    const baseline = createDefaultState(1000);
    baseline.ageIndex = 8;
    baseline.totalSectors = 45;
    baseline.stats.kills = 5 * 104_729;
    const frontier = createDefaultState(1000);
    frontier.ageIndex = 8;
    frontier.totalSectors = 50;
    const baselineSimulation = new BattleSimulation(baseline);
    const frontierSimulation = new BattleSimulation(frontier);
    baselineSimulation.setAutoAttack(false);
    frontierSimulation.setAutoAttack(false);

    runTicks(baselineSimulation, 13);
    runTicks(frontierSimulation, 13);
    const baselineEnemy = baselineSimulation.getSnapshot().units.find((unit) => unit.team === 'enemy')!;
    const frontierEnemy = frontierSimulation.getSnapshot().units.find((unit) => unit.team === 'enemy')!;

    expect(frontierEnemy.role).toBe(baselineEnemy.role);
    expect(frontierEnemy.displayName).toBe(baselineEnemy.displayName);
    expect(frontierEnemy.elite).toBe(baselineEnemy.elite);
    expect(frontierEnemy.maxHp / baselineEnemy.maxHp).toBeCloseTo(1.6, 8);
    expect(frontierEnemy.reward / baselineEnemy.reward).toBeCloseTo(1.45, 3);
  });
});
