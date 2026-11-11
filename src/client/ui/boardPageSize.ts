export function boardPageSize() {
  const height = window.innerHeight;
  return height <= 260 ? 1 : height <= 400 ? 3 : 5;
}
