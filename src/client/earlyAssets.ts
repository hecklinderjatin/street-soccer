import { matchAssets, type Asset } from './art/assetList';
import { startingConfig } from './challenge';

// Starts downloading the match art at once, in parallel with the game code
// (instead of after it: Phaser's loader can only start once the ~230 KB game
// bundle has arrived and run). Each file is fetched once into a blob; the
// game's loader then reads that blob (an object URL), so nothing is
// downloaded twice. A failed early fetch just falls back to the normal URL.

const early = new Map<string, Promise<string | null>>();

export function startEarlyDownloads() {
  for (const asset of matchAssets(startingConfig())) {
    if (early.has(asset.url)) continue;
    early.set(
      asset.url,
      fetch(asset.url)
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => (blob ? URL.createObjectURL(blob) : null))
        .catch(() => null)
    );
  }
}

// `assets` with each URL swapped for its early download, once those are in
// (or the normal URL where there was none, or it failed).
export async function withEarlyDownloads(
  assets: readonly Asset[]
): Promise<Asset[]> {
  return Promise.all(
    assets.map(async (asset) => ({
      key: asset.key,
      url: (await early.get(asset.url)) ?? asset.url,
    }))
  );
}

// Frees the early blobs once the game has its own copies.
export async function releaseEarlyDownloads(assets: readonly Asset[]) {
  for (const asset of assets) {
    const url = await early.get(asset.url);
    if (url) URL.revokeObjectURL(url);
    early.delete(asset.url);
  }
}
