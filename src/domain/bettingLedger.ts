export type PlayerId = string;

export type Player = {
  readonly id: PlayerId;
  readonly name: string;
  readonly handicap: number;
};

export type OjangRoundSettings = {
  readonly holeCount: number;
};

export type ScoreEntryMode = 'on-putt' | 'hio' | 'manual';

export type GameUnit = {
  readonly pointValue: number;
  readonly moneyPerPoint: number;
};

export type GameUnitMap = Readonly<Record<BettingGameId, GameUnit>>;
export type HoleScoreMap = Readonly<Record<PlayerId, number>>;

export type HoleResult = {
  readonly holeNumber: number;
  readonly par: number;
  readonly strokes: HoleScoreMap;
};

export type BettingRound = {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly players: readonly Player[];
  readonly settings: OjangRoundSettings;
  readonly holes: readonly HoleResult[];
};

export type BalanceMap = Readonly<Record<PlayerId, number>>;

export type PlayerBalance = {
  readonly money: number;
};

export type LedgerBreakdownRow = {
  readonly id: string;
  readonly game: 'ojang' | 'settlement';
  readonly holeNumber?: number;
  readonly playerId?: PlayerId;
  readonly label: string;
  readonly detail: string;
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
  readonly rawTotals: BalanceMap;
  readonly adjustedTotals: BalanceMap;
  readonly allocatedStrokes: Readonly<Record<number, BalanceMap>>;
  readonly netHoleScores: Readonly<Record<number, BalanceMap>>;
  readonly completedHoleNumbers: readonly number[];
};

export type NetTransferUnit = 'money';

export type NetTransfer = {
  readonly payerId: PlayerId;
  readonly payeeId: PlayerId;
  readonly amount: number;
  readonly unit: 'money';
};

export type RoundLedger = {
  readonly roundId: string;
  readonly calculationOrder: readonly string[];
  readonly normalizedRound: BettingRound;
  readonly completedHoleNumbers: readonly number[];
  readonly rawTotals: BalanceMap;
  readonly adjustedTotals: BalanceMap;
  readonly playerBalances: Readonly<Record<PlayerId, PlayerBalance>>;
  readonly netTransfers: readonly NetTransfer[];
  readonly breakdownRows: readonly LedgerBreakdownRow[];
};

export const defaultOjangUnitAmount = 1_000;
export const maximumOjangScoreStrokes = 30;

export const ledgerCalculationOrder = [
  'normalize round input',
  'derive final-total handicap view',
  'calculate traditional Ojang hole-by-hole stroke ledger',
  'apply minpan/baepan board multipliers',
  'convert Ojang point units to money units',
  'aggregate player balances',
  'net money balances into minimal transfers',
  'emit inspectable calculation breakdown rows',
] as const;

export const defaultEnabledGames: EnabledGames = {
  ojang: true,
};

export const defaultGameUnits: GameUnitMap = {
  ojang: { pointValue: 1, moneyPerPoint: 5000 },
};

const fallbackPlayers: readonly Player[] = [
  { id: 'p1', name: '', handicap: 0 },
  { id: 'p2', name: '', handicap: 0 },
  { id: 'p3', name: '', handicap: 0 },
  { id: 'p4', name: '', handicap: 0 },
] as const;

type ScoreEntry = {
  readonly player: Player;
  readonly score: HoleScore;
};

export function createDefaultRound(options: {
  readonly playerCount?: number;
  readonly now?: string;
} = {}): BettingRound {
  const playerCount = options.playerCount ?? 4;
  assertPlayerCount(playerCount);
  const timestamp = options.now ?? '2026-06-25T00:00:00.000Z';

  return normalizeBettingRound({
    id: 'default-golf-ojang-round',
    createdAt: timestamp,
    updatedAt: timestamp,
    players: fallbackPlayers.slice(0, playerCount),
    settings: { holeCount: 18 },
    enabledGames: defaultEnabledGames,
    gameUnits: defaultGameUnits,
    holes: [],
  });
}

export function calculateRoundLedger(round: BettingRound): RoundLedger {
  const normalizedRound = normalizeBettingRound(round);
  const handicap = applyHandicap(normalizedRound);
  const gameLedgers = bettingGameIds
    .filter((game) => normalizedRound.enabledGames[game])
    .map((game) => calculateGameLedger(game, normalizedRound, handicap));
  const totals = aggregateGameLedgers(normalizedRound, gameLedgers);
  const netTransfers = calculateNetTransfers(mapPlayerBalances(totals, 'money'));
  const settlementRows = netTransfers.map((transfer, index) => createSettlementRow(transfer, index));

  return {
    roundId: normalizedRound.id,
    calculationOrder: ledgerCalculationOrder,
    normalizedRound,
    completedHoleNumbers: completed.map((hole) => hole.holeNumber),
    rawTotals,
    adjustedTotals,
    playerBalances,
    netTransfers,
    breakdownRows: [...rows, ...settlementRows],
  };
}

export function normalizeBettingRound(round: BettingRound): BettingRound {
  assertPlayerCount(round.players.length);
  assertUniquePlayerIds(round.players);
  const holeCount = clampInteger(round.settings.holeCount, 1, 18);
  const players = round.players.map((player) => ({
    id: player.id.trim(),
    name: player.name,
    handicap: clampInteger(player.handicap, -10, 54),
  }));
  const playerIds = players.map((player) => player.id);
  const holes = round.holes
    .map((hole) => normalizeHole(hole, playerIds, holeCount))
    .filter((hole): hole is HoleResult => hole !== null)
    .sort((left, right) => left.holeNumber - right.holeNumber);

  return {
    ...round,
    players,
    settings: { holeCount },
    enabledGames: normalizeEnabledGames(round.enabledGames),
    gameUnits: normalizeGameUnits(round.gameUnits),
    holes,
  };
}

export function applyHandicap(round: BettingRound): AppliedHandicap {
  const normalizedRound = normalizeBettingRound(round);
  const completedHoles = normalizedRound.holes.filter((hole) => isCompletedHole(hole, normalizedRound.players));
  const completedHoleNumbers = completedHoles.map((hole) => hole.holeNumber);
  const rawTotals = createMutableBalances(normalizedRound.players);
  const allocatedStrokes: Record<number, Record<PlayerId, number>> = {};
  const netHoleScores: Record<number, Record<PlayerId, number>> = {};

  for (const holeNumber of Array.from({ length: normalizedRound.settings.holeCount }, (_, index) => index + 1)) {
    allocatedStrokes[holeNumber] = createMutableBalances(normalizedRound.players);
  }

  for (const hole of completedHoles) {
    const netScores = createMutableBalances(normalizedRound.players);

    for (const player of normalizedRound.players) {
      const rawScore = hole.strokes[player.id] ?? 0;
      rawTotals[player.id] = roundToTwo(rawTotals[player.id] + rawScore);
      netScores[player.id] = rawScore;
    }

    netHoleScores[hole.holeNumber] = netScores;
  }

  const adjustedTotals = createMutableBalances(normalizedRound.players);
  for (const player of normalizedRound.players) {
    adjustedTotals[player.id] = roundToTwo(rawTotals[player.id] - normalizeNumber(player.handicap));
  }

  return {
    rawTotals,
    adjustedTotals,
    allocatedStrokes,
    netHoleScores,
    completedHoleNumbers,
  };
}

export function calculateNetTransfers(balances: BalanceMap): readonly NetTransfer[] {
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
      transfers.push({ payerId: payer.playerId, payeeId: payee.playerId, amount, unit: 'money' });
    }

    if (payer.remaining <= 0.005) {
      payerIndex += 1;
    }
    if (payee.remaining <= 0.005) {
      payeeIndex += 1;
    }
  }

  return transfers;
}

function completedHoles(round: BettingRound): readonly HoleResult[] {
  return round.holes.filter((hole) => isCompletedHole(round, hole));
}

function isCompletedHole(round: BettingRound, hole: HoleResult): boolean {
  return round.players.every((player) => scoreForPlayer(hole, player.id)?.strokes && scoreForPlayer(hole, player.id)!.strokes > 0);
}

function scoreEntriesForHole(round: BettingRound, hole: HoleResult): readonly ScoreEntry[] {
  return round.players.flatMap((player) => {
    const score = scoreForPlayer(hole, player.id);
    return score ? [{ player, score }] : [];
  });
}

function scoreForPlayer(hole: HoleResult, playerId: PlayerId): HoleScore | undefined {
  return hole.scores.find((score) => score.playerId === playerId);
}

function calculatePairwiseScoreDeltas(
  players: readonly Player[],
  scores: readonly ScoreEntry[],
  unitAmount: number,
  multiplier: number,
): BalanceMap {
  const strokes = Object.fromEntries(scores.map((entry) => [entry.player.id, entry.score.strokes]));
  return calculatePairwiseTotalDeltas(players, strokes, unitAmount, multiplier);
}

function calculatePairwiseTotalDeltas(
  players: readonly Player[],
  totals: BalanceMap,
  unitAmount: number,
  multiplier = 1,
): BalanceMap {
  const deltas = createMutableBalances(players);

  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      const leftTotal = totals[left.id] ?? 0;
      const rightTotal = totals[right.id] ?? 0;
      const deltaForLeft = roundToTwo((rightTotal - leftTotal) * unitAmount * multiplier);
      deltas[left.id] = roundToTwo((deltas[left.id] ?? 0) + deltaForLeft);
      deltas[right.id] = roundToTwo((deltas[right.id] ?? 0) - deltaForLeft);
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
        const points = roundToTwo((strokeDelta + birdieBonus) * board.multiplier * unit.pointValue);
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
          detail: ojangRowDetail({ hole, winner, loser, strokeDelta, birdieBonus, board, points }),
          points,
          money: roundToTwo(points * unit.moneyPerPoint),
          balanceDeltas: deltas,
        }));
      }
    }

    nextBoardReasons = followingBoardReasons;
  }

  return roundBalances(deltas);
}

function doublePlateTriggerReasons(hole: HoleResult, scores: readonly ScoreEntry[]): string[] {
  const reasons: string[] = [];
  if (scores.some((entry) => entry.score.strokes <= hole.par - 1)) {
    reasons.push('버디 이상');
  }
  if (scores.some((entry) => entry.score.strokes >= hole.par + 3)) {
    reasons.push('트리플 이상');
  }
  if (hole.par === 3 && scores.some((entry) => entry.score.strokes >= hole.par + 2)) {
    reasons.push('파3 더블 이상');
  }
  if (scores.length === 4 && Array.from(scoreCounts(scores).values()).some((count) => count === 3)) {
    reasons.push('3명 동타');
  }

  return reasons;
}

function ojangRowDetail(input: {
  readonly hole: HoleResult;
  readonly winner: OjangScoreEntry;
  readonly loser: OjangScoreEntry;
  readonly strokeDelta: number;
  readonly birdieBonus: number;
  readonly board: OjangBoardState;
  readonly points: number;
}): string {
  const additionText = input.birdieBonus > 0 ? ', 버디 보너스 +1' : '';
  const boardReason = input.board.reasons.length > 0 ? ` (${input.board.reasons.join(', ')})` : '';

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
    moneyBalances: toMoneyBalances(roundedPointBalances, unit),
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

  const nearEntry = scores.find((entry) => entry.player.id === hole.nearPlayerId);
  if (!nearEntry) {
    return null;
  }

  const success = nearEntry.score.strokes <= hole.par;
  const deltas = createMutableBalances(round.players);
  for (const player of round.players) {
    if (player.id === nearEntry.player.id) {
      continue;
    }
    deltas[nearEntry.player.id] = roundToTwo((deltas[nearEntry.player.id] ?? 0) + (success ? round.settings.unitAmount : -round.settings.unitAmount));
    deltas[player.id] = roundToTwo((deltas[player.id] ?? 0) + (success ? -round.settings.unitAmount : round.settings.unitAmount));
  }

  return createBreakdownRow({
    game: 'ojang',
    id: `hole-${hole.holeNumber}-near-${nearEntry.player.id}`,
    holeNumber: hole.holeNumber,
    playerId: nearEntry.player.id,
    label: success ? '파3 니어 성공' : '파3 니어 실패 · 니뻐',
    detail: success
      ? `${hole.holeNumber}번 홀 니어 ${displayName(nearEntry.player)} 파 이하 성공 · 1타값을 받습니다.`
      : `${hole.holeNumber}번 홀 니어 ${displayName(nearEntry.player)} 파 실패(니뻐) · 1타값을 냅니다.`,
    money: positiveTotal(deltas),
    balanceDeltas: deltas,
  });
}

function rawStrokeTotals(round: BettingRound, completed: readonly HoleResult[]): BalanceMap {
  const totals = createMutableBalances(round.players);
  for (const hole of completed) {
    for (const player of round.players) {
      totals[player.id] = roundToTwo((totals[player.id] ?? 0) + (scoreForPlayer(hole, player.id)?.strokes ?? 0));
    }
  }
  return totals;
}

function finalHandicapDelta(players: readonly Player[], rawTotals: BalanceMap, adjustedTotals: BalanceMap, unitAmount: number): BalanceMap {
  const rawDeltas = calculatePairwiseTotalDeltas(players, rawTotals, unitAmount);
  const adjustedDeltas = calculatePairwiseTotalDeltas(players, adjustedTotals, unitAmount);
  const delta = createMutableBalances(players);

  for (const player of players) {
    delta[player.id] = roundToTwo((adjustedDeltas[player.id] ?? 0) - (rawDeltas[player.id] ?? 0));
  }

  return roundBalances(delta);
}

function createBreakdownRow(input: {
  readonly id: string;
  readonly game: 'ojang' | 'settlement';
  readonly holeNumber?: number;
  readonly playerId?: PlayerId;
  readonly label: string;
  readonly detail: string;
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
    money: roundToTwo(input.money),
    balanceDeltas: roundBalances(input.balanceDeltas),
  };
}

function createSettlementRow(transfer: NetTransfer, index: number): LedgerBreakdownRow {
  return createBreakdownRow({
    id: `settlement-${index + 1}`,
    game: 'settlement',
    label: '순정산',
    detail: `${transfer.payerId} → ${transfer.payeeId} ${formatNumber(transfer.amount)}원`,
    points: 0,
    money: transfer.amount,
    balanceDeltas: {},
  });
}

function completedHoles(round: BettingRound): readonly HoleResult[] {
  return round.holes.filter((hole) => isCompletedHole(hole, round.players));
}

function isCompletedHole(hole: HoleResult, players: readonly Player[]): boolean {
  return players.every((player) => (hole.strokes[player.id] ?? 0) > 0);
}

function scoreEntriesForHole(round: BettingRound, _handicap: AppliedHandicap, hole: HoleResult): readonly OjangScoreEntry[] {
  return round.players.map((player) => ({
    player,
    rawScore: hole.strokes[player.id] ?? 0,
    settlementScore: hole.strokes[player.id] ?? 0,
  }));
}

function toMoneyBalances(pointBalances: BalanceMap, unit: GameUnit): BalanceMap {
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
  const nearPlayerId = typeof hole.nearPlayerId === 'string' && playerIds.includes(hole.nearPlayerId) ? hole.nearPlayerId : null;

  return {
    holeNumber,
    par: clampInteger(hole.par, 3, 5),
    strokes: Object.fromEntries(playerIds.map((playerId) => [
      playerId,
      Math.max(0, Math.round(normalizeNumber(hole.strokes[playerId], 0))),
    ])),
  };
}

function normalizeScore(score: HoleScore, playerId: PlayerId): HoleScore {
  const strokes = clampInteger(score.strokes, 1, maximumOjangScoreStrokes);
  const onGreenShots = normalizeOptionalInteger(score.onGreenShots, 1, 6);
  const putts = normalizeOptionalInteger(score.putts, 0, 5);
  const holeInOne = score.holeInOne === true || score.entryMode === 'hio';

  if (holeInOne) {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
  }

  if (score.entryMode === 'on-putt' && onGreenShots !== undefined && putts !== undefined) {
    return { playerId, strokes: clampInteger(onGreenShots + putts, 1, maximumOjangScoreStrokes), entryMode: 'on-putt', onGreenShots, putts, holeInOne: false };
  }

  return { playerId, strokes, entryMode: 'manual' };
}

function normalizeOptionalInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

function assertPlayerCount(playerCount: number): void {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Ojang ledger supports 2–4 players.');
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

  const [playerId, balance] = roundedEntries[correctionIndex];
  roundedEntries[correctionIndex] = [playerId, roundToTwo(balance + residual)];
  return Object.fromEntries(roundedEntries);
}

function hasNonZeroBalance(balances: BalanceMap): boolean {
  return Object.values(balances).some((balance) => Math.abs(balance) > 0.005);
}

function positiveTotal(balances: BalanceMap): number {
  return roundToTwo(Object.values(balances).filter((balance) => balance > 0).reduce((sum, balance) => sum + balance, 0));
}

function displayName(player: Player): string {
  return player.name.trim() || player.id;
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

function relativeScoreText(strokes: number, par: number): string {
  const relative = strokes - par;
  if (relative === 0) {
    return '파';
  }
  return relative > 0 ? `+${relative}` : `${relative}`;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}

function dedupe(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
