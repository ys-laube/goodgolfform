export type PlayerId = string;

export type Player = {
  readonly id: PlayerId;
  readonly name: string;
  readonly handicap: number;
};

export type OjangRoundSettings = {
  readonly holeCount: number;
  readonly unitAmount: number;
};

export type ScoreEntryMode = 'on-putt' | 'hio' | 'manual';

export type HoleScore = {
  readonly playerId: PlayerId;
  readonly strokes: number;
  readonly entryMode?: ScoreEntryMode;
  readonly onGreenShots?: number;
  readonly putts?: number;
  readonly holeInOne?: boolean;
};

export type HoleResult = {
  readonly holeNumber: number;
  readonly par: number;
  readonly backdoorOpen: boolean;
  readonly nearPlayerId?: PlayerId | null;
  readonly scores: readonly HoleScore[];
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
  'normalize Ojang round input',
  'calculate completed-hole pairwise Ojang settlement',
  'apply double-plate triggers and four-way-tie carry',
  'apply under-par and par-3 near zero-sum rows',
  'apply final-total handicap adjustment delta',
  'net balances into minimal transfers',
  'emit inspectable Korean calculation breakdown rows',
] as const;

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
  readonly unitAmount?: number;
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
      unitAmount: positiveInteger(options.unitAmount, defaultOjangUnitAmount),
    },
    holes: [],
  });
}

export function calculateRoundLedger(round: BettingRound): RoundLedger {
  const normalizedRound = normalizeBettingRound(round);
  const moneyBalances = createMutableBalances(normalizedRound.players);
  const rows: LedgerBreakdownRow[] = [];
  const completed = completedHoles(normalizedRound);
  let carryDoublePlate = false;

  for (const hole of completed) {
    const scores = scoreEntriesForHole(normalizedRound, hole);
    const fourWayTie = scores.length === 4 && new Set(scores.map((entry) => entry.score.strokes)).size === 1;

    if (fourWayTie) {
      rows.push(createBreakdownRow({
        game: 'ojang',
        id: `hole-${hole.holeNumber}-four-way-carry`,
        holeNumber: hole.holeNumber,
        label: '4명 동타 · 다음 홀 배판',
        detail: `${hole.holeNumber}번 홀 4명 동타로 현재 홀 타수차 정산은 0원, 다음 완료 홀에 배판을 넘깁니다.`,
        money: 0,
        balanceDeltas: createMutableBalances(normalizedRound.players),
      }));
      carryDoublePlate = true;
      continue;
    }

    const triggerReasons = doublePlateTriggerReasons(hole, scores);
    if (carryDoublePlate) {
      triggerReasons.unshift('이전 4명 동타 이월');
    }
    const holeMultiplier = triggerReasons.length > 0 ? 2 : 1;

    if (triggerReasons.length > 0) {
      rows.push(createBreakdownRow({
        game: 'ojang',
        id: `hole-${hole.holeNumber}-double-plate`,
        holeNumber: hole.holeNumber,
        label: '배판 적용',
        detail: `${hole.holeNumber}번 홀 ${dedupe(triggerReasons).join(', ')} 조건으로 타수차 정산을 ${holeMultiplier}배 적용합니다.`,
        money: 0,
        balanceDeltas: createMutableBalances(normalizedRound.players),
      }));
    }

    const pairwiseDeltas = calculatePairwiseScoreDeltas(normalizedRound.players, scores, normalizedRound.settings.unitAmount, holeMultiplier);
    if (hasNonZeroBalance(pairwiseDeltas)) {
      mergeBalances(moneyBalances, pairwiseDeltas);
      rows.push(createBreakdownRow({
        game: 'ojang',
        id: `hole-${hole.holeNumber}-pairwise`,
        holeNumber: hole.holeNumber,
        label: '오장 타수차',
        detail: `${hole.holeNumber}번 홀 타수차 × ${formatMoney(normalizedRound.settings.unitAmount)} × ${holeMultiplier}배 전원 1:1 정산`,
        money: positiveTotal(pairwiseDeltas),
        balanceDeltas: pairwiseDeltas,
      }));
    }

    for (const bonusRow of underParBonusRows(normalizedRound, hole, scores)) {
      mergeBalances(moneyBalances, bonusRow.balanceDeltas);
      rows.push(bonusRow);
    }

    const nearRow = parThreeNearRow(normalizedRound, hole, scores);
    if (nearRow) {
      mergeBalances(moneyBalances, nearRow.balanceDeltas);
      rows.push(nearRow);
    }

    carryDoublePlate = false;
  }

  const rawTotals = rawStrokeTotals(normalizedRound, completed);
  const adjustedTotals = Object.fromEntries(normalizedRound.players.map((player) => [
    player.id,
    roundToTwo((rawTotals[player.id] ?? 0) - normalizeNumber(player.handicap)),
  ])) as BalanceMap;
  const handicapDelta = finalHandicapDelta(normalizedRound.players, rawTotals, adjustedTotals, normalizedRound.settings.unitAmount);
  if (hasNonZeroBalance(handicapDelta)) {
    mergeBalances(moneyBalances, handicapDelta);
    rows.push(createBreakdownRow({
      game: 'ojang',
      id: 'final-handicap-delta',
      label: '핸디 보정',
      detail: '홀별 핸디 배분 없이 총타 기준 원정산과 (총타-핸디) 기준 정산의 차액만 마지막에 반영합니다.',
      money: positiveTotal(handicapDelta),
      balanceDeltas: handicapDelta,
    }));
  }

  const roundedBalances = roundBalances(moneyBalances);
  const playerBalances = Object.fromEntries(normalizedRound.players.map((player) => [
    player.id,
    { money: roundedBalances[player.id] ?? 0 },
  ]));
  const netTransfers = calculateNetTransfers(roundedBalances);
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
    settings: {
      holeCount,
      unitAmount: positiveInteger(round.settings.unitAmount, defaultOjangUnitAmount),
    },
    holes,
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

    if (amount > 0) {
      transfers.push({ payerId: payer.playerId, payeeId: payee.playerId, amount, unit: 'money' });
      payer.remaining = roundToTwo(payer.remaining - amount);
      payee.remaining = roundToTwo(payee.remaining - amount);
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

function scoreCounts(scores: readonly ScoreEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const entry of scores) {
    counts.set(entry.score.strokes, (counts.get(entry.score.strokes) ?? 0) + 1);
  }
  return counts;
}

function underParBonusRows(round: BettingRound, hole: HoleResult, scores: readonly ScoreEntry[]): readonly LedgerBreakdownRow[] {
  return scores.flatMap((entry) => {
    const bonusUnits = underParBonusUnits(hole, entry.score);
    if (bonusUnits === 0) {
      return [];
    }

    const deltas = createMutableBalances(round.players);
    for (const player of round.players) {
      if (player.id === entry.player.id) {
        continue;
      }
      deltas[entry.player.id] = roundToTwo((deltas[entry.player.id] ?? 0) + bonusUnits * round.settings.unitAmount);
      deltas[player.id] = roundToTwo((deltas[player.id] ?? 0) - bonusUnits * round.settings.unitAmount);
    }

    const label = entry.score.holeInOne || entry.score.entryMode === 'hio'
      ? '홀인원 값'
      : bonusUnits >= 2
        ? '이글 값'
        : '버디 값';

    return [createBreakdownRow({
      game: 'ojang',
      id: `hole-${hole.holeNumber}-bonus-${entry.player.id}`,
      holeNumber: hole.holeNumber,
      playerId: entry.player.id,
      label,
      detail: `${hole.holeNumber}번 홀 ${displayName(entry.player)} ${entry.score.strokes}타(${relativeScoreText(entry.score.strokes, hole.par)}) · ${bonusUnits}타값을 나머지 플레이어와 정산합니다.`,
      money: positiveTotal(deltas),
      balanceDeltas: deltas,
    })];
  });
}

function underParBonusUnits(hole: HoleResult, score: HoleScore): number {
  if (score.holeInOne || score.entryMode === 'hio') {
    return 3;
  }

  const relativeScore = score.strokes - hole.par;
  if (relativeScore <= -2) {
    return 2;
  }
  if (relativeScore === -1) {
    return 1;
  }

  return 0;
}

function parThreeNearRow(round: BettingRound, hole: HoleResult, scores: readonly ScoreEntry[]): LedgerBreakdownRow | null {
  if (hole.par !== 3 || !hole.nearPlayerId) {
    return null;
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
    detail: `${transfer.payerId} → ${transfer.payeeId} ${formatMoney(transfer.amount)}`,
    money: transfer.amount,
    balanceDeltas: {},
  });
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
    backdoorOpen: hole.backdoorOpen === true,
    nearPlayerId,
    scores: playerIds.flatMap((playerId) => {
      const score = hole.scores.find((candidate) => candidate.playerId === playerId);
      return score ? [normalizeScore(score, playerId)] : [];
    }),
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
