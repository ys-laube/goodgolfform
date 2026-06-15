import type { Coordinate, Participant, RoundRoom, ShotPin, ShotPinCategory } from './models';

type StoredParticipant = Participant & {
  readonly memberToken: string;
};

type StoredRoom = {
  readonly room: RoundRoom;
  readonly participants: readonly StoredParticipant[];
};

export type RoomMembership = RoomCredential & {
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

export type RoomCredential = {
  readonly roomId: string;
  readonly participantId: string;
  readonly memberToken: string;
};

export type CreateShotPinInput = Coordinate & RoomCredential & {
  readonly category?: ShotPinCategory;
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
  readonly listPins: (credential: RoomCredential) => Promise<readonly ShotPin[]>;
  readonly listPinSnapshot: (credential: RoomCredential, now?: string) => Promise<PinListSnapshot>;
};

export type SharedRoomBackend = {
  readonly roomsById: Map<string, StoredRoom>;
  readonly roomIdByInviteToken: Map<string, string>;
  readonly pinsByRoomId: Map<string, readonly ShotPin[]>;
};

const defaultBackend = createSharedRoomBackend();

export function createSharedRoomBackend(): SharedRoomBackend {
  return {
    roomsById: new Map<string, StoredRoom>(),
    roomIdByInviteToken: new Map<string, string>(),
    pinsByRoomId: new Map<string, readonly ShotPin[]>(),
  };
}

export function createRoomRepository(backend: SharedRoomBackend = defaultBackend): RoomRepository {
  return {
    async createRoom(input) {
      const createdAt = input.now ?? new Date().toISOString();
      const roomId = opaqueId('room');
      const inviteToken = opaqueId('invite');
      const participant = createParticipant(input.hostDisplayName, createdAt);
      const room: RoundRoom = {
        id: roomId,
        name: input.name.trim() || 'Golf round',
        createdAt,
        inviteToken,
      };

      backend.roomsById.set(room.id, { room, participants: [participant] });
      backend.roomIdByInviteToken.set(inviteToken, room.id);
      backend.pinsByRoomId.set(room.id, []);

      return copyMembership(room, participant);
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

      const participant = createParticipant(input.displayName, input.now ?? new Date().toISOString());
      backend.roomsById.set(roomId, {
        room: storedRoom.room,
        participants: [...storedRoom.participants, participant],
      });

      return copyMembership(storedRoom.room, participant);
    },

    async createPin(input) {
      const participant = requireRoomParticipant(backend, input);
      const pin: ShotPin = {
        id: opaqueId('pin'),
        roomId: input.roomId,
        participantId: participant.id,
        participantName: participant.displayName,
        category: input.category ?? 'note',
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

    async listPins(credential) {
      requireRoomParticipant(backend, credential);
      return copyPins(backend, credential.roomId);
    },

    async listPinSnapshot(credential, now) {
      requireRoomParticipant(backend, credential);
      return {
        pins: copyPins(backend, credential.roomId),
        observedAt: now ?? new Date().toISOString(),
        freshness: 'loose',
      };
    },
  };
}

function createParticipant(displayName: string, joinedAt: string): StoredParticipant {
  return {
    id: opaqueId('participant'),
    memberToken: opaqueId('member'),
    displayName: displayName.trim() || 'Golf friend',
    joinedAt,
  };
}

function requireRoomParticipant(backend: SharedRoomBackend, credential: RoomCredential): StoredParticipant {
  const storedRoom = backend.roomsById.get(credential.roomId);
  if (!storedRoom) {
    throw new Error('Room was not found.');
  }

  const participant = storedRoom.participants.find(
    (entry) => entry.id === credential.participantId && entry.memberToken === credential.memberToken,
  );
  if (!participant) {
    throw new Error('Room membership credentials are invalid.');
  }

  return participant;
}

function copyMembership(room: RoundRoom, participant: StoredParticipant): RoomMembership {
  return {
    room: { ...room },
    participant: copyParticipant(participant),
    roomId: room.id,
    participantId: participant.id,
    memberToken: participant.memberToken,
  };
}

function copyParticipant(participant: StoredParticipant): Participant {
  return {
    id: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt,
    lastKnownLocation: participant.lastKnownLocation ? { ...participant.lastKnownLocation } : undefined,
  };
}

function opaqueId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (!random) {
    throw new Error('Secure random IDs require crypto.randomUUID support.');
  }
  return `${prefix}_${random.replaceAll('-', '')}`;
}

function copyPins(backend: SharedRoomBackend, roomId: string): readonly ShotPin[] {
  return (backend.pinsByRoomId.get(roomId) ?? []).map((pin) => ({ ...pin }));
}
