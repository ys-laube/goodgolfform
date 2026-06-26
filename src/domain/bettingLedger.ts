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

export const defaultOjangUnitAmount = 5_000;

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
  const pointBalances = createMutableBalances(normalizedRound.players);
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
        detail: `${hole.holeNumber}번 홀 4명 동타로 현재 홀 정산 없이 다음 완료 홀에 자동 배판을 넘깁니다.`,
        money: 0,
        balanceDeltas: createMutableBalances(normalizedRound.players),
      }));
      carryDoublePlate = true;
      continue;
    }

    const triggerReasons = doublePlateTriggerReasons(hole, scores);
    if (carryDoublePlate) {
      triggerReasons.unshift('이전 4명 동타 자동 배판');
    }
    const holeMultiplier = triggerReasons.length > 0 ? 2 : 1;

    if (triggerReasons.length > 0) {
      rows.push(createBreakdownRow({
        game: 'ojang',
        id: `hole-${hole.holeNumber}-double-plate`,
        holeNumber: hole.holeNumber,
        label: '배판 적용',
        detail: `${hole.holeNumber}번 홀 ${triggerReasons.join(', ')} 조건으로 타수차 정산을 ${holeMultiplier}배 적용합니다.`,
        money: 0,
        balanceDeltas: createMutableBalances(normalizedRound.players),
      }));
    }

    const pairwiseDeltas = calculatePairwiseScoreDeltas(normalizedRound.players, scores, normalizedRound.settings.unitAmount, holeMultiplier);
    if (hasNonZeroBalance(pairwiseDeltas)) {
      mergeBalances(pointBalances, pairwiseDeltas);
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
      mergeBalances(pointBalances, bonusRow.balanceDeltas);
      rows.push(bonusRow);
    }

    const nearRow = parThreeNearRow(normalizedRound, hole, scores);
    if (nearRow) {
      mergeBalances(pointBalances, nearRow.balanceDeltas);
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
    mergeBalances(pointBalances, handicapDelta);
    rows.push(createBreakdownRow({
      game: 'ojang',
      id: 'final-handicap-delta',
      label: '핸디 보정',
      detail: '총타 기준 원정산과 (총타-핸디) 기준 정산의 차액만 마지막에 반영합니다.',
      money: positiveTotal(handicapDelta),
      balanceDeltas: handicapDelta,
    }));
  }

  const roundedBalances = roundBalances(pointBalances);
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
    name: player.name.trim(),
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

    if (amount > 0.005) {
      transfers.push({ payerId: payer.playerId, payeeId: payee.playerId, amount, unit: 'money' });
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

function completedHoles(round: BettingRound): readonly HoleResult[] {
  return round.holes.filter((hole) => isCompletedHole(hole, round.players));
}

function isCompletedHole(hole: HoleResult, players: readonly Player[]): boolean {
  return players.every((player) => (scoreForPlayer(hole, player.id)?.strokes ?? 0) > 0);
}

function scoreEntriesForHole(round: BettingRound, hole: HoleResult): readonly { readonly player: Player; readonly score: HoleScore }[] {
  return round.players.map((player) => ({
    player,
    score: scoreForPlayer(hole, player.id) ?? { playerId: player.id, strokes: 0, entryMode: 'manual' },
  }));
}

function scoreForPlayer(hole: HoleResult, playerId: PlayerId): HoleScore | undefined {
  return hole.scores.find((score) => score.playerId === playerId);
}

function doublePlateTriggerReasons(
  hole: HoleResult,
  entries: readonly { readonly player: Player; readonly score: HoleScore }[],
): string[] {
  const reasons: string[] = [];
  const relativeScores = entries.map((entry) => entry.score.strokes - hole.par);
  const scoreCounts = new Map<number, number>();
  for (const entry of entries) {
    scoreCounts.set(entry.score.strokes, (scoreCounts.get(entry.score.strokes) ?? 0) + 1);
  }

  if (relativeScores.some((relativeScore) => relativeScore <= -1)) {
    reasons.push('버디 이상');
  }

  if (relativeScores.some((relativeScore) => relativeScore >= 3)) {
    reasons.push('트리플 보기 이상');
  }

  if (hole.par === 3 && relativeScores.some((relativeScore) => relativeScore >= 2)) {
    reasons.push('파3 더블 보기 이상');
  }

  if ([...scoreCounts.values()].some((count) => count === 3)) {
    reasons.push('3명 동타');
  }

  return reasons;
}

function calculatePairwiseScoreDeltas(
  players: readonly Player[],
  entries: readonly { readonly player: Player; readonly score: HoleScore }[],
  unitAmount: number,
  multiplier: number,
): BalanceMap {
  const deltas = createMutableBalances(players);

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];

      if (left.score.strokes === right.score.strokes) {
        continue;
      }

      const winner = left.score.strokes < right.score.strokes ? left.player : right.player;
      const loser = left.score.strokes < right.score.strokes ? right.player : left.player;
      const strokeDelta = Math.abs(left.score.strokes - right.score.strokes);
      const amount = roundToTwo(strokeDelta * unitAmount * multiplier);
      deltas[winner.id] = roundToTwo(deltas[winner.id] + amount);
      deltas[loser.id] = roundToTwo(deltas[loser.id] - amount);
    }
  }

  return roundBalances(deltas);
}

function underParBonusRows(
  round: BettingRound,
  hole: HoleResult,
  entries: readonly { readonly player: Player; readonly score: HoleScore }[],
): readonly LedgerBreakdownRow[] {
  return entries.flatMap((entry) => {
    const bonus = underParBonus(hole.par, entry.score.strokes);
    if (!bonus) {
      return [];
    }

    const amount = bonus.units * round.settings.unitAmount;
    const deltas = distributeAgainstField(round.players, entry.player.id, amount);
    return [createBreakdownRow({
      game: 'ojang',
      id: `hole-${hole.holeNumber}-${bonus.id}-${entry.player.id}`,
      holeNumber: hole.holeNumber,
      playerId: entry.player.id,
      label: bonus.label,
      detail: `${hole.holeNumber}번 홀 ${displayName(entry.player)} ${bonus.label} ${formatMoney(amount)} 보너스`,
      money: amount,
      balanceDeltas: deltas,
    })];
  });
}

function underParBonus(par: number, strokes: number): { readonly id: string; readonly label: string; readonly units: number } | null {
  if (strokes === 1) {
    return { id: 'hio-bonus', label: '홀인원값', units: 3 };
  }

  const relativeScore = strokes - par;
  if (relativeScore <= -2) {
    return { id: 'eagle-bonus', label: '이글값', units: 2 };
  }

  if (relativeScore === -1) {
    return { id: 'birdie-bonus', label: '버디값', units: 1 };
  }

  return null;
}

function parThreeNearRow(
  round: BettingRound,
  hole: HoleResult,
  entries: readonly { readonly player: Player; readonly score: HoleScore }[],
): LedgerBreakdownRow | null {
  if (hole.par !== 3 || !hole.nearPlayerId) {
    return null;
  }

  const entry = entries.find((candidate) => candidate.player.id === hole.nearPlayerId);
  if (!entry) {
    return null;
  }

  const success = entry.score.strokes <= hole.par;
  const amount = round.settings.unitAmount;
  const deltas = distributeAgainstField(round.players, entry.player.id, success ? amount : -amount);
  const nipper = success && entry.score.strokes < hole.par;

  return createBreakdownRow({
    game: 'ojang',
    id: `hole-${hole.holeNumber}-near-${entry.player.id}`,
    holeNumber: hole.holeNumber,
    playerId: entry.player.id,
    label: success ? (nipper ? '니뻐 · 니어 성공' : '니어 성공') : '니어 실패',
    detail: success
      ? `${hole.holeNumber}번 파3 ${displayName(entry.player)} 니어가 파 이하로 성공해 ${formatMoney(amount)} 반영${nipper ? ' (니어+버디)' : ''}`
      : `${hole.holeNumber}번 파3 ${displayName(entry.player)} 니어가 파 실패로 ${formatMoney(amount)} 페널티`,
    money: amount,
    balanceDeltas: deltas,
  });
}

function rawStrokeTotals(round: BettingRound, holes: readonly HoleResult[]): BalanceMap {
  const totals = createMutableBalances(round.players);
  for (const hole of holes) {
    for (const player of round.players) {
      totals[player.id] = roundToTwo(totals[player.id] + (scoreForPlayer(hole, player.id)?.strokes ?? 0));
    }
  }
  return totals;
}

function finalHandicapDelta(
  players: readonly Player[],
  rawTotals: BalanceMap,
  adjustedTotals: BalanceMap,
  unitAmount: number,
): BalanceMap {
  const rawPairwise = calculatePairwiseTotalDeltas(players, rawTotals, unitAmount);
  const adjustedPairwise = calculatePairwiseTotalDeltas(players, adjustedTotals, unitAmount);

  return roundBalances(Object.fromEntries(players.map((player) => [
    player.id,
    roundToTwo((adjustedPairwise[player.id] ?? 0) - (rawPairwise[player.id] ?? 0)),
  ])));
}

function calculatePairwiseTotalDeltas(players: readonly Player[], totals: BalanceMap, unitAmount: number): BalanceMap {
  const deltas = createMutableBalances(players);

  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      const leftTotal = totals[left.id] ?? 0;
      const rightTotal = totals[right.id] ?? 0;

      if (leftTotal === rightTotal) {
        continue;
      }

      const winner = leftTotal < rightTotal ? left : right;
      const loser = leftTotal < rightTotal ? right : left;
      const amount = roundToTwo(Math.abs(leftTotal - rightTotal) * unitAmount);
      deltas[winner.id] = roundToTwo(deltas[winner.id] + amount);
      deltas[loser.id] = roundToTwo(deltas[loser.id] - amount);
    }
  }

  return roundBalances(deltas);
}

function distributeAgainstField(players: readonly Player[], playerId: PlayerId, amount: number): BalanceMap {
  const deltas = createMutableBalances(players);
  const others = players.filter((player) => player.id !== playerId);
  deltas[playerId] = amount;

  if (others.length === 0) {
    return deltas;
  }

  const counterDelta = -amount / others.length;
  for (const other of others) {
    deltas[other.id] = counterDelta;
  }

  return roundBalances(deltas);
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
  const strokes = Math.max(0, Math.round(normalizeNumber(score.strokes, 0)));
  const onGreenShots = normalizeOptionalInteger(score.onGreenShots, 1, 6);
  const putts = normalizeOptionalInteger(score.putts, 0, 5);
  const holeInOne = score.holeInOne === true || score.entryMode === 'hio';
  const entryMode: ScoreEntryMode = holeInOne ? 'hio' : score.entryMode === 'on-putt' ? 'on-putt' : 'manual';

  if (entryMode === 'hio') {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
  }

  if (entryMode === 'on-putt' && onGreenShots !== undefined && putts !== undefined && onGreenShots + putts === strokes) {
    return { playerId, strokes, entryMode, onGreenShots, putts, holeInOne: false };
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

function normalizeNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
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

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
