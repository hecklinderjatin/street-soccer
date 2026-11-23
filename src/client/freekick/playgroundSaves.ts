import type { PlaygroundSave } from '../../shared/api';
import { parseCustomSetup } from '../../shared/freeKickCustom';

export async function playgroundApi(
  path: string,
  body?: object
): Promise<unknown> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error: unknown =
      data && typeof data === 'object' ? Reflect.get(data, 'error') : null;
    throw new Error(
      typeof error === 'string'
        ? error
        : 'Playground unavailable. Please retry.'
    );
  }
  return data;
}

// The player's saved kicks, after a list, save or delete.
export async function playgroundSaves(
  action: 'saves' | 'delete',
  body?: object
): Promise<PlaygroundSave[]> {
  const data = await playgroundApi(`/api/playground/${action}`, body);
  const raw: unknown =
    data && typeof data === 'object' ? Reflect.get(data, 'saves') : null;
  if (!Array.isArray(raw)) return [];
  const saves: PlaygroundSave[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const setup = parseCustomSetup(Reflect.get(item, 'setup'), true);
    const at: unknown = Reflect.get(item, 'slot');
    const savedAt: unknown = Reflect.get(item, 'savedAt');
    if (
      typeof setup !== 'string' &&
      typeof at === 'number' &&
      typeof savedAt === 'number'
    )
      saves.push({ slot: at, setup, savedAt });
  }
  return saves;
}
