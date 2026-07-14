import { AGES, ROLE_BY_ID, ROLES } from '../data/content';
import { compactNumber } from '../core/economy';
import type { CombatEvent, SettingsState, SimulationSnapshot, UnitEntity } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  text?: string;
}

const roleCell = Object.fromEntries(ROLES.map((role, index) => [role.id, index])) as Record<UnitEntity['role'], number>;
const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly background = new Image();
  private readonly sprites = new Image();
  private readonly staticLayer = document.createElement('canvas');
  private staticContext: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private width = 1;
  private height = 1;
  private dpr = 1;
  private previousTime = performance.now();
  private time = 0;
  private currentAge = -1;
  private ready = false;
  private reducedMotion = false;
  private particlesEnabled = true;

  getParticleCount(): number {
    return this.particles.length;
  }
  private floatingNumbers = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const staticContext = this.staticLayer.getContext('2d', { alpha: false });
    if (!context || !staticContext) throw new Error('Canvas 2D indisponible');
    this.context = context;
    this.staticContext = staticContext;
    this.background.decoding = 'async';
    this.background.src = assetUrl('assets/generated/chronoforge-key-art.webp');
    this.sprites.decoding = 'async';
    this.sprites.src = assetUrl('assets/original/unit-sprites.svg');
    Promise.allSettled([this.background.decode(), this.sprites.decode()]).then(() => {
      this.ready = true;
      this.buildStaticLayer();
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize(batterySaver = false): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(batterySaver ? 1.25 : 2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const pixelWidth = Math.round(this.width * this.dpr);
    const pixelHeight = Math.round(this.height * this.dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.staticLayer.width = pixelWidth;
      this.staticLayer.height = pixelHeight;
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.staticContext.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.buildStaticLayer();
    }
  }

  setSettings(settings: SettingsState): void {
    this.reducedMotion = settings.reducedMotion;
    this.particlesEnabled = settings.particles;
    this.floatingNumbers = settings.floatingNumbers;
  }

  pushEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      const x = event.x * this.width;
      const y = event.y * this.height;
      if (event.type === 'hit' && this.particlesEnabled) {
        const color = event.team === 'enemy' ? '#ff667f' : '#64f4df';
        const count = this.reducedMotion ? 2 : 5;
        for (let i = 0; i < count; i += 1) {
          this.addParticle({ x, y, vx: (Math.random() - 0.5) * 55, vy: -20 - Math.random() * 42, life: 0.35, maxLife: 0.35, color, size: 2 + Math.random() * 3 });
        }
      }
      if (event.type === 'coin' && this.floatingNumbers) {
        this.addParticle({ x, y, vx: 0, vy: -28, life: 0.85, maxLife: 0.85, color: '#ffd66f', size: 12, text: `+${compactNumber(event.value ?? 0)}` });
      }
      if (event.type === 'mechanic' && this.particlesEnabled) {
        const color = event.stage === 'warning' ? '#ffd36b' : '#ff637f';
        const count = this.reducedMotion ? 4 : 10;
        for (let i = 0; i < count; i += 1) {
          const angle = i / count * Math.PI * 2;
          this.addParticle({ x, y, vx: Math.cos(angle) * 24, vy: Math.sin(angle) * 24, life: 0.75, maxLife: 0.75, color, size: event.stage === 'warning' ? 2.5 : 4 });
        }
      }
      if ((event.type === 'capture' || event.type === 'sector' || event.type === 'boss' || event.type === 'mechanic') && event.label) {
        const life = event.type === 'sector' ? 2.4 : event.type === 'mechanic' ? 1.8 : 1.5;
        const color = event.type === 'boss' || (event.type === 'mechanic' && event.stage === 'impact') ? '#ff879d' : '#fbe6a2';
        this.addParticle({ x: event.type === 'mechanic' ? x : this.width / 2, y: Math.max(70, y), vx: 0, vy: -12, life, maxLife: life, color, size: event.type === 'sector' ? 22 : 15, text: event.label });
      }
    }
  }

  private addParticle(particle: Particle): void {
    if (this.particles.length >= 170) this.particles.shift();
    this.particles.push(particle);
  }

  render(snapshot: SimulationSnapshot, alpha: number, settings: SettingsState): void {
    this.setSettings(settings);
    if (snapshot.state.ageIndex !== this.currentAge) {
      this.currentAge = snapshot.state.ageIndex;
      this.buildStaticLayer();
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.previousTime) / 1000);
    this.previousTime = now;
    this.time += dt;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.context.drawImage(this.staticLayer, 0, 0, this.staticLayer.width, this.staticLayer.height, 0, 0, this.width, this.height);
    this.drawCaptureZone(snapshot);
    this.drawStructures(snapshot);
    const sorted = [...snapshot.units].sort((a, b) => a.y - b.y);
    for (const unit of sorted) this.drawUnit(unit, alpha);
    this.updateAndDrawParticles(dt);
    if (!this.ready) this.drawLoading();
  }

  private buildStaticLayer(): void {
    if (this.width <= 1 || this.height <= 1) return;
    const ctx = this.staticContext;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const age = AGES[Math.max(0, this.currentAge)] ?? AGES[0];
    if (this.background.complete && this.background.naturalWidth > 0) {
      const imageRatio = this.background.naturalWidth / this.background.naturalHeight;
      const viewRatio = this.width / this.height;
      let sourceWidth = this.background.naturalWidth;
      let sourceHeight = this.background.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;
      if (imageRatio > viewRatio) {
        sourceWidth = sourceHeight * viewRatio;
        sourceX = (this.background.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = sourceWidth / viewRatio;
        sourceY = (this.background.naturalHeight - sourceHeight) * 0.52;
      }
      ctx.drawImage(this.background, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, this.width, this.height);
    } else {
      const fallback = ctx.createLinearGradient(0, 0, 0, this.height);
      fallback.addColorStop(0, '#151d4a');
      fallback.addColorStop(1, '#26180f');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const ageWash = ctx.createLinearGradient(0, 0, 0, this.height);
    ageWash.addColorStop(0, `${age?.palette[1] ?? '#121932'}c9`);
    ageWash.addColorStop(0.48, '#071128a8');
    ageWash.addColorStop(1, `${age?.palette[1] ?? '#17100b'}d9`);
    ctx.fillStyle = ageWash;
    ctx.fillRect(0, 0, this.width, this.height);

    const path = ctx.createLinearGradient(0, 0, 0, this.height);
    path.addColorStop(0, `${age?.palette[2] ?? '#68e2dd'}55`);
    path.addColorStop(0.52, '#8e7a6166');
    path.addColorStop(1, `${age?.palette[0] ?? '#ffb65d'}66`);
    ctx.beginPath();
    ctx.moveTo(this.width * 0.38, 0);
    ctx.bezierCurveTo(this.width * 0.68, this.height * 0.18, this.width * 0.32, this.height * 0.33, this.width * 0.39, this.height * 0.5);
    ctx.bezierCurveTo(this.width * 0.48, this.height * 0.68, this.width * 0.27, this.height * 0.82, this.width * 0.2, this.height);
    ctx.lineTo(this.width * 0.82, this.height);
    ctx.bezierCurveTo(this.width * 0.76, this.height * 0.79, this.width * 0.57, this.height * 0.68, this.width * 0.62, this.height * 0.5);
    ctx.bezierCurveTo(this.width * 0.66, this.height * 0.34, this.width * 0.41, this.height * 0.2, this.width * 0.62, 0);
    ctx.closePath();
    ctx.fillStyle = path;
    ctx.fill();
    ctx.strokeStyle = '#f4e3bd3f';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 16; i += 1) {
      const y = (i + 0.5) / 16 * this.height;
      const sway = Math.sin(i * 2.3) * this.width * 0.08;
      ctx.fillStyle = i % 2 ? '#ffffff0c' : '#00000014';
      ctx.beginPath();
      ctx.ellipse(this.width * 0.5 + sway, y, this.width * (0.09 + i * 0.002), 2 + i * 0.08, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCaptureZone(snapshot: SimulationSnapshot): void {
    const ctx = this.context;
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 2.5) * 2;
    const radiusX = this.width * 0.24 + pulse;
    const radiusY = Math.max(24, this.height * 0.043) + pulse * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = snapshot.state.pressure >= 100 ? '#50f0db1c' : '#ffd76a12';
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = this.reducedMotion ? 0 : -this.time * 12;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = snapshot.state.pressure >= 100 ? '#75f7e8b8' : '#ffd9798f';
    ctx.stroke();
    ctx.restore();
  }

  private drawStructures(snapshot: SimulationSnapshot): void {
    const ctx = this.context;
    const age = AGES[snapshot.state.ageIndex] ?? AGES[0];
    const allyColor = age?.palette[2] ?? '#66efe0';
    const enemyColor = '#ff5f7e';
    this.drawGate(this.width * 0.5, this.height * 0.055, enemyColor, true);
    this.drawGate(this.width * 0.5, this.height * 0.93, allyColor, false);
    const owned = ROLES.filter((role) => snapshot.state.spawners[role.id].level > 0);
    owned.forEach((role, index) => {
      const x = this.width * (0.17 + (index % 3) * 0.33);
      const y = this.height * (0.87 + Math.floor(index / 3) * 0.045);
      ctx.fillStyle = '#081328cc';
      ctx.strokeStyle = allyColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 20, y - 12, 40, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f5fbff';
      ctx.font = '700 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${ROLE_BY_ID[role.id].shortName} ${snapshot.state.spawners[role.id].level}`, x, y + 3);
    });
  }

  private drawGate(x: number, y: number, color: string, inverted: boolean): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    if (inverted) ctx.rotate(Math.PI);
    ctx.fillStyle = '#071027d9';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34, 20);
    ctx.lineTo(-29, -8);
    ctx.lineTo(-17, -15);
    ctx.lineTo(-9, -3);
    ctx.lineTo(0, -24);
    ctx.lineTo(9, -3);
    ctx.lineTo(17, -15);
    ctx.lineTo(29, -8);
    ctx.lineTo(34, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawUnit(unit: UnitEntity, alpha: number): void {
    const ctx = this.context;
    const interpolatedX = unit.previousX + (unit.x - unit.previousX) * alpha;
    const interpolatedY = unit.previousY + (unit.y - unit.previousY) * alpha;
    const x = interpolatedX * this.width;
    const y = interpolatedY * this.height;
    const baseSize = Math.max(27, Math.min(50, this.width * unit.radius * (unit.isBoss ? 2.25 : 1.8)));
    const bob = this.reducedMotion || unit.state !== 'move' ? 0 : Math.sin(this.time * 10 + unit.id) * 1.5;
    const spawnScale = unit.state === 'spawn' ? Math.max(0.2, 1 - unit.stateTimer * 1.9) : 1;
    const attackScale = unit.state === 'attack' ? 1.13 : unit.state === 'windup' ? 0.92 : 1;
    const size = baseSize * spawnScale * attackScale;
    const teamColor = unit.team === 'ally' ? '#62f4df' : '#ff607e';
    const age = AGES[unit.ageIndex] ?? AGES[0];

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#0206128c';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.34, size * 0.43, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    if (unit.isHero || unit.isBoss || unit.elite) {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.55 + (this.reducedMotion ? 0 : Math.sin(this.time * 4 + unit.id) * 1.2), 0, Math.PI * 2);
      ctx.strokeStyle = unit.isHero ? '#ffffff' : unit.isBoss ? '#ffca7a' : age?.palette[0] ?? '#ffd86b';
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = unit.isBoss ? 4 : 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `${teamColor}24`;
    ctx.fill();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (this.sprites.complete && this.sprites.naturalWidth > 0) {
      const sourceX = roleCell[unit.role] * 128;
      ctx.globalAlpha = unit.state === 'dead' ? 0.35 : 1;
      if (unit.team === 'enemy') ctx.scale(-1, 1);
      ctx.drawImage(this.sprites, sourceX, 0, 128, 128, -size * 0.55, -size * 0.68, size * 1.1, size * 1.1);
    } else {
      ctx.fillStyle = age?.palette[0] ?? '#f3cf77';
      ctx.beginPath();
      ctx.arc(0, -size * 0.1, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const barWidth = size * 0.88;
    const barY = y - size * 0.71;
    ctx.fillStyle = '#050a17d9';
    ctx.fillRect(x - barWidth / 2, barY, barWidth, 4);
    ctx.fillStyle = unit.hp / unit.maxHp < 0.28 ? '#ffca5e' : teamColor;
    ctx.fillRect(x - barWidth / 2, barY, barWidth * Math.max(0, unit.hp / unit.maxHp), 4);
    if (unit.team === 'enemy' && (unit.isBoss || unit.elite)) {
      ctx.fillStyle = unit.isBoss ? '#ffe3a0' : '#ffd27e';
      ctx.font = `800 ${unit.isBoss ? 10 : 8}px system-ui`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#070b18';
      ctx.strokeText(unit.displayName, x, barY - 5);
      ctx.fillText(unit.displayName, x, barY - 5);
    }
    if (unit.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${unit.flash * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private updateAndDrawParticles(dt: number): void {
    const ctx = this.context;
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.text ? 0 : 110 * dt;
      const opacity = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      ctx.globalAlpha = opacity;
      if (particle.text) {
        ctx.fillStyle = particle.color;
        ctx.font = `800 ${particle.size}px system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#071024';
        ctx.strokeText(particle.text, particle.x, particle.y);
        ctx.fillText(particle.text, particle.x, particle.y);
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private drawLoading(): void {
    const ctx = this.context;
    ctx.fillStyle = '#0a1024cc';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#f4e6ba';
    ctx.font = '700 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Ouverture de la ligne temporelle…', this.width / 2, this.height / 2);
  }

  toNormalizedPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }
}
