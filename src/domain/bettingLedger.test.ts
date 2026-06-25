import { describe, expect, it } from 'vitest';
import {
  KOREAN_MISSION_DECK,
  applyHandicap,
  calculateNetTransfers,
  calculateRoundLedger,
  createDefaultRound,
  drawMissionCard,
  isVegasAvailable,
  type BettingRound,
  type BettingGameId,
  type BalanceMap,
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
    enabledGames: { stroke: true, skins: true, vegas: true, events: true, missions: true },
    gameUnits: {
      stroke: { pointValue: 1, moneyPerPoint: 1000 },
      skins: { pointValue: 1, moneyPerPoint: 1000 },
      vegas: { pointValue: 1, moneyPerPoint: 1000 },
      events: { pointValue: 1, moneyPerPoint: 1000 },
      missions: { pointValue: 1, moneyPerPoint: 1000 },
    },
    holes: [],
    ...overrides,
  };
}

function balanceSum(balances: BalanceMap): number {
  return Object.values(balances).reduce((sum, balance) => sum + balance, 0);
}

describe('golf betting ledger domain setup', () => {
  it('creates valid local betting rounds for 2, 3, and 4 players', () => {
    expect(createDefaultRound({ playerCount: 2 }).players).toHaveLength(2);
    expect(createDefaultRound({ playerCount: 3 }).players).toHaveLength(3);
    expect(createDefaultRound({ playerCount: 4 }).players).toHaveLength(4);
    expect(createDefaultRound({ playerCount: 4 }).enabledGames).toMatchObject({
      stroke: true,
      skins: true,
      vegas: true,
      events: true,
      missions: true,
    });
  });

  it('rejects rounds outside the 2–4 player field scope', () => {
    expect(() => createDefaultRound({ playerCount: 1 })).toThrow(/2–4/);
    expect(() => createDefaultRound({ playerCount: 5 })).toThrow(/2–4/);
    expect(() => calculateRoundLedger(fixtureRound({ players: players.slice(0, 1) }))).toThrow(/2–4/);
  });
});

describe('handicap calculation views', () => {
  it('uses final-total handicap by default without mutating raw strokes', () => {
    const round = fixtureRound({
      holes: [
        { holeNumber: 1, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, strokes: { a: 5, b: 6, c: 5, d: 5 } },
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
        { holeNumber: 1, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, strokes: { a: 5, b: 6, c: 5, d: 5 } },
      ],
    });

    const handicap = applyHandicap(round);

    expect(handicap.allocatedStrokes[1]).toMatchObject({ a: 0, b: 1, c: 1, d: 0 });
    expect(handicap.allocatedStrokes[2]).toMatchObject({ a: 0, b: 0, c: 1, d: 0 });
    expect(handicap.netHoleScores[1]).toMatchObject({ a: 4, b: 3, c: 4, d: 6 });
    expect(handicap.adjustedTotals).toMatchObject({ a: 14, b: 13, c: 13, d: 16 });
  });
});

describe('per-game settlement formulas', () => {
  it('calculates stroke/per-point settlement from adjusted total score deltas', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      enabledGames: { stroke: true, skins: false, vegas: false, events: false, missions: false },
      holes: [
        { holeNumber: 1, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, strokes: { a: 5, b: 6, c: 5, d: 5 } },
      ],
    }));

    expect(ledger.gameLedgers[0].pointBalances).toMatchObject({ a: 0, b: 4, c: 4, d: -8 });
    expect(ledger.breakdownRows.some((row) => row.detail.includes('보정 합계'))).toBe(true);
  });

  it('handles skins tie carryover, carryover collection, and final unclaimed carryover', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      enabledGames: { stroke: false, skins: true, vegas: false, events: false, missions: false },
      holes: [
        { holeNumber: 1, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        { holeNumber: 2, strokes: { a: 5, b: 4, c: 5, d: 5 } },
        { holeNumber: 3, strokes: { a: 5, b: 6, c: 5, d: 5 } },
      ],
    }));
    const skins = ledger.gameLedgers[0];

    expect(skins.unclaimedPoints).toBe(1);
    expect(skins.pointBalances.b).toBe(2);
    expect(skins.pointBalances.a).toBeCloseTo(-0.67, 2);
    expect(skins.rows.map((row) => row.label)).toEqual([
      '스킨스 캐리오버',
      '스킨스 획득',
      '스킨스 캐리오버',
      '미청구 스킨스 이월',
    ]);
  });

  it('calculates 4-player Vegas team numbers and disables Vegas outside 4 players', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      enabledGames: { stroke: false, skins: false, vegas: true, events: false, missions: false },
      holes: [{ holeNumber: 1, strokes: { a: 4, b: 5, c: 5, d: 6 } }],
    }));
    const vegas = ledger.gameLedgers[0];

    expect(isVegasAvailable(fixtureRound())).toBe(true);
    expect(isVegasAvailable(fixtureRound({ players: players.slice(0, 3) }))).toBe(false);
    expect(vegas.pointBalances).toMatchObject({ a: 5.5, b: 5.5, c: -5.5, d: -5.5 });
    expect(vegas.rows[0].detail).toContain('45 대 56');

    const unavailable = calculateRoundLedger(fixtureRound({
      players: players.slice(0, 3),
      enabledGames: { stroke: false, skins: false, vegas: true, events: false, missions: false },
    })).gameLedgers[0];
    expect(unavailable.unavailableReason).toContain('4명');
    expect(unavailable.pointBalances).toMatchObject({ a: 0, b: 0, c: 0 });
  });

  it('applies events independently from handicap and keeps each event zero-sum', () => {
    const ledger = calculateRoundLedger(fixtureRound({
      enabledGames: { stroke: false, skins: false, vegas: false, events: true, missions: false },
      holes: [
        {
          holeNumber: 1,
          strokes: { a: 7, b: 7, c: 7, d: 7 },
          events: [
            { type: 'near-pin', playerId: 'a' },
            { type: 'ob-penalty', playerId: 'd' },
          ],
        },
      ],
    }));
    const events = ledger.gameLedgers[0];

    expect(balanceSum(events.pointBalances)).toBeCloseTo(0, 2);
    expect(events.pointBalances.a).toBeCloseTo(2.67, 2);
    expect(events.pointBalances.d).toBeCloseTo(-2.66, 2);
    expect(events.rows).toHaveLength(2);
  });

  it('uses a fixed Korean mission deck and deterministic draw/outcome rows', () => {
    const firstCard = drawMissionCard(0);
    const ledger = calculateRoundLedger(fixtureRound({
      enabledGames: { stroke: false, skins: false, vegas: false, events: false, missions: true },
      holes: [{
        holeNumber: 1,
        strokes: { a: 4, b: 4, c: 4, d: 4 },
        missions: [{ cardId: firstCard.id, playerId: 'c', result: 'success' }],
      }],
    }));

    expect(KOREAN_MISSION_DECK.every((card) => card.title.length > 0 && card.description.length > 0)).toBe(true);
    expect(firstCard).toBe(KOREAN_MISSION_DECK[0]);
    expect(ledger.gameLedgers[0].rows[0].label).toContain('미션 카드');
    expect(ledger.gameLedgers[0].pointBalances.c).toBe(firstCard.successPoints);
  });
});

describe('mixed-game ledger composition', () => {
  it('composes stroke, skins, Vegas, events, money conversion, and net transfers without double-counting', () => {
    const round = fixtureRound({
      settings: { holeCount: 3, scoringMode: 'money', handicapMode: 'final-total' },
      enabledGames: { stroke: true, skins: true, vegas: true, events: true, missions: false },
      holes: [
        { holeNumber: 1, strokes: { a: 4, b: 4, c: 5, d: 6 } },
        {
          holeNumber: 2,
          strokes: { a: 5, b: 4, c: 5, d: 5 },
          events: [{ type: 'near-pin', playerId: 'a' }],
        },
        {
          holeNumber: 3,
          strokes: { a: 5, b: 6, c: 5, d: 5 },
          events: [{ type: 'ob-penalty', playerId: 'd' }],
        },
      ],
    });

    const ledger = calculateRoundLedger(round);
    const ledgersByGame = Object.fromEntries(ledger.gameLedgers.map((gameLedger) => [gameLedger.game, gameLedger])) as Record<BettingGameId, (typeof ledger.gameLedgers)[number]>;

    expect(ledger.calculationOrder).toEqual([
      'normalize round input',
      'derive handicap view',
      'calculate enabled game ledgers independently',
      'convert per-game points to money units',
      'aggregate player balances',
      'net balances into minimal transfers',
      'emit inspectable calculation breakdown rows',
    ]);
    expect(ledgersByGame.stroke.pointBalances).toMatchObject({ a: 0, b: 4, c: 4, d: -8 });
    expect(ledgersByGame.skins.unclaimedPoints).toBe(1);
    expect(ledgersByGame.vegas.pointBalances).toMatchObject({ a: 10.5, b: 10.5, c: -10.5, d: -10.5 });
    expect(balanceSum(ledgersByGame.stroke.pointBalances)).toBeCloseTo(0, 2);
    expect(balanceSum(ledgersByGame.skins.pointBalances)).toBeCloseTo(0, 2);
    expect(balanceSum(ledgersByGame.vegas.pointBalances)).toBeCloseTo(0, 2);
    expect(balanceSum(ledgersByGame.events.pointBalances)).toBeCloseTo(0, 2);

    for (const player of players) {
      const sumOfGamePoints = ledger.gameLedgers.reduce((sum, gameLedger) => sum + gameLedger.pointBalances[player.id], 0);
      expect(ledger.playerBalances[player.id].points).toBeCloseTo(sumOfGamePoints, 2);
      expect(ledger.playerBalances[player.id].money).toBeCloseTo(sumOfGamePoints * 1000, 2);
    }

    const transferTotal = ledger.netTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    const positiveMoney = Object.values(ledger.playerBalances)
      .filter((balance) => balance.money > 0)
      .reduce((sum, balance) => sum + balance.money, 0);
    expect(transferTotal).toBeCloseTo(positiveMoney, 2);
    expect(ledger.netTransfers.every((transfer) => transfer.unit === 'money')).toBe(true);
    expect(ledger.normalizedRound.holes[0].strokes).toMatchObject({ a: 4, b: 4, c: 5, d: 6 });
    expect(['stroke', 'skins', 'vegas', 'events'].every((game) => ledger.breakdownRows.some((row) => row.game === game))).toBe(true);
  });

  it('settles point-only balances without monetary transfer units', () => {
    const transfers = calculateNetTransfers({ a: 4, b: -1, c: -3 }, { unit: 'points' });

    expect(transfers).toEqual([
      { payerId: 'c', payeeId: 'a', amount: 3, unit: 'points' },
      { payerId: 'b', payeeId: 'a', amount: 1, unit: 'points' },
    ]);
  });
});
