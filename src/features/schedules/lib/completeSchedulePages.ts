type Page<T> = { data: T[]; pagination: { total: number; pageSize?: number; totalPages?: number }; done: boolean };

// Only complete a finished query. Follow-up pages must never start another refresh.
export async function completeSchedulePages<T extends { id: string }, P extends Page<T>>(first: P, url: string, request: typeof fetch = fetch): Promise<P> {
  if (!first.done || first.data.length >= first.pagination.total) return first;
  const size = first.pagination.pageSize || first.data.length;
  const pages = first.pagination.totalPages || Math.ceil(first.pagination.total / size);
  if (!size || !Number.isFinite(pages) || pages > 100) throw new Error("船期结果过多，请缩小日期范围后重试");
  const query = new URL(url, "http://localhost");
  query.searchParams.delete("refresh");
  query.searchParams.delete("retry");
  const rows = new Map(first.data.map(row => [row.id, row]));
  for (let page = 2; page <= pages; page++) {
    query.searchParams.set("page", String(page));
    const response = await request(url.startsWith("/") ? query.pathname + query.search : query.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("船期后续分页请求失败");
    const next = await response.json() as P;
    if (!next.done || next.pagination.total !== first.pagination.total) throw new Error("船期结果已更新，请重新查询");
    for (const row of next.data) rows.set(row.id, row);
  }
  if (rows.size !== first.pagination.total) throw new Error("船期分页结果不完整，请重试");
  return { ...first, data: [...rows.values()] };
}
