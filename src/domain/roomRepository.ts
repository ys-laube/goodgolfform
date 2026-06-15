import type { Coordinate, Participant, RoundRoom, ShotPin } from './models';

type StoredRoom = {
  readonly room: RoundRoom;
  readonly participants: readonly Participant[];
};

export type RoomMembership = {
  readonly room: RoundRoom;
  readonly participant: Participant;
};

export type CreateRoomInput = {
  readonly name: string;
  readonly hostDisplayName: string;
  readonly now?: string;
};

export type JoinRoomInput = {
  readonly inviteToken: string;
  readonly displayName: string;
  readonly now?: string;
};

export type CreateShotPinInput = Coordinate & {
  readonly roomId: string;
  readonly participantId: string;
  readonly participantName: string;
  readonly emoji: string;
  readonly comment: string;
  readonly now?: string;
};

export type PinListSnapshot = {
  readonly pins: readonly ShotPin[];
  readonly observedAt: string;
  readonly freshness: 'loose';
};

export type RoomRepository = {
  readonly createRoom: (input: CreateRoomInput) => Promise<RoomMembership>;
  readonly joinRoom: (input: JoinRoomInput) => Promise<RoomMembership>;
  readonly createPin: (input: CreateShotPinInput) => Promise<ShotPin>;
  readonly listPins: (roomId: string) => Promise<readonly ShotPin[]>;
  readonly listPinSnapshot: (roomId: string, now?: string) => Promise<PinListSnapshot>;
};

export type SharedRoomBackend = {
  readonly roomsById: Map<string, StoredRoom>;
  readonly roomIdByInviteToken: Map<string, string>;
  readonly pinsByRoomId: Map<string, readonly ShotPin[]>;
  nextSequence: number;
};

const defaultBackend = createSharedRoomBackend();

export function createSharedRoomBackend(): SharedRoomBackend {
  return {
    roomsById: new Map<string, StoredRoom>(),
    roomIdByInviteToken: new Map<string, string>(),
    pinsByRoomId: new Map<string, readonly ShotPin[]>(),
    nextSequence: 1,
  };
}

export function createRoomRepository(backend: SharedRoomBackend = defaultBackend): RoomRepository {
  return {
    async createRoom(input) {
      const createdAt = input.now ?? new Date().toISOString();
      const roomId = nextId(backend, 'room');
      const inviteToken = nextId(backend, 'invite');
      const participant = createParticipant(backend, input.hostDisplayName, createdAt);
      const room: RoundRoom = {
        id: roomId,
        name: input.name.trim() || 'Golf round',
        createdAt,
        inviteToken,
      };

      backend.roomsById.set(room.id, { room, participants: [participant] });
      backend.roomIdByInviteToken.set(inviteToken, room.id);
      backend.pinsByRoomId.set(room.id, []);

      return { room: { ...room }, participant: { ...participant } };
    },

    async joinRoom(input) {
      const roomId = backend.roomIdByInviteToken.get(input.inviteToken);
      if (!roomId) {
        throw new Error('Room invite link was not found.');
      }

      const storedRoom = backend.roomsById.get(roomId);
      if (!storedRoom) {
        throw new Error('Room data is unavailable for this invite link.');
      }

      const participant = createParticipant(backend, input.displayName, input.now ?? new Date().toISOString());
      backend.roomsById.set(roomId, {
        room: storedRoom.room,
        participants: [...storedRoom.participants, participant],
      });

      return { room: { ...storedRoom.room }, participant: { ...participant } };
    },

    async createPin(input) {
      if (!backend.roomsById.has(input.roomId)) {
        throw new Error('Cannot add a shot pin to an unknown room.');
      }

      const pin: ShotPin = {
        id: nextId(backend, 'pin'),
        roomId: input.roomId,
        participantId: input.participantId,
        participantName: input.participantName,
        emoji: input.emoji,
        comment: input.comment,
        lat: input.lat,
        lng: input.lng,
        createdAt: input.now ?? new Date().toISOString(),
      };
      const existingPins = backend.pinsByRoomId.get(input.roomId) ?? [];
      backend.pinsByRoomId.set(input.roomId, [...existingPins, pin]);

      return { ...pin };
    },

    async listPins(roomId) {
      return copyPins(backend, roomId);
    },

    async listPinSnapshot(roomId, now) {
      return {
        pins: copyPins(backend, roomId),
        observedAt: now ?? new Date().toISOString(),
        freshness: 'loose',
      };
    },
  };
}

function createParticipant(backend: SharedRoomBackend, displayName: string, joinedAt: string): Participant {
  return {
    id: nextId(backend, 'participant'),
    displayName: displayName.trim() || 'Golf friend',
    joinedAt,
  };
}

function nextId(backend: SharedRoomBackend, prefix: string): string {
  const sequence = backend.nextSequence;
  backend.nextSequence += 1;
  return `${prefix}-${sequence}`;
}

function copyPins(backend: SharedRoomBackend, roomId: string): readonly ShotPin[] {
  return (backend.pinsByRoomId.get(roomId) ?? []).map((pin) => ({ ...pin }));
}
