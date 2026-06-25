export const bettingGameIds = ['stroke', 'skins', 'vegas', 'events', 'missions'] as const;

export type BettingGameId = (typeof bettingGameIds)[number];
export type PlayerId = string;
export type ScoringMode = 'points' | 'money';
export type HandicapMode = 'final-total' | 'hole-allocation';
export type MissionOutcomeResult = 'success' | 'fail';

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
export type VegasTeamAssignment = readonly [readonly [PlayerId, PlayerId], readonly [PlayerId, PlayerId]];

export type BettingEventType = 'near-pin' | 'longest-drive' | 'birdie' | 'ob-penalty';

export type BettingEventAward = {
  readonly type: BettingEventType;
  readonly playerId: PlayerId;
  readonly points?: number;
  readonly label?: string;
};

export type MissionOutcome = {
  readonly cardId: string;
  readonly playerId: PlayerId;
  readonly result: MissionOutcomeResult;
};

export type HoleResult = {
  readonly holeNumber: number;
  readonly strokes: HoleScoreMap;
  readonly events?: readonly BettingEventAward[];
  readonly missions?: readonly MissionOutcome[];
  readonly vegasTeams?: VegasTeamAssignment;
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

export type MissionCard = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly successPoints: number;
  readonly failPenaltyPoints: number;
};

export const ledgerCalculationOrder = [
  'normalize round input',
  'derive handicap view',
  'calculate enabled game ledgers independently',
  'convert per-game points to money units',
  'aggregate player balances',
  'net balances into minimal transfers',
  'emit inspectable calculation breakdown rows',
] as const;

export const defaultEnabledGames: EnabledGames = {
  stroke: true,
  skins: true,
  vegas: true,
  events: true,
  missions: true,
};

export const defaultGameUnits: GameUnitMap = {
  stroke: { pointValue: 1, moneyPerPoint: 1000 },
  skins: { pointValue: 1, moneyPerPoint: 1000 },
  vegas: { pointValue: 1, moneyPerPoint: 1000 },
  events: { pointValue: 1, moneyPerPoint: 1000 },
  missions: { pointValue: 1, moneyPerPoint: 1000 },
};

export const eventBasePoints: Readonly<Record<BettingEventType, number>> = {
  'near-pin': 2,
  'longest-drive': 2,
  birdie: 3,
  'ob-penalty': -2,
};

export const eventLabels: Readonly<Record<BettingEventType, string>> = {
  'near-pin': '니어핀 보너스',
  'longest-drive': '롱기스트 보너스',
  birdie: '버디 보너스',
  'ob-penalty': 'OB/벌타 페널티',
};

export const KOREAN_MISSION_DECK: readonly MissionCard[] = [
  {
    id: 'fairway-keeper',
    title: '페어웨이 지킴이',
    description: '티샷을 페어웨이에 안착시키면 보너스, 실패하면 소폭 페널티.',
    successPoints: 2,
    failPenaltyPoints: 1,
  },
  {
    id: 'one-putt-save',
    title: '원펏 세이브',
    description: '그린 위 첫 퍼트로 마무리하면 보너스.',
    successPoints: 3,
    failPenaltyPoints: 1,
  },
  {
    id: 'sand-save-party',
    title: '벙커 탈출쇼',
    description: '벙커 이후 보기 이하로 막으면 보너스, 실패하면 페널티.',
    successPoints: 4,
    failPenaltyPoints: 2,
  },
  {
    id: 'par-save-pressure',
    title: '파 세이브 압박',
    description: '미션 선언 홀에서 파 이상이면 보너스, 더블 보기 이상이면 페널티.',
    successPoints: 3,
    failPenaltyPoints: 2,
  },
] as const;

const fallbackPlayers: readonly Player[] = [
  { id: 'p1', name: '민준', handicap: 0 },
  { id: 'p2', name: '서준', handicap: 1 },
  { id: 'p3', name: '지아', handicap: 2 },
  { id: 'p4', name: '하준', handicap: 0 },
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
    id: 'default-golf-bet-ledger-round',
    createdAt: timestamp,
    updatedAt: timestamp,
    players: fallbackPlayers.slice(0, playerCount),
    settings: {
      holeCount: 18,
      scoringMode: options.scoringMode ?? 'points',
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

export function isVegasAvailable(round: BettingRound): boolean {
  return normalizeBettingRound(round).players.length === 4;
}

export function drawMissionCard(seed: number, drawIndex = 0): MissionCard {
  const normalizedSeed = Math.abs(Math.trunc(seed + drawIndex * 9973));
  return KOREAN_MISSION_DECK[normalizedSeed % KOREAN_MISSION_DECK.length];
}

function calculateGameLedger(game: BettingGameId, round: BettingRound, handicap: AppliedHandicap): GameLedger {
  switch (game) {
    case 'stroke':
      return calculateStrokeLedger(round, handicap);
    case 'skins':
      return calculateSkinsLedger(round, handicap);
    case 'vegas':
      return calculateVegasLedger(round, handicap);
    case 'events':
      return calculateEventsLedger(round);
    case 'missions':
      return calculateMissionsLedger(round);
  }
}

function calculateStrokeLedger(round: BettingRound, handicap: AppliedHandicap): GameLedger {
  const unit = round.gameUnits.stroke;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];

  for (let leftIndex = 0; leftIndex < round.players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < round.players.length; rightIndex += 1) {
      const left = round.players[leftIndex];
      const right = round.players[rightIndex];
      const leftTotal = handicap.adjustedTotals[left.id] ?? 0;
      const rightTotal = handicap.adjustedTotals[right.id] ?? 0;

      if (leftTotal === rightTotal) {
        continue;
      }

      const winner = leftTotal < rightTotal ? left : right;
      const loser = leftTotal < rightTotal ? right : left;
      const strokeDelta = Math.abs(leftTotal - rightTotal);
      const points = roundToTwo(strokeDelta * unit.pointValue);
      const deltas = createMutableBalances(round.players);
      deltas[winner.id] = points;
      deltas[loser.id] = -points;
      mergeBalances(pointBalances, deltas);
      rows.push(createBreakdownRow({
        game: 'stroke',
        id: `stroke-${winner.id}-${loser.id}`,
        label: '스트로크 정산',
        detail: `${winner.name}이 ${loser.name}보다 보정 합계 ${formatNumber(strokeDelta)}타 앞서 ${formatNumber(points)}점 획득`,
        points,
        money: round.settings.scoringMode === 'money' ? roundToTwo(points * unit.moneyPerPoint) : 0,
        balanceDeltas: deltas,
      }));
    }
  }

  return buildGameLedger('stroke', '스트로크', pointBalances, rows, round, unit);
}

function calculateSkinsLedger(round: BettingRound, handicap: AppliedHandicap): GameLedger {
  const unit = round.gameUnits.skins;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];
  let carryover = 0;

  for (const hole of completedHoles(round)) {
    const scores = scoreEntriesForHole(round, handicap, hole);
    const lowestScore = Math.min(...scores.map((entry) => entry.score));
    const winners = scores.filter((entry) => entry.score === lowestScore);

    if (winners.length !== 1) {
      carryover = roundToTwo(carryover + unit.pointValue);
      rows.push(createBreakdownRow({
        game: 'skins',
        id: `skins-${hole.holeNumber}-carry`,
        holeNumber: hole.holeNumber,
        label: '스킨스 캐리오버',
        detail: `${hole.holeNumber}번 홀 최저타 동률로 ${formatNumber(carryover)}점이 다음 홀로 이월`,
        points: 0,
        money: 0,
        balanceDeltas: createMutableBalances(round.players),
      }));
      continue;
    }

    const winner = winners[0].player;
    const skinPoints = roundToTwo(unit.pointValue + carryover);
    const deltas = distributeAgainstField(round.players, winner.id, skinPoints);
    mergeBalances(pointBalances, deltas);
    rows.push(createBreakdownRow({
      game: 'skins',
      id: `skins-${hole.holeNumber}-${winner.id}`,
      holeNumber: hole.holeNumber,
      playerId: winner.id,
      label: '스킨스 획득',
      detail: `${winner.name}이 ${hole.holeNumber}번 홀 단독 최저타로 ${formatNumber(skinPoints)}점 스킨 획득`,
      points: skinPoints,
      money: round.settings.scoringMode === 'money' ? roundToTwo(skinPoints * unit.moneyPerPoint) : 0,
      balanceDeltas: deltas,
    }));
    carryover = 0;
  }

  if (carryover > 0) {
    rows.push(createBreakdownRow({
      game: 'skins',
      id: 'skins-unclaimed-carryover',
      label: '미청구 스킨스 이월',
      detail: `마지막 홀까지 주인이 없는 ${formatNumber(carryover)}점은 강제 배분하지 않음`,
      points: 0,
      money: 0,
      balanceDeltas: createMutableBalances(round.players),
    }));
  }

  return buildGameLedger('skins', '스킨스', pointBalances, rows, round, unit, carryover);
}

function calculateVegasLedger(round: BettingRound, handicap: AppliedHandicap): GameLedger {
  const unit = round.gameUnits.vegas;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];

  if (round.players.length !== 4) {
    return buildGameLedger('vegas', '베가스 팀전', pointBalances, [createBreakdownRow({
      game: 'vegas',
      id: 'vegas-unavailable',
      label: '베가스 비활성',
      detail: '베가스 팀전은 정확히 4명일 때만 계산됩니다.',
      points: 0,
      money: 0,
      balanceDeltas: pointBalances,
    })], round, unit, 0, '베가스 팀전은 4명 전용입니다.');
  }

  for (const hole of completedHoles(round)) {
    const teams = resolveVegasTeams(hole, round.players);
    const teamScores = teams.map((team) => {
      const scores = team.map((playerId) => scoreForHole(round, handicap, hole, playerId)).sort((a, b) => a - b);
      return { team, number: scores[0] * 10 + scores[1], scores };
    });

    if (teamScores[0].number === teamScores[1].number) {
      rows.push(createBreakdownRow({
        game: 'vegas',
        id: `vegas-${hole.holeNumber}-tie`,
        holeNumber: hole.holeNumber,
        label: '베가스 동률',
        detail: `${hole.holeNumber}번 홀 양 팀 ${teamScores[0].number}로 정산 없음`,
        points: 0,
        money: 0,
        balanceDeltas: createMutableBalances(round.players),
      }));
      continue;
    }

    const winningTeam = teamScores[0].number < teamScores[1].number ? teamScores[0] : teamScores[1];
    const losingTeam = teamScores[0].number < teamScores[1].number ? teamScores[1] : teamScores[0];
    const teamPoints = roundToTwo((losingTeam.number - winningTeam.number) * unit.pointValue);
    const deltas = createMutableBalances(round.players);

    for (const playerId of winningTeam.team) {
      deltas[playerId] = roundToTwo(teamPoints / 2);
    }

    for (const playerId of losingTeam.team) {
      deltas[playerId] = roundToTwo(-teamPoints / 2);
    }

    mergeBalances(pointBalances, deltas);
    rows.push(createBreakdownRow({
      game: 'vegas',
      id: `vegas-${hole.holeNumber}`,
      holeNumber: hole.holeNumber,
      label: '베가스 팀 정산',
      detail: `${hole.holeNumber}번 홀 ${winningTeam.number} 대 ${losingTeam.number}, 승리 팀이 ${formatNumber(teamPoints)}점 분배`,
      points: teamPoints,
      money: round.settings.scoringMode === 'money' ? roundToTwo(teamPoints * unit.moneyPerPoint) : 0,
      balanceDeltas: deltas,
    }));
  }

  return buildGameLedger('vegas', '베가스 팀전', pointBalances, rows, round, unit);
}

function calculateEventsLedger(round: BettingRound): GameLedger {
  const unit = round.gameUnits.events;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];

  for (const hole of round.holes) {
    for (const event of hole.events ?? []) {
      const player = round.players.find((candidate) => candidate.id === event.playerId);
      if (!player) {
        continue;
      }

      const eventPoints = roundToTwo((event.points ?? eventBasePoints[event.type]) * unit.pointValue);
      const deltas = distributeAgainstField(round.players, player.id, eventPoints);
      mergeBalances(pointBalances, deltas);
      rows.push(createBreakdownRow({
        game: 'events',
        id: `event-${hole.holeNumber}-${event.type}-${player.id}`,
        holeNumber: hole.holeNumber,
        playerId: player.id,
        label: event.label ?? eventLabels[event.type],
        detail: `${hole.holeNumber}번 홀 ${player.name} · ${event.label ?? eventLabels[event.type]} ${formatSigned(eventPoints)}점`,
        points: eventPoints,
        money: round.settings.scoringMode === 'money' ? roundToTwo(eventPoints * unit.moneyPerPoint) : 0,
        balanceDeltas: deltas,
      }));
    }
  }

  return buildGameLedger('events', '이벤트', pointBalances, rows, round, unit);
}

function calculateMissionsLedger(round: BettingRound): GameLedger {
  const unit = round.gameUnits.missions;
  const pointBalances = createMutableBalances(round.players);
  const rows: LedgerBreakdownRow[] = [];

  for (const hole of round.holes) {
    for (const outcome of hole.missions ?? []) {
      const player = round.players.find((candidate) => candidate.id === outcome.playerId);
      const card = KOREAN_MISSION_DECK.find((candidate) => candidate.id === outcome.cardId);
      if (!player || !card) {
        continue;
      }

      const rawPoints = outcome.result === 'success' ? card.successPoints : -card.failPenaltyPoints;
      const missionPoints = roundToTwo(rawPoints * unit.pointValue);
      const deltas = distributeAgainstField(round.players, player.id, missionPoints);
      mergeBalances(pointBalances, deltas);
      rows.push(createBreakdownRow({
        game: 'missions',
        id: `mission-${hole.holeNumber}-${card.id}-${player.id}`,
        holeNumber: hole.holeNumber,
        playerId: player.id,
        label: `미션 카드 · ${card.title}`,
        detail: `${player.name} ${outcome.result === 'success' ? '성공' : '실패'}: ${card.description}`,
        points: missionPoints,
        money: round.settings.scoringMode === 'money' ? roundToTwo(missionPoints * unit.moneyPerPoint) : 0,
        balanceDeltas: deltas,
      }));
    }
  }

  return buildGameLedger('missions', '미션 카드', pointBalances, rows, round, unit);
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
  return {
    game,
    label,
    pointBalances: roundBalances(pointBalances),
    moneyBalances: toMoneyBalances(pointBalances, round.settings.scoringMode, unit),
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
): readonly { readonly player: Player; readonly score: number }[] {
  return round.players.map((player) => ({
    player,
    score: scoreForHole(round, handicap, hole, player.id),
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

function resolveVegasTeams(hole: HoleResult, players: readonly Player[]): VegasTeamAssignment {
  return hole.vegasTeams ?? [[players[0].id, players[1].id], [players[2].id, players[3].id]];
}

function distributeAgainstField(players: readonly Player[], playerId: PlayerId, points: number): Record<PlayerId, number> {
  const deltas = createMutableBalances(players);
  const others = players.filter((player) => player.id !== playerId);
  deltas[playerId] = roundToTwo(points);

  if (others.length === 0) {
    return deltas;
  }

  const counterDelta = roundToTwo(-points / others.length);
  let allocatedCounter = 0;
  for (const other of others.slice(0, -1)) {
    deltas[other.id] = counterDelta;
    allocatedCounter = roundToTwo(allocatedCounter + counterDelta);
  }

  const lastOther = others.at(-1);
  if (lastOther) {
    deltas[lastOther.id] = roundToTwo(-points - allocatedCounter);
  }

  return deltas;
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
    strokes: Object.fromEntries(playerIds.map((playerId) => [
      playerId,
      Math.max(0, Math.round(normalizeNumber(hole.strokes[playerId], 0))),
    ])),
    events: (hole.events ?? []).filter((event) => playerIds.includes(event.playerId)),
    missions: (hole.missions ?? []).filter((mission) => playerIds.includes(mission.playerId)),
  };
}

function assertPlayerCount(playerCount: number): void {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Golf betting ledger supports 2–4 players.');
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
  return Object.fromEntries(Object.entries(balances).map(([playerId, balance]) => [playerId, roundToTwo(balance)]));
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

function formatSigned(value: number): string {
  return value >= 0 ? `+${formatNumber(value)}` : formatNumber(value);
}
