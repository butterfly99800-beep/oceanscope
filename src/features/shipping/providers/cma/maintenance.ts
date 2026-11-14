/** Only explicit official notices qualify; empty results and verification pages do not. */
export function isCmaMaintenance(text: string) {
  return /We are improving the eBusiness area|unavailable due to scheduled maintenance/i.test(text);
}
export function allowCmaMaintenanceFallback(forceRefresh: boolean, providers: {code:string;warnings:string[]}[]) {
  return !forceRefresh && providers.some(p=>p.code === "CMA" && p.warnings.some(w=>/CMA_MAINTENANCE/.test(w)));
}
