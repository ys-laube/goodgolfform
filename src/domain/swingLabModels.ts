export type SwingTempo = 'smooth' | 'neutral' | 'assertive';
export type ShotShape = 'straight' | 'draw' | 'fade';
export type TrajectoryWindow = 'low' | 'standard' | 'high';
export type WindDirection = 'none' | 'headwind' | 'tailwind' | 'crosswind-left' | 'crosswind-right';
export type LieCondition = 'fairway' | 'rough' | 'tee' | 'sand' | 'firm' | 'soft';
export type PathBias = 'neutral' | 'draw-biased' | 'fade-biased';
export type TrajectoryBias = 'lower' | 'standard' | 'higher';

export type ClubDistance = {
  readonly club: string;
  readonly carryMeters: number;
};

export type GolferProfile = {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  readonly handicap: number;
  readonly tempoPreference: SwingTempo;
  readonly shotShape: ShotShape;
  readonly trajectoryPreference: TrajectoryWindow;
  readonly clubDistances: readonly ClubDistance[];
};

export type ShotScenario = {
  readonly targetDistanceMeters: number;
  readonly windDirection: WindDirection;
  readonly windStrengthKph: number;
  readonly lie: LieCondition;
  readonly desiredWindow: TrajectoryWindow;
};

export type RecommendationAdjustment = {
  readonly label: string;
  readonly meters: number;
};

export type SwingRecommendation = {
  readonly recommendedClub: string;
  readonly stockCarryMeters: number;
  readonly effectiveDistanceMeters: number;
  readonly distanceGapMeters: number;
  readonly swingSizePercent: number;
  readonly swingSizeLabel: 'feathered' | 'controlled' | 'stock' | 'stretched';
  readonly tempo: SwingTempo;
  readonly tempoRating: number;
  readonly pathBias: PathBias;
  readonly trajectoryBias: TrajectoryBias;
  readonly trajectoryStrategy: string;
  readonly confidenceScore: number;
  readonly adjustments: readonly RecommendationAdjustment[];
  readonly why: readonly string[];
};
