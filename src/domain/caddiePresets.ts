export const caddiePresetStorageKey = 'korean-caddie:preset-distances:v1';
export const caddiePresetStorageVersion = 1;

export type CaddieClubKey = 'driver' | '3w' | '5w' | '4i' | '5i' | '6i' | '7i' | '8i' | '9i' | 'pw' | 'gw' | 'sw';

export type CaddieClubDistance = {
  readonly club: CaddieClubKey;
  readonly carryMeters: number;
};

export type CaddieAnchorDistances = {
  readonly driver: number;
  readonly sevenIron: number;
  readonly pitchingWedge: number;
};

export type CaddieDistancePreset = {
  readonly id: string;
  readonly name: string;
  readonly anchorDistances: CaddieAnchorDistances;
  readonly clubDistances: readonly CaddieClubDistance[];
  readonly updatedAt: string;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredCaddiePresetPayload = {
  readonly version: typeof caddiePresetStorageVersion;
  readonly presets: readonly CaddieDistancePreset[];
};

export const caddieClubOrder: readonly CaddieClubKey[] = ['driver', '3w', '5w', '4i', '5i', '6i', '7i', '8i', '9i', 'pw', 'gw', 'sw'];

const interpolationIndexes: Record<CaddieClubKey, number> = {
  driver: 0,
  '3w': 1,
  '5w': 2,
  '4i': 3,
  '5i': 4,
  '6i': 5,
  '7i': 6,
  '8i': 7,
  '9i': 8,
  pw: 9,
  gw: 10,
  sw: 11,
};

export function estimateClubDistances(anchors: CaddieAnchorDistances): readonly CaddieClubDistance[] {
  const driver = clampCarryMeters(anchors.driver, 180);
  const sevenIron = clampCarryMeters(anchors.sevenIron, 135);
  const pitchingWedge = clampCarryMeters(anchors.pitchingWedge, 100);
  const longGap = Math.max(6, (driver - sevenIron) / 6);
  const shortGap = Math.max(5, (sevenIron - pitchingWedge) / 3);
  const wedgeGap = Math.max(8, Math.min(15, shortGap + 2));

  return caddieClubOrder.map((club) => {
    let carryMeters: number;
    const index = interpolationIndexes[club];

    if (index <= interpolationIndexes['7i']) {
      carryMeters = driver - longGap * index;
    } else if (index <= interpolationIndexes.pw) {
      carryMeters = sevenIron - shortGap * (index - interpolationIndexes['7i']);
    } else {
      carryMeters = pitchingWedge - wedgeGap * (index - interpolationIndexes.pw);
    }

    if (club === 'driver') {
      carryMeters = driver;
    } else if (club === '7i') {
      carryMeters = sevenIron;
    } else if (club === 'pw') {
      carryMeters = pitchingWedge;
    }

    return { club, carryMeters: clampCarryMeters(carryMeters, carryMeters) };
  });
}

export function createCaddieDistancePreset(input: {
  readonly id?: string;
  readonly name: string;
  readonly anchorDistances: CaddieAnchorDistances;
  readonly updatedAt?: string;
}): CaddieDistancePreset {
  const anchorDistances = normalizeAnchorDistances(input.anchorDistances);
  const normalizedName = input.name.trim() || '내 거리 프리셋';

  return {
    id: input.id?.trim() || presetIdFromName(normalizedName),
    name: normalizedName,
    anchorDistances,
    clubDistances: estimateClubDistances(anchorDistances),
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
  };
}

export function replaceCaddieClubDistance(
  preset: CaddieDistancePreset,
  club: CaddieClubKey,
  carryMeters: number,
): CaddieDistancePreset {
  return {
    ...preset,
    clubDistances: preset.clubDistances.map((distance) =>
      distance.club === club ? { ...distance, carryMeters: clampCarryMeters(carryMeters, distance.carryMeters) } : distance,
    ),
  };
}

export function serializeCaddiePresets(presets: readonly CaddieDistancePreset[]): string {
  return JSON.stringify({ version: caddiePresetStorageVersion, presets });
}

export function deserializeCaddiePresets(raw: string | null): readonly CaddieDistancePreset[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCaddiePresetPayload>;
    if (parsed.version !== caddiePresetStorageVersion || !Array.isArray(parsed.presets)) {
      return [];
    }

    const presets = parsed.presets.filter(isCaddieDistancePreset);
    return presets.length === parsed.presets.length ? presets : [];
  } catch {
    return [];
  }
}

export function loadCaddiePresets(storage: StorageLike | undefined): readonly CaddieDistancePreset[] {
  if (!storage) {
    return [];
  }

  try {
    return deserializeCaddiePresets(storage.getItem(caddiePresetStorageKey));
  } catch {
    return [];
  }
}

export function saveCaddiePresets(storage: StorageLike | undefined, presets: readonly CaddieDistancePreset[]): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(caddiePresetStorageKey, serializeCaddiePresets(presets));
    return true;
  } catch {
    return false;
  }
}

export function clearCaddiePresets(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(caddiePresetStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function upsertCaddiePreset(
  presets: readonly CaddieDistancePreset[],
  preset: CaddieDistancePreset,
): readonly CaddieDistancePreset[] {
  const existingIndex = presets.findIndex((item) => item.id === preset.id);
  if (existingIndex === -1) {
    return [...presets, preset];
  }

  return presets.map((item, index) => (index === existingIndex ? preset : item));
}

function normalizeAnchorDistances(anchors: CaddieAnchorDistances): CaddieAnchorDistances {
  return {
    driver: clampCarryMeters(anchors.driver, 180),
    sevenIron: clampCarryMeters(anchors.sevenIron, 135),
    pitchingWedge: clampCarryMeters(anchors.pitchingWedge, 100),
  };
}

function clampCarryMeters(value: number, fallback: number): number {
  const numericValue = Number.isFinite(value) ? value : fallback;
  return Math.min(330, Math.max(30, Math.round(numericValue)));
}

function presetIdFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '');
  return `preset-${slug || 'local'}`;
}

function isCaddieDistancePreset(value: unknown): value is CaddieDistancePreset {
  if (!isRecord(value)) {
    return false;
  }

  const clubDistances = value.clubDistances;

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !isAnchorDistances(value.anchorDistances) ||
    !Array.isArray(clubDistances) ||
    clubDistances.length !== caddieClubOrder.length
  ) {
    return false;
  }

  return caddieClubOrder.every((club, index) => isCaddieClubDistance(clubDistances[index], club));
}

function isAnchorDistances(value: unknown): value is CaddieAnchorDistances {
  return (
    isRecord(value) &&
    isCarryMeter(value.driver) &&
    isCarryMeter(value.sevenIron) &&
    isCarryMeter(value.pitchingWedge)
  );
}

function isCaddieClubDistance(value: unknown, expectedClub: CaddieClubKey): value is CaddieClubDistance {
  return isRecord(value) && value.club === expectedClub && isCarryMeter(value.carryMeters);
}

function isCarryMeter(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 330;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
