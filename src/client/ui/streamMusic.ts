// Background music streamed by the browser (an <audio> element) instead of
// a Phaser sound, which would download the whole track before it can play
// and then decode it into ~90 MB of memory. It starts while still
// downloading. Its source is assigned only after a player gesture.
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
  private activated = false;
  private muted = false;
  private readonly onGesture = (event: Event) => {
    if (!event.isTrusted) return;
    this.activated = true;
    this.start();
  };

  constructor(
    private readonly url: string,
    volume: number,
    output?: MusicOutput
  ) {
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'none';
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
      window.addEventListener(type, this.onGesture, { capture: true });
  }

  private start() {
    if (
      !this.activated ||
      !this.wanted ||
      this.muted ||
      document.hidden ||
      !this.el.paused
    )
      return;
    if (!this.el.hasAttribute('src')) this.el.src = this.url;
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

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    if (!this.source) this.el.muted = muted;
    if (muted) this.el.pause();
    else this.start();
  }

  destroy() {
    this.wanted = false;
    for (const type of GESTURES)
      window.removeEventListener(type, this.onGesture, { capture: true });
    this.el.pause();
    this.source?.disconnect();
    this.gain?.disconnect();
    if (this.el.hasAttribute('src')) {
      this.el.removeAttribute('src');
      this.el.load(); // drops the download and the buffered audio
    }
  }
}
