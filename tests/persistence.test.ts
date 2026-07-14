import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/core/economy';
import { exportSave, importSave, migrateSave } from '../src/services/storage';

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

describe('sauvegarde versionnée', () => {
  it('exporte et importe une sauvegarde courante', () => {
    const state = createDefaultState(10_000);
    state.coins = 4242;
    state.spawners.assault.level = 3;
    state.spawners.assault.count = 1;
    state.gear.banner = 108;
    const imported = importSave(exportSave(state));
    expect(imported?.coins).toBe(4242);
    expect(imported?.spawners.assault.level).toBe(3);
    expect(imported?.gear.banner).toBe(108);
  });

  it('rejette une donnée corrompue ou future', () => {
    expect(importSave('pas-une-sauvegarde')).toBeNull();
    expect(migrateSave({ version: 99, saveId: 'future' })).toBeNull();
  });

  it('rejette un import v3 incomplet ou imbriqué corrompu', () => {
    const current = createDefaultState(1234);
    const incomplete = { ...current, prestige: { crystals: 0, lifetimeCrystals: 0 } };
    const corrupted = {
      ...current,
      spawners: {
        ...current.spawners,
        assault: { ...current.spawners.assault, level: 4, count: 0 },
      },
    };

    expect(importSave(encode(incomplete))).toBeNull();
    expect(importSave(encode(corrupted))).toBeNull();
  });

  it('migre une vraie sauvegarde v1 minimale vers un état v3 complet', () => {
    const legacy = {
      version: 1,
      saveId: 'legacy-minimal',
      coins: 777,
      ageIndex: 1,
      sectorInAge: 2,
      spawners: {
        assault: { level: 3 },
      },
    };
    const migrated = migrateSave(legacy);

    expect(migrated?.version).toBe(3);
    expect(migrated?.coins).toBe(777);
    expect(migrated?.totalSectors).toBe(7);
    expect(migrated?.ageIndex).toBe(1);
    expect(migrated?.sectorInAge).toBe(2);
    expect(migrated?.spawners.assault).toMatchObject({ role: 'assault', level: 3, count: 1, order: 'push' });
    expect(migrated?.spawners.siege).toMatchObject({ role: 'siege', level: 0, count: 0 });
    expect(migrated?.prestige.crystals).toBe(0);
    expect(migrated?.missions).toHaveLength(3);
    expect(migrated?.stats).toMatchObject({ kills: 0, heroKills: 0, bosses: 0 });
    expect(migrated?.gear).toMatchObject({ heroWeapon: 0, heroArmor: 0, armyWeapon: 0, armyArmor: 0, boots: 0, banner: 0 });
  });
});
