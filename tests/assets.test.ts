import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('couverture locale des assets', () => {
  it.each([
    'public/assets/generated/chronoforge-key-art.webp',
    'public/assets/original/unit-sprites.svg',
    'public/icons/chronoforge-icon.svg',
    'public/icons/chronoforge-icon-192.png',
    'public/icons/chronoforge-icon-512.png',
    'public/audio/original/chronoforge-loop.wav',
    'public/audio/original/impact.wav',
    'public/audio/original/coin.wav',
    'public/audio/original/era-unlock.wav',
    'public/audio/original/ui-confirm.wav',
  ])('%s existe et n’est pas vide', (path) => {
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(100);
  });
});
