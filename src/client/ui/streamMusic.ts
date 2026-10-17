// Background music streamed by the browser (an <audio> element) instead of
// a Phaser sound, which would download the whole track before it can play
// and then decode it into ~90 MB of memory. It starts while still
// downloading and never holds up the match.
//
// Where the game uses Web Audio (`output`), the element is routed through
// it: its own gain sets the volume (phones such as iPhones ignore an audio
// element's volume) and Phaser's master mute applies. Browsers only let
// media start from a tap (the post's PLAY happened in another frame), so a
// refused start is retried on the player's next touch, click or key.
export type MusicOutput = { context: AudioContext; destination: AudioNode };

const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const;

export class StreamMusic {
  private readonly el: HTMLAudioElement;
  private readonly gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private wanted = false; // should be playing
  private readonly retry = () => {
    if (this.wanted && this.el.paused) this.start();
  };

  constructor(url: string, volume: number, output?: MusicOutput) {
    this.el = new Audio(url);
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = volume;
    if (output) {
      try {
        this.source = output.context.createMediaElementSource(this.el);
        this.gain = output.context.createGain();
        this.gain.gain.value = volume;
        this.source.connect(this.gain).connect(output.destination);
        this.el.volume = 1; // the gain does it
      } catch {
        this.source = null; // plays straight from the element instead
      }
    }
    for (const type of GESTURES)
      window.addEventListener(type, this.retry, { capture: true });
  }

  private start() {
    this.el.play().catch(() => undefined); // retried on the next gesture
  }

  play() {
    this.wanted = true;
    this.start();
  }

  pause() {
    this.wanted = false;
    this.el.pause();
  }

  resume() {
    this.wanted = true;
    this.start();
  }

  stop() {
    this.wanted = false;
    this.el.pause();
    this.el.currentTime = 0;
  }

  // Only needed when not routed through Web Audio (there Phaser's master
  // mute already applies).
  setMuted(muted: boolean) {
    if (!this.source) this.el.muted = muted;
  }

  destroy() {
    this.wanted = false;
    for (const type of GESTURES)
      window.removeEventListener(type, this.retry, { capture: true });
    this.el.pause();
    this.source?.disconnect();
    this.gain?.disconnect();
    this.el.removeAttribute('src');
    this.el.load(); // drops the download and the buffered audio
  }
}
