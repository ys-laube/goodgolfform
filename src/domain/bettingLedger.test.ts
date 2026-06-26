import { describe, expect, it } from 'vitest';
import {
  applyHandicap,
  calculateNetTransfers,
  calculateRoundLedger,
  createDefaultRound,
  type BalanceMap,
  type BettingRound,
  type Player,
} from './bettingLedger';

const players: readonly Player[] = [
  { id: 'a', name: '민준', handicap: 0 },
  { id: 'b', name: '서준', handicap: 1 },
  { id: 'c', name: '지아', handicap: 2 },
  { id: 'd', name: '하준', handicap: 0 },
];

function fixtureRound(overrides: Partial<BettingRound> = {}): BettingRound {
  return {
    id: 'round-fixture',
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
    players,
    settings: { holeCount: 3, scoringMode: 'points', handicapMode: 'final-total' },
    enabledGames: { ojang: true },
    gameUnits: {
      ojang: { pointValue: 1, moneyPerPoint: 5000 },
    },
    holes: [],
    ...overrides,
  };
}

function ojangLedger(round: BettingRound): GameLedger {
  const ledger = calculateRoundLedger(round);
  const gameLedger = ledger.gameLedgers.find((candidate) => candidate.game === 'ojang');
  expect(gameLedger).toBeDefined();
  return gameLedger as GameLedger;
}

function balanceSum(balances: BalanceMap): number {
  return Object.values(balances).reduce((sum, balance) => sum + balance, 0);
}

describe('Ojang ledger domain setup', () => {
  it('creates valid local Ojang rounds for 2, 3, and 4 players', () => {
    expect(createDefaultRound({ playerCount: 2 }).players).toHaveLength(2);
    expect(createDefaultRound({ playerCount: 3 }).players).toHaveLength(3);
    expect(createDefaultRound({ playerCount: 4 }).players).toHaveLength(4);
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.name)).not.toEqual(
      expect.arrayContaining(['민준', '서연', '도윤', '지우']),
    );
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.handicap)).toEqual([0, 0, 0, 0]);
    expect(createDefaultRound({ playerCount: 4 }).enabledGames).toEqual({ ojang: true });
    expect(createDefaultRound({ playerCount: 4 }).gameUnits.ojang.moneyPerPoint).toBe(5000);
  });

  it('rejects rounds outside the 2–4 player field scope', () => {
    expect(() => createDefaultRound({ playerCount: 1 })).toThrow(/2–4/);
    expect(() => createDefaultRound({ playerCount: 5 })).toThrow(/2–4/);
    expect(() => calculateRoundLedger(fixtureRound({ players: players.slice(0, 1) }))).toThrow(/2–4/);
  });
});

describe('handicap calculation views', () => {
  it('tracks final-total handicap separately without mutating raw strokes', () => {
    const round = fixtureRound({
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, par: 4, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, par: 4, strokes: { a: 5, b: 6, c: 5, d: 5 } },
      ],
    });

    const handicap = applyHandicap(round);

    expect(handicap.rawTotals).toMatchObject({ a: 14, b: 14, c: 15, d: 16 });
    expect(handicap.adjustedTotals).toMatchObject({ a: 14, b: 13, c: 13, d: 16 });
    expect(round.holes[0].strokes).toMatchObject({ a: 4, b: 4, c: 5, d: 6 });
  });

  it('allocates hole-by-hole handicap strokes deterministically from early holes', () => {
    const round = fixtureRound({
      settings: { holeCount: 3, scoringMode: 'points', handicapMode: 'hole-allocation' },
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, par: 4, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, par: 4, strokes: { a: 5, b: 6, c: 5, d: 5 } },
      ],
    });

    expect(ojangLedger(finalTotalRound).rows).toHaveLength(0);
    expect(calculateRoundLedger(finalTotalRound).handicap.adjustedTotals).toMatchObject({ a: 4, b: 3 });
    expect(ojangLedger(holeAllocationRound).pointBalances).toMatchObject({ a: -1, b: 1 });
    expect(ojangLedger(holeAllocationRound).rows[0]?.detail).toContain('서준 3타 vs 민준 4타');
  });
});

describe('traditional Ojang settlement formulas', () => {
  it('settles every completed hole as pairwise stroke differences', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 6, d: 4 } }],
    }));
    const ojang = ledger.gameLedgers[0];

    expect(ojang.game).toBe('ojang');
    expect(ojang.label).toBe('전통 오장');
    expect(ojang.pointBalances).toMatchObject({ a: 3, b: -1, c: -5, d: 3 });
    expect(balanceSum(ojang.pointBalances)).toBeCloseTo(0, 2);
    expect(ojang.rows).toHaveLength(5);
    expect(ojang.rows[0].detail).toContain('오장');
  });

  it('uses birdie, triple-or-worse, three-way ties, and all-ties to make the following hole a baepan', () => {
    const birdieLedger = calculateRoundLedger(fixtureRound({
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 3, b: 4, c: 4, d: 4 } },
        { holeNumber: 2, par: 4, strokes: { a: 5, b: 4, c: 4, d: 4 } },
      ],
    }));

    expect(birdieLedger.gameLedgers[0].pointBalances).toMatchObject({ a: 0, b: 0, c: 0, d: 0 });
    expect(birdieLedger.breakdownRows.some((row) => row.label.includes('배판') && row.detail.includes('버디 이상'))).toBe(true);

    const threeWayTieLedger = calculateRoundLedger(fixtureRound({
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 4, b: 4, c: 4, d: 5 } },
        { holeNumber: 2, par: 4, strokes: { a: 5, b: 4, c: 5, d: 5 } },
      ],
    }));

    expect(threeWayTieLedger.gameLedgers[0].pointBalances).toMatchObject({ a: -1, b: 7, c: -1, d: -5 });
    expect(threeWayTieLedger.breakdownRows.some((row) => row.label.includes('배판') && row.detail.includes('3명 동타'))).toBe(true);

    const allTieLedger = calculateRoundLedger(fixtureRound({
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 4, b: 4, c: 4, d: 4 } },
        { holeNumber: 2, par: 4, strokes: { a: 4, b: 5, c: 5, d: 5 } },
      ],
    }));

    expect(allTieLedger.gameLedgers[0].pointBalances).toMatchObject({ a: 6, b: -2, c: -2, d: -2 });
    expect(allTieLedger.breakdownRows[0].label).toContain('전원 동타');
    expect(allTieLedger.breakdownRows.some((row) => row.label.includes('배판') && row.detail.includes('전 홀 전원 동타'))).toBe(true);
  });

  it('keeps par-3 near-pin marking inside the single Ojang ruleset', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      holes: [{
        holeNumber: 1,
        par: 3,
        strokes: { a: 3, b: 4, c: 4, d: 4 },
        events: [{ type: 'near-pin', playerId: 'a' }],
      }],
    }));

    expect(ledger.gameLedgers[0].pointBalances).toMatchObject({ a: 6, b: -2, c: -2, d: -2 });
    expect(ledger.breakdownRows.some((row) => row.detail.includes('니어 보너스'))).toBe(true);
  });
});

describe('Ojang ledger composition', () => {
  it('converts the single Ojang ledger to money and nets transfers without double-counting', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      settings: { holeCount: 3, scoringMode: 'money', handicapMode: 'final-total' },
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 6, d: 4 } }],
    }));
    const ojang = ledger.gameLedgers[0];

    expect(ledger.calculationOrder).toEqual([
      'normalize round input',
      'derive handicap view',
      'calculate traditional Ojang hole-by-hole stroke ledger',
      'apply minpan/baepan board multipliers and Ojang bonuses',
      'convert Ojang point units to money units',
      'aggregate player balances',
      'net balances into minimal transfers',
      'emit inspectable calculation breakdown rows',
    ]);
    expect(ojang.pointBalances).toMatchObject({ a: 3, b: -1, c: -5, d: 3 });
    expect(ojang.moneyBalances).toMatchObject({ a: 15000, b: -5000, c: -25000, d: 15000 });
    expect(balanceSum(ojang.pointBalances)).toBeCloseTo(0, 2);

    for (const player of players) {
      expect(ledger.playerBalances[player.id].points).toBeCloseTo(ojang.pointBalances[player.id], 2);
      expect(ledger.playerBalances[player.id].money).toBeCloseTo(ojang.moneyBalances[player.id], 2);
    }

    expect(ledger.netTransfers).toEqual([
      { payerId: 'c', payeeId: 'a', amount: 15000, unit: 'money' },
      { payerId: 'c', payeeId: 'd', amount: 10000, unit: 'money' },
      { payerId: 'b', payeeId: 'd', amount: 5000, unit: 'money' },
    ]);
    expect(ledger.breakdownRows.every((row) => row.game === 'ojang' || row.game === 'settlement')).toBe(true);
  });

  it('keeps standalone net-transfer calculation deterministic', () => {
    expect(calculateNetTransfers({ a: 3, b: -1, c: -5, d: 3 })).toEqual([
      { payerId: 'c', payeeId: 'a', amount: 3, unit: 'points' },
      { payerId: 'c', payeeId: 'd', amount: 2, unit: 'points' },
      { payerId: 'b', payeeId: 'd', amount: 1, unit: 'points' },
    ]);
  });
});
