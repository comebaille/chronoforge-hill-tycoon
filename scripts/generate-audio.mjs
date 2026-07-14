import { mkdirSync, writeFileSync } from 'node:fs';

const SAMPLE_RATE = 22050;

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000 * 2 - 1;
  };
}

function writeWav(path, duration, generator) {
  const sampleCount = Math.floor(SAMPLE_RATE * duration);
  const dataBytes = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const value = Math.max(-1, Math.min(1, generator(time, duration)));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  writeFileSync(path, buffer);
}

mkdirSync('public/audio/original', { recursive: true });

const loopNoise = seededNoise(7421);
writeWav('public/audio/original/chronoforge-loop.wav', 12, (time, duration) => {
  const beat = time % 0.5;
  const kickEnvelope = Math.exp(-beat * 15);
  const kick = Math.sin(Math.PI * 2 * (72 - beat * 38) * time) * kickEnvelope * 0.2;
  const pulse = Math.sin(Math.PI * 2 * 55 * time) * 0.07 + Math.sin(Math.PI * 2 * 82.5 * time) * 0.025;
  const step = Math.floor(time * 4) % 8;
  const notes = [220, 246.94, 293.66, 329.63, 293.66, 246.94, 196, 246.94];
  const noteEnvelope = Math.exp(-(time * 4 % 1) * 4.5);
  const pluck = Math.sin(Math.PI * 2 * notes[step] * time) * noteEnvelope * 0.055;
  const hat = beat > 0.24 && beat < 0.31 ? loopNoise() * Math.exp(-(beat - 0.24) * 80) * 0.025 : 0;
  const edgeFade = Math.min(1, time / 0.08, (duration - time) / 0.08);
  return (kick + pulse + pluck + hat) * edgeFade;
});

const impactNoise = seededNoise(9941);
writeWav('public/audio/original/impact.wav', 0.34, (time) => {
  const envelope = Math.exp(-time * 14);
  return (Math.sin(Math.PI * 2 * (95 - time * 80) * time) * 0.48 + impactNoise() * 0.25) * envelope;
});

writeWav('public/audio/original/coin.wav', 0.42, (time) => {
  const envelope = Math.exp(-time * 7.5);
  const frequency = time < 0.12 ? 740 : 1050;
  return (Math.sin(Math.PI * 2 * frequency * time) * 0.33 + Math.sin(Math.PI * 2 * frequency * 1.5 * time) * 0.12) * envelope;
});

writeWav('public/audio/original/era-unlock.wav', 1.5, (time) => {
  const attack = Math.min(1, time * 5);
  const release = Math.min(1, (1.5 - time) * 1.4);
  const envelope = attack * release;
  return (
    Math.sin(Math.PI * 2 * 220 * time) * 0.15 +
    Math.sin(Math.PI * 2 * 277.18 * time) * 0.12 +
    Math.sin(Math.PI * 2 * 329.63 * time) * 0.1 +
    Math.sin(Math.PI * 2 * 440 * time) * 0.06
  ) * envelope;
});

writeWav('public/audio/original/ui-confirm.wav', 0.16, (time) => {
  const envelope = Math.exp(-time * 24);
  return Math.sin(Math.PI * 2 * (520 + time * 820) * time) * envelope * 0.28;
});
