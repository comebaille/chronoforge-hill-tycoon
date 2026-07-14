import { AGES, FIRST_CAMPAIGN_TARGET_MINUTES, HILL_NAMES, MISSION_DEFS, PRESTIGE_UPGRADES, ROLE_BY_ID, ROLES } from '../data/content';
import {
  buyPrestigeUpgrade,
  calculateOfflineReport,
  canPrestige,
  claimMission,
  claimOfflineReport,
  compactNumber,
  createDefaultState,
  estimatedPrestigeReward,
  formatDuration,
  frontierTier,
  gearUpgradeCost,
  isRoleUnlocked,
  maxGearRank,
  performPrestige,
  prestigeUpgradeCost,
  purchaseGear,
  purchaseSpawnerLevels,
  roleUnlockLabel,
  spawnerUpgradeCost,
  type GearKey,
} from '../core/economy';
import { BattleSimulation } from '../game/simulation';
import { CanvasRenderer } from '../render/renderer';
import { AudioManager } from '../services/audio';
import { clearProgress, exportSave, importSave, loadGame, loadSettings, saveGame, saveSettings } from '../services/storage';
import type { GameState, GameTab, OfflineReport, SettingsState, SimulationSnapshot, UnitRole } from '../types';

const FIXED_STEP_MS = 1000 / 30;
const MAX_FIXED_STEPS = 6;

const ICONS: Record<string, string> = {
  war: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 15 15M14 4l6 6M4 20l5-2-3-3zM19 4 4 19M10 4 4 10M20 20l-5-2 3-3z"/></svg>',
  barracks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11M8 20v-6h8v6M3 20h18"/></svg>',
  forge: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9v6H5zM9 9v5M4 14h10v4H4zM8 18v3M16 4c4 2 5 5 3 8-1-2-4-3-4-6z"/></svg>',
  ages: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2M7 3 4 6M17 3l3 3"/></svg>',
  hq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-9l8-7 8 7v9M8 21v-6h8v6M3 21h18M9 8V3h6v5"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-1-1-5-1-5 1s5 1 5 4-4 3-6 1M12 6v12"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>',
  strike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-2 8 5-2-6 14 2-9-5 2z"/></svg>',
  burst: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6z"/></svg>',
};

const TAB_LABELS: Record<GameTab, string> = { war: 'Guerre', barracks: 'Caserne', forge: 'Forge', ages: 'Âges', hq: 'QG' };

const GEAR_COPY: Record<GearKey, { name: string; description: string; bonus: string }> = {
  heroWeapon: { name: 'Arme du héros', description: 'Améliore chaque frappe active et automatique.', bonus: '+10 % dégâts' },
  heroArmor: { name: 'Plastron du héros', description: 'Augmente la survie et la présence sur la colline.', bonus: '+12 % PV' },
  armyWeapon: { name: 'Arsenal de l’armée', description: 'Équipe toutes les classes alliées.', bonus: '+9 % dégâts' },
  armyArmor: { name: 'Plastrons collectifs', description: 'Renforce toutes les lignes de soldats.', bonus: '+11 % PV' },
  boots: { name: 'Bottes de campagne', description: 'Accélère la marche et la prise de zone.', bonus: '+4 % vitesse' },
  banner: { name: 'Bannière logistique', description: 'Réduit les délais de tous les spawners.', bonus: '+6 % cadence' },
};

const ORDER_COPY: Record<GameState['spawners'][UnitRole]['order'], { label: string; description: string }> = {
  push: { label: 'Colline', description: 'Avance au centre et affronte la ligne la plus proche.' },
  hero: { label: 'Escorte', description: 'Reste autour du héros et attaque ce qui le menace.' },
  hunt: { label: 'Chasse', description: 'Traverse la ligne pour viser tireurs, soutiens et siège.' },
  defend: { label: 'Défense', description: 'Intercepte en priorité les ennemis proches de ta base.' },
};

const ROLE_USE: Record<UnitRole, string> = {
  assault: 'Le cœur de ta ligne : peu coûteux, remplace vite les pertes et apporte du poids sur la colline.',
  ranger: 'Tire derrière les tanks et finit les cibles blessées avant qu’elles ne reçoivent des soins.',
  guardian: 'Ton bloqueur : 2,6× plus de PV et 1,5 point de capture, mais il occupe 2 places.',
  scout: 'Traverse rapidement le front pour éliminer tireurs, soigneurs et pièces d’artillerie.',
  support: 'Soigne en continu l’allié le plus blessé et prolonge la durée de vie de toute la poussée.',
  siege: 'Artillerie lente à très longue portée : dégâts massifs et 42 % d’éclaboussure autour de la cible.',
};

export class ChronoforgeApp {
  private state: GameState = loadGame();
  private settings: SettingsState = loadSettings();
  private simulation: BattleSimulation;
  private renderer: CanvasRenderer;
  private audio: AudioManager;
  private activeTab: GameTab = 'war';
  private purchaseAmount: 1 | 10 | 999 = 1;
  private started = false;
  private accumulator = 0;
  private previousFrame = performance.now();
  private hudTimer = 0;
  private liveTimer = 0;
  private autosaveTimer = 0;
  private frameHandle = 0;
  private frameSamples: number[] = [];
  private simulationSamples: number[] = [];
  private renderSamples: number[] = [];
  private peakActiveEntities = 0;
  private peakActiveParticles = 0;
  private lastBossState = false;
  private pendingOffline: OfflineReport;
  private panelScroll: Partial<Record<GameTab, number>> = {};
  private movementKeys = new Set<string>();
  private activeJoystickPointer: number | null = null;
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private panel: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.pendingOffline = calculateOfflineReport(this.state);
    this.root.innerHTML = this.shellMarkup();
    this.canvas = this.query<HTMLCanvasElement>('#battlefield');
    this.panel = this.query<HTMLElement>('#game-panel');
    this.simulation = new BattleSimulation(this.state);
    this.simulation.setAutoAttack(this.settings.autoAttack);
    this.renderer = new CanvasRenderer(this.canvas);
    this.renderer.setSettings(this.settings);
    this.audio = new AudioManager(this.settings);
    this.bindEvents();
    this.applySettingsClasses();
    this.updateAll();
    this.registerServiceWorker();
    this.frameHandle = requestAnimationFrame((time) => this.frame(time));
  }

  private shellMarkup(): string {
    const hasSave = this.state.stats.playSeconds > 5 || this.state.totalSectors > 0 || Object.values(this.state.spawners).some((spawner) => spawner.level > 0);
    return `
      <main class="game-shell" data-tab="war" inert aria-hidden="true">
        <section class="battle" aria-label="Champ de bataille chronologique">
          <canvas id="battlefield" role="img" aria-label="Bataille automatique sur une colline entre l’armée alliée et l’armée ennemie"></canvas>
          <div class="battle-vignette" aria-hidden="true"></div>
          <header class="hud-top">
            <div class="hud-era">
              <span class="eyebrow" id="hud-sector">COLLINE 1 / 45</span>
              <strong id="hud-age">Âge des Braises</strong>
            </div>
            <div class="hud-money" aria-label="Trésor de guerre">
              ${ICONS.coin}
              <div><strong id="hud-coins">135</strong><span id="hud-income">+0 / s</span></div>
            </div>
            <button class="icon-button" id="pause-button" aria-label="Mettre le combat en pause">${ICONS.pause}</button>
          </header>

          <section class="objective-card" aria-label="Objectif de bataille">
            <div class="objective-heading"><span id="objective-label">Brisez la ligne ennemie</span><strong id="objective-value">0 / 100</strong></div>
            <div class="progress pressure"><i id="pressure-bar"></i></div>
            <div class="capture-row"><span>CONTRÔLE DE LA COLLINE</span><span id="armies-count">1 allié · 0 ennemi</span></div>
            <div class="progress capture"><i id="capture-bar"></i></div>
          </section>

          <div class="boss-banner" id="boss-banner" hidden><span>MENACE SOUVERAINE</span><strong id="boss-name">Mâchoire-de-Roc</strong></div>

          <div class="hero-movement" aria-label="Déplacement manuel du héros">
            <button class="hero-joystick" id="hero-joystick" type="button" aria-label="Maintenir et glisser pour déplacer le héros">
              <i class="joystick-arrows" aria-hidden="true"></i>
              <span id="joystick-knob" aria-hidden="true"></span>
            </button>
            <small>DÉPLACER</small>
          </div>

          <div class="battle-controls" aria-label="Commandes de combat">
            <button class="assist-button" id="auto-button" aria-pressed="${this.settings.autoAttack}" aria-label="Activer ou désactiver le pilote automatique du héros">
              <span class="assist-dot"></span><span>AUTO HÉROS</span>
            </button>
            <button class="combat-button ability" id="ability-button" aria-label="Déclencher l’onde chronale">
              ${ICONS.burst}<small id="ability-cooldown">PRÊT</small>
            </button>
            <button class="combat-button strike" id="strike-button" aria-label="Faire attaquer le héros">
              ${ICONS.strike}<span>FRAPPE</span>
            </button>
          </div>

          <aside class="tutorial-banner" id="tutorial-banner" aria-live="polite" hidden>
            <div><span class="eyebrow">MISSION D’APPRENTISSAGE</span><strong id="tutorial-copy"></strong></div>
            <button id="skip-tutorial" class="text-button">Ignorer</button>
          </aside>
          <div id="battle-live" class="sr-only" aria-live="polite"></div>
        </section>

        <section class="game-panel" id="game-panel" aria-label="Panneau de gestion" hidden>
          <div class="panel-handle" aria-hidden="true"></div>
          <header class="panel-header">
            <div><span class="eyebrow">CHRONOFORGE</span><h2 id="panel-title">Caserne</h2></div>
            <div class="panel-actions"><span class="panel-balance" aria-label="Trésor disponible">${ICONS.coin}<b data-live-coins>${compactNumber(this.state.coins)}</b></span><button class="panel-size-button icon-button" id="panel-size-button" aria-label="Agrandir le panneau" aria-pressed="false">↕</button><button class="close-panel icon-button" aria-label="Fermer le panneau">×</button></div>
          </header>
          <div class="panel-content" id="panel-content"></div>
        </section>

        <nav class="bottom-nav" aria-label="Navigation principale">
          ${(['war', 'barracks', 'forge', 'ages', 'hq'] as GameTab[]).map((tab) => `
            <button data-tab="${tab}" ${tab === 'war' ? 'aria-current="page"' : ''}>
              ${ICONS[tab]}<span>${TAB_LABELS[tab]}</span>
            </button>`).join('')}
        </nav>
      </main>

      <section class="start-screen" id="start-screen" aria-labelledby="game-title">
        <div class="start-art" aria-hidden="true"></div>
        <div class="start-scrim"></div>
        <div class="start-content">
          <div class="brand-mark">${ICONS.strike}</div>
          <p class="eyebrow">TYCOON DE CONQUÊTE TEMPORELLE</p>
          <h1 id="game-title">CHRONO<span>FORGE</span></h1>
          <p>Bâtissez vos spawners. Menez vos soldats. Prenez la colline à travers neuf âges.</p>
          <div class="campaign-promise">
            <span><strong>45</strong> collines</span><span><strong>9</strong> âges</span><span><strong>∞</strong> frontière</span>
          </div>
          <button class="primary-button start-button" id="start-button">${hasSave ? 'CONTINUER LA CONQUÊTE' : 'ALLUMER LA PREMIÈRE BRAISE'}</button>
          <small>Progression locale · jouable hors ligne · aucune énergie</small>
        </div>
      </section>

      <dialog id="offline-dialog" class="game-dialog" aria-labelledby="offline-dialog-title">
        <form method="dialog">
          <span class="dialog-icon">${ICONS.coin}</span>
          <p class="eyebrow">L’ARMÉE N’A PAS DORMI</p>
          <h2 id="offline-dialog-title">Rapport de campagne</h2>
          <p id="offline-copy"></p>
          <strong id="offline-reward" class="dialog-reward"></strong>
          <button class="primary-button" value="close">Récupérer</button>
        </form>
      </dialog>

      <dialog id="confirm-dialog" class="game-dialog" aria-labelledby="confirm-dialog-title">
        <form method="dialog">
          <span class="dialog-icon danger">!</span>
          <p class="eyebrow">ACTION IRRÉVERSIBLE</p>
          <h2 id="confirm-dialog-title">Effacer la chronologie ?</h2>
          <p>Pièces, collines et équipements seront perdus. Les réglages restent conservés.</p>
          <label class="confirm-check"><input type="checkbox" id="confirm-reset-check" /> Je comprends que cette action est définitive.</label>
          <div class="dialog-actions"><button class="secondary-button" value="cancel">Annuler</button><button class="danger-button" id="confirm-reset" value="confirm" disabled>Effacer</button></div>
        </form>
      </dialog>

      <div class="toast-stack" id="toast-stack" aria-live="polite" aria-atomic="false"></div>
    `;
  }

  private bindEvents(): void {
    this.query('#start-button').addEventListener('click', () => void this.startGame());
    this.query('#pause-button').addEventListener('click', () => this.togglePause());
    this.query('#strike-button').addEventListener('click', () => {
      this.performHeroStrike();
    });
    this.query('#ability-button').addEventListener('click', () => {
      if (this.simulation.useChronoBurst()) {
        this.audio.play('era');
        this.haptic([24, 18, 36]);
      }
    });
    this.query('#auto-button').addEventListener('click', () => {
      this.settings.autoAttack = !this.settings.autoAttack;
      this.simulation.setAutoAttack(this.settings.autoAttack);
      this.audio.play('confirm');
      this.persistSettings();
      this.updateAutoButton();
    });
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.started) return;
      const point = this.renderer.toNormalizedPoint(event.clientX, event.clientY);
      if (this.simulation.heroStrike(point.x, point.y)) {
        this.onManualStrike();
        this.haptic(14);
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('.bottom-nav button').forEach((button) => {
      button.addEventListener('click', () => this.setTab(button.dataset.tab as GameTab));
    });
    this.query('.close-panel').addEventListener('click', () => this.setTab('war'));
    this.query('#panel-size-button').addEventListener('click', () => this.togglePanelSize());
    this.query('#skip-tutorial').addEventListener('click', () => {
      this.state.tutorialComplete = true;
      this.state.tutorialStep = 6;
      this.updateTutorial();
      saveGame(this.state);
    });
    this.panel.addEventListener('click', (event) => this.handlePanelClick(event));
    this.panel.addEventListener('change', (event) => this.handlePanelChange(event));
    const resetCheck = this.query<HTMLInputElement>('#confirm-reset-check');
    resetCheck.addEventListener('change', () => {
      this.query<HTMLButtonElement>('#confirm-reset').disabled = !resetCheck.checked;
    });
    this.query('#confirm-dialog').addEventListener('close', () => {
      const dialog = this.query<HTMLDialogElement>('#confirm-dialog');
      if (dialog.returnValue === 'confirm') this.resetProgress();
      resetCheck.checked = false;
      this.query<HTMLButtonElement>('#confirm-reset').disabled = true;
    });
    window.addEventListener('pagehide', () => saveGame(this.state));
    window.addEventListener('resize', () => this.renderer.resize(this.settings.batterySaver));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveGame(this.state);
      this.previousFrame = performance.now();
    });
    this.bindHeroMovement();
  }

  private bindHeroMovement(): void {
    const joystick = this.query<HTMLButtonElement>('#hero-joystick');
    const knob = this.query<HTMLElement>('#joystick-knob');
    const updatePointer = (event: PointerEvent): void => {
      if (this.activeJoystickPointer !== event.pointerId) return;
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.36);
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance > radius) {
        dx = dx / distance * radius;
        dy = dy / distance * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.simulation.setHeroMovement(dx / radius, dy / radius);
      event.preventDefault();
    };
    const releasePointer = (event: PointerEvent): void => {
      if (this.activeJoystickPointer !== event.pointerId) return;
      this.activeJoystickPointer = null;
      knob.style.transform = '';
      this.simulation.setHeroMovement(0, 0);
      if (joystick.hasPointerCapture(event.pointerId)) joystick.releasePointerCapture(event.pointerId);
    };
    joystick.addEventListener('pointerdown', (event) => {
      this.activeJoystickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updatePointer(event);
    });
    joystick.addEventListener('pointermove', updatePointer);
    joystick.addEventListener('pointerup', releasePointer);
    joystick.addEventListener('pointercancel', releasePointer);

    const movementKeys = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'z', 'q']);
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key) || !this.started || this.activeTab !== 'war') return;
      this.movementKeys.add(key);
      this.syncKeyboardMovement();
      event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      this.movementKeys.delete(key);
      this.syncKeyboardMovement();
    });
    window.addEventListener('blur', () => {
      this.movementKeys.clear();
      this.syncKeyboardMovement();
    });
  }

  private syncKeyboardMovement(): void {
    const left = this.movementKeys.has('arrowleft') || this.movementKeys.has('a') || this.movementKeys.has('q');
    const right = this.movementKeys.has('arrowright') || this.movementKeys.has('d');
    const up = this.movementKeys.has('arrowup') || this.movementKeys.has('w') || this.movementKeys.has('z');
    const down = this.movementKeys.has('arrowdown') || this.movementKeys.has('s');
    this.simulation.setHeroMovement(Number(right) - Number(left), Number(down) - Number(up));
  }

  private togglePanelSize(): void {
    const expanded = this.panel.classList.toggle('expanded');
    const button = this.query<HTMLButtonElement>('#panel-size-button');
    button.setAttribute('aria-pressed', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Réduire le panneau pour voir le combat' : 'Agrandir le panneau');
    this.audio.play('confirm');
  }

  private async startGame(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.frameSamples = [];
    this.simulationSamples = [];
    this.renderSamples = [];
    this.peakActiveEntities = 0;
    this.peakActiveParticles = 0;
    const shell = this.query<HTMLElement>('.game-shell');
    shell.inert = false;
    shell.removeAttribute('aria-hidden');
    this.query('#start-screen').classList.add('is-leaving');
    await this.audio.unlock();
    window.setTimeout(() => this.query('#start-screen').setAttribute('hidden', ''), this.settings.reducedMotion ? 0 : 650);
    if (this.pendingOffline.coins > 0) {
      const report = claimOfflineReport(this.state);
      this.showOfflineReport(report);
    }
    if (!this.state.tutorialComplete && this.state.tutorialStep === 0) {
      this.setTab('barracks');
      requestAnimationFrame(() => this.panel.querySelector<HTMLButtonElement>('[data-buy-spawner="assault"]')?.focus());
    } else {
      requestAnimationFrame(() => this.query<HTMLButtonElement>('#pause-button').focus());
    }
    this.updateTutorial();
    this.toast('La ligne temporelle est ouverte.', 'success');
  }

  private frame(time: number): void {
    const frameDelta = Math.min(250, Math.max(0, time - this.previousFrame));
    this.previousFrame = time;
    if (this.started) this.pushPerformanceSample(this.frameSamples, frameDelta);
    if (this.started && !document.hidden) {
      this.accumulator += frameDelta;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP_MS && steps < MAX_FIXED_STEPS) {
        const simulationStart = performance.now();
        this.simulation.fixedUpdate(FIXED_STEP_MS / 1000);
        this.pushPerformanceSample(this.simulationSamples, performance.now() - simulationStart);
        const tickSnapshot = this.simulation.getSnapshot();
        this.renderer.pushEvents(tickSnapshot.events);
        this.audio.handleEvents(tickSnapshot.events);
        this.handleGameplayEvents(tickSnapshot);
        this.accumulator -= FIXED_STEP_MS;
        steps += 1;
      }
      if (steps >= MAX_FIXED_STEPS) this.accumulator = 0;
    }
    const snapshot = this.simulation.getSnapshot();
    const renderStart = performance.now();
    this.renderer.render(snapshot, this.accumulator / FIXED_STEP_MS, this.settings);
    this.pushPerformanceSample(this.renderSamples, performance.now() - renderStart);
    this.hudTimer += frameDelta;
    this.liveTimer += frameDelta;
    this.autosaveTimer += frameDelta;
    if (this.hudTimer >= 160) {
      this.updateHud(snapshot);
      this.hudTimer = 0;
    }
    if (this.liveTimer >= 2000) {
      this.updateLiveSummary(snapshot);
      this.liveTimer = 0;
    }
    if (this.autosaveTimer >= 12000) {
      saveGame(this.state);
      this.autosaveTimer = 0;
    }
    this.frameHandle = requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private handleGameplayEvents(snapshot: SimulationSnapshot): void {
    for (const event of snapshot.events) {
      if (event.type === 'coin' && this.state.tutorialStep === 2) {
        this.advanceTutorial(3, 'Première prime encaissée. Améliore maintenant ton arme.');
      }
      if (event.type === 'sector') {
        this.toast(`${event.label ?? 'Colline conquise'} +${compactNumber(event.value ?? 0)}`, 'legendary');
        this.haptic([45, 35, 70]);
        saveGame(this.state);
        this.renderPanel();
      }
      if (event.type === 'boss') this.toast(`${event.label ?? 'Boss'} entre dans la bataille.`, 'danger');
      if (event.type === 'hero-down') this.toast('Le héros reviendra dans 6 secondes.', 'danger');
    }
    if (snapshot.bossActive !== this.lastBossState) {
      this.lastBossState = snapshot.bossActive;
      this.audio.setBossDucking(snapshot.bossActive);
    }
  }

  private updateAll(): void {
    this.updateHud(this.simulation.getSnapshot());
    this.updateTutorial();
    this.updateAutoButton();
  }

  private updateHud(snapshot: SimulationSnapshot): void {
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    this.query('#hud-age').textContent = age.name;
    const hillName = HILL_NAMES[this.state.sectorInAge] ?? 'Frontière';
    this.query('#hud-sector').textContent = this.state.totalSectors < 45
      ? `COLLINE ${this.state.totalSectors + 1} / 45 · ${hillName}`
      : `FRONTIÈRE ${this.state.totalSectors - 44} · PALIER ${frontierTier(this.state.totalSectors)} · ${hillName}`;
    this.query('#hud-coins').textContent = compactNumber(this.state.coins);
    this.query('#hud-income').textContent = `+${compactNumber(snapshot.incomePerSecond)} / s`;
    this.root.querySelectorAll<HTMLElement>('[data-live-coins]').forEach((element) => { element.textContent = compactNumber(this.state.coins); });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-cost]').forEach((button) => {
      const cost = Number(button.dataset.cost);
      if (Number.isFinite(cost) && button.dataset.locked !== 'true') button.disabled = this.state.coins < cost;
    });
    this.query('#objective-label').textContent = this.state.pressure < 100 ? 'BRISEZ LA LIGNE ENNEMIE' : 'TENEZ LA COLLINE';
    this.query('#objective-value').textContent = this.state.pressure < 100 ? `${Math.floor(this.state.pressure)} / 100` : `${Math.floor(this.state.capture)} %`;
    this.query<HTMLElement>('#pressure-bar').style.width = `${this.state.pressure}%`;
    this.query<HTMLElement>('#capture-bar').style.width = `${this.state.capture}%`;
    this.query('#armies-count').textContent = `${snapshot.allyCount} allié${snapshot.allyCount > 1 ? 's' : ''} · ${snapshot.enemyCount} ennemi${snapshot.enemyCount > 1 ? 's' : ''}`;
    this.query<HTMLElement>('#boss-banner').hidden = !snapshot.bossActive;
    this.query('#boss-name').textContent = age.boss;
    const abilityButton = this.query<HTMLButtonElement>('#ability-button');
    abilityButton.disabled = snapshot.abilityCooldown > 0;
    this.query('#ability-cooldown').textContent = snapshot.abilityCooldown > 0 ? `${Math.ceil(snapshot.abilityCooldown)} s` : 'PRÊT';
    this.query<HTMLButtonElement>('#strike-button').disabled = snapshot.heroCooldown > 0 || snapshot.paused;
    const pauseButton = this.query<HTMLButtonElement>('#pause-button');
    pauseButton.innerHTML = snapshot.paused ? ICONS.play! : ICONS.pause!;
    pauseButton.setAttribute('aria-label', snapshot.paused ? 'Reprendre le combat' : 'Mettre le combat en pause');
    this.query('.game-shell').style.setProperty('--age-accent', age.palette[2]);
    this.query('.game-shell').style.setProperty('--age-warm', age.palette[0]);
    const shell = this.query<HTMLElement>('.game-shell');
    this.peakActiveEntities = Math.max(this.peakActiveEntities, snapshot.units.length);
    this.peakActiveParticles = Math.max(this.peakActiveParticles, this.renderer.getParticleCount());
    shell.dataset.activeEntities = String(snapshot.units.length);
    shell.dataset.activeParticles = String(this.renderer.getParticleCount());
    shell.dataset.peakActiveEntities = String(this.peakActiveEntities);
    shell.dataset.peakActiveParticles = String(this.peakActiveParticles);
    shell.dataset.fps = this.frameSamples.length ? (1000 / (this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length)).toFixed(1) : '0';
    shell.dataset.frameP95Ms = this.percentile95(this.frameSamples).toFixed(2);
    shell.dataset.simulationP95Ms = this.percentile95(this.simulationSamples).toFixed(2);
    shell.dataset.renderP95Ms = this.percentile95(this.renderSamples).toFixed(2);
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const encodedBytes = (navigation?.encodedBodySize ?? 0) + resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
    shell.dataset.startupMs = (navigation?.loadEventEnd ?? 0).toFixed(2);
    shell.dataset.downloadMb = (encodedBytes / 1_048_576).toFixed(4);
  }

  private pushPerformanceSample(samples: number[], value: number): void {
    samples.push(value);
    if (samples.length > 600) samples.shift();
  }

  private percentile95(samples: number[]): number {
    if (samples.length === 0) return 0;
    const ordered = [...samples].sort((a, b) => a - b);
    return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)] ?? 0;
  }

  private updateLiveSummary(snapshot: SimulationSnapshot): void {
    if (!this.started || this.activeTab !== 'war') {
      this.query('#battle-live').textContent = '';
      return;
    }
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    this.query('#battle-live').textContent = `${age.name}, ${HILL_NAMES[this.state.sectorInAge]}. ${snapshot.allyCount} alliés contre ${snapshot.enemyCount} ennemis. Pression ${Math.floor(this.state.pressure)} sur 100. Capture ${Math.floor(this.state.capture)} pour cent. Trésor ${compactNumber(this.state.coins)}.`;
  }

  private togglePause(): void {
    const paused = this.simulation.togglePaused();
    this.toast(paused ? 'Combat en pause.' : 'Combat repris.', 'info');
    this.updateHud(this.simulation.getSnapshot());
  }

  private performHeroStrike(): void {
    if (this.simulation.heroStrike()) {
      this.onManualStrike();
      this.haptic(18);
    }
  }

  private onManualStrike(): void {
    this.audio.play('impact');
    if (this.state.tutorialStep === 1) this.advanceTutorial(2, 'Bien. Gagne maintenant ta première prime de combat.');
  }

  private setTab(tab: GameTab): void {
    const returnFocusFromPanel = tab === 'war' && this.panel.contains(document.activeElement);
    if (tab !== 'war') {
      this.movementKeys.clear();
      this.simulation.setHeroMovement(0, 0);
      this.query<HTMLElement>('#joystick-knob').style.transform = '';
    }
    this.panelScroll[this.activeTab] = this.panel.querySelector('.panel-content')?.scrollTop ?? 0;
    this.activeTab = tab;
    this.query<HTMLElement>('.game-shell').dataset.tab = tab;
    this.root.querySelectorAll<HTMLButtonElement>('.bottom-nav button').forEach((button) => {
      if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (tab === 'war') {
      this.panel.hidden = true;
      if (returnFocusFromPanel) requestAnimationFrame(() => this.root.querySelector<HTMLButtonElement>('.bottom-nav [data-tab="war"]')?.focus());
    } else {
      this.panel.hidden = false;
      this.query('#panel-title').textContent = TAB_LABELS[tab];
      this.renderPanel();
    }
    if (tab === 'ages' && this.state.tutorialStep === 4) {
      this.state.tutorialStep = 6;
      this.state.tutorialComplete = true;
      this.panel.querySelector('.panel-tutorial')?.remove();
      this.toast('Tutoriel terminé. La colline t’appartient désormais.', 'legendary');
      saveGame(this.state);
    }
    this.updateTutorial();
    this.audio.play('confirm');
  }

  private renderPanel(focusSelector?: string): void {
    const content = this.query('#panel-content');
    const sameTabScroll = content.scrollTop || this.panelScroll[this.activeTab] || 0;
    let markup = '';
    if (this.activeTab === 'barracks') markup = this.barracksMarkup();
    else if (this.activeTab === 'forge') markup = this.forgeMarkup();
    else if (this.activeTab === 'ages') markup = this.agesMarkup();
    else if (this.activeTab === 'hq') markup = this.hqMarkup();
    content.innerHTML = `${this.panelTutorialMarkup()}${markup}`;
    content.scrollTop = sameTabScroll;
    this.panelScroll[this.activeTab] = sameTabScroll;
    if (focusSelector) requestAnimationFrame(() => content.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true }));
  }

  private barracksMarkup(): string {
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    return `
      <div class="panel-summary">
        <div><span>TRÉSOR DISPONIBLE</span><strong><span data-live-coins>${compactNumber(this.state.coins)}</span> ${ICONS.coin}</strong></div>
        <div><span>POPULATION CIBLE</span><strong>22 soldats</strong></div>
      </div>
      <div class="segmented" role="group" aria-label="Quantité d’achat">
        ${([1, 10, 999] as const).map((amount) => `<button data-buy-amount="${amount}" class="${this.purchaseAmount === amount ? 'active' : ''}">${amount === 999 ? 'MAX' : `×${amount}`}</button>`).join('')}
      </div>
      <p class="panel-intro">Chaque spawner produit automatiquement une classe. Ses niveaux améliorent durablement ses PV, ses dégâts et sa cadence.</p>
      <div class="card-list barracks-list">
        ${ROLES.map((role) => {
          const spawner = this.state.spawners[role.id];
          const unlocked = isRoleUnlocked(this.state, role.id);
          const cost = spawnerUpgradeCost(this.state, role.id);
          const canAfford = this.state.coins >= cost;
          const name = age.allyNames[role.id];
          const cadence = Math.max(0.58, 1 - Math.min(0.18, spawner.level * 0.015));
          const orderCopy = ORDER_COPY[spawner.order];
          return `<article class="upgrade-card ${unlocked ? '' : 'locked'}" data-role="${role.id}">
            <div class="role-sprite role-${role.id}" aria-hidden="true"></div>
            <div class="upgrade-copy">
              <div class="card-title"><div><span>SPAWNER ${role.name.toUpperCase()} · ${age.shortName}</span><h3>${name}</h3></div><b>NIV. ${spawner.level}</b></div>
              <p>${unlocked ? role.description : `Se débloque : ${roleUnlockLabel(role.id)}`}</p>
              <div class="stat-chips"><span>1 unité / ${(role.spawnSeconds * cadence).toFixed(1)} s</span><span>Population ${role.population}</span><span>+8 % / niveau</span></div>
            </div>
            <div class="role-purpose"><strong>À QUOI IL SERT</strong><span>${ROLE_USE[role.id]}</span></div>
            ${unlocked && spawner.level > 0 ? `<div class="tactic-control"><div><strong>ORDRE : ${orderCopy.label.toUpperCase()}</strong><span>${orderCopy.description}</span></div><div class="tactic-buttons" role="group" aria-label="Ordre des ${name}">${(Object.keys(ORDER_COPY) as Array<keyof typeof ORDER_COPY>).map((order) => `<button data-order-role="${role.id}" data-order="${order}" class="${spawner.order === order ? 'active' : ''}" aria-pressed="${spawner.order === order}">${ORDER_COPY[order].label}</button>`).join('')}</div></div>` : ''}
            <button class="buy-button" data-buy-spawner="${role.id}" data-cost="${cost}" data-locked="${!unlocked}" ${!unlocked || !canAfford ? 'disabled' : ''} aria-label="Améliorer ${name}">
              <span>${spawner.level === 0 ? 'CONSTRUIRE CE SPAWNER' : 'RENFORCER · +8 % PV/DÉGÂTS'}</span><strong>${unlocked ? compactNumber(cost) : 'VERROUILLÉ'} ${unlocked ? ICONS.coin : ''}</strong>
            </button>
          </article>`;
        }).join('')}
      </div>
    `;
  }

  private forgeMarkup(): string {
    const age = AGES[this.state.ageIndex] ?? AGES[0]!;
    const gearKeys = Object.keys(GEAR_COPY) as GearKey[];
    return `
      <div class="forge-hero">
        <div class="forge-orb">${ICONS.shield}</div>
        <div><span class="eyebrow">ÉQUIPEMENT ACTUEL · ${age.shortName}</span><h3>${this.currentWeaponName(age)} · ${this.currentArmorName(age)}</h3><p>Les améliorations d’une époque restent utiles pendant toute la campagne.</p></div>
      </div>
      <div class="card-list forge-list">
        ${gearKeys.map((key) => {
          const copy = GEAR_COPY[key];
          const rank = this.state.gear[key];
          const maximum = maxGearRank(this.state, key);
          const cost = gearUpgradeCost(this.state, key);
          const maxed = rank >= maximum;
          return `<article class="gear-card">
            <div class="gear-top"><span class="gear-icon">${key.includes('Armor') ? ICONS.shield : ICONS.strike}</span><div><span>${key.startsWith('hero') ? 'HÉROS' : 'ARMÉE ENTIÈRE'}</span><h3>${copy.name}</h3></div><b>${rank} / ${maximum}</b></div>
            <p>${copy.description}</p>
            <div class="compare-row"><span>Rang actuel <strong>${rank}</strong></span><i>→</i><span>Prochain gain <strong>${copy.bonus}</strong></span></div>
            <button class="buy-button" data-buy-gear="${key}" data-cost="${cost}" data-locked="${maxed}" ${maxed || this.state.coins < cost ? 'disabled' : ''}><span>${maxed ? 'MAXIMUM DE L’ÂGE' : 'FORGER'}</span><strong>${maxed ? 'MAÎTRISÉ' : `${compactNumber(cost)} ${ICONS.coin}`}</strong></button>
          </article>`;
        }).join('')}
      </div>
    `;
  }

  private agesMarkup(): string {
    const firstChronicleProgress = Math.min(45, this.state.totalSectors);
    const currentFrontierTier = frontierTier(this.state.totalSectors);
    return `
      <div class="campaign-overview">
        <span class="eyebrow">PREMIÈRE CHRONIQUE</span>
        <h3>${firstChronicleProgress} / 45 collines conquises</h3>
        <div class="progress"><i style="width:${firstChronicleProgress / 45 * 100}%"></i></div>
        <p>Durée cible de la première conquête : ${formatDuration(FIRST_CAMPAIGN_TARGET_MINUTES * 60)} minimum, puis prestige et Frontière paradoxale infinie.</p>
      </div>
      <ol class="timeline">
        ${AGES.map((age) => {
          const completed = Math.max(0, Math.min(5, firstChronicleProgress - age.index * 5));
          const current = age.index === this.state.ageIndex;
          const locked = firstChronicleProgress < 45 && age.index > this.state.ageIndex;
          return `<li class="age-node ${completed === 5 ? 'complete' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}">
            <div class="age-index">${(age.index + 1).toString().padStart(2, '0')}</div>
            <div class="age-copy"><span>${locked ? 'APERÇU DE LA CHRONOLOGIE' : current ? 'FRONT ACTUEL' : 'ÂGE MAÎTRISÉ'}</span><h3>${age.name}</h3><p>${age.tagline}</p>
              <div class="sector-dots" aria-label="${completed} collines sur 5 conquises">${HILL_NAMES.map((hill, index) => `<i class="${index < completed ? 'done' : index === completed && current ? 'active' : ''}" title="${hill}"></i>`).join('')}</div>
              <dl><div><dt>Boss</dt><dd>${age.boss}</dd></div><div><dt>Landmark</dt><dd>${age.landmark}</dd></div><div><dt>Temps cible</dt><dd>${age.targetMinutes[0]}–${age.targetMinutes[1]} min</dd></div></dl>
            </div>
          </li>`;
        }).join('')}
      </ol>
      <section class="endgame-card"><span class="eyebrow">APRÈS L’HYPERFUTUR · PALIER ${currentFrontierTier}</span><h3>La Frontière paradoxale</h3><p>Les cinq secteurs hyperfuturs se recomposent sans fin. Chaque palier renforce les ennemis et les primes ; la reboucle de prestige reste disponible à tout moment.</p></section>
    `;
  }

  private hqMarkup(): string {
    const reward = estimatedPrestigeReward(this.state);
    return `
      <section class="hq-section">
        <div class="section-heading"><div><span class="eyebrow">ORDRES DE CAMPAGNE</span><h3>Missions</h3></div><span>Récompenses immédiates</span></div>
        <div class="mission-list">${MISSION_DEFS.map((definition) => {
          const mission = this.state.missions.find((entry) => entry.id === definition.id)!;
          const complete = mission.progress >= definition.target;
          return `<article class="mission-card"><div><strong>${definition.label}</strong><span>${Math.min(definition.target, Math.floor(mission.progress))} / ${definition.target}</span></div><div class="progress"><i style="width:${Math.min(100, mission.progress / definition.target * 100)}%"></i></div><button data-claim-mission="${definition.id}" ${!complete || mission.claimed ? 'disabled' : ''}>${mission.claimed ? 'RÉCUPÉRÉ' : complete ? 'RÉCUPÉRER' : 'EN COURS'}</button></article>`;
        }).join('')}</div>
      </section>

      <section class="hq-section prestige-section">
        <div class="section-heading"><div><span class="eyebrow">REBOUCLE HISTORIQUE</span><h3>Arbre temporel</h3></div><strong>${compactNumber(this.state.prestige.crystals)} cristaux</strong></div>
        <p>Disponible après la capitale de l’Âge du Fer. Recommence plus fort et accélère les anciennes ères.</p>
        <div class="prestige-grid">${PRESTIGE_UPGRADES.map((upgrade) => {
          const rank = this.state.prestige.ranks[upgrade.id];
          const cost = prestigeUpgradeCost(rank);
          return `<button data-buy-prestige="${upgrade.id}" ${rank >= 10 || this.state.prestige.crystals < cost ? 'disabled' : ''}><span>${upgrade.name}</span><strong>Rang ${rank} / 10</strong><small>${upgrade.bonusLabel}</small><b>${rank >= 10 ? 'MAX' : `${cost} ◈`}</b></button>`;
        }).join('')}</div>
        <button class="prestige-button" data-prestige ${!canPrestige(this.state) ? 'disabled' : ''}><span>${canPrestige(this.state) ? 'REBOUCLER LA CHRONOLOGIE' : `DÉBLOCAGE : ${Math.min(15, this.state.totalSectors)} / 15 COLLINES`}</span><strong>+${reward} cristaux</strong></button>
      </section>

      <section class="hq-section">
        <div class="section-heading"><div><span class="eyebrow">CONFORT ET ACCESSIBILITÉ</span><h3>Réglages</h3></div></div>
        <div class="settings-list">
          ${this.rangeSetting('masterVolume', 'Volume général', this.settings.masterVolume)}
          ${this.rangeSetting('musicVolume', 'Musique', this.settings.musicVolume)}
          ${this.rangeSetting('effectsVolume', 'Effets', this.settings.effectsVolume)}
          ${this.rangeSetting('uiVolume', 'Interface', this.settings.uiVolume)}
          ${this.toggleSetting('muted', 'Tout couper', 'Coupe le son sans perdre les volumes.')}
          ${this.toggleSetting('autoAttack', 'Attaque automatique', 'Le héros assiste l’armée sans tap répété.')}
          ${this.toggleSetting('leftHanded', 'Mode gaucher', 'Place les commandes de combat du côté gauche.')}
          ${this.toggleSetting('reducedMotion', 'Mouvements réduits', 'Désactive secousses, pulsations et transitions longues.')}
          ${this.toggleSetting('highContrast', 'Contraste renforcé', 'Accentue contours, texte et barres de progression.')}
          ${this.toggleSetting('largeText', 'Texte agrandi', 'Augmente la taille de l’interface de gestion.')}
          ${this.toggleSetting('haptics', 'Vibrations', 'Retour haptique léger sur impacts et conquêtes.')}
          ${this.toggleSetting('particles', 'Particules', 'Effets visuels d’impact et de capture.')}
          ${this.toggleSetting('floatingNumbers', 'Nombres de gains', 'Affiche les récompenses directement sur le champ de bataille.')}
          ${this.toggleSetting('batterySaver', 'Économie de batterie', 'Limite la résolution de rendu du Canvas.')}
        </div>
      </section>

      <section class="hq-section stats-section">
        <div class="section-heading"><div><span class="eyebrow">ARCHIVES DE GUERRE</span><h3>Statistiques</h3></div></div>
        <dl><div><dt>Ennemis vaincus</dt><dd>${compactNumber(this.state.stats.kills)}</dd></div><div><dt>Boss vaincus</dt><dd>${this.state.stats.bosses}</dd></div><div><dt>Pièces gagnées</dt><dd>${compactNumber(this.state.stats.coinsEarned)}</dd></div><div><dt>Temps actif</dt><dd>${formatDuration(this.state.stats.playSeconds)}</dd></div><div><dt>Étoiles</dt><dd>${this.state.stars}</dd></div><div><dt>Profondeur totale</dt><dd>${this.state.totalSectors} collines</dd></div></dl>
      </section>

      <section class="hq-section save-tools">
        <div class="section-heading"><div><span class="eyebrow">SAUVEGARDE LOCALE</span><h3>Protéger la chronologie</h3></div></div>
        <textarea id="save-transfer" aria-label="Code d’export ou d’import de la sauvegarde" placeholder="Le code d’export apparaîtra ici, ou colle un code à importer."></textarea>
        <div class="tool-buttons"><button data-export-save>Exporter</button><button data-import-save>Importer</button><button data-reset-save class="danger-outline">Effacer</button></div>
      </section>
    `;
  }

  private rangeSetting(key: 'masterVolume' | 'musicVolume' | 'effectsVolume' | 'uiVolume', label: string, value: number): string {
    return `<label class="range-setting"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${value}" data-setting="${key}" /><output>${Math.round(value * 100)} %</output></label>`;
  }

  private toggleSetting(key: keyof SettingsState, label: string, description: string): string {
    const checked = Boolean(this.settings[key]);
    return `<label class="toggle-setting"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}/><i aria-hidden="true"></i></label>`;
  }

  private handlePanelClick(event: Event): void {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;
    const amount = button.dataset.buyAmount;
    if (amount) {
      this.purchaseAmount = Number(amount) as 1 | 10 | 999;
      this.renderPanel(`[data-buy-amount="${amount}"]`);
      return;
    }
    const orderRole = button.dataset.orderRole as UnitRole | undefined;
    const order = button.dataset.order as GameState['spawners'][UnitRole]['order'] | undefined;
    if (orderRole && order && Object.hasOwn(ORDER_COPY, order)) {
      this.state.spawners[orderRole].order = order;
      this.audio.play('confirm');
      this.toast(`${ROLE_BY_ID[orderRole].name} : ordre ${ORDER_COPY[order].label}.`, 'info');
      saveGame(this.state);
      this.renderPanel(`[data-order-role="${orderRole}"][data-order="${order}"]`);
      return;
    }
    const role = button.dataset.buySpawner as UnitRole | undefined;
    if (role) {
      const before = this.state.spawners[role].level;
      const bought = purchaseSpawnerLevels(this.state, role, this.purchaseAmount);
      if (bought > 0) {
        this.audio.play('confirm');
        this.haptic(12);
        this.toast(`${ROLE_BY_ID[role].name} : niveau ${before + bought}.`, 'success');
        if (this.state.tutorialStep === 0) this.advanceTutorial(1, 'Ton premier soldat arrive. Déplace le héros avec le joystick puis utilise FRAPPE.');
        saveGame(this.state);
      } else this.toast('Trésor insuffisant pour cet achat.', 'danger');
      this.renderPanel(`[data-buy-spawner="${role}"]`);
      return;
    }
    const gear = button.dataset.buyGear as GearKey | undefined;
    if (gear) {
      if (purchaseGear(this.state, gear)) {
        if (gear === 'heroWeapon' || gear === 'heroArmor') this.simulation.refreshHeroStats();
        this.audio.play('confirm');
        this.toast(`${GEAR_COPY[gear].name} amélioré : ${GEAR_COPY[gear].bonus}.`, 'success');
        if (this.state.tutorialStep === 3) this.advanceTutorial(4, 'Ton équipement est prêt. Ouvre Âges pour voir le chemin complet.');
        saveGame(this.state);
      } else this.toast('Amélioration verrouillée ou trop coûteuse.', 'danger');
      this.renderPanel(`[data-buy-gear="${gear}"]`);
      return;
    }
    const missionId = button.dataset.claimMission;
    if (missionId) {
      const reward = claimMission(this.state, missionId);
      if (reward > 0) {
        this.audio.play('coin');
        this.toast(`Mission accomplie : +${compactNumber(reward)} pièces.`, 'success');
        saveGame(this.state);
      }
      this.renderPanel(`[data-claim-mission="${missionId}"]`);
      return;
    }
    const prestigeId = button.dataset.buyPrestige as keyof GameState['prestige']['ranks'] | undefined;
    if (prestigeId) {
      if (buyPrestigeUpgrade(this.state, prestigeId)) {
        if (prestigeId === 'hero') this.simulation.refreshHeroStats();
        this.audio.play('era');
        this.toast('Branche temporelle renforcée.', 'legendary');
        saveGame(this.state);
      }
      this.renderPanel(`[data-buy-prestige="${prestigeId}"]`);
      return;
    }
    if (button.hasAttribute('data-prestige')) {
      if (!canPrestige(this.state)) return;
      const confirmed = window.confirm(`Reboucler maintenant pour ${estimatedPrestigeReward(this.state)} cristaux ? La campagne courante sera réinitialisée.`);
      if (confirmed) {
        this.state = performPrestige(this.state);
        this.simulation.setState(this.state);
        this.audio.play('era', false);
        this.toast('La chronologie s’est repliée. Ton héritage demeure.', 'legendary');
        saveGame(this.state);
        this.renderPanel();
      }
      return;
    }
    if (button.hasAttribute('data-export-save')) this.exportCurrentSave();
    if (button.hasAttribute('data-import-save')) this.importCurrentSave();
    if (button.hasAttribute('data-reset-save')) this.query<HTMLDialogElement>('#confirm-dialog').showModal();
  }

  private handlePanelChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting as keyof SettingsState | undefined;
    if (!key) return;
    if (input.type === 'checkbox') {
      (this.settings[key] as boolean) = input.checked;
    } else if (input.type === 'range') {
      (this.settings[key] as number) = Number(input.value);
      const output = input.parentElement?.querySelector('output');
      if (output) output.textContent = `${Math.round(Number(input.value) * 100)} %`;
    }
    this.simulation.setAutoAttack(this.settings.autoAttack);
    this.audio.applySettings(this.settings);
    this.renderer.setSettings(this.settings);
    this.renderer.resize(this.settings.batterySaver);
    this.applySettingsClasses();
    this.updateAutoButton();
    this.persistSettings();
  }

  private applySettingsClasses(): void {
    document.documentElement.classList.toggle('reduced-motion', this.settings.reducedMotion);
    document.documentElement.classList.toggle('high-contrast', this.settings.highContrast);
    document.documentElement.classList.toggle('large-text', this.settings.largeText);
    document.documentElement.classList.toggle('left-handed', this.settings.leftHanded);
  }

  private persistSettings(): void {
    saveSettings(this.settings);
  }

  private updateAutoButton(): void {
    const button = this.query<HTMLButtonElement>('#auto-button');
    button.setAttribute('aria-pressed', String(this.settings.autoAttack));
    button.classList.toggle('active', this.settings.autoAttack);
  }

  private updateTutorial(): void {
    const banner = this.query<HTMLElement>('#tutorial-banner');
    if (this.state.tutorialComplete || !this.started || this.activeTab !== 'war') {
      banner.hidden = true;
      return;
    }
    const instructions = [
      'Construis le spawner Assaut dans la Caserne.',
      'Déplace le héros avec le joystick, puis utilise FRAPPE sur un ennemi.',
      'Continue le combat jusqu’à ta première prime.',
      'Ouvre la Forge et améliore une arme ou une armure.',
      'Ouvre Âges pour découvrir les 45 collines.',
    ];
    banner.hidden = false;
    this.query('#tutorial-copy').textContent = instructions[this.state.tutorialStep] ?? 'Prends la colline.';
  }

  private panelTutorialMarkup(): string {
    if (this.state.tutorialComplete || !this.started) return '';
    const instructions = [
      'Construis le spawner Assaut ci-dessous.',
      'Déplace le héros avec le joystick, puis utilise FRAPPE sur un ennemi.',
      'Continue le combat jusqu’à ta première prime.',
      'Améliore une arme ou une armure dans cette Forge.',
      'Observe les neuf âges et leurs 45 collines.',
    ];
    return `<aside class="panel-tutorial" aria-live="polite"><span class="eyebrow">MISSION D’APPRENTISSAGE</span><strong>${instructions[this.state.tutorialStep] ?? 'Prends la colline.'}</strong></aside>`;
  }

  private advanceTutorial(step: number, message: string): void {
    this.state.tutorialStep = step;
    this.toast(message, 'info');
    this.updateTutorial();
    saveGame(this.state);
  }

  private currentWeaponName(age: (typeof AGES)[number]): string {
    const localRank = this.state.gear.heroWeapon % 4;
    return age.heroWeapons[Math.min(2, Math.floor(localRank / 1.4))] ?? age.heroWeapons[0];
  }

  private currentArmorName(age: (typeof AGES)[number]): string {
    return age.armorTrack[Math.min(3, this.state.gear.heroArmor % 4)] ?? age.armorTrack[0];
  }

  private showOfflineReport(report: OfflineReport): void {
    const dialog = this.query<HTMLDialogElement>('#offline-dialog');
    this.query('#offline-copy').textContent = `Absence comptabilisée : ${formatDuration(report.creditedSeconds)} à ${Math.round(report.efficiency * 100)} % d’efficacité. Aucun boss ni territoire n’a été conquis automatiquement.`;
    this.query('#offline-reward').textContent = `+ ${compactNumber(report.coins)} pièces`;
    dialog.showModal();
  }

  private exportCurrentSave(): void {
    const textarea = this.query<HTMLTextAreaElement>('#save-transfer');
    const encoded = exportSave(this.state);
    textarea.value = encoded;
    textarea.focus();
    textarea.select();
    void navigator.clipboard?.writeText(encoded).then(() => this.toast('Sauvegarde copiée dans le presse-papiers.', 'success')).catch(() => this.toast('Code d’export prêt à copier.', 'info'));
  }

  private importCurrentSave(): void {
    const textarea = this.query<HTMLTextAreaElement>('#save-transfer');
    const imported = importSave(textarea.value);
    if (!imported) {
      this.toast('Code de sauvegarde invalide ou incompatible.', 'danger');
      return;
    }
    this.state = imported;
    this.simulation.setState(this.state);
    saveGame(this.state);
    this.toast('Chronologie importée avec succès.', 'success');
    this.renderPanel();
  }

  private resetProgress(): void {
    clearProgress();
    this.state = createDefaultState();
    this.simulation.setState(this.state);
    this.activeTab = 'war';
    this.setTab('war');
    this.toast('Nouvelle chronologie créée.', 'info');
    saveGame(this.state);
  }

  private toast(message: string, type: 'success' | 'danger' | 'legendary' | 'info'): void {
    const stack = this.query('#toast-stack');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i aria-hidden="true"></i><span>${message}</span>`;
    stack.append(toast);
    window.setTimeout(() => toast.classList.add('leaving'), 3600);
    window.setTimeout(() => toast.remove(), 4100);
  }

  private haptic(pattern: number | number[]): void {
    if (!this.settings.haptics || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      window.addEventListener('load', () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }));
    }
  }

  private query<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector) ?? document.querySelector<T>(selector);
    if (!element) throw new Error(`Élément introuvable : ${selector}`);
    return element;
  }

  destroy(): void {
    cancelAnimationFrame(this.frameHandle);
    saveGame(this.state);
  }
}
