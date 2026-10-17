type Comment = {
  id: `t1_${string}`;
  stickied: boolean;
  removed: boolean;
  body: string;
  postId: string;
  distinguish: (sticky: boolean) => Promise<void>;
};

type ThreadStore = {
  saved: () => Promise<string | undefined>;
  pending: (id: string) => Promise<void>;
  published: (id: string) => Promise<void>;
  fetch: (id: `t1_${string}`) => Promise<Comment | null>;
  create: () => Promise<Comment>;
};

// Never return a cached ID without checking the current moderation state.
// Failed pinning retains a pending candidate so a retry does not spam comments.
export async function requirePinnedThread(postId: string, store: ThreadStore) {
  const saved = await store.saved();
  const validId = (id: string): id is `t1_${string}` => id.startsWith('t1_');
  let comment = saved && validId(saved) ? await store.fetch(saved) : null;
  if (
    comment &&
    (comment.removed ||
      comment.body === '[deleted]' ||
      comment.body === '[removed]')
  )
    comment = null;
  if (!comment) {
    comment = await store.create();
    await store.pending(comment.id);
  }
  if (comment.postId !== postId)
    throw new Error('Scores comment belongs to another post');
  if (!comment.stickied) {
    await comment.distinguish(true);
    const refreshed = await store.fetch(comment.id);
    if (!refreshed?.stickied || refreshed.removed)
      throw new Error(
        'Scores comment could not be pinned. Please retry later.'
      );
  }
  await store.published(comment.id);
  return comment.id;
}
