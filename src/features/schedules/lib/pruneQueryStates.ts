// Keep active work and the current polling key; evict only completed metadata.
export function pruneQueryStates<T extends {done: boolean; startedAt: number}>(states: Map<string, T>, now: number, ttlMs: number, keepKey: string, maxCompleted = 200) {
  const completed = [...states].filter(([key, value]) => key !== keepKey && value.done).sort((a,b) => a[1].startedAt-b[1].startedAt);
  let remaining = completed.length;
  for (const [key, value] of completed) {
    if (now-value.startedAt >= ttlMs || remaining > maxCompleted) { states.delete(key); remaining--; }
  }
}
