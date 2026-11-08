export function locationMatchScore(query: string, names: string[], codes: string[] = []): number {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return 0;
  const ns = names.filter(Boolean).map(x => x.toLocaleLowerCase());
  const cs = codes.filter(Boolean).map(x => x.toLocaleLowerCase());
  if (ns.includes(q) || cs.includes(q)) return 100;
  if (ns.some(x => x.startsWith(q))) return 80;
  if (ns.some(x => x.split(/[\s,/-]+/).some(word => word.startsWith(q)))) return 70;
  if (q.length >= 3 && cs.some(x => x.startsWith(q) || x.slice(2).startsWith(q))) return 60;
  if (q.length >= 3 && ns.some(x => x.includes(q))) return 40;
  return 0;
}
