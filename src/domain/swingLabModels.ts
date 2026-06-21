export type GolferLevel = 'beginner' | 'developing' | 'single-digit' | 'scratch';
export type ShotShape = 'straight' | 'draw' | 'fade';
export type TrajectoryTendency = 'low' | 'mid' | 'high';
export type TempoPreference = 'smooth' | 'neutral' | 'assertive';

export type ClubKey = 'driver' | '3w' | '5w' | '4i' | '5i' | '6i' | '7i' | '8i' | '9i' | 'pw' | 'gw' | 'sw';

export type ClubDistance = {
  readonly club: ClubKey;
  readonly carryMeters: number;
};

export type SwingLabProfile = {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly level: GolferLevel;
  readonly handicap: number;
  readonly shotShape: ShotShape;
  readonly trajectoryTendency: TrajectoryTendency;
  readonly tempoPreference: TempoPreference;
  readonly clubDistances: readonly ClubDistance[];
};

export type WindDirection = 'none' | 'headwind' | 'tailwind' | 'left-to-right' | 'right-to-left';
export type WindStrength = 'calm' | 'light' | 'steady' | 'strong';
export type LieCondition = 'tee' | 'fairway' | 'rough' | 'bunker';
export type ShotWindow = 'standard' | 'low' | 'high';

export type ShotScenario = {
  readonly targetDistanceMeters: number;
  readonly windDirection: WindDirection;
  readonly windStrength: WindStrength;
  readonly lie: LieCondition;
  readonly desiredWindow: ShotWindow;
};

export type SwingTempo = 'smooth' | 'neutral' | 'assertive';
export type PathBias = 'neutral' | 'draw-biased' | 'fade-biased';
export type TrajectoryStrategy = 'flighted' | 'standard-window' | 'launch-higher';

export type RecommendationAdjustment = {
  readonly label: string;
  readonly meters: number;
  readonly reason: string;
};

export type SwingRecommendation = {
  readonly selectedClub: ClubKey;
  readonly clubLabel: string;
  readonly adjustedDistanceMeters: number;
  readonly distanceFeel: string;
  readonly swingSizePercent: number;
  readonly swingSizeLabel: string;
  readonly tempo: SwingTempo;
  readonly tempoRating: number;
  readonly pathBias: PathBias;
  readonly trajectoryStrategy: TrajectoryStrategy;
  readonly confidenceScore: number;
  readonly gameMetricLabel: string;
  readonly why: readonly string[];
  readonly adjustments: readonly RecommendationAdjustment[];
};

export type MotionParameters = {
  readonly arcDegrees: number;
  readonly animationDurationMs: number;
  readonly tempoRating: number;
  readonly pathOffset: number;
  readonly planeTiltDegrees: number;
  readonly launchAngleDegrees: number;
  readonly followThroughHeight: number;
  readonly reducedMotionPose: 'compact' | 'balanced' | 'extended';
  readonly accessibleSummary: string;
};
