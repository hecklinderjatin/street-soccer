// Load-time marks: milliseconds since the page started opening, logged to
// the console as "[timing] <name> <ms> ms" so the time from tapping the post
// to a playable match can be measured on a real phone. With ?debug they also
// show in the match's debug overlay.
const marks: string[] = [];

export function markTiming(name: string) {
  const ms = Math.round(performance.now());
  marks.push(`${name} ${ms}`);
  console.info(`[timing] ${name} ${ms} ms`);
}

export function timingSummary() {
  return marks.join(' | ');
}
