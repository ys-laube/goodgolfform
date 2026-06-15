import type {
  CreateRoomInput,
  CreateShotPinInput,
  JoinRoomInput,
  PinListSnapshot,
  RoomCredential,
  RoomMembership,
  RoomRepository,
} from './roomRepository';
import type { ShotPin, ShotPinCategory } from './models';

export type RoomApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RoomApiClient = {
  readonly createRoom: (input: CreateRoomInput) => Promise<RoomMembership>;
  readonly joinRoom: (input: JoinRoomInput) => Promise<RoomMembership>;
  readonly createPin: (input: CreateShotPinInput) => Promise<ShotPin>;
  readonly listPins: (credential: RoomCredential) => Promise<readonly ShotPin[]>;
  readonly listPinSnapshot: (credential: RoomCredential, now?: string) => Promise<PinListSnapshot>;
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
          await repository.createPin(parseCreateShotPinInput({ ...body, roomId: pinRoute.roomId }, request)),
          201,
        );
      }

      if (pinRoute && request.method === 'GET' && !pinRoute.snapshot) {
        return jsonResponse(await repository.listPins(parseRoomCredential(pinRoute.roomId, request)), 200);
      }

      if (pinRoute && request.method === 'GET' && pinRoute.snapshot) {
        return jsonResponse(
          await repository.listPinSnapshot(parseRoomCredential(pinRoute.roomId, request), url.searchParams.get('now') ?? undefined),
          200,
        );
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
    createPin: (body) =>
      requestJson<ShotPin>(input.fetch, `${baseUrl}/rooms/${encodeURIComponent(body.roomId)}/pins`, {
        method: 'POST',
        body,
        credential: body,
      }),
    listPins: (credential) =>
      requestJson<readonly ShotPin[]>(input.fetch, `${baseUrl}/rooms/${encodeURIComponent(credential.roomId)}/pins`, {
        credential,
      }),
    listPinSnapshot: (credential, now) => {
      const url = new URL(`${baseUrl}/rooms/${encodeURIComponent(credential.roomId)}/pins/snapshot`);
      if (now) {
        url.searchParams.set('now', now);
      }
      return requestJson<PinListSnapshot>(input.fetch, url, { credential });
    },
  };
}

export function createRemoteRoomApiClient(baseUrl: string, fetcher: RoomApiFetch = fetch): RoomApiClient {
  return createRoomApiClient({ baseUrl, fetch: fetcher });
}

async function requestJson<T>(
  fetcher: RoomApiFetch,
  url: string | URL,
  init: { readonly method?: string; readonly body?: unknown; readonly credential?: RoomCredential } = {},
): Promise<T> {
  const response = await fetcher(url, {
    method: init.method ?? 'GET',
    headers: requestHeaders(init),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const error = isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'Room API request failed.';
    throw new Error(error);
  }

  return payload as T;
}

function requestHeaders(init: { readonly body?: unknown; readonly credential?: RoomCredential }): HeadersInit | undefined {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (init.credential) {
    headers['x-fungolf-participant-id'] = init.credential.participantId;
    headers['x-fungolf-member-token'] = init.credential.memberToken;
  }
  return Object.keys(headers).length ? headers : undefined;
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
    name: boundedString(body.name, 'name', 80),
    hostDisplayName: boundedString(body.hostDisplayName, 'hostDisplayName', 40),
    now: optionalString(body.now, 'now'),
  };
}

function parseJoinRoomInput(body: Record<string, unknown>): JoinRoomInput {
  return {
    inviteToken: boundedString(body.inviteToken, 'inviteToken', 96),
    displayName: boundedString(body.displayName, 'displayName', 40),
    now: optionalString(body.now, 'now'),
  };
}

function parseCreateShotPinInput(body: Record<string, unknown>, request: Request): CreateShotPinInput {
  const roomId = boundedString(body.roomId, 'roomId', 96);
  return {
    roomId,
    participantId: credentialHeader(request, 'x-fungolf-participant-id', 'participantId'),
    memberToken: credentialHeader(request, 'x-fungolf-member-token', 'memberToken'),
    category: optionalShotPinCategory(body.category),
    emoji: boundedString(body.emoji, 'emoji', 16),
    comment: boundedString(body.comment, 'comment', 140),
    lat: boundedCoordinate(body.lat, 'lat', -90, 90),
    lng: boundedCoordinate(body.lng, 'lng', -180, 180),
    now: optionalString(body.now, 'now'),
  };
}

function parseRoomCredential(roomId: string, request: Request): RoomCredential {
  return {
    roomId,
    participantId: credentialHeader(request, 'x-fungolf-participant-id', 'participantId'),
    memberToken: credentialHeader(request, 'x-fungolf-member-token', 'memberToken'),
  };
}

function credentialHeader(request: Request, headerName: string, fieldName: string): string {
  return boundedString(request.headers.get(headerName), fieldName, 96);
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

function boundedString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${fieldName} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
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

function boundedCoordinate(value: unknown, fieldName: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}.`);
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
