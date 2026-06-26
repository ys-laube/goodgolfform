import { describe, expect, it } from 'vitest';

import {
  calculateNetTransfers,
  calculateRoundLedger,
  createDefaultRound,
  defaultOjangUnitAmount,
  type BalanceMap,
  type BettingRound,
  type Player,
} from './bettingLedger';

const players: readonly Player[] = [
  { id: 'a', name: '민준', handicap: 0 },
  { id: 'b', name: '서준', handicap: 0 },
  { id: 'c', name: '지아', handicap: 0 },
  { id: 'd', name: '하준', handicap: 0 },
];

function fixtureRound(overrides: Partial<BettingRound> = {}): BettingRound {
  return {
    id: 'round-fixture',
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
    players,
    settings: { holeCount: 18, unitAmount: defaultOjangUnitAmount },
    holes: [],
    ...overrides,
  };
}

function hole(
  holeNumber: number,
  par: number,
  strokes: Readonly<Record<string, number>>,
  extras: Partial<BettingRound['holes'][number]> = {},
): BettingRound['holes'][number] {
  return {
    holeNumber,
    par,
    backdoorOpen: false,
    scores: Object.entries(strokes).map(([playerId, score]) => ({ playerId, strokes: score, entryMode: 'manual' as const })),
    ...extras,
  };
}

function balanceSum(balances: BalanceMap): number {
  return Object.values(balances).reduce((sum, balance) => sum + balance, 0);
}

describe('traditional Ojang ledger setup', () => {
  it('creates valid blank local Ojang rounds for 2, 3, and 4 players', () => {
    expect(createDefaultRound({ playerCount: 2 }).players).toHaveLength(2);
    expect(createDefaultRound({ playerCount: 3 }).players).toHaveLength(3);
    expect(createDefaultRound({ playerCount: 4 }).players).toHaveLength(4);
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.name)).toEqual(['', '', '', '']);
    expect(createDefaultRound({ playerCount: 4 }).players.map((player) => player.handicap)).toEqual([0, 0, 0, 0]);
    expect(createDefaultRound({ playerCount: 4 }).settings).toMatchObject({ holeCount: 18, unitAmount: 5000 });
  });

  it('rejects rounds outside the 2–4 player field scope', () => {
    expect(() => createDefaultRound({ playerCount: 1 })).toThrow(/2–4/);
    expect(() => createDefaultRound({ playerCount: 5 })).toThrow(/2–4/);
    expect(() => calculateRoundLedger(fixtureRound({ players: players.slice(0, 1) }))).toThrow(/2–4/);
  });
});

describe('traditional Ojang settlement formulas', () => {
  it('settles every completed hole as all-vs-all pairwise stroke differences', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      settings: { holeCount: 18, unitAmount: 5000 },
      holes: [hole(1, 4, { a: 4, b: 5, c: 5, d: 6 })],
    }));

    expect(ledger.completedHoleNumbers).toEqual([1]);
    expect(ledger.playerBalances).toMatchObject({
      a: { money: 20000 },
      b: { money: 0 },
      c: { money: 0 },
      d: { money: -20000 },
    });
    expect(balanceSum(Object.fromEntries(Object.entries(ledger.playerBalances).map(([id, value]) => [id, value.money])))).toBeCloseTo(0, 2);
    expect(ledger.breakdownRows.some((row) => row.label === '오장 타수차' && row.detail.includes('전원 1:1'))).toBe(true);
    expect(ledger.netTransfers).toEqual([
      { payerId: 'd', payeeId: 'a', amount: 20000, unit: 'money' },
    ]);
  });

  it('applies 배판 for birdie-or-better and carries a 4-player tie to the next completed hole', () => {
    const birdieLedger = calculateRoundLedger(fixtureRound({
      holes: [hole(1, 4, { a: 3, b: 4, c: 4, d: 4 })],
    }));

    expect(birdieLedger.playerBalances).toMatchObject({
      a: { money: 35000 },
      b: { money: -11666.67 },
      c: { money: -11666.67 },
      d: { money: -11666.66 },
    });
    expect(birdieLedger.breakdownRows.some((row) => row.label.includes('배판') && row.detail.includes('버디 이상'))).toBe(true);
    expect(birdieLedger.breakdownRows.some((row) => row.label.includes('버디 값'))).toBe(true);

    const carryLedger = calculateRoundLedger(fixtureRound({
      holes: [
        hole(1, 4, { a: 4, b: 4, c: 4, d: 4 }),
        hole(2, 4, { a: 4, b: 5, c: 5, d: 5 }),
      ],
    }));

    expect(carryLedger.playerBalances).toMatchObject({
      a: { money: 30000 },
      b: { money: -10000 },
      c: { money: -10000 },
      d: { money: -10000 },
    });
    expect(carryLedger.breakdownRows[0]?.label).toContain('4명 동타');
    expect(carryLedger.breakdownRows.some((row) => row.label.includes('배판') && row.detail.includes('이월'))).toBe(true);
  });

  it('keeps par-3 니어 and 니뻐 inside the single Ojang ruleset', () => {
    const nearSuccess = calculateRoundLedger(fixtureRound({
      holes: [hole(1, 3, { a: 3, b: 4, c: 4, d: 4 }, { nearPlayerId: 'a' })],
    }));
    const successRow = nearSuccess.breakdownRows.find((row) => row.label.includes('니어 성공'));

    expect(successRow?.balanceDeltas).toMatchObject({ a: 5000, b: -1666.67, c: -1666.67, d: -1666.66 });
    expect(nearSuccess.playerBalances.a.money).toBe(35000);

    const nearFail = calculateRoundLedger(fixtureRound({
      holes: [hole(1, 3, { a: 3, b: 4, c: 4, d: 4 }, { nearPlayerId: 'b' })],
    }));
    const failRow = nearFail.breakdownRows.find((row) => row.label.includes('니뻐'));

    expect(failRow?.balanceDeltas).toMatchObject({ a: 1666.67, b: -5000, c: 1666.67, d: 1666.66 });
    expect(nearFail.breakdownRows.some((row) => row.detail.includes('니뻐'))).toBe(true);
  });

  it('preserves canonical strokes when score metadata is inconsistent', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      players: players.slice(0, 2),
      settings: { holeCount: 1, unitAmount: 1000 },
      holes: [{
        holeNumber: 1,
        par: 4,
        backdoorOpen: false,
        scores: [
          { playerId: 'a', strokes: 5, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true },
          { playerId: 'b', strokes: 4, entryMode: 'on-putt', onGreenShots: 1, putts: 2 },
        ],
      }],
    }));

    expect(ledger.normalizedRound.holes[0]?.scores).toEqual([
      { playerId: 'a', strokes: 5, entryMode: 'manual' },
      { playerId: 'b', strokes: 4, entryMode: 'manual' },
    ]);
    expect(ledger.playerBalances).toMatchObject({ a: { money: -1000 }, b: { money: 1000 } });
    expect(ledger.breakdownRows.some((row) => row.label === '홀인원 값')).toBe(false);
  });

  it('applies final-total handicap only as the final delta row without mutating raw strokes', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      players: [
        { id: 'a', name: '민준', handicap: 0 },
        { id: 'b', name: '서준', handicap: 1 },
      ],
      settings: { holeCount: 1, unitAmount: 1000 },
      holes: [hole(1, 4, { a: 4, b: 5 })],
    }));

    expect(ledger.rawTotals).toMatchObject({ a: 4, b: 5 });
    expect(ledger.adjustedTotals).toMatchObject({ a: 4, b: 4 });
    expect(ledger.breakdownRows.some((row) => row.id === 'final-handicap-delta' && row.detail.includes('홀별 핸디 배분 없이'))).toBe(true);
    expect(ledger.playerBalances).toMatchObject({ a: { money: 0 }, b: { money: 0 } });
    expect(ledger.normalizedRound.holes[0]?.scores.find((score) => score.playerId === 'b')?.strokes).toBe(5);
  });
});

describe('Ojang ledger composition', () => {
  it('keeps calculation order explicit and nets money transfers deterministically', () => {
    const ledger = calculateRoundLedger(fixtureRound({ holes: [hole(1, 4, { a: 4, b: 5, c: 6, d: 4 })] }));

    expect(ledger.calculationOrder).toEqual([
      'normalize Ojang round input',
      'calculate completed-hole pairwise Ojang settlement',
      'apply double-plate triggers and four-way-tie carry',
      'apply under-par and par-3 near zero-sum rows',
      'apply final-total handicap adjustment delta',
      'net balances into minimal transfers',
      'emit inspectable Korean calculation breakdown rows',
    ]);
    expect(ledger.breakdownRows.every((row) => row.game === 'ojang' || row.game === 'settlement')).toBe(true);
  });

  it('keeps standalone net-transfer calculation deterministic', () => {
    expect(calculateNetTransfers({ a: 3000, b: -1000, c: -5000, d: 3000 })).toEqual([
      { payerId: 'c', payeeId: 'a', amount: 3000, unit: 'money' },
      { payerId: 'c', payeeId: 'd', amount: 2000, unit: 'money' },
      { payerId: 'b', payeeId: 'd', amount: 1000, unit: 'money' },
    ]);
  });
});
