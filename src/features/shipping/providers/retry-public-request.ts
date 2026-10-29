// Two attempts maximum, only for transient transport failures or server errors.
// Access rejection, authentication and rate limiting are never retried here.
export async function retryPublicRequest<T extends { status(): number }>(query: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await query();
      if (response.status() < 500 || attempt === 1) return response;
    } catch (error) {
      if (attempt === 1 || !(error instanceof Error)
        || !/Timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|connection/i.test(error.message)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error("PUBLIC_REQUEST_FAILED");
}
