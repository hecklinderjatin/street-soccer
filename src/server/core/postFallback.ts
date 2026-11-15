export function gamePostFallback(mode: string, objective: string, play: string) {
  return {
    text: [
      `**Street Soccer · ${mode}**`,
      objective,
      `Open this post on www.reddit.com or in the official Reddit app and select **${play}** to play.`,
    ].join('\n\n'),
  };
}

export function playgroundPostFallback(distanceM: number) {
  return gamePostFallback(
    'Free Kick Playground',
    `Score this player-built free kick from ${distanceM} m. Retry until you score.`,
    'Play'
  );
}
