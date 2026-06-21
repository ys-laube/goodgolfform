import type { ClubDistance, ClubKey, SwingLabProfile } from './swingLabModels';

export const profilePresetStorageKey = 'serious-golf-swing-lab:profile-presets:v1';
export const profilePresetStorageVersion = 1;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredProfilePresetPayload = {
  readonly version: typeof profilePresetStorageVersion;
  readonly profiles: readonly SwingLabProfile[];
};

const clubKeys: readonly ClubKey[] = ['driver', '3w', '5w', '4i', '5i', '6i', '7i', '8i', '9i', 'pw', 'gw', 'sw'];

const baselineDistances: readonly ClubDistance[] = [
  { club: 'driver', carryMeters: 220 },
  { club: '3w', carryMeters: 205 },
  { club: '5w', carryMeters: 190 },
  { club: '4i', carryMeters: 178 },
  { club: '5i', carryMeters: 166 },
  { club: '6i', carryMeters: 154 },
  { club: '7i', carryMeters: 142 },
  { club: '8i', carryMeters: 130 },
  { club: '9i', carryMeters: 118 },
  { club: 'pw', carryMeters: 106 },
  { club: 'gw', carryMeters: 92 },
  { club: 'sw', carryMeters: 78 },
] as const;

function scaleDistances(scale: number): readonly ClubDistance[] {
  return baselineDistances.map((distance) => ({
    club: distance.club,
    carryMeters: Math.round(distance.carryMeters * scale),
  }));
}

export const builtInProfilePresets: readonly SwingLabProfile[] = [
  {
    id: 'preset-balanced-maker',
    name: 'Balanced Maker',
    archetype: 'Single-digit friend with stock mid-flight windows',
    heightCm: 178,
    weightKg: 76,
    level: 'single-digit',
    handicap: 7,
    shotShape: 'straight',
    trajectoryTendency: 'mid',
    tempoPreference: 'neutral',
    clubDistances: baselineDistances,
  },
  {
    id: 'preset-smooth-draw',
    name: 'Smooth Draw Player',
    archetype: 'Tempo-first player who prefers a right-to-left window',
    heightCm: 172,
    weightKg: 68,
    level: 'developing',
    handicap: 14,
    shotShape: 'draw',
    trajectoryTendency: 'high',
    tempoPreference: 'smooth',
    clubDistances: scaleDistances(0.9),
  },
  {
    id: 'preset-flight-control',
    name: 'Flight Control Striker',
    archetype: 'Assertive striker who likes flatter flight and firm contact',
    heightCm: 184,
    weightKg: 84,
    level: 'scratch',
    handicap: 1,
    shotShape: 'fade',
    trajectoryTendency: 'low',
    tempoPreference: 'assertive',
    clubDistances: scaleDistances(1.08),
  },
] as const;

export function serializeProfilePresets(profiles: readonly SwingLabProfile[]): string {
  return JSON.stringify({ version: profilePresetStorageVersion, profiles });
}

export function deserializeProfilePresets(raw: string | null): readonly SwingLabProfile[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredProfilePresetPayload>;
    if (parsed.version !== profilePresetStorageVersion || !Array.isArray(parsed.profiles)) {
      return [];
    }

    const profiles = parsed.profiles.filter(isSwingLabProfile);
    return profiles.length === parsed.profiles.length ? profiles : [];
  } catch {
    return [];
  }
}

export function loadSavedProfilePresets(storage: StorageLike | undefined): readonly SwingLabProfile[] {
  if (!storage) {
    return [];
  }

  try {
    return deserializeProfilePresets(storage.getItem(profilePresetStorageKey));
  } catch {
    return [];
  }
}

export function saveProfilePresets(storage: StorageLike | undefined, profiles: readonly SwingLabProfile[]): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(profilePresetStorageKey, serializeProfilePresets(profiles));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedProfilePresets(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(profilePresetStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function upsertProfilePreset(
  profiles: readonly SwingLabProfile[],
  profile: SwingLabProfile,
): readonly SwingLabProfile[] {
  const existingIndex = profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex === -1) {
    return [...profiles, profile];
  }

  return profiles.map((item, index) => (index === existingIndex ? profile : item));
}

function isSwingLabProfile(value: unknown): value is SwingLabProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.archetype === 'string' &&
    typeof value.heightCm === 'number' &&
    typeof value.weightKg === 'number' &&
    typeof value.handicap === 'number' &&
    isOneOf(value.level, ['beginner', 'developing', 'single-digit', 'scratch']) &&
    isOneOf(value.shotShape, ['straight', 'draw', 'fade']) &&
    isOneOf(value.trajectoryTendency, ['low', 'mid', 'high']) &&
    isOneOf(value.tempoPreference, ['smooth', 'neutral', 'assertive']) &&
    Array.isArray(value.clubDistances) &&
    value.clubDistances.length > 0 &&
    value.clubDistances.every(isClubDistance)
  );
}

function isClubDistance(value: unknown): value is ClubDistance {
  return (
    isRecord(value) &&
    isOneOf(value.club, clubKeys) &&
    typeof value.carryMeters === 'number' &&
    Number.isFinite(value.carryMeters) &&
    value.carryMeters >= 30 &&
    value.carryMeters <= 330
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}
