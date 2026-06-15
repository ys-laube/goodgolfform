export type Coordinate = {
  readonly lat: number;
  readonly lng: number;
};

export type CourseTargetType = 'green' | 'pin' | 'hazard' | 'tee' | 'custom';

export type RoundRoom = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly inviteToken?: string;
};

export type Participant = {
  readonly id: string;
  readonly displayName: string;
  readonly joinedAt: string;
  readonly lastKnownLocation?: LocationSample;
};

export type CourseTarget = Coordinate & {
  readonly id: string;
  readonly roomId: string;
  readonly type: CourseTargetType;
  readonly label: string;
};

export type ShotPin = Coordinate & {
  readonly id: string;
  readonly roomId: string;
  readonly participantId: string;
  readonly participantName: string;
  readonly emoji: string;
  readonly comment: string;
  readonly createdAt: string;
};

export type LocationSample = Coordinate & {
  readonly accuracyMeters: number;
  readonly timestamp: string;
  readonly heading?: number;
  readonly speed?: number;
};
