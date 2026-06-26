export const bettingGameIds = ['ojang'] as const;

export type BettingGameId = (typeof bettingGameIds)[number];
export type PlayerId = string;
export type ScoringMode = 'points' | 'money';
export type HandicapMode = 'final-total' | 'hole-allocation';

export type Player = {
  readonly id: PlayerId;
  readonly name: string;
  readonly handicap: number;
};

export type BettingRoundSettings = {
  readonly holeCount: number;
  readonly scoringMode: ScoringMode;
  readonly handicapMode: HandicapMode;
};

export type EnabledGames = Readonly<Record<BettingGameId, boolean>>;

export type GameUnit = {
  readonly pointValue: number;
  readonly moneyPerPoint: number;
};

export type GameUnitMap = Readonly<Record<BettingGameId, GameUnit>>;
export type HoleScoreMap = Readonly<Record<PlayerId, number>>;

export type BettingEventType = 'near-pin';

export type BettingEventAward = {
  readonly type: BettingEventType;
  readonly playerId: PlayerId;
  readonly points?: number;
  readonly label?: string;
};

export type HoleResult = {
  readonly holeNumber: number;
  readonly par: number;
  readonly strokes: HoleScoreMap;
  readonly events?: readonly BettingEventAward[];
};

export type BettingRound = {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly players: readonly Player[];
  readonly settings: BettingRoundSettings;
  readonly enabledGames: EnabledGames;
  readonly gameUnits: GameUnitMap;
  readonly holes: readonly HoleResult[];
};

export type BalanceMap = Readonly<Record<PlayerId, number>>;

export type PlayerBalance = {
  readonly points: number;
  readonly money: number;
};

export type LedgerBreakdownRow = {
  readonly id: string;
  readonly game: BettingGameId | 'settlement';
  readonly holeNumber?: number;
  readonly playerId?: PlayerId;
  readonly label: string;
  readonly detail: string;
  readonly points: number;
  readonly money: number;
  readonly balanceDeltas: BalanceMap;
};

export type GameLedger = {
  readonly game: BettingGameId;
  readonly label: string;
  readonly pointBalances: BalanceMap;
  readonly moneyBalances: BalanceMap;
  readonly rows: readonly LedgerBreakdownRow[];
  readonly unclaimedPoints: number;
  readonly unavailableReason?: string;
};

export type AppliedHandicap = {
  readonly mode: HandicapMode;
  readonly rawTotals: BalanceMap;
  readonly adjustedTotals: BalanceMap;
  readonly allocatedStrokes: Readonly<Record<number, BalanceMap>>;
  readonly netHoleScores: Readonly<Record<number, BalanceMap>>;
  readonly completedHoleNumbers: readonly number[];
};

export type NetTransferUnit = 'points' | 'money';

export type NetTransfer = {
  readonly payerId: PlayerId;
  readonly payeeId: PlayerId;
  readonly amount: number;
  readonly unit: NetTransferUnit;
};

export type RoundLedger = {
  readonly roundId: string;
  readonly calculationOrder: readonly string[];
  readonly normalizedRound: BettingRound;
  readonly handicap: AppliedHandicap;
  readonly gameLedgers: readonly GameLedger[];
  readonly playerBalances: Readonly<Record<PlayerId, PlayerBalance>>;
  readonly netTransfers: readonly NetTransfer[];
  readonly breakdownRows: readonly LedgerBreakdownRow[];
};

type OjangScoreEntry = {
  readonly player: Player;
  readonly rawScore: number;
  readonly settlementScore: number;
};

type OjangBoardState = {
  readonly multiplier: 1 | 2;
  readonly label: '민판' | '배판';
  readonly reasons: readonly string[];
  readonly allTied: boolean;
};

export const ledgerCalculationOrder = [
  'normalize round input',
  'derive handicap view',
  'calculate traditional Ojang hole-by-hole stroke ledger',
  'apply minpan/baepan board multipliers and Ojang bonuses',
  'convert Ojang point units to money units',
  'aggregate player balances',
  'net balances into minimal transfers',
  'emit inspectable calculation breakdown rows',
] as const;

export const defaultEnabledGames: EnabledGames = {
  ojang: true,
};

export const defaultGameUnits: GameUnitMap = {
  ojang: { pointValue: 1, moneyPerPoint: 5000 },
};

export const eventBasePoints: Readonly<Record<BettingEventType, number>> = {
  'near-pin': 1,
};

export const eventLabels: Readonly<Record<BettingEventType, string>> = {
  'near-pin': '니어 보너스',
};

const fallbackPlayers: readonly Player[] = [
  { id: 'p1', name: '', handicap: 0 },
  { id: 'p2', name: '', handicap: 0 },
  { id: 'p3', name: '', handicap: 0 },
  { id: 'p4', name: '', handicap: 0 },
] as const;

export function createDefaultRound(options: {
  readonly playerCount?: number;
  readonly now?: string;
  readonly scoringMode?: ScoringMode;
  readonly handicapMode?: HandicapMode;
} = {}): BettingRound {
  const playerCount = options.playerCount ?? 4;
  assertPlayerCount(playerCount);
  const timestamp = options.now ?? '2026-06-25T00:00:00.000Z';

  return normalizeBettingRound({
    id: 'default-golf-ojang-round',
    createdAt: timestamp,
    updatedAt: timestamp,
    players: fallbackPlayers.slice(0, playerCount),
    settings: {
      holeCount: 18,
      scoringMode: options.scoringMode ?? 'money',
      handicapMode: options.handicapMode ?? 'final-total',
    },
    enabledGames: defaultEnabledGames,
    gameUnits: defaultGameUnits,
    holes: [],
  });
}

export function calculateRoundLedger(round: BettingRound): RoundLedger {
  const normalizedRound = normalizeBettingRound(round);
  const handicap = applyHandicap(normalizedRound, normalizedRound.settings.handicapMode);
  const gameLedgers = bettingGameIds
    .filter((game) => normalizedRound.enabledGames[game])
    .map((game) => calculateGameLedger(game, normalizedRound, handicap));
  const totals = aggregateGameLedgers(normalizedRound, gameLedgers);
  const settlementBasis = normalizedRound.settings.scoringMode === 'money'
    ? mapPlayerBalances(totals, 'money')
    : mapPlayerBalances(totals, 'points');
  const netTransfers = calculateNetTransfers(settlementBasis, {
    unit: normalizedRound.settings.scoringMode === 'money' ? 'money' : 'points',
  });
  const settlementRows = netTransfers.map((transfer, index) => createSettlementRow(transfer, index));

  return {
    roundId: normalizedRound.id,
    calculationOrder: ledgerCalculationOrder,
    normalizedRound,
    handicap,
    gameLedgers,
    playerBalances: totals,
    netTransfers,
    breakdownRows: [...gameLedgers.flatMap((ledger) => ledger.rows), ...settlementRows],
  };
}

export function normalizeBettingRound(round: BettingRound): BettingRound {
  assertPlayerCount(round.players.length);
  assertUniquePlayerIds(round.players);
  const holeCount = clampInteger(round.settings.holeCount, 1, 18);
  const players = round.players.map((player) => ({
    id: player.id.trim(),
    name: player.name.trim() || '플레이어',
    handicap: normalizeNumber(player.handicap),
  }));
  const playerIds = players.map((player) => player.id);
  const holes = round.holes
    .map((hole) => normalizeHole(hole, playerIds, holeCount))
    .filter((hole): hole is HoleResult => hole !== null)
    .sort((left, right) => left.holeNumber - right.holeNumber);

  return {
    ...round,
    players,
    settings: {
      holeCount,
      scoringMode: round.settings.scoringMode,
      handicapMode: round.settings.handicapMode,
    },
    enabledGames: normalizeEnabledGames(round.enabledGames),
    gameUnits: normalizeGameUnits(round.gameUnits),
    holes,
  };
}

export function applyHandicap(round: BettingRound, mode: HandicapMode = round.settings.handicapMode): AppliedHandicap {
  const normalizedRound = normalizeBettingRound(round);
  const completedHoles = normalizedRound.holes.filter((hole) => isCompletedHole(hole, normalizedRound.players));
  const completedHoleNumbers = completedHoles.map((hole) => hole.holeNumber);
  const rawTotals = createMutableBalances(normalizedRound.players);
  const allocatedStrokes: Record<number, Record<PlayerId, number>> = {};
  const netHoleScores: Record<number, Record<PlayerId, number>> = {};

  for (const holeNumber of Array.from({ length: normalizedRound.settings.holeCount }, (_, index) => index + 1)) {
    allocatedStrokes[holeNumber] = createMutableBalances(normalizedRound.players);
  }

  for (const player of normalizedRound.players) {
    const totalAllocated = Math.max(0, Math.round(player.handicap));
    const baseAllocation = Math.floor(totalAllocated / normalizedRound.settings.holeCount);
    const remainder = totalAllocated % normalizedRound.settings.holeCount;

    for (let holeNumber = 1; holeNumber <= normalizedRound.settings.holeCount; holeNumber += 1) {
      allocatedStrokes[holeNumber][player.id] = baseAllocation + (holeNumber <= remainder ? 1 : 0);
    }
  }

  for (const hole of completedHoles) {
    const netScores = createMutableBalances(normalizedRound.players);

    for (const player of normalizedRound.players) {
      const rawScore = hole.strokes[player.id] ?? 0;
      rawTotals[player.id] = roundToTwo(rawTotals[player.id] + rawScore);
      netScores[player.id] = Math.max(1, rawScore - allocatedStrokes[hole.holeNumber][player.id]);
    }

    netHoleScores[hole.holeNumber] = netScores;
  }

  const adjustedTotals = createMutableBalances(normalizedRound.players);
  for (const player of normalizedRound.players) {
    adjustedTotals[player.id] = mode === 'final-total'
      ? roundToTwo(rawTotals[player.id] - normalizeNumber(player.handicap))
      : roundToTwo(completedHoles.reduce((sum, hole) => sum + (netHoleScores[hole.holeNumber]?.[player.id] ?? 0), 0));
  }

  return {
    mode,
    rawTotals,
    adjustedTotals,
    allocatedStrokes,
    netHoleScores,
    completedHoleNumbers,
  };
}

export function calculateNetTransfers(
  balances: BalanceMap,
  options: { readonly unit?: NetTransferUnit } = {},
): readonly NetTransfer[] {
  const unit = options.unit ?? 'points';
  const payers = Object.entries(balances)
    .filter(([, balance]) => balance < -0.005)
    .map(([playerId, balance]) => ({ playerId, remaining: roundToTwo(-balance) }))
    .sort((left, right) => right.remaining - left.remaining || left.playerId.localeCompare(right.playerId));
  const payees = Object.entries(balances)
    .filter(([, balance]) => balance > 0.005)
    .map(([playerId, balance]) => ({ playerId, remaining: roundToTwo(balance) }))
    .sort((left, right) => right.remaining - left.remaining || left.playerId.localeCompare(right.playerId));
  const transfers: NetTransfer[] = [];
  let payerIndex = 0;
  let payeeIndex = 0;

  while (payerIndex < payers.length && payeeIndex < payees.length) {
    const payer = payers[payerIndex];
    const payee = payees[payeeIndex];
    const amount = roundToTwo(Math.min(payer.remaining, payee.remaining));

    if (amount > 0.005) {
      transfers.push({ payerId: payer.playerId, payeeId: payee.playerId, amount, unit });
    }

    payer.remaining = roundToTwo(payer.remaining - amount);
    payee.remaining = roundToTwo(payee.remaining - amount);

    if (payer.remaining <= 0.005) {
      payerIndex += 1;
    }

    if (payee.remaining <= 0.005) {
      payeeIndex += 1;
    }
  }

  return transfers;
}

function calculateGameLedger(game: BettingGameId, round: BettingRound, handicap: AppliedHandicap): GameLedger {
  switch (game) {
    case 'ojang':
      return calculateOjangLedger(round, handicap);
  }
}

function calculateOjangLedger(round: BettingRound, handicap: AppliedHandicap): GameLedger {
  const unit = round.gameUnits.ojang;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];
  let nextBoardReasons: readonly string[] = [];

  for (const hole of completedHoles(round)) {
    const scores = scoreEntriesForHole(round, handicap, hole);
    const board = resolveOjangBoardState(scores, nextBoardReasons);
    const followingBoardReasons = ojangFollowingBoardReasons(hole, scores);

    if (board.allTied) {
      rows.push(createBreakdownRow({
        game: 'ojang',
        id: `ojang-${hole.holeNumber}-all-tie`,
        holeNumber: hole.holeNumber,
        label: `오장 ${board.label} · 전원 동타`,
        detail: `${hole.holeNumber}번 홀 ${scores[0]?.settlementScore ?? 0}타 전원 동타로 정산 없음, 다음 완료 홀은 배판`,
        points: 0,
        money: 0,
        balanceDeltas: createMutableBalances(round.players),
      }));
      nextBoardReasons = followingBoardReasons;
      continue;
    }

    for (let leftIndex = 0; leftIndex < scores.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < scores.length; rightIndex += 1) {
        const left = scores[leftIndex];
        const right = scores[rightIndex];

        if (left.settlementScore === right.settlementScore) {
          continue;
        }

        const winner = left.settlementScore < right.settlementScore ? left : right;
        const loser = left.settlementScore < right.settlementScore ? right : left;
        const strokeDelta = Math.abs(left.settlementScore - right.settlementScore);
        const birdieBonus = winner.rawScore < hole.par ? 1 : 0;
        const nearBonus = ojangNearBonus(hole, winner, 'winner');
        const nearPenalty = ojangNearBonus(hole, loser, 'loser');
        const payableStrokeUnits = roundToTwo(strokeDelta + birdieBonus + nearBonus + nearPenalty);
        const points = roundToTwo(payableStrokeUnits * board.multiplier * unit.pointValue);
        const deltas = createMutableBalances(round.players);
        deltas[winner.player.id] = points;
        deltas[loser.player.id] = -points;
        mergeBalances(pointBalances, deltas);

        rows.push(createBreakdownRow({
          game: 'ojang',
          id: `ojang-${hole.holeNumber}-${winner.player.id}-${loser.player.id}`,
          holeNumber: hole.holeNumber,
          playerId: winner.player.id,
          label: `오장 ${board.label}`,
          detail: ojangRowDetail({
            hole,
            winner,
            loser,
            strokeDelta,
            birdieBonus,
            nearBonus,
            nearPenalty,
            board,
            points,
          }),
          points,
          money: round.settings.scoringMode === 'money' ? roundToTwo(points * unit.moneyPerPoint) : 0,
          balanceDeltas: deltas,
        }));
      }
    }
    nextBoardReasons = followingBoardReasons;
  }

  return buildGameLedger('ojang', '전통 오장', pointBalances, rows, round, unit);
}

function resolveOjangBoardState(scores: readonly OjangScoreEntry[], boardReasons: readonly string[]): OjangBoardState {
  const scoreCounts = new Map<number, number>();
  for (const score of scores) {
    scoreCounts.set(score.settlementScore, (scoreCounts.get(score.settlementScore) ?? 0) + 1);
  }

  const allTied = scoreCounts.size === 1 && scores.length > 1;
  const isDouble = boardReasons.length > 0;
  return {
    multiplier: isDouble ? 2 : 1,
    label: isDouble ? '배판' : '민판',
    reasons: boardReasons,
    allTied,
  };
}

function ojangFollowingBoardReasons(hole: HoleResult, scores: readonly OjangScoreEntry[]): readonly string[] {
  const scoreCounts = new Map<number, number>();
  for (const score of scores) {
    scoreCounts.set(score.settlementScore, (scoreCounts.get(score.settlementScore) ?? 0) + 1);
  }

  const reasons: string[] = [];
  const allTied = scoreCounts.size === 1 && scores.length > 1;
  const hasThreeWayTie = scores.length >= 4 && Array.from(scoreCounts.values()).some((count) => count === 3);
  const hasTripleBogeyOrWorse = scores.some((score) => score.rawScore >= hole.par + 3);
  const hasUnderPar = scores.some((score) => score.rawScore < hole.par);

  if (allTied) {
    reasons.push('전 홀 전원 동타');
  }
  if (hasTripleBogeyOrWorse) {
    reasons.push('트리플 보기 이상');
  }
  if (hasThreeWayTie) {
    reasons.push('3명 동타');
  }
  if (hasUnderPar) {
    reasons.push('버디 이상');
  }

  return reasons;
}

function ojangNearBonus(hole: HoleResult, entry: OjangScoreEntry, position: 'winner' | 'loser'): number {
  if (hole.par !== 3) {
    return 0;
  }

  const nearEvent = hole.events?.find((event) => event.type === 'near-pin' && event.playerId === entry.player.id);
  if (!nearEvent) {
    return 0;
  }

  const bonusUnits = Math.max(0, normalizeNumber(nearEvent.points, eventBasePoints['near-pin']));

  if (position === 'winner' && entry.rawScore <= hole.par) {
    return bonusUnits;
  }

  if (position === 'loser' && entry.rawScore > hole.par) {
    return bonusUnits;
  }

  return 0;
}

function ojangRowDetail(input: {
  readonly hole: HoleResult;
  readonly winner: OjangScoreEntry;
  readonly loser: OjangScoreEntry;
  readonly strokeDelta: number;
  readonly birdieBonus: number;
  readonly nearBonus: number;
  readonly nearPenalty: number;
  readonly board: OjangBoardState;
  readonly points: number;
}): string {
  const additions = [
    input.birdieBonus > 0 ? '버디 보너스 +1' : null,
    input.nearBonus > 0 ? `니어 보너스 +${formatNumber(input.nearBonus)}` : null,
    input.nearPenalty > 0 ? `니어 실패 페널티 +${formatNumber(input.nearPenalty)}` : null,
  ].filter(Boolean);
  const boardReason = input.board.reasons.length > 0 ? ` (${input.board.reasons.join(', ')})` : '';
  const additionText = additions.length > 0 ? `, ${additions.join(', ')}` : '';

  return `${input.hole.holeNumber}번 홀 ${input.winner.player.name} ${formatNumber(input.winner.settlementScore)}타 vs ${input.loser.player.name} ${formatNumber(input.loser.settlementScore)}타: 타수차 ${formatNumber(input.strokeDelta)}${additionText} × ${input.board.label}${boardReason} = ${formatNumber(input.points)}점`;
}

function buildGameLedger(
  game: BettingGameId,
  label: string,
  pointBalances: BalanceMap,
  rows: readonly LedgerBreakdownRow[],
  round: BettingRound,
  unit: GameUnit,
  unclaimedPoints = 0,
  unavailableReason?: string,
): GameLedger {
  const roundedPointBalances = roundBalances(pointBalances);

  return {
    game,
    label,
    pointBalances: roundedPointBalances,
    moneyBalances: toMoneyBalances(roundedPointBalances, round.settings.scoringMode, unit),
    rows,
    unclaimedPoints: roundToTwo(unclaimedPoints),
    unavailableReason,
  };
}

function aggregateGameLedgers(round: BettingRound, gameLedgers: readonly GameLedger[]): Readonly<Record<PlayerId, PlayerBalance>> {
  const pointTotals = createMutableBalances(round.players);
  const moneyTotals = createMutableBalances(round.players);

  for (const ledger of gameLedgers) {
    mergeBalances(pointTotals, ledger.pointBalances);
    mergeBalances(moneyTotals, ledger.moneyBalances);
  }

  return Object.fromEntries(round.players.map((player) => [
    player.id,
    { points: roundToTwo(pointTotals[player.id]), money: roundToTwo(moneyTotals[player.id]) },
  ]));
}

function mapPlayerBalances(
  balances: Readonly<Record<PlayerId, PlayerBalance>>,
  field: keyof PlayerBalance,
): BalanceMap {
  return Object.fromEntries(Object.entries(balances).map(([playerId, balance]) => [playerId, balance[field]]));
}

function createBreakdownRow(input: {
  readonly id: string;
  readonly game: BettingGameId | 'settlement';
  readonly holeNumber?: number;
  readonly playerId?: PlayerId;
  readonly label: string;
  readonly detail: string;
  readonly points: number;
  readonly money: number;
  readonly balanceDeltas: BalanceMap;
}): LedgerBreakdownRow {
  return {
    id: input.id,
    game: input.game,
    holeNumber: input.holeNumber,
    playerId: input.playerId,
    label: input.label,
    detail: input.detail,
    points: roundToTwo(input.points),
    money: roundToTwo(input.money),
    balanceDeltas: roundBalances(input.balanceDeltas),
  };
}

function createSettlementRow(transfer: NetTransfer, index: number): LedgerBreakdownRow {
  return createBreakdownRow({
    id: `settlement-${index + 1}`,
    game: 'settlement',
    label: transfer.unit === 'money' ? '순정산' : '포인트 순정산',
    detail: `${transfer.payerId} → ${transfer.payeeId} ${formatNumber(transfer.amount)}${transfer.unit === 'money' ? '원' : '점'}`,
    points: transfer.unit === 'points' ? transfer.amount : 0,
    money: transfer.unit === 'money' ? transfer.amount : 0,
    balanceDeltas: {},
  });
}

function completedHoles(round: BettingRound): readonly HoleResult[] {
  return round.holes.filter((hole) => isCompletedHole(hole, round.players));
}

function isCompletedHole(hole: HoleResult, players: readonly Player[]): boolean {
  return players.every((player) => (hole.strokes[player.id] ?? 0) > 0);
}

function scoreEntriesForHole(
  round: BettingRound,
  handicap: AppliedHandicap,
  hole: HoleResult,
): readonly OjangScoreEntry[] {
  return round.players.map((player) => ({
    player,
    rawScore: hole.strokes[player.id] ?? 0,
    settlementScore: scoreForHole(round, handicap, hole, player.id),
  }));
}

function scoreForHole(
  round: BettingRound,
  handicap: AppliedHandicap,
  hole: HoleResult,
  playerId: PlayerId,
): number {
  if (round.settings.handicapMode === 'hole-allocation') {
    return handicap.netHoleScores[hole.holeNumber]?.[playerId] ?? (hole.strokes[playerId] ?? 0);
  }

  return hole.strokes[playerId] ?? 0;
}

function toMoneyBalances(pointBalances: BalanceMap, scoringMode: ScoringMode, unit: GameUnit): BalanceMap {
  if (scoringMode !== 'money') {
    return Object.fromEntries(Object.keys(pointBalances).map((playerId) => [playerId, 0]));
  }

  return Object.fromEntries(Object.entries(pointBalances).map(([playerId, points]) => [
    playerId,
    roundToTwo(points * unit.moneyPerPoint),
  ]));
}

function normalizeEnabledGames(enabledGames: EnabledGames): EnabledGames {
  return Object.fromEntries(bettingGameIds.map((game) => [game, enabledGames[game] ?? defaultEnabledGames[game]])) as EnabledGames;
}

function normalizeGameUnits(gameUnits: GameUnitMap): GameUnitMap {
  return Object.fromEntries(bettingGameIds.map((game) => {
    const unit = gameUnits[game] ?? defaultGameUnits[game];
    return [game, {
      pointValue: positiveNumber(unit.pointValue, defaultGameUnits[game].pointValue),
      moneyPerPoint: Math.max(0, normalizeNumber(unit.moneyPerPoint, defaultGameUnits[game].moneyPerPoint)),
    }];
  })) as GameUnitMap;
}

function normalizeHole(hole: HoleResult, playerIds: readonly PlayerId[], holeCount: number): HoleResult | null {
  const holeNumber = clampInteger(hole.holeNumber, 1, holeCount);
  if (!Number.isFinite(holeNumber)) {
    return null;
  }

  return {
    ...hole,
    holeNumber,
    par: clampInteger(hole.par, 3, 5),
    strokes: Object.fromEntries(playerIds.map((playerId) => [
      playerId,
      Math.max(0, Math.round(normalizeNumber(hole.strokes[playerId], 0))),
    ])),
    events: (hole.events ?? []).filter((event) => playerIds.includes(event.playerId) && event.type === 'near-pin'),
  };
}

function assertPlayerCount(playerCount: number): void {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Golf Ojang ledger supports 2–4 players.');
  }
}

function assertUniquePlayerIds(players: readonly Player[]): void {
  const ids = new Set<string>();
  for (const player of players) {
    const id = player.id.trim();
    if (!id || ids.has(id)) {
      throw new Error('Player ids must be stable and unique.');
    }
    ids.add(id);
  }
}

function createMutableBalances(players: readonly Player[]): Record<PlayerId, number> {
  return Object.fromEntries(players.map((player) => [player.id, 0]));
}

function mergeBalances(target: Record<PlayerId, number>, source: BalanceMap): void {
  for (const [playerId, amount] of Object.entries(source)) {
    target[playerId] = roundToTwo((target[playerId] ?? 0) + amount);
  }
}

function roundBalances(balances: BalanceMap): BalanceMap {
  const roundedEntries = Object.entries(balances).map(([playerId, balance]) => [playerId, roundToTwo(balance)] as const);
  const residual = roundToTwo(-roundedEntries.reduce((sum, [, balance]) => sum + balance, 0));

  if (residual === 0 || roundedEntries.length === 0) {
    return Object.fromEntries(roundedEntries);
  }

  let correctionIndex = roundedEntries.length - 1;
  let smallestNonZeroBalance = Number.POSITIVE_INFINITY;

  roundedEntries.forEach(([, balance], index) => {
    const absoluteBalance = Math.abs(balance);
    if (absoluteBalance > 0 && absoluteBalance <= smallestNonZeroBalance) {
      smallestNonZeroBalance = absoluteBalance;
      correctionIndex = index;
    }
  });

  return Object.fromEntries(roundedEntries.map(([playerId, balance], index) => [
    playerId,
    index === correctionIndex ? roundToTwo(balance + residual) : balance,
  ]));
}

function normalizeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: number, fallback: number): number {
  const normalized = normalizeNumber(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  const normalized = Math.round(normalizeNumber(value, min));
  return Math.min(max, Math.max(min, normalized));
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
