let locked = false;

export function acquireCoscoScraperLock() {
  if (locked) return false;
  locked = true;
  return true;
}

export function releaseCoscoScraperLock() {
  locked = false;
}
