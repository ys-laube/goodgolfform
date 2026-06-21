import { describe, expect, it } from 'vitest';
import {
  caddieClubOrder,
  caddiePresetStorageKey,
  caddiePresetStorageVersion,
  clearCaddiePresets,
  createCaddieDistancePreset,
  deserializeCaddiePresets,
  estimateClubDistances,
  loadCaddiePresets,
  replaceCaddieClubDistance,
  saveCaddiePresets,
  serializeCaddiePresets,
  upsertCaddiePreset,
  type StorageLike,
} from './caddiePresets';

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

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('blocked read');
  }

  setItem(): void {
    throw new Error('blocked write');
  }

  removeItem(): void {
    throw new Error('blocked clear');
  }
}

describe('caddie local distance presets', () => {
  it('estimates a full club table from driver, 7I, and PW anchors', () => {
    const distances = estimateClubDistances({ driver: 220, sevenIron: 140, pitchingWedge: 105 });

    expect(distances.map((distance) => distance.club)).toEqual(caddieClubOrder);
    expect(distances.find((distance) => distance.club === 'driver')?.carryMeters).toBe(220);
    expect(distances.find((distance) => distance.club === '7i')?.carryMeters).toBe(140);
    expect(distances.find((distance) => distance.club === 'pw')?.carryMeters).toBe(105);
    expect(distances.find((distance) => distance.club === '6i')?.carryMeters).toBeGreaterThan(
      distances.find((distance) => distance.club === '7i')?.carryMeters ?? 0,
    );
    expect(distances.find((distance) => distance.club === '8i')?.carryMeters).toBeGreaterThan(
      distances.find((distance) => distance.club === '9i')?.carryMeters ?? 0,
    );
    expect(distances.find((distance) => distance.club === 'sw')?.carryMeters).toBeLessThanOrEqual(90);
  });

  it('clamps abnormal anchor and edited distances into the supported field range', () => {
    const preset = createCaddieDistancePreset({
      id: 'preset-clamped',
      name: '',
      anchorDistances: { driver: Number.NaN, sevenIron: 500, pitchingWedge: -1 },
    });
    const edited = replaceCaddieClubDistance(preset, 'pw', 24);

    expect(preset.name).toBe('내 거리 프리셋');
    expect(preset.anchorDistances.driver).toBe(180);
    expect(preset.anchorDistances.sevenIron).toBe(330);
    expect(preset.anchorDistances.pitchingWedge).toBe(30);
    expect(edited.clubDistances.find((distance) => distance.club === 'pw')?.carryMeters).toBe(30);
  });

  it('serializes and restores versioned local caddie presets', () => {
    const preset = createCaddieDistancePreset({
      id: 'preset-my-yardage',
      name: '내 거리',
      anchorDistances: { driver: 215, sevenIron: 135, pitchingWedge: 100 },
      updatedAt: '2026-06-21T00:00:00.000Z',
    });
    const raw = serializeCaddiePresets([preset]);
    const parsed = JSON.parse(raw) as { version: number };

    expect(parsed.version).toBe(caddiePresetStorageVersion);
    expect(deserializeCaddiePresets(raw)).toEqual([preset]);
  });

  it('saves, upserts, loads, and clears through the versioned storage key', () => {
    const storage = new MemoryStorage();
    const preset = createCaddieDistancePreset({
      id: 'preset-local',
      name: '철수 기본 거리',
      anchorDistances: { driver: 230, sevenIron: 145, pitchingWedge: 105 },
    });
    const edited = replaceCaddieClubDistance({ ...preset, name: '철수 수정 거리' }, 'gw', 88);

    expect(saveCaddiePresets(storage, [preset])).toBe(true);
    expect(storage.getItem(caddiePresetStorageKey)).toContain('철수 기본 거리');
    expect(upsertCaddiePreset(loadCaddiePresets(storage), edited)).toEqual([edited]);

    saveCaddiePresets(storage, upsertCaddiePreset(loadCaddiePresets(storage), edited));
    expect(loadCaddiePresets(storage)).toEqual([edited]);
    expect(clearCaddiePresets(storage)).toBe(true);
    expect(loadCaddiePresets(storage)).toEqual([]);
  });

  it('falls back safely for malformed, mismatched, corrupted, and unavailable storage', () => {
    const storage = new MemoryStorage();
    const preset = createCaddieDistancePreset({
      id: 'preset-safe',
      name: '안전 프리셋',
      anchorDistances: { driver: 210, sevenIron: 130, pitchingWedge: 95 },
    });

    storage.setItem(caddiePresetStorageKey, '{bad json');
    expect(loadCaddiePresets(storage)).toEqual([]);

    storage.setItem(caddiePresetStorageKey, JSON.stringify({ version: 999, presets: [preset] }));
    expect(loadCaddiePresets(storage)).toEqual([]);

    storage.setItem(caddiePresetStorageKey, JSON.stringify({ version: caddiePresetStorageVersion, presets: [{ ...preset, clubDistances: [] }] }));
    expect(loadCaddiePresets(storage)).toEqual([]);

    const throwingStorage = new ThrowingStorage();
    expect(loadCaddiePresets(throwingStorage)).toEqual([]);
    expect(saveCaddiePresets(throwingStorage, [preset])).toBe(false);
    expect(clearCaddiePresets(throwingStorage)).toBe(false);
  });
});
