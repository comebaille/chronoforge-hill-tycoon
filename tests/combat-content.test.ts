import { describe, expect, it } from 'vitest';
import { AGES, BOSS_MECHANICS, ENEMY_DECKS, pickEnemyDeckEntry } from '../src/data/content';
import { createDefaultState } from '../src/core/economy';
import { BattleSimulation } from '../src/game/simulation';
import type { BossMechanicId, CombatEvent } from '../src/types';

describe('variété de combat selon les âges', () => {
  it('utilise neuf decks complets, distincts et sélectionnables sans trou', () => {
    expect(ENEMY_DECKS).toHaveLength(AGES.length);
    const signatures = new Set<string>();
    ENEMY_DECKS.forEach((deck, ageIndex) => {
      expect(deck.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100);
      expect(deck.every((entry) => AGES[ageIndex]!.enemies.includes(entry.name))).toBe(true);
      signatures.add(deck.map((entry) => `${entry.role}:${entry.weight}`).join('|'));
      let cursor = 0;
      for (const entry of deck) {
        const picked = pickEnemyDeckEntry(ageIndex, (cursor + entry.weight / 2) / 100);
        expect(picked).toEqual(entry);
        cursor += entry.weight;
      }
    });
    expect(signatures.size).toBe(AGES.length);
    expect(ENEMY_DECKS.slice(4).every((deck) => deck.some((entry) => entry.role === 'siege'))).toBe(true);
  });

  it('télégraphie puis résout une mécanique différente pour chacun des neuf boss', () => {
    const resolvedIds = new Set<BossMechanicId>();
    AGES.forEach((age) => {
      const state = createDefaultState(1000);
      state.ageIndex = age.index;
      state.sectorInAge = 4;
      state.totalSectors = age.index * 5 + 4;
      state.pressure = 58;
      const simulation = new BattleSimulation(state);
      simulation.setAutoAttack(false);
      let warning: CombatEvent | undefined;
      let impact: CombatEvent | undefined;

      for (let tick = 0; tick < 30 * 12 && !impact; tick += 1) {
        simulation.fixedUpdate(1 / 30);
        warning ??= simulation.getSnapshot().events.find((event) => event.type === 'mechanic' && event.stage === 'warning');
        impact = simulation.getSnapshot().events.find((event) => event.type === 'mechanic' && event.stage === 'impact');
      }

      const definition = BOSS_MECHANICS[age.index]!;
      const boss = simulation.getSnapshot().units.find((unit) => unit.isBoss)!;
      expect(boss.displayName).toBe(age.boss);
      expect(warning?.mechanicId).toBe(definition.id);
      expect(impact?.mechanicId).toBe(definition.id);
      expect(warning?.label).toContain(definition.warningLabel);
      expect(impact?.label).toBe(definition.impactLabel);
      expect(simulation.getSnapshot().bossMechanicPhase).toBeGreaterThanOrEqual(1);
      resolvedIds.add(impact!.mechanicId!);
    });
    expect(resolvedIds.size).toBe(AGES.length);
  });

  it('applique concrètement le piratage néon aux spawners actifs', () => {
    const state = createDefaultState(1000);
    state.ageIndex = 7;
    state.sectorInAge = 4;
    state.totalSectors = 39;
    state.pressure = 58;
    state.spawners.assault.level = 1;
    state.spawners.assault.count = 1;
    state.spawners.assault.timer = 100;
    const simulation = new BattleSimulation(state);
    simulation.setAutoAttack(false);
    let timerAtWarning = 0;
    let ticksAfterWarning = 0;
    let warned = false;
    let impacted = false;

    for (let tick = 0; tick < 30 * 12 && !impacted; tick += 1) {
      simulation.fixedUpdate(1 / 30);
      const events = simulation.getSnapshot().events;
      if (!warned && events.some((event) => event.type === 'mechanic' && event.stage === 'warning')) {
        warned = true;
        timerAtWarning = state.spawners.assault.timer;
      } else if (warned) ticksAfterWarning += 1;
      impacted = events.some((event) => event.type === 'mechanic' && event.stage === 'impact');
    }

    expect(warned).toBe(true);
    expect(impacted).toBe(true);
    expect(state.spawners.assault.timer).toBeCloseTo(timerAtWarning - ticksAfterWarning / 30 + 2.4, 6);
  });
});
