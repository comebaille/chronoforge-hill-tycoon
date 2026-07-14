import { AGES, BOSS_MECHANICS, pickEnemyDeckEntry, ROLE_BY_ID, ROLES } from '../data/content';
import { frontierEnemyMultiplier, frontierRewardMultiplier, incrementMission, killReward, moneyScale, powerScale } from '../core/economy';
import type { BossMechanicId, CombatEvent, GameState, SimulationSnapshot, UnitEntity, UnitRole } from '../types';

const MAX_UNITS = 58;
const ALLY_CAP = 22;
const ENEMY_CAP = 28;
const CAPTURE_MIN_Y = 0.39;
const CAPTURE_MAX_Y = 0.61;
const LANES = [0.29, 0.5, 0.71];

class SeededRandom {
  private value: number;

  constructor(seed: number) {
    this.value = seed >>> 0 || 0x4d595df4;
  }

  next(): number {
    this.value = (Math.imul(1664525, this.value) + 1013904223) >>> 0;
    return this.value / 0x100000000;
  }

  integer(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export class BattleSimulation {
  private units: UnitEntity[] = [];
  private events: CombatEvent[] = [];
  private readonly random: SeededRandom;
  private nextId = 1;
  private enemySpawnTimer = 0.4;
  private targetTimer = 0;
  private pressureWave = 0;
  private heroRespawnTimer = 0;
  private heroCooldown = 0;
  private abilityCooldown = 0;
  private incomeWindow: Array<{ time: number; amount: number }> = [];
  private elapsed = 0;
  private bossSpawnedForSector = false;
  private bossMechanicTimer = 0;
  private bossMechanicPhase = 0;
  private bossMechanicWarning = false;
  private bossMechanicTarget = { x: 0.5, y: 0.5, unitId: null as number | null, lane: 1 };
  private paused = false;
  private autoAttack = true;

  constructor(public state: GameState) {
    this.random = new SeededRandom(state.totalSectors * 104729 + state.stats.kills + 1);
    this.spawnHero();
  }

  setState(state: GameState): void {
    this.state = state;
    this.units = [];
    this.events = [];
    this.bossSpawnedForSector = false;
    this.pressureWave = 0;
    this.resetBossMechanic();
    this.spawnHero();
  }

  setAutoAttack(enabled: boolean): void {
    this.autoAttack = enabled;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  togglePaused(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  fixedUpdate(dt: number): void {
    if (this.paused) return;
    this.elapsed += dt;
    this.state.stats.playSeconds += dt;
    this.heroCooldown = Math.max(0, this.heroCooldown - dt);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.targetTimer -= dt;
    this.events.length = 0;

    this.updateHeroRespawn(dt);
    this.updateSpawners(dt);
    this.updateEnemySpawner(dt);
    if (this.targetTimer <= 0) {
      this.acquireTargets();
      this.targetTimer = 0.16;
    }
    this.updateUnits(dt);
    this.updateBossMechanic(dt);
    this.updateCapture(dt);
    this.cleanupDead();
    this.updateIncomeWindow();

    if (this.autoAttack && this.heroCooldown <= 0) {
      const target = this.closestEnemyToHero();
      if (target && Math.abs(target.y - this.getHeroY()) < 0.18) this.heroStrike(target.x, target.y, false);
    }
  }

  private updateSpawners(dt: number): void {
    const allyPopulation = this.units.filter((unit) => unit.team === 'ally' && !unit.isHero && unit.state !== 'dead')
      .reduce((sum, unit) => sum + ROLE_BY_ID[unit.role].population, 0);
    let available = ALLY_CAP - allyPopulation;

    for (const role of ROLES) {
      const spawner = this.state.spawners[role.id];
      if (spawner.level <= 0 || spawner.count <= 0) continue;
      const cadence = Math.max(0.58, 1 - Math.min(0.18, spawner.level * 0.015));
      const logistics = 1 - this.state.prestige.ranks.logistics * 0.03;
      spawner.timer -= dt * spawner.count;
      if (spawner.timer <= 0 && available >= role.population && this.units.length < MAX_UNITS) {
        this.spawnAlly(role.id);
        available -= role.population;
        spawner.timer += role.spawnSeconds * cadence * logistics * 0.94 ** this.state.gear.banner;
      }
    }
  }

  private updateEnemySpawner(dt: number): void {
    let enemies = this.units.filter((unit) => unit.team === 'enemy' && unit.state !== 'dead').length;
    const bossGate = this.state.sectorInAge === 4 && this.state.pressure >= 58;
    if (bossGate && !this.bossSpawnedForSector && enemies < ENEMY_CAP && this.units.length < MAX_UNITS) {
      this.spawnEnemy(true);
      enemies += 1;
      this.bossSpawnedForSector = true;
      this.events.push({ type: 'boss', x: 0.5, y: 0.12, label: AGES[this.state.ageIndex]?.boss ?? 'Souverain paradoxal' });
    }

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer > 0 || enemies >= ENEMY_CAP || this.units.length >= MAX_UNITS) return;
    const sectorFactor = 1 + this.state.sectorInAge * 0.06;
    const capturePressure = 1 + this.state.capture / 260;
    this.enemySpawnTimer = Math.max(0.72, 2.25 / sectorFactor / capturePressure);
    const count = this.state.capture > 70 && this.random.next() > 0.58 ? 2 : 1;
    const availableSlots = Math.min(ENEMY_CAP - enemies, MAX_UNITS - this.units.length);
    for (let i = 0; i < Math.min(count, availableSlots); i += 1) this.spawnEnemy(false);
  }

  private spawnHero(): void {
    if (this.units.some((unit) => unit.isHero && unit.state !== 'dead')) return;
    const { maxHp, damage } = this.heroStats();
    this.units.push({
      id: this.nextId++, displayName: 'Héros temporel', variantId: `hero:${AGES[this.state.ageIndex]?.id ?? 'embers'}`,
      team: 'ally', role: 'assault', ageIndex: this.state.ageIndex,
      x: 0.5, y: 0.72, previousX: 0.5, previousY: 0.72, lane: 1,
      hp: maxHp, maxHp, damage,
      speed: 0.086, range: 0.09, cooldown: 0.55, attackTimer: 0,
      state: 'spawn', stateTimer: 0.3, isHero: true, isBoss: false, elite: true, radius: 0.028,
      targetId: null, reward: 0, flash: 0,
    });
    this.events.push({ type: 'spawn', x: 0.5, y: 0.72, team: 'ally', label: 'Héros temporel' });
  }

  private heroStats(): { maxHp: number; damage: number } {
    const agePower = powerScale(this.state.ageIndex, 0);
    const prestige = 1 + this.state.prestige.ranks.hero * 0.04;
    return {
      maxHp: 260 * agePower * 1.12 ** this.state.gear.heroArmor * prestige,
      damage: 14 * agePower * 1.1 ** this.state.gear.heroWeapon * prestige,
    };
  }

  refreshHeroStats(preserveHealthRatio = true): boolean {
    const hero = this.units.find((unit) => unit.isHero && unit.state !== 'dead');
    if (!hero) return false;
    const healthRatio = hero.maxHp > 0 ? Math.max(0, Math.min(1, hero.hp / hero.maxHp)) : 1;
    const { maxHp, damage } = this.heroStats();
    hero.ageIndex = this.state.ageIndex;
    hero.displayName = 'Héros temporel';
    hero.variantId = `hero:${AGES[this.state.ageIndex]?.id ?? 'embers'}`;
    hero.maxHp = maxHp;
    hero.hp = preserveHealthRatio ? maxHp * healthRatio : maxHp;
    hero.damage = damage;
    return true;
  }

  private spawnAlly(roleId: UnitRole): void {
    const definition = ROLE_BY_ID[roleId];
    const level = Math.max(1, this.state.spawners[roleId].level);
    const basePower = powerScale(this.state.ageIndex, 0);
    const healthBonus = 1 + this.state.prestige.ranks.health * 0.05;
    const damageBonus = 1 + this.state.prestige.ranks.damage * 0.04;
    const maxHp = 70 * definition.hpMultiplier * basePower * 1.08 ** level * 1.11 ** this.state.gear.armyArmor * healthBonus;
    const lane = this.random.integer(3);
    const x = (LANES[lane] ?? 0.5) + (this.random.next() - 0.5) * 0.025;
    const y = 0.89 + this.random.next() * 0.03;
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    this.units.push({
      id: this.nextId++, displayName: age.allyNames[roleId], variantId: `ally:${age.id}:${roleId}`,
      team: 'ally', role: roleId, ageIndex: this.state.ageIndex,
      x, y, previousX: x, previousY: y, lane,
      hp: maxHp, maxHp,
      damage: 8 * definition.damageMultiplier * basePower * 1.08 ** level * 1.09 ** this.state.gear.armyWeapon * damageBonus,
      speed: 0.064 * definition.speedMultiplier * 1.04 ** this.state.gear.boots,
      range: definition.range, cooldown: roleId === 'siege' ? 2.15 : roleId === 'ranger' ? 1.25 : 0.88,
      attackTimer: this.random.next() * 0.3, state: 'spawn', stateTimer: 0.24,
      isHero: false, isBoss: false, elite: level % 4 === 0, radius: roleId === 'guardian' || roleId === 'siege' ? 0.026 : 0.021,
      targetId: null, reward: 0, flash: 0,
    });
    this.events.push({ type: 'spawn', x, y, team: 'ally' });
  }

  private spawnEnemy(isBoss: boolean): void {
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    const deckEntry = pickEnemyDeckEntry(this.state.ageIndex, this.random.next());
    const role: UnitRole = isBoss ? 'guardian' : deckEntry.role;
    const definition = ROLE_BY_ID[role];
    const scale = powerScale(this.state.ageIndex, this.state.sectorInAge) * frontierEnemyMultiplier(this.state.totalSectors);
    const elite = !isBoss && this.random.next() < 0.06 + this.state.sectorInAge * 0.014;
    const typeHp = isBoss ? 18 : elite ? 3.3 : role === 'guardian' ? 2.3 : role === 'siege' ? 1.55 : role === 'support' ? 0.85 : role === 'scout' ? 0.78 : role === 'ranger' ? 0.72 : 1;
    const typeDps = isBoss ? 2.2 : elite ? 1.45 : role === 'ranger' ? 1.25 : 1;
    const maxHp = 52 * scale * typeHp;
    const lane = isBoss ? 1 : this.random.integer(3);
    const x = (LANES[lane] ?? 0.5) + (this.random.next() - 0.5) * 0.025;
    const y = isBoss ? 0.1 : 0.06 + this.random.next() * 0.04;
    const rewardMultiplier = isBoss ? 60 : elite ? 5 : role === 'guardian' ? 2 : role === 'support' ? 1.5 : role === 'ranger' ? 1.1 : 1;
    const displayName = isBoss ? age.boss : elite ? `${deckEntry.name} d’élite` : deckEntry.name;
    this.units.push({
      id: this.nextId++, displayName, variantId: isBoss ? `boss:${age.id}` : `enemy:${age.id}:${role}:${deckEntry.name}`,
      team: 'enemy', role, ageIndex: this.state.ageIndex,
      x, y, previousX: x, previousY: y, lane,
      hp: maxHp, maxHp, damage: 5.2 * scale ** 0.88 * definition.damageMultiplier * typeDps,
      speed: (isBoss ? 0.026 : 0.052) * definition.speedMultiplier,
      range: definition.range, cooldown: isBoss ? 1.75 : role === 'siege' ? 2.15 : role === 'ranger' ? 1.35 : 0.95,
      attackTimer: 0.5 + this.random.next() * 0.5, state: 'spawn', stateTimer: isBoss ? 0.8 : 0.24,
      isHero: false, isBoss, elite, radius: isBoss ? 0.055 : role === 'guardian' ? 0.029 : 0.021,
      targetId: null, reward: Math.round(killReward(this.state.ageIndex, this.state.sectorInAge, rewardMultiplier) * frontierRewardMultiplier(this.state.totalSectors)), flash: 0,
    });
    if (isBoss) this.resetBossMechanic(true);
    this.events.push({ type: 'spawn', x, y, team: 'enemy' });
  }

  private resetBossMechanic(active = false): void {
    const mechanic = BOSS_MECHANICS[this.state.ageIndex] ?? BOSS_MECHANICS[0]!;
    this.bossMechanicTimer = active ? mechanic.intervalSeconds : 0;
    this.bossMechanicPhase = 0;
    this.bossMechanicWarning = false;
    this.bossMechanicTarget = { x: 0.5, y: 0.5, unitId: null, lane: 1 };
  }

  private updateBossMechanic(dt: number): void {
    const boss = this.units.find((unit) => unit.isBoss && unit.state !== 'dead');
    if (!boss) {
      this.bossMechanicWarning = false;
      return;
    }
    const mechanic = BOSS_MECHANICS[this.state.ageIndex] ?? BOSS_MECHANICS[0]!;
    this.bossMechanicTimer -= dt;
    if (!this.bossMechanicWarning && this.bossMechanicTimer <= mechanic.warningSeconds) {
      this.prepareBossMechanic(boss, mechanic.id);
      this.bossMechanicWarning = true;
      this.events.push({
        type: 'mechanic', x: this.bossMechanicTarget.x, y: this.bossMechanicTarget.y,
        label: `⚠ ${mechanic.warningLabel}`, mechanicId: mechanic.id, stage: 'warning',
      });
    }
    if (this.bossMechanicTimer > 0) return;
    const value = this.resolveBossMechanic(boss, mechanic.id);
    this.events.push({
      type: 'mechanic', x: this.bossMechanicTarget.x, y: this.bossMechanicTarget.y,
      value, label: mechanic.impactLabel, mechanicId: mechanic.id, stage: 'impact',
    });
    this.bossMechanicPhase += 1;
    this.bossMechanicTimer = mechanic.intervalSeconds * (boss.hp / boss.maxHp < 0.45 ? 0.82 : 1);
    this.bossMechanicWarning = false;
  }

  private prepareBossMechanic(boss: UnitEntity, mechanicId: BossMechanicId): void {
    const allies = this.units.filter((unit) => unit.team === 'ally' && unit.state !== 'dead');
    const hero = allies.find((unit) => unit.isHero);
    const target = mechanicId === 'airstrike'
      ? hero ?? allies[0]
      : allies.length > 0 ? allies[this.bossMechanicPhase % allies.length] : undefined;
    const usesLane = mechanicId === 'burning-oil' || mechanicId === 'broadside';
    const lane = usesLane ? this.bossMechanicPhase % LANES.length : target?.lane ?? 1;
    this.bossMechanicTarget = {
      x: usesLane ? LANES[lane] ?? 0.5 : target?.x ?? boss.x,
      y: usesLane ? 0.5 : target?.y ?? boss.y,
      unitId: target?.id ?? null,
      lane,
    };
  }

  private resolveBossMechanic(boss: UnitEntity, mechanicId: BossMechanicId): number {
    const allies = this.units.filter((unit) => unit.team === 'ally' && unit.state !== 'dead');
    const enemies = this.units.filter((unit) => unit.team === 'enemy' && unit.state !== 'dead' && !unit.isBoss);
    let affected = 0;
    if (mechanicId === 'rockfall') {
      for (const unit of [...allies]) {
        if (Math.hypot(unit.x - this.bossMechanicTarget.x, unit.y - this.bossMechanicTarget.y) <= 0.14) {
          this.dealDamage(boss, unit, unit.maxHp * 0.08);
          affected += 1;
        }
      }
    } else if (mechanicId === 'bull-rush') {
      const target = allies.find((unit) => unit.id === this.bossMechanicTarget.unitId)
        ?? allies.sort((a, b) => Math.hypot(a.x - this.bossMechanicTarget.x, a.y - this.bossMechanicTarget.y) - Math.hypot(b.x - this.bossMechanicTarget.x, b.y - this.bossMechanicTarget.y))[0];
      const dx = this.bossMechanicTarget.x - boss.x;
      const dy = this.bossMechanicTarget.y - boss.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const dash = Math.min(0.16, distance);
      boss.x = Math.max(0.18, Math.min(0.82, boss.x + dx / distance * dash));
      boss.y = Math.max(0.045, Math.min(0.945, boss.y + dy / distance * dash));
      if (target && Math.hypot(target.x - boss.x, target.y - boss.y) < 0.3) {
        this.dealDamage(boss, target, target.maxHp * 0.12);
        affected = 1;
      }
    } else if (mechanicId === 'war-banner') {
      for (const unit of enemies) {
        unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.15);
        unit.attackTimer *= 0.45;
        affected += 1;
      }
      if (affected === 0) boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.04);
    } else if (mechanicId === 'burning-oil') {
      for (const unit of [...allies]) {
        if (Math.abs(unit.x - this.bossMechanicTarget.x) <= 0.14 && unit.y >= 0.35 && unit.y <= 0.65) {
          this.dealDamage(boss, unit, unit.maxHp * 0.08);
          unit.y = Math.min(0.945, unit.y + 0.07);
          affected += 1;
        }
      }
    } else if (mechanicId === 'broadside') {
      for (const unit of [...allies]) {
        if (Math.abs(unit.x - this.bossMechanicTarget.x) <= 0.12) {
          this.dealDamage(boss, unit, unit.maxHp * 0.1);
          affected += 1;
        }
      }
    } else if (mechanicId === 'overheat') {
      const damage = Math.max(0, Math.min(boss.maxHp * 0.06, boss.hp - 1));
      boss.hp -= damage;
      boss.flash = 1;
      this.events.push({ type: 'hit', x: boss.x, y: boss.y, value: damage, team: 'enemy' });
      affected = Math.round(damage);
    } else if (mechanicId === 'airstrike') {
      const target = allies.find((unit) => unit.id === this.bossMechanicTarget.unitId)
        ?? allies.sort((a, b) => Math.hypot(a.x - this.bossMechanicTarget.x, a.y - this.bossMechanicTarget.y) - Math.hypot(b.x - this.bossMechanicTarget.x, b.y - this.bossMechanicTarget.y))[0];
      if (target) {
        this.dealDamage(boss, target, target.maxHp * 0.15);
        affected = 1;
      }
    } else if (mechanicId === 'spawner-hack') {
      for (const role of ROLES) {
        const spawner = this.state.spawners[role.id];
        if (spawner.level <= 0 || spawner.count <= 0) continue;
        spawner.timer += 2.4;
        affected += 1;
      }
    } else {
      const previousHp = boss.hp;
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.08);
      for (const unit of allies) {
        unit.y = Math.min(0.945, unit.y + 0.1);
        affected += 1;
      }
      if (boss.hp > previousHp) affected += 1;
    }
    return affected;
  }

  private acquireTargets(): void {
    const living = this.units.filter((unit) => unit.state !== 'dead');
    for (const unit of living) {
      const candidates = living.filter((candidate) => candidate.team !== unit.team && candidate.state !== 'dead');
      if (candidates.length === 0) {
        unit.targetId = null;
        continue;
      }
      const definition = ROLE_BY_ID[unit.role];
      candidates.sort((a, b) => this.targetScore(unit, a, definition.targeting) - this.targetScore(unit, b, definition.targeting));
      unit.targetId = candidates[0]?.id ?? null;
    }
  }

  private targetScore(source: UnitEntity, target: UnitEntity, strategy: string): number {
    const distance = Math.hypot(source.x - target.x, source.y - target.y);
    if (strategy === 'weakest') return distance * 0.55 + target.hp / target.maxHp * 0.18;
    if (strategy === 'backline') return distance + (target.role === 'ranger' || target.role === 'support' ? -0.34 : 0);
    if (strategy === 'cluster') return distance + (target.isBoss ? -0.08 : 0);
    return distance + (target.isHero ? -0.05 : 0);
  }

  private updateUnits(dt: number): void {
    for (const unit of this.units) {
      unit.previousX = unit.x;
      unit.previousY = unit.y;
      unit.flash = Math.max(0, unit.flash - dt * 5);
      unit.attackTimer = Math.max(0, unit.attackTimer - dt);
      unit.stateTimer -= dt;
      if (unit.state === 'dead') continue;
      if (unit.state === 'spawn') {
        if (unit.stateTimer <= 0) unit.state = 'move';
        continue;
      }

      const target = unit.targetId ? this.units.find((candidate) => candidate.id === unit.targetId && candidate.state !== 'dead') : undefined;
      if (unit.state === 'windup') {
        if (unit.stateTimer <= 0) {
          unit.state = 'attack';
          unit.stateTimer = 0.04;
          if (target) this.resolveAttack(unit, target);
        }
        continue;
      }
      if (unit.state === 'attack') {
        if (unit.stateTimer <= 0) {
          unit.state = 'recover';
          unit.stateTimer = unit.cooldown * 0.28;
        }
        continue;
      }
      if (unit.state === 'recover') {
        if (unit.stateTimer <= 0) unit.state = 'move';
        continue;
      }

      if (unit.role === 'support') this.applySupportAura(unit, dt);
      if (target) {
        const distance = Math.hypot(unit.x - target.x, unit.y - target.y);
        if (distance <= unit.range + target.radius + unit.radius && unit.attackTimer <= 0) {
          unit.state = 'windup';
          unit.stateTimer = unit.isBoss ? 0.46 : unit.role === 'siege' ? 0.38 : 0.16;
          unit.attackTimer = unit.cooldown;
          continue;
        }
        this.moveToward(unit, target.x, target.y, dt);
      } else {
        const destinationY = unit.team === 'ally' ? 0.32 : 0.68;
        this.moveToward(unit, LANES[unit.lane] ?? 0.5, destinationY, dt);
      }
      unit.y = Math.max(0.045, Math.min(0.945, unit.y));
      unit.x = Math.max(0.18, Math.min(0.82, unit.x));
    }
  }

  private moveToward(unit: UnitEntity, targetX: number, targetY: number, dt: number): void {
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return;
    const speed = unit.speed * dt;
    unit.x += dx / distance * speed;
    unit.y += dy / distance * speed;
  }

  private resolveAttack(attacker: UnitEntity, target: UnitEntity): void {
    if (target.state === 'dead') return;
    const damage = attacker.damage * attacker.cooldown;
    if (attacker.role === 'support') {
      const injured = this.units
        .filter((unit) => unit.team === attacker.team && unit.state !== 'dead' && unit.hp < unit.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (injured) injured.hp = Math.min(injured.maxHp, injured.hp + damage * 0.9);
      return;
    }
    this.dealDamage(attacker, target, damage);
    if (attacker.role === 'siege') {
      for (const splashTarget of this.units) {
        if (splashTarget.team === target.team && splashTarget.id !== target.id && splashTarget.state !== 'dead' && Math.hypot(splashTarget.x - target.x, splashTarget.y - target.y) < 0.095) {
          this.dealDamage(attacker, splashTarget, damage * 0.42);
        }
      }
    }
  }

  private dealDamage(attacker: UnitEntity, target: UnitEntity, damage: number): void {
    target.hp -= damage;
    target.flash = 1;
    this.events.push({ type: 'hit', x: target.x, y: target.y, value: damage, team: target.team });
    if (target.hp <= 0) this.killUnit(target, attacker);
  }

  private killUnit(target: UnitEntity, attacker: UnitEntity): void {
    if (target.state === 'dead') return;
    target.hp = 0;
    target.state = 'dead';
    target.stateTimer = 0.42;
    this.events.push({ type: 'kill', x: target.x, y: target.y, team: target.team });
    if (target.team === 'enemy') {
      const heroBonus = attacker.isHero ? 1.25 : 1;
      const incomeBonus = 1 + this.state.prestige.ranks.income * 0.05;
      const reward = Math.round(target.reward * heroBonus * incomeBonus);
      this.state.coins += reward;
      this.state.stats.coinsEarned += reward;
      this.state.stats.kills += 1;
      if (attacker.isHero) {
        this.state.stats.heroKills += 1;
        incrementMission(this.state, 'hero', 1);
      }
      incrementMission(this.state, 'kills', 1);
      this.state.pressure = Math.min(100, this.state.pressure + (target.isBoss ? 35 : target.elite ? 20 : 5));
      if (target.isBoss) this.state.stats.bosses += 1;
      this.incomeWindow.push({ time: this.elapsed, amount: reward });
      this.events.push({ type: 'coin', x: target.x, y: target.y, value: reward, team: 'ally' });
    } else if (target.isHero) {
      this.heroRespawnTimer = 6;
      this.events.push({ type: 'hero-down', x: target.x, y: target.y, label: 'Héros à terre · retour dans 6 s' });
    }
  }

  private applySupportAura(source: UnitEntity, dt: number): void {
    for (const unit of this.units) {
      if (unit.team !== source.team || unit.state === 'dead' || unit.hp >= unit.maxHp) continue;
      if (Math.hypot(source.x - unit.x, source.y - unit.y) < 0.12) unit.hp = Math.min(unit.maxHp, unit.hp + source.damage * 0.11 * dt);
    }
  }

  private updateCapture(dt: number): void {
    if (this.state.pressure < 100) return;
    let alliedWeight = 0;
    let enemyWeight = 0;
    for (const unit of this.units) {
      if (unit.state === 'dead' || unit.y < CAPTURE_MIN_Y || unit.y > CAPTURE_MAX_Y) continue;
      const weight = unit.isHero ? 2 : unit.isBoss ? 3 : unit.role === 'guardian' ? 1.5 : 1;
      if (unit.team === 'ally') alliedWeight += weight;
      else enemyWeight += weight;
    }
    const delta = 4 * Math.max(-3, Math.min(3, alliedWeight - enemyWeight)) * dt;
    this.state.capture = Math.max(0, Math.min(100, this.state.capture + delta));
    const wave = Math.floor(this.state.capture / 25);
    if (wave > this.pressureWave && wave < 4) {
      this.pressureWave = wave;
      this.enemySpawnTimer = 0;
      this.events.push({ type: 'capture', x: 0.5, y: 0.48, value: wave * 25, label: `Contre-vague à ${wave * 25} %` });
    }
    const livingBoss = this.units.some((unit) => unit.isBoss && unit.state !== 'dead');
    if (this.state.capture >= 100 && (this.state.sectorInAge !== 4 || !livingBoss)) this.completeSector();
  }

  private completeSector(): void {
    const isCapital = this.state.sectorInAge === 4;
    const factor = isCapital ? 80 : 25;
    const reward = Math.round(factor * 7 * moneyScale(this.state.ageIndex, this.state.sectorInAge) * frontierRewardMultiplier(this.state.totalSectors));
    this.state.coins += reward;
    this.state.stats.coinsEarned += reward;
    this.state.stars += 1;
    this.state.totalSectors += 1;
    this.state.sectorInAge += 1;
    if (this.state.sectorInAge >= 5) {
      this.state.sectorInAge = 0;
      this.state.ageIndex = Math.min(AGES.length - 1, this.state.ageIndex + 1);
    }
    this.state.capture = 0;
    this.state.pressure = 0;
    this.pressureWave = 0;
    this.bossSpawnedForSector = false;
    this.resetBossMechanic();
    for (const unit of this.units) {
      if (!unit.isHero) unit.state = 'dead';
      else {
        unit.x = 0.5;
        unit.y = 0.72;
      }
    }
    this.refreshHeroStats(false);
    this.events.push({ type: 'sector', x: 0.5, y: 0.46, value: reward, label: isCapital ? 'Âge conquis !' : 'Colline conquise !' });
  }

  private updateHeroRespawn(dt: number): void {
    if (this.heroRespawnTimer <= 0) return;
    this.heroRespawnTimer -= dt;
    if (this.heroRespawnTimer <= 0) this.spawnHero();
  }

  private cleanupDead(): void {
    this.units = this.units.filter((unit) => unit.state !== 'dead' || unit.stateTimer > 0);
  }

  private updateIncomeWindow(): void {
    const cutoff = this.elapsed - 10;
    this.incomeWindow = this.incomeWindow.filter((entry) => entry.time >= cutoff);
    const total = this.incomeWindow.reduce((sum, entry) => sum + entry.amount, 0);
    const income = total / Math.min(10, Math.max(1, this.elapsed));
    this.state.bestIncomePerSecond = Math.max(this.state.bestIncomePerSecond, income, 0.35 * 2.45 ** this.state.ageIndex * frontierRewardMultiplier(this.state.totalSectors));
  }

  private closestEnemyToHero(): UnitEntity | undefined {
    const hero = this.units.find((unit) => unit.isHero && unit.state !== 'dead');
    if (!hero) return undefined;
    return this.units
      .filter((unit) => unit.team === 'enemy' && unit.state !== 'dead')
      .sort((a, b) => Math.hypot(hero.x - a.x, hero.y - a.y) - Math.hypot(hero.x - b.x, hero.y - b.y))[0];
  }

  private getHeroY(): number {
    return this.units.find((unit) => unit.isHero && unit.state !== 'dead')?.y ?? 0.72;
  }

  heroStrike(x = 0.5, y = 0.5, manual = true): boolean {
    if (this.paused || this.heroCooldown > 0) return false;
    const hero = this.units.find((unit) => unit.isHero && unit.state !== 'dead');
    if (!hero) return false;
    const enemies = this.units.filter((unit) => unit.team === 'enemy' && unit.state !== 'dead');
    const target = enemies.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (!target) return false;
    this.heroCooldown = 0.48;
    hero.x += (target.x - hero.x) * 0.08;
    hero.y += (target.y - hero.y) * 0.08;
    this.dealDamage(hero, target, hero.damage * 1.9);
    if (manual) {
      this.state.stats.taps += 1;
      incrementMission(this.state, 'hero', 1);
    }
    return true;
  }

  useChronoBurst(): boolean {
    if (this.paused || this.abilityCooldown > 0) return false;
    const hero = this.units.find((unit) => unit.isHero && unit.state !== 'dead');
    if (!hero) return false;
    this.abilityCooldown = 12;
    for (const target of [...this.units]) {
      if (target.team === 'enemy' && target.state !== 'dead' && Math.hypot(target.x - hero.x, target.y - hero.y) < 0.28) {
        this.dealDamage(hero, target, hero.damage * 3.1);
      }
    }
    this.events.push({ type: 'capture', x: hero.x, y: hero.y, value: 0, label: 'Onde chronale' });
    return true;
  }

  getSnapshot(): SimulationSnapshot {
    const allyCount = this.units.filter((unit) => unit.team === 'ally' && unit.state !== 'dead').length;
    const enemyCount = this.units.filter((unit) => unit.team === 'enemy' && unit.state !== 'dead').length;
    const recentIncome = this.incomeWindow.reduce((sum, entry) => sum + entry.amount, 0) / Math.min(10, Math.max(1, this.elapsed));
    const bossActive = this.units.some((unit) => unit.isBoss && unit.state !== 'dead');
    const mechanic = BOSS_MECHANICS[this.state.ageIndex] ?? BOSS_MECHANICS[0]!;
    return {
      state: this.state,
      units: this.units,
      events: this.events,
      enemyIntensity: Math.min(1, enemyCount / ENEMY_CAP),
      bossActive,
      bossMechanicId: bossActive ? mechanic.id : null,
      bossMechanicPhase: this.bossMechanicPhase,
      bossMechanicTimer: this.bossMechanicTimer,
      bossMechanicWarning: this.bossMechanicWarning,
      incomePerSecond: recentIncome,
      allyCount,
      enemyCount,
      heroCooldown: this.heroCooldown,
      abilityCooldown: this.abilityCooldown,
      paused: this.paused,
    };
  }
}
