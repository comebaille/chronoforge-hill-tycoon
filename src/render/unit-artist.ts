import type { UnitEntity, UnitRole } from '../types';

interface UnitMaterial {
  armor: string;
  armorDark: string;
  cloth: string;
  skin: string;
  weapon: string;
  energy: string;
}

const MATERIALS: readonly UnitMaterial[] = [
  { armor: '#8b6541', armorDark: '#4c321f', cloth: '#c98c46', skin: '#e0ad78', weapon: '#eee1bf', energy: '#ffca66' },
  { armor: '#c88a38', armorDark: '#71451d', cloth: '#8b3340', skin: '#d8a06f', weapon: '#f3cf72', energy: '#65e8df' },
  { armor: '#aab5bd', armorDark: '#4c5964', cloth: '#9c2e35', skin: '#d5a075', weapon: '#e6edf1', energy: '#f1c45d' },
  { armor: '#aab7c5', armorDark: '#3b4858', cloth: '#284f78', skin: '#d4a176', weapon: '#edf3f7', energy: '#72d9ee' },
  { armor: '#8f6b4a', armorDark: '#332c2b', cloth: '#842f36', skin: '#d2a179', weapon: '#d6dde2', energy: '#ffb44f' },
  { armor: '#b77835', armorDark: '#3e4b52', cloth: '#3c766f', skin: '#c99570', weapon: '#cad7da', energy: '#66ead9' },
  { armor: '#576779', armorDark: '#202b35', cloth: '#445b45', skin: '#bf8f6e', weapon: '#cbd7dd', energy: '#63d6ff' },
  { armor: '#784f9e', armorDark: '#202749', cloth: '#cb3c91', skin: '#c48e79', weapon: '#c6f8ff', energy: '#50f6ff' },
  { armor: '#8469b5', armorDark: '#262342', cloth: '#5e80aa', skin: '#d0a3a0', weapon: '#e1f5ff', energy: '#aefcf2' },
];

const ROLE_MARKS: Record<UnitRole, string> = {
  assault: '◆',
  ranger: '›',
  guardian: '▰',
  scout: '×',
  support: '+',
  siege: '✦',
};

function normalizedName(unit: UnitEntity): string {
  return unit.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isElephant(name: string): boolean {
  return name.includes('elephant') || name.includes('mammouth');
}

function isRaptor(name: string): boolean {
  return name.includes('raptor');
}

function isMounted(name: string): boolean {
  return name.includes('char ') || name.startsWith('char') || name.includes('cavalier') || name.includes('monte');
}

function isDrone(name: string): boolean {
  return name.includes('drone') || name.includes('essaim');
}

function isMech(name: string): boolean {
  return ['automate', 'scie mecanique', 'exo-', 'mastodonte', 'sentinelle', 'titan', 'colosse', 'gardien du vide', 'marcheur'].some((token) => name.includes(token));
}

function isArtillery(name: string, role: UnitRole): boolean {
  return role === 'siege' || ['canon', 'mortier', 'baliste', 'trebuchet', 'belier', 'bombarde', 'lance-rocher', 'lance-singularite'].some((token) => name.includes(token));
}

export function isSignatureUnit(unit: UnitEntity): boolean {
  const name = normalizedName(unit);
  return isElephant(name) || isRaptor(name) || isMounted(name) || isDrone(name) || isMech(name) || isArtillery(name, unit.role);
}

export function roleMark(role: UnitRole): string {
  return ROLE_MARKS[role];
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = '#07101d'): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, color: string, width: number, points: readonly [number, number][]): void {
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, fill: string, points: readonly [number, number][]): void {
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#07101d';
  ctx.stroke();
}

function drawElephant(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, name: string): void {
  const fur = name.includes('mammouth');
  const body = fur ? '#76583f' : material.armorDark;
  ellipse(ctx, -size * 0.04, -size * 0.02, size * 0.43, size * 0.28, body);
  for (const x of [-0.29, -0.1, 0.13, 0.29]) line(ctx, body, size * 0.14, [[size * x, size * 0.15], [size * x, size * 0.45]]);
  ellipse(ctx, size * 0.34, -size * 0.06, size * 0.22, size * 0.23, body);
  ellipse(ctx, size * 0.27, -size * 0.09, size * 0.13, size * 0.16, fur ? '#8e6a4b' : material.armor, '#16202a');
  ctx.beginPath();
  ctx.moveTo(size * 0.48, -size * 0.02);
  ctx.bezierCurveTo(size * 0.63, size * 0.08, size * 0.58, size * 0.36, size * 0.48, size * 0.39);
  ctx.strokeStyle = body;
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = 'round';
  ctx.stroke();
  line(ctx, '#f4e6c2', size * 0.045, [[size * 0.45, size * 0.03], [size * 0.61, size * 0.16]]);
  if (fur) line(ctx, '#f4e6c2', size * 0.045, [[size * 0.39, size * 0.02], [size * 0.54, size * 0.2]]);
  polygon(ctx, accent, [[-size * 0.34, -size * 0.2], [size * 0.22, -size * 0.23], [size * 0.28, size * 0.09], [-size * 0.32, size * 0.11]]);
  polygon(ctx, material.weapon, [[-size * 0.2, -size * 0.36], [size * 0.14, -size * 0.36], [size * 0.18, -size * 0.19], [-size * 0.24, -size * 0.19]]);
  ellipse(ctx, -size * 0.02, -size * 0.48, size * 0.07, size * 0.08, material.skin);
  line(ctx, material.weapon, size * 0.035, [[size * 0.02, -size * 0.43], [size * 0.29, -size * 0.6]]);
  ellipse(ctx, size * 0.42, -size * 0.12, size * 0.022, size * 0.022, '#fff6c7', '#fff6c7');
}

function drawRaptor(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string): void {
  ellipse(ctx, -size * 0.02, -size * 0.02, size * 0.28, size * 0.18, material.cloth);
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, -size * 0.02);
  ctx.quadraticCurveTo(-size * 0.58, -size * 0.18, -size * 0.64, size * 0.03);
  ctx.strokeStyle = material.cloth;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.stroke();
  line(ctx, material.cloth, size * 0.1, [[size * 0.17, -size * 0.1], [size * 0.31, -size * 0.34]]);
  polygon(ctx, material.armor, [[size * 0.26, -size * 0.42], [size * 0.55, -size * 0.35], [size * 0.47, -size * 0.2], [size * 0.28, -size * 0.22]]);
  line(ctx, material.armorDark, size * 0.075, [[-size * 0.08, size * 0.11], [-size * 0.18, size * 0.4], [-size * 0.33, size * 0.49]]);
  line(ctx, material.armorDark, size * 0.075, [[size * 0.1, size * 0.09], [size * 0.24, size * 0.38], [size * 0.4, size * 0.43]]);
  line(ctx, accent, size * 0.04, [[-size * 0.2, -size * 0.15], [size * 0.12, -size * 0.2]]);
  ellipse(ctx, size * 0.46, -size * 0.33, size * 0.025, size * 0.025, '#ffef83', '#ffef83');
  line(ctx, '#f3e4c0', size * 0.025, [[size * 0.51, -size * 0.27], [size * 0.59, -size * 0.23]]);
}

function drawMounted(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, name: string): void {
  const chariot = name.includes('char');
  if (chariot) {
    ellipse(ctx, -size * 0.27, size * 0.28, size * 0.16, size * 0.16, material.armorDark);
    ellipse(ctx, size * 0.08, size * 0.28, size * 0.16, size * 0.16, material.armorDark);
    ellipse(ctx, -size * 0.27, size * 0.28, size * 0.08, size * 0.08, material.weapon);
    ellipse(ctx, size * 0.08, size * 0.28, size * 0.08, size * 0.08, material.weapon);
    polygon(ctx, material.armor, [[-size * 0.42, -size * 0.1], [size * 0.18, -size * 0.1], [size * 0.1, size * 0.23], [-size * 0.33, size * 0.19]]);
  }
  ellipse(ctx, size * 0.22, size * 0.02, size * 0.31, size * 0.18, material.armorDark);
  line(ctx, material.armorDark, size * 0.08, [[size * 0.37, -size * 0.08], [size * 0.48, -size * 0.32]]);
  ellipse(ctx, size * 0.5, -size * 0.34, size * 0.11, size * 0.09, material.armorDark);
  for (const x of [0.03, 0.22, 0.37]) line(ctx, material.armorDark, size * 0.055, [[size * x, size * 0.13], [size * (x - 0.04), size * 0.42]]);
  ellipse(ctx, -size * 0.05, -size * 0.25, size * 0.09, size * 0.1, material.skin);
  polygon(ctx, accent, [[-size * 0.18, -size * 0.19], [size * 0.04, -size * 0.18], [size * 0.09, size * 0.08], [-size * 0.13, size * 0.07]]);
  line(ctx, material.weapon, size * 0.035, [[-size * 0.02, -size * 0.28], [size * 0.38, -size * 0.5]]);
}

function drawDrone(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, swarm: boolean): void {
  const drawSingle = (x: number, y: number, scale: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ellipse(ctx, 0, 0, size * 0.2 * scale, size * 0.1 * scale, material.armorDark);
    line(ctx, material.weapon, size * 0.035 * scale, [[-size * 0.28 * scale, 0], [size * 0.28 * scale, 0]]);
    for (const rotorX of [-0.3, 0.3]) ellipse(ctx, size * rotorX * scale, 0, size * 0.1 * scale, size * 0.035 * scale, accent, accent);
    ellipse(ctx, 0, size * 0.03 * scale, size * 0.045 * scale, size * 0.045 * scale, material.energy, material.energy);
    ctx.restore();
  };
  if (swarm) {
    drawSingle(-size * 0.27, -size * 0.17, 0.72);
    drawSingle(size * 0.18, -size * 0.3, 0.78);
    drawSingle(size * 0.28, size * 0.12, 0.66);
    drawSingle(-size * 0.1, size * 0.2, 0.88);
  } else drawSingle(0, 0, 1.35);
}

function drawArtillery(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, ageIndex: number): void {
  ellipse(ctx, -size * 0.26, size * 0.25, size * 0.18, size * 0.18, material.armorDark);
  ellipse(ctx, size * 0.18, size * 0.25, size * 0.18, size * 0.18, material.armorDark);
  ellipse(ctx, -size * 0.26, size * 0.25, size * 0.09, size * 0.09, material.weapon);
  ellipse(ctx, size * 0.18, size * 0.25, size * 0.09, size * 0.09, material.weapon);
  polygon(ctx, material.armor, [[-size * 0.39, -size * 0.02], [size * 0.28, -size * 0.04], [size * 0.35, size * 0.21], [-size * 0.36, size * 0.2]]);
  line(ctx, ageIndex >= 7 ? material.energy : material.weapon, size * 0.13, [[-size * 0.05, -size * 0.12], [size * 0.55, -size * 0.42]]);
  if (ageIndex >= 5) ellipse(ctx, -size * 0.1, -size * 0.02, size * 0.12, size * 0.12, accent);
  if (ageIndex >= 7) ellipse(ctx, size * 0.52, -size * 0.41, size * 0.08, size * 0.08, material.energy, material.energy);
  line(ctx, accent, size * 0.035, [[-size * 0.33, size * 0.04], [size * 0.26, size * 0.03]]);
}

function drawMech(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, name: string): void {
  const bulky = name.includes('mastodonte') || name.includes('titan') || name.includes('colosse');
  const bodyScale = bulky ? 1.14 : 1;
  line(ctx, material.armorDark, size * 0.12, [[-size * 0.16, size * 0.12], [-size * 0.23, size * 0.45]]);
  line(ctx, material.armorDark, size * 0.12, [[size * 0.16, size * 0.12], [size * 0.23, size * 0.45]]);
  polygon(ctx, material.armor, [[-size * 0.3 * bodyScale, -size * 0.25], [size * 0.3 * bodyScale, -size * 0.25], [size * 0.24 * bodyScale, size * 0.18], [-size * 0.24 * bodyScale, size * 0.18]]);
  polygon(ctx, material.armorDark, [[-size * 0.19, -size * 0.43], [size * 0.19, -size * 0.43], [size * 0.23, -size * 0.2], [-size * 0.23, -size * 0.2]]);
  line(ctx, material.weapon, size * 0.11, [[-size * 0.26, -size * 0.12], [-size * 0.48, size * 0.18]]);
  line(ctx, material.weapon, size * 0.11, [[size * 0.26, -size * 0.12], [size * 0.54, -size * 0.25]]);
  ellipse(ctx, 0, -size * 0.31, size * 0.12, size * 0.045, material.energy, material.energy);
  ellipse(ctx, 0, -size * 0.03, size * 0.085, size * 0.085, accent, accent);
}

function drawWeapon(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, role: UnitRole, ageIndex: number): void {
  if (role === 'guardian') {
    polygon(ctx, accent, [[-size * 0.47, -size * 0.2], [-size * 0.14, -size * 0.25], [-size * 0.1, size * 0.27], [-size * 0.3, size * 0.43], [-size * 0.5, size * 0.24]]);
    return;
  }
  if (role === 'support') {
    line(ctx, material.weapon, size * 0.055, [[size * 0.31, -size * 0.45], [size * 0.31, size * 0.44]]);
    ellipse(ctx, size * 0.31, -size * 0.45, size * 0.1, size * 0.1, material.energy, accent);
    line(ctx, '#ffffff', size * 0.026, [[size * 0.26, -size * 0.45], [size * 0.36, -size * 0.45]]);
    line(ctx, '#ffffff', size * 0.026, [[size * 0.31, -size * 0.5], [size * 0.31, -size * 0.4]]);
    return;
  }
  if (role === 'ranger') {
    if (ageIndex <= 2) {
      ctx.beginPath();
      ctx.arc(size * 0.28, -size * 0.02, size * 0.3, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = material.weapon;
      ctx.lineWidth = size * 0.045;
      ctx.stroke();
      line(ctx, '#eaf4ef', size * 0.018, [[size * 0.28, -size * 0.32], [size * 0.28, size * 0.28]]);
    } else line(ctx, ageIndex >= 7 ? material.energy : material.weapon, size * 0.075, [[size * 0.02, -size * 0.08], [size * 0.54, -size * 0.2]]);
    return;
  }
  if (role === 'scout') {
    line(ctx, ageIndex >= 7 ? material.energy : material.weapon, size * 0.045, [[-size * 0.22, 0], [-size * 0.49, size * 0.22]]);
    line(ctx, ageIndex >= 7 ? material.energy : material.weapon, size * 0.045, [[size * 0.2, 0], [size * 0.5, size * 0.16]]);
    return;
  }
  line(ctx, ageIndex >= 6 ? material.weapon : ageIndex === 0 ? material.armorDark : material.weapon, size * (ageIndex >= 6 ? 0.075 : 0.055), [[size * 0.08, -size * 0.05], [size * 0.48, -size * 0.4]]);
  if (ageIndex === 0) ellipse(ctx, size * 0.5, -size * 0.43, size * 0.1, size * 0.13, material.armorDark);
  if (ageIndex >= 7) line(ctx, material.energy, size * 0.025, [[size * 0.16, -size * 0.12], [size * 0.51, -size * 0.43]]);
}

function drawHumanoid(ctx: CanvasRenderingContext2D, size: number, material: UnitMaterial, accent: string, unit: UnitEntity): void {
  line(ctx, material.armorDark, size * 0.11, [[-size * 0.11, size * 0.16], [-size * 0.18, size * 0.46]]);
  line(ctx, material.armorDark, size * 0.11, [[size * 0.11, size * 0.16], [size * 0.18, size * 0.46]]);
  polygon(ctx, material.armor, [[-size * 0.25, -size * 0.2], [size * 0.25, -size * 0.2], [size * 0.2, size * 0.22], [-size * 0.2, size * 0.22]]);
  polygon(ctx, accent, [[-size * 0.25, -size * 0.16], [size * 0.24, -size * 0.16], [size * 0.2, -size * 0.02], [-size * 0.22, -size * 0.02]]);
  line(ctx, material.skin, size * 0.075, [[-size * 0.22, -size * 0.08], [-size * 0.39, size * 0.12]]);
  line(ctx, material.skin, size * 0.075, [[size * 0.22, -size * 0.08], [size * 0.38, size * 0.08]]);
  ellipse(ctx, 0, -size * 0.34, size * 0.145, size * 0.16, material.skin);
  if (unit.ageIndex === 0) polygon(ctx, material.armorDark, [[-size * 0.18, -size * 0.43], [0, -size * 0.57], [size * 0.18, -size * 0.43], [size * 0.12, -size * 0.28], [-size * 0.12, -size * 0.28]]);
  else if (unit.ageIndex <= 3) {
    ctx.beginPath();
    ctx.arc(0, -size * 0.38, size * 0.19, Math.PI, Math.PI * 2);
    ctx.fillStyle = material.weapon;
    ctx.fill();
    ctx.strokeStyle = '#07101d';
    ctx.stroke();
    if (unit.ageIndex === 2) line(ctx, accent, size * 0.04, [[0, -size * 0.55], [size * 0.2, -size * 0.64]]);
  } else if (unit.ageIndex <= 6) polygon(ctx, material.armorDark, [[-size * 0.18, -size * 0.47], [size * 0.18, -size * 0.47], [size * 0.14, -size * 0.31], [-size * 0.14, -size * 0.31]]);
  else {
    ctx.beginPath();
    ctx.arc(0, -size * 0.37, size * 0.2, Math.PI, Math.PI * 2);
    ctx.strokeStyle = material.energy;
    ctx.lineWidth = size * 0.045;
    ctx.stroke();
    line(ctx, material.energy, size * 0.025, [[-size * 0.11, -size * 0.37], [size * 0.11, -size * 0.37]]);
  }
  drawWeapon(ctx, size, material, accent, unit.role, unit.ageIndex);
}

export function drawUnitFigure(ctx: CanvasRenderingContext2D, unit: UnitEntity, size: number, teamAccent: string): void {
  const material = MATERIALS[Math.max(0, Math.min(MATERIALS.length - 1, unit.ageIndex))] ?? MATERIALS[0]!;
  const name = normalizedName(unit);
  ctx.save();
  ctx.lineWidth = Math.max(1.3, size * 0.025);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = '#020611d9';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.05;
  if (unit.team === 'enemy') ctx.scale(-1, 1);
  if (isElephant(name)) drawElephant(ctx, size, material, teamAccent, name);
  else if (isRaptor(name)) drawRaptor(ctx, size, material, teamAccent);
  else if (isMounted(name)) drawMounted(ctx, size, material, teamAccent, name);
  else if (isDrone(name)) drawDrone(ctx, size, material, teamAccent, name.includes('essaim'));
  else if (isArtillery(name, unit.role)) drawArtillery(ctx, size, material, teamAccent, unit.ageIndex);
  else if (isMech(name)) drawMech(ctx, size, material, teamAccent, name);
  else drawHumanoid(ctx, size, material, teamAccent, unit);
  ctx.restore();
}
