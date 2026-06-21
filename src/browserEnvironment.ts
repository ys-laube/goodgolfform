import type { StorageLike } from './domain/profilePresets';

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

export function currentMatchMedia(): Window['matchMedia'] | undefined {
  try {
    return browserWindow()?.matchMedia;
  } catch {
    return undefined;
  }
}
