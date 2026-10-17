// The master sound switch (music and effects), kept here as the one source
// of truth. Phaser's `sound.mute` can't be read back reliably: it reports the
// Web Audio gain, which only changes on the audio engine's next processing
// step (and not at all while audio is still locked before the first touch),
// so reading it right after setting it gave the old value and the button
// toggled back. Remembered in localStorage when available.

const KEY = 'street-soccer-muted';

let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false; // storage can be unavailable inside an embedded browser
  }
})();

export const soundMuted = () => muted;

// Sets the switch and applies it to Phaser's sound (`sound`: any scene's
// sound manager; they are all the game's one manager). The streamed music
// reads soundMuted() every frame.
export function setSoundMuted(sound: { mute: boolean }, value: boolean) {
  muted = value;
  sound.mute = value;
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // the current session still respects the switch
  }
}
