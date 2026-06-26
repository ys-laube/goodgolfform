import { describe, expect, it } from 'vitest';
import {
  applyHandicap,
  calculateNetTransfers,
  calculateRoundLedger,
  createDefaultRound,
  ledgerCalculationOrder,
  type BalanceMap,
  type BettingRound,
  type GameLedger,
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
    gameUnits: { ojang: { pointValue: 1, moneyPerPoint: 1_000 } },
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

describe('traditional Ojang ledger setup', () => {
  it('creates local Ojang-only rounds for 2, 3, and 4 players', () => {
    expect(createDefaultRound({ playerCount: 2 }).players).toHaveLength(2);
    expect(createDefaultRound({ playerCount: 3 }).players).toHaveLength(3);
    expect(createDefaultRound({ playerCount: 4 }).players).toHaveLength(4);
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.name)).not.toEqual(
      expect.arrayContaining(['민준', '서연', '도윤', '지우']),
    );
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.handicap)).toEqual([0, 0, 0, 0]);
    expect(createDefaultRound({ playerCount: 4 }).enabledGames).toEqual({ ojang: true });
    expect(createDefaultRound({ playerCount: 4 }).gameUnits.ojang.moneyPerPoint).toBe(5_000);
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

  it('uses hole-allocation handicap only when that mode is selected for hole settlement scores', () => {
    const finalTotalRound = fixtureRound({
      players: players.slice(0, 2),
      settings: { holeCount: 1, scoringMode: 'points', handicapMode: 'final-total' },
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 4 } }],
    });
    const holeAllocationRound = fixtureRound({
      players: players.slice(0, 2),
      settings: { holeCount: 1, scoringMode: 'points', handicapMode: 'hole-allocation' },
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 4 } }],
    });

    expect(ojangLedger(finalTotalRound).rows).toHaveLength(0);
    expect(calculateRoundLedger(finalTotalRound).handicap.adjustedTotals).toMatchObject({ a: 4, b: 3 });
    expect(ojangLedger(holeAllocationRound).pointBalances).toMatchObject({ a: -1, b: 1 });
    expect(ojangLedger(holeAllocationRound).rows[0]?.detail).toContain('서준 3타 vs 민준 4타');
  });
});

describe('traditional Ojang pairwise settlement', () => {
  it('settles every unequal pair by stroke delta and keeps balances zero-sum', () => {
    const ledger = ojangLedger(fixtureRound({
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 6, d: 4 } }],
    }));

    expect(ledger.rows).toHaveLength(5);
    expect(ledger.pointBalances).toMatchObject({ a: 3, b: -1, c: -5, d: 3 });
    expect(balanceSum(ledger.pointBalances)).toBeCloseTo(0, 2);
    expect(ledger.rows.every((row) => row.label === '오장 민판')).toBe(true);
    expect(ledger.rows.some((row) => row.detail.includes('타수차 2'))).toBe(true);
  });

  it('applies 배판 for under-par scores and adds a birdie/eagle/HIO-style bonus', () => {
    const ledger = ojangLedger(fixtureRound({
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 3, b: 4, c: 5, d: 6 } }],
    }));

    expect(ledger.pointBalances).toMatchObject({ a: 18, b: 2, c: -6, d: -14 });
    expect(balanceSum(ledger.pointBalances)).toBeCloseTo(0, 2);
    expect(ledger.rows.every((row) => row.label === '오장 배판')).toBe(true);
    expect(ledger.rows[0]?.detail).toContain('버디 보너스 +1');
    expect(ledger.rows[0]?.detail).toContain('버디 이상');
  });

  it('carries an all-tie hole into automatic 배판 on the next completed hole', () => {
    const ledger = ojangLedger(fixtureRound({
      holes: [
        { holeNumber: 1, par: 4, strokes: { a: 4, b: 4, c: 4, d: 4 } },
        { holeNumber: 2, par: 4, strokes: { a: 4, b: 5, c: 5, d: 5 } },
      ],
    }));

    expect(ledger.rows[0]).toMatchObject({ label: '오장 민판 · 전원 동타', points: 0 });
    expect(ledger.pointBalances).toMatchObject({ a: 6, b: -2, c: -2, d: -2 });
    expect(ledger.rows.slice(1).every((row) => row.label === '오장 배판')).toBe(true);
    expect(ledger.rows[1]?.detail).toContain('전 홀 전원 동타');
  });

  it('uses 3-player ties and blow-up scores as 배판 triggers', () => {
    const threeWayTie = ojangLedger(fixtureRound({
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 5, d: 5 } }],
    }));
    const blowup = ojangLedger(fixtureRound({
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 6, d: 7 } }],
    }));

    expect(threeWayTie.rows.every((row) => row.detail.includes('3명 동타'))).toBe(true);
    expect(blowup.rows.every((row) => row.detail.includes('트리플 이상'))).toBe(true);
  });

  it('applies par-3 near success and near-fail penalties only from canonical near-pin metadata', () => {
    const nearSuccess = ojangLedger(fixtureRound({
      players: players.slice(0, 3),
      holes: [{
        holeNumber: 1,
        par: 3,
        strokes: { a: 3, b: 4, c: 5 },
        events: [{ type: 'near-pin', playerId: 'a', points: 2 }],
      }],
    }));
    const nearFail = ojangLedger(fixtureRound({
      players: players.slice(0, 3),
      holes: [{
        holeNumber: 1,
        par: 3,
        strokes: { a: 3, b: 4, c: 5 },
        events: [{ type: 'near-pin', playerId: 'b', points: 2 }],
      }],
    }));
    const nonParThree = ojangLedger(fixtureRound({
      players: players.slice(0, 3),
      holes: [{
        holeNumber: 1,
        par: 4,
        strokes: { a: 4, b: 5, c: 6 },
        events: [{ type: 'near-pin', playerId: 'a', points: 2 }],
      }],
    }));

    expect(nearSuccess.pointBalances).toMatchObject({ a: 7, b: -2, c: -5 });
    expect(nearSuccess.rows.some((row) => row.detail.includes('니어 보너스 +2'))).toBe(true);
    expect(nearFail.pointBalances).toMatchObject({ a: 5, b: -2, c: -3 });
    expect(nearFail.rows.some((row) => row.detail.includes('니어 실패 페널티 +2'))).toBe(true);
    expect(nonParThree.rows.some((row) => row.detail.includes('니어'))).toBe(false);
  });
});

describe('Ojang ledger composition and settlement', () => {
  it('converts Ojang point units to money and nets payer-to-receiver transfers', () => {
    const round = fixtureRound({
      settings: { holeCount: 1, scoringMode: 'money', handicapMode: 'final-total' },
      gameUnits: { ojang: { pointValue: 1, moneyPerPoint: 1_000 } },
      holes: [{ holeNumber: 1, par: 4, strokes: { a: 4, b: 5, c: 6, d: 4 } }],
    });

    const ledger = calculateRoundLedger(round);
    const gameLedger = ojangLedger(round);

    expect(ledger.calculationOrder).toEqual(ledgerCalculationOrder);
    expect(gameLedger.moneyBalances).toMatchObject({ a: 3_000, b: -1_000, c: -5_000, d: 3_000 });
    expect(balanceSum(gameLedger.pointBalances)).toBeCloseTo(0, 2);
    expect(ledger.playerBalances.a).toMatchObject({ points: 3, money: 3_000 });
    expect(ledger.netTransfers.every((transfer) => transfer.unit === 'money')).toBe(true);
    expect(ledger.netTransfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(6_000);
    expect(ledger.breakdownRows.some((row) => row.game === 'ojang')).toBe(true);
    expect(ledger.breakdownRows.some((row) => row.game === 'settlement')).toBe(true);
  });

  it('keeps standalone net-transfer calculation deterministic', () => {
    expect(calculateNetTransfers({ a: 3, b: -1, c: -5, d: 3 })).toEqual([
      { payerId: 'c', payeeId: 'a', amount: 3, unit: 'points' },
      { payerId: 'c', payeeId: 'd', amount: 2, unit: 'points' },
      { payerId: 'b', payeeId: 'd', amount: 1, unit: 'points' },
    ]);
  });
});
