import type { CombatEvent, SettingsState } from '../types';

type SoundId = 'impact' | 'coin' | 'era' | 'confirm';

const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const SOUND_PATHS: Record<SoundId, string> = {
  impact: assetUrl('audio/original/impact.wav'),
  coin: assetUrl('audio/original/coin.wav'),
  era: assetUrl('audio/original/era-unlock.wav'),
  confirm: assetUrl('audio/original/ui-confirm.wav'),
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private ui: GainNode | null = null;
  private buffers = new Map<SoundId | 'music', AudioBuffer>();
  private musicSource: AudioBufferSourceNode | null = null;
  private unlocked = false;
  private settings: SettingsState;
  private lastImpact = 0;
  private lastCoin = 0;

  constructor(settings: SettingsState) {
    this.settings = settings;
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend();
      else if (this.unlocked) void this.context.resume();
    });
  }

  async unlock(): Promise<void> {
    if (this.unlocked && this.context) {
      await this.context.resume();
      return;
    }
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    this.context = new Context();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.ui = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 8;
    compressor.ratio.value = 6;
    this.music.connect(this.master);
    this.effects.connect(this.master);
    this.ui.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(this.context.destination);
    this.unlocked = true;
    this.applySettings(this.settings);
    void this.loadBuffers().then(() => this.startMusic());
  }

  private async loadBuffers(): Promise<void> {
    if (!this.context) return;
    const paths: Array<[SoundId | 'music', string]> = [
      ['music', assetUrl('audio/original/chronoforge-loop.wav')],
      ...Object.entries(SOUND_PATHS) as Array<[SoundId, string]>,
    ];
    await Promise.all(paths.map(async ([id, path]) => {
      try {
        const response = await fetch(path);
        const data = await response.arrayBuffer();
        this.buffers.set(id, await this.context!.decodeAudioData(data));
      } catch {
        // Le jeu reste jouable et silencieux si le navigateur refuse le décodage.
      }
    }));
  }

  private startMusic(): void {
    if (!this.context || !this.music || this.musicSource || !this.buffers.has('music')) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get('music') ?? null;
    source.loop = true;
    source.connect(this.music);
    source.start();
    this.musicSource = source;
  }

  play(id: SoundId, variation = true): void {
    if (!this.context || !this.unlocked) return;
    const buffer = this.buffers.get(id);
    const destination = id === 'confirm' ? this.ui : this.effects;
    if (!buffer || !destination) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = variation ? 0.94 + Math.random() * 0.12 : 1;
    gain.gain.value = id === 'impact' ? 0.52 : id === 'coin' ? 0.42 : 0.68;
    source.connect(gain);
    gain.connect(destination);
    source.start();
  }

  handleEvents(events: readonly CombatEvent[]): void {
    const now = performance.now();
    for (const event of events) {
      if (event.type === 'hit' && now - this.lastImpact > 72) {
        this.play('impact');
        this.lastImpact = now;
      } else if (event.type === 'coin' && now - this.lastCoin > 110) {
        this.play('coin');
        this.lastCoin = now;
      } else if (event.type === 'sector') {
        this.play('era', false);
      }
    }
  }

  applySettings(settings: SettingsState): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.music || !this.effects || !this.ui) return;
    const now = this.context.currentTime;
    const masterValue = settings.muted ? 0 : settings.masterVolume;
    this.master.gain.setTargetAtTime(masterValue, now, 0.03);
    this.music.gain.setTargetAtTime(settings.musicVolume, now, 0.03);
    this.effects.gain.setTargetAtTime(settings.effectsVolume, now, 0.03);
    this.ui.gain.setTargetAtTime(settings.uiVolume, now, 0.03);
  }

  setBossDucking(active: boolean): void {
    if (!this.context || !this.music) return;
    this.music.gain.setTargetAtTime(this.settings.musicVolume * (active ? 0.72 : 1), this.context.currentTime, 0.25);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
