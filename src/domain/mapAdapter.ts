import type { Coordinate, CourseTarget, LocationSample } from './models';

const DEFAULT_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_ZOOM = 17;
const TILE_SIZE_PX = 256;
const TILE_GRID_SIZE = 3;
const MARKER_MIN_PERCENT = -20;
const MARKER_MAX_PERCENT = 120;

export type MapMarker = {
  readonly id: string;
  readonly label: string;
  readonly coordinate: Coordinate;
  readonly kind: 'current-location' | CourseTarget['type'];
  readonly screen: {
    readonly xPercent: number;
    readonly yPercent: number;
    readonly visible: boolean;
  };
};

export type MapTile = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly url: string;
  readonly leftPercent: number;
  readonly topPercent: number;
};

export type MapViewport = {
  readonly center: Coordinate;
  readonly zoomHint: 'course' | 'target' | 'location';
  readonly zoom: number;
  readonly tileTemplate: string;
};

export type ProviderNeutralMapModel = {
  readonly viewport: MapViewport;
  readonly markers: readonly MapMarker[];
  readonly tiles: readonly MapTile[];
  readonly attribution: string;
};

export type MapAdapter = {
  readonly renderModel: (model: ProviderNeutralMapModel) => unknown;
};

export function buildMockMapModel(input: {
  readonly targets: readonly CourseTarget[];
  readonly currentLocation?: LocationSample;
  readonly tileTemplate?: string;
  readonly zoom?: number;
}): ProviderNeutralMapModel {
  const center = input.currentLocation ?? input.targets[0] ?? { lat: 0, lng: 0 };
  const zoom = input.zoom ?? DEFAULT_ZOOM;
  const tileTemplate = input.tileTemplate ?? DEFAULT_TILE_TEMPLATE;
  const projection = buildTileProjection(center, zoom, tileTemplate);

  const currentMarker: readonly Omit<MapMarker, 'screen'>[] = input.currentLocation
    ? [
        {
          id: 'current-location',
          label: `Current location (${Math.round(input.currentLocation.accuracyMeters)} m accuracy)`,
          coordinate: input.currentLocation,
          kind: 'current-location',
        },
      ]
    : [];

  const targetMarkers = input.targets.map((target) => ({
    id: target.id,
    label: target.label,
    coordinate: target,
    kind: target.type,
  } satisfies Omit<MapMarker, 'screen'>));

  return {
    viewport: {
      center,
      zoomHint: input.currentLocation ? 'location' : 'course',
      zoom,
      tileTemplate,
    },
    markers: [...currentMarker, ...targetMarkers].map((marker) => ({
      ...marker,
      screen: projection.projectToViewport(marker.coordinate),
    })),
    tiles: projection.tiles,
    attribution: 'Map tiles © OpenStreetMap contributors; approximate GPS/course context only.',
  };
}

function buildTileProjection(center: Coordinate, zoom: number, tileTemplate: string) {
  const scale = TILE_SIZE_PX * 2 ** zoom;
  const centerPixel = coordinateToWorldPixel(center, scale);
  const topLeftPixel = {
    x: centerPixel.x - (TILE_GRID_SIZE * TILE_SIZE_PX) / 2,
    y: centerPixel.y - (TILE_GRID_SIZE * TILE_SIZE_PX) / 2,
  };
  const startTileX = Math.floor(topLeftPixel.x / TILE_SIZE_PX);
  const startTileY = Math.floor(topLeftPixel.y / TILE_SIZE_PX);
  const maxTile = 2 ** zoom;

  const tiles = Array.from({ length: TILE_GRID_SIZE * TILE_GRID_SIZE }, (_, index) => {
    const column = index % TILE_GRID_SIZE;
    const row = Math.floor(index / TILE_GRID_SIZE);
    const rawX = startTileX + column;
    const rawY = startTileY + row;
    const x = wrapTileX(rawX, maxTile);
    const y = clamp(rawY, 0, maxTile - 1);

    return {
      id: `${zoom}-${x}-${y}`,
      x,
      y,
      z: zoom,
      url: tileTemplate.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)),
      leftPercent: (column / TILE_GRID_SIZE) * 100,
      topPercent: (row / TILE_GRID_SIZE) * 100,
    } satisfies MapTile;
  });

  return {
    tiles,
    projectToViewport(coordinate: Coordinate): MapMarker['screen'] {
      const pixel = coordinateToWorldPixel(coordinate, scale);
      const xPercent = ((pixel.x - topLeftPixel.x) / (TILE_GRID_SIZE * TILE_SIZE_PX)) * 100;
      const yPercent = ((pixel.y - topLeftPixel.y) / (TILE_GRID_SIZE * TILE_SIZE_PX)) * 100;

      return {
        xPercent: clamp(xPercent, MARKER_MIN_PERCENT, MARKER_MAX_PERCENT),
        yPercent: clamp(yPercent, MARKER_MIN_PERCENT, MARKER_MAX_PERCENT),
        visible:
          xPercent >= MARKER_MIN_PERCENT &&
          xPercent <= MARKER_MAX_PERCENT &&
          yPercent >= MARKER_MIN_PERCENT &&
          yPercent <= MARKER_MAX_PERCENT,
      };
    },
  };
}

function coordinateToWorldPixel(coordinate: Coordinate, scale: number) {
  const lat = clamp(coordinate.lat, -85.05112878, 85.05112878);
  const lng = ((coordinate.lng + 180) % 360) - 180;
  const sinLat = Math.sin((lat * Math.PI) / 180);

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function wrapTileX(x: number, maxTile: number): number {
  return ((x % maxTile) + maxTile) % maxTile;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
