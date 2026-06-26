import type { StorageLike } from './domain/scorecardStorage';

function browserWindow(): Window | undefined {
  try {
    return globalThis.window;
  } catch {
    return undefined;
  }
}

export function availableLocalStorage(): StorageLike | undefined {
  try {
    return browserWindow()?.localStorage;
  } catch {
    return undefined;
  }
}
