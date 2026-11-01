export const POST_TYPES = ['daily', 'classic', 'casual'] as const;
export type PostType = (typeof POST_TYPES)[number];
export const POST_TYPE_LABEL: Record<PostType, string> = {
  daily: 'DAILY CHALLENGE',
  classic: 'CLASSIC',
  casual: 'CUSTOM',
};

export const parsePostType = (value: unknown): PostType | null =>
  POST_TYPES.find((type) => type === value) ?? null;

// Old custom posts are challenges; the original install post is Classic.
export function postType(data: unknown): PostType {
  if (typeof data !== 'object' || data === null) return 'classic';
  return (
    parsePostType(Reflect.get(data, 'matchType')) ??
    (Reflect.get(data, 'match') ? 'daily' : 'classic')
  );
}

// Shared by result saving and score sharing. Legacy clients omit mode.
export function competitiveResultAllowed(data: unknown, result: unknown) {
  if (postType(data) === 'casual') return false;
  if (typeof result !== 'object' || result === null) return false;
  const mode: unknown = Reflect.get(result, 'mode');
  return mode === undefined || mode === 'competitive';
}
