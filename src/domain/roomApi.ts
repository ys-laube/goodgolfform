import type {
  CreateRoomInput,
  CreateShotPinInput,
  JoinRoomInput,
  PinListSnapshot,
  RoomMembership,
  RoomRepository,
} from './roomRepository';
import type { ShotPin, ShotPinCategory } from './models';

export type RoomApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RoomApiClient = {
  readonly createRoom: (input: CreateRoomInput) => Promise<RoomMembership>;
  readonly joinRoom: (input: JoinRoomInput) => Promise<RoomMembership>;
  readonly createPin: (input: CreateShotPinInput) => Promise<ShotPin>;
  readonly listPins: (roomId: string) => Promise<readonly ShotPin[]>;
  readonly listPinSnapshot: (roomId: string, now?: string) => Promise<PinListSnapshot>;
};

export function createRoomApiHandler(repository: RoomRepository): RoomApiFetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (request.method === 'POST' && path === '/rooms') {
        const body = await readJsonRecord(request);
        return jsonResponse(await repository.createRoom(parseCreateRoomInput(body)), 201);
      }

      if (request.method === 'POST' && path === '/rooms/join') {
        const body = await readJsonRecord(request);
        return jsonResponse(await repository.joinRoom(parseJoinRoomInput(body)), 200);
      }

      const pinRoute = matchRoomPinsRoute(path);
      if (pinRoute && request.method === 'POST' && !pinRoute.snapshot) {
        const body = await readJsonRecord(request);
        return jsonResponse(
          await repository.createPin(parseCreateShotPinInput({ ...body, roomId: pinRoute.roomId })),
          201,
        );
      }

      if (pinRoute && request.method === 'GET' && !pinRoute.snapshot) {
        return jsonResponse(await repository.listPins(pinRoute.roomId), 200);
      }

      if (pinRoute && request.method === 'GET' && pinRoute.snapshot) {
        return jsonResponse(await repository.listPinSnapshot(pinRoute.roomId, url.searchParams.get('now') ?? undefined), 200);
      }

      return jsonResponse({ error: 'not_found', message: 'Room API route was not found.' }, 404);
    } catch (error) {
      return jsonResponse(toApiError(error), error instanceof ValidationError ? 400 : 404);
    }
  };
}

export function createRoomApiClient(input: { readonly baseUrl: string; readonly fetch: RoomApiFetch }): RoomApiClient {
  const baseUrl = input.baseUrl.replace(/\/$/, '');

  return {
    createRoom: (body) => requestJson<RoomMembership>(input.fetch, `${baseUrl}/rooms`, { method: 'POST', body }),
    joinRoom: (body) => requestJson<RoomMembership>(input.fetch, `${baseUrl}/rooms/join`, { method: 'POST', body }),
    createPin: (body) => requestJson<ShotPin>(input.fetch, `${baseUrl}/rooms/${encodeURIComponent(body.roomId)}/pins`, {
      method: 'POST',
      body,
    }),
    listPins: (roomId) => requestJson<readonly ShotPin[]>(input.fetch, `${baseUrl}/rooms/${encodeURIComponent(roomId)}/pins`),
    listPinSnapshot: (roomId, now) => {
      const url = new URL(`${baseUrl}/rooms/${encodeURIComponent(roomId)}/pins/snapshot`);
      if (now) {
        url.searchParams.set('now', now);
      }
      return requestJson<PinListSnapshot>(input.fetch, url);
    },
  };
}

async function requestJson<T>(
  fetcher: RoomApiFetch,
  url: string | URL,
  init: { readonly method?: string; readonly body?: unknown } = {},
): Promise<T> {
  const response = await fetcher(url, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const error = isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'Room API request failed.';
    throw new Error(error);
  }

  return payload as T;
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function matchRoomPinsRoute(path: string): { readonly roomId: string; readonly snapshot: boolean } | undefined {
  const match = /^\/rooms\/([^/]+)\/pins(?:\/(snapshot))?$/.exec(path);
  if (!match) {
    return undefined;
  }

  return { roomId: decodeURIComponent(match[1] ?? ''), snapshot: match[2] === 'snapshot' };
}

async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    if (!isRecord(body)) {
      throw new ValidationError('Request body must be a JSON object.');
    }
    return body;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Request body must be valid JSON.');
  }
}

function parseCreateRoomInput(body: Record<string, unknown>): CreateRoomInput {
  return {
    name: requiredString(body.name, 'name'),
    hostDisplayName: requiredString(body.hostDisplayName, 'hostDisplayName'),
    now: optionalString(body.now, 'now'),
  };
}

function parseJoinRoomInput(body: Record<string, unknown>): JoinRoomInput {
  return {
    inviteToken: requiredString(body.inviteToken, 'inviteToken'),
    displayName: requiredString(body.displayName, 'displayName'),
    now: optionalString(body.now, 'now'),
  };
}

function parseCreateShotPinInput(body: Record<string, unknown>): CreateShotPinInput {
  return {
    roomId: requiredString(body.roomId, 'roomId'),
    participantId: requiredString(body.participantId, 'participantId'),
    participantName: requiredString(body.participantName, 'participantName'),
    category: optionalShotPinCategory(body.category),
    emoji: requiredString(body.emoji, 'emoji'),
    comment: requiredString(body.comment, 'comment'),
    lat: requiredNumber(body.lat, 'lat'),
    lng: requiredNumber(body.lng, 'lng'),
    now: optionalString(body.now, 'now'),
  };
}

function optionalShotPinCategory(value: unknown): ShotPinCategory | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'shot' || value === 'lie' || value === 'target' || value === 'note') {
    return value;
  }
  throw new ValidationError('category must be one of shot, lie, target, or note when provided.');
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${fieldName} is required.`);
  }
  return value;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}

function requiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a finite number.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toApiError(error: unknown): { readonly error: string; readonly message: string } {
  if (error instanceof ValidationError) {
    return { error: 'bad_request', message: error.message };
  }
  if (error instanceof Error) {
    return { error: 'not_found', message: error.message };
  }
  return { error: 'internal_error', message: 'Room API request failed.' };
}

class ValidationError extends Error {}
