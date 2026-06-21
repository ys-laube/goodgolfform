import { describe, expect, it } from 'vitest';
import {
  builtInProfilePresets,
  clearSavedProfilePresets,
  deserializeProfilePresets,
  loadSavedProfilePresets,
  profilePresetStorageKey,
  profilePresetStorageVersion,
  saveProfilePresets,
  serializeProfilePresets,
  upsertProfilePreset,
  type StorageLike,
} from './profilePresets';

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('storage read blocked');
  }

  setItem(): void {
    throw new Error('storage write blocked');
  }

  removeItem(): void {
    throw new Error('storage clear blocked');
  }
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('profile presets', () => {
  it('ships built-in presets with required profile fields and club distances', () => {
    expect(builtInProfilePresets.length).toBeGreaterThanOrEqual(3);
    for (const preset of builtInProfilePresets) {
      expect(preset.id).toMatch(/^preset-/);
      expect(preset.name).toBeTruthy();
      expect(preset.heightCm).toBeGreaterThan(120);
      expect(preset.weightKg).toBeGreaterThan(40);
      expect(preset.clubDistances.map((distance) => distance.club)).toEqual(
        expect.arrayContaining(['driver', '7i', 'pw']),
      );
    }
  });

  it('serializes and deserializes versioned presets while preserving club distances', () => {
    const raw = serializeProfilePresets([builtInProfilePresets[0]]);
    const parsed = JSON.parse(raw) as { version: number };

    expect(parsed.version).toBe(profilePresetStorageVersion);
    expect(deserializeProfilePresets(raw)).toEqual([builtInProfilePresets[0]]);
  });

  it('saves and restores valid v1 data under the versioned storage key', () => {
    const storage = new MemoryStorage();

    expect(saveProfilePresets(storage, [builtInProfilePresets[1]])).toBe(true);
    expect(storage.getItem(profilePresetStorageKey)).toContain('부드러운 드로 플레이어');
    expect(loadSavedProfilePresets(storage)).toEqual([builtInProfilePresets[1]]);
  });

  it('falls back safely on malformed or unsupported storage data', () => {
    const storage = new MemoryStorage();
    storage.setItem(profilePresetStorageKey, '{bad json');
    expect(loadSavedProfilePresets(storage)).toEqual([]);

    storage.setItem(profilePresetStorageKey, JSON.stringify({ version: 999, profiles: [builtInProfilePresets[0]] }));
    expect(loadSavedProfilePresets(storage)).toEqual([]);

    storage.setItem(profilePresetStorageKey, JSON.stringify({ version: 1, profiles: [{ id: 'broken' }] }));
    expect(loadSavedProfilePresets(storage)).toEqual([]);
  });

  it('handles storage read, write, and clear exceptions without crashing the app flow', () => {
    const storage = new ThrowingStorage();

    expect(loadSavedProfilePresets(storage)).toEqual([]);
    expect(saveProfilePresets(storage, [builtInProfilePresets[0]])).toBe(false);
    expect(clearSavedProfilePresets(storage)).toBe(false);
  });

  it('rejects corrupted club distance payloads outside the supported domain', () => {
    const storage = new MemoryStorage();
    const corruptedClub = {
      ...builtInProfilePresets[0],
      clubDistances: [{ club: 'alien-wedge', carryMeters: 120 }],
    };
    const corruptedDistance = {
      ...builtInProfilePresets[0],
      clubDistances: [{ club: '7i', carryMeters: Number.NaN }],
    };

    storage.setItem(profilePresetStorageKey, JSON.stringify({ version: profilePresetStorageVersion, profiles: [corruptedClub] }));
    expect(loadSavedProfilePresets(storage)).toEqual([]);

    storage.setItem(profilePresetStorageKey, JSON.stringify({ version: profilePresetStorageVersion, profiles: [corruptedDistance] }));
    expect(loadSavedProfilePresets(storage)).toEqual([]);
  });

  it('upserts and clears saved presets without requiring browser globals', () => {
    const storage = new MemoryStorage();
    const editedPreset = { ...builtInProfilePresets[0], name: 'Edited Balanced Maker' };

    const nextPresets = upsertProfilePreset([builtInProfilePresets[0]], editedPreset);
    expect(nextPresets).toEqual([editedPreset]);

    saveProfilePresets(storage, nextPresets);
    expect(clearSavedProfilePresets(storage)).toBe(true);
    expect(loadSavedProfilePresets(storage)).toEqual([]);
  });
});
