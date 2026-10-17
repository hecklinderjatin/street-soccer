type ErasureStore = {
  zRem: (key: string, members: string[]) => Promise<unknown>;
  hDel: (key: string, fields: string[]) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
};

export async function removePlayerResults(
  store: ErasureStore,
  boards: readonly string[],
  username: string
) {
  for (const board of boards) {
    await store.zRem(board, [username]);
    await store.hDel(`${board}:stats`, [username]);
    const postId = board.split(':')[1];
    await store.del(
      `cooldown:result:${postId}:${username}`,
      `cooldown:comment:${postId}:${username}`
    );
  }
}

export async function removeUnavailableAccounts(
  usernames: readonly string[],
  exists: (username: string) => Promise<boolean>,
  forget: (username: string) => Promise<void>
) {
  for (const username of new Set(usernames)) {
    if (!(await exists(username))) await forget(username);
  }
}
