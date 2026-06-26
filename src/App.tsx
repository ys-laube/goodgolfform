import { useMemo, useState, type CSSProperties } from 'react';

import {
  calculateRoundLedger,
  drawMissionCard,
  eventBasePoints,
  type BettingEventType,
  type BettingRound as LedgerBettingRound,
  type PlayerId,
} from './domain/bettingLedger';
import { type BettingRound as StoredBettingRound } from './domain/bettingStorage';
import { useBettingRoundSession, type BettingEventKey, type BettingGameKey } from './useBettingRoundSession';

const gameKeys: readonly BettingGameKey[] = ['stroke', 'skins', 'vegas', 'events', 'missions'];
const eventKeys: readonly BettingEventKey[] = ['near-pin', 'longest-drive', 'birdie', 'ob-penalty'];
const playerTones = ['#4f8cff', '#ff8aab', '#6ee7b7', '#fbbf24'] as const;
const currencyFormatter = new Intl.NumberFormat('ko-KR');

const gameLabels: Record<BettingGameKey, string> = {
  stroke: '스트로크',
  skins: '스킨스',
  vegas: '팀 베가스',
  events: '이벤트',
  missions: '미션 카드',
};

const gameDescriptions: Record<BettingGameKey, string> = {
  stroke: '보정 타수 차이로 1:1 정산',
  skins: '홀 단독 최저타가 스킨 획득',
  vegas: '1·2번 vs 3·4번 팀 숫자 대결',
  events: '니어핀, 롱기스트, 버디, OB',
  missions: '고정 미션 성공/실패 보너스',
};

const eventLabels: Record<BettingEventKey, string> = {
  'near-pin': '니어핀',
  'longest-drive': '롱기스트',
  birdie: '버디',
  'ob-penalty': 'OB/벌타',
};

type GameUnitField = 'points' | 'money';

export function parseEditableIntegerDraft(value: string): number | null {
  const trimmedValue = value.trim();

  if (!/^-?\d+$/.test(trimmedValue)) {
    return null;
  }

  const parsed = Number.parseInt(trimmedValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerDraft(value: string, fallback: number): number {
  return parseEditableIntegerDraft(value) ?? fallback;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function signedAmountLabel(amount: number, mode: 'money' | 'points'): string {
  if (Math.abs(amount) < 0.005) {
    return mode === 'money' ? '₩0' : '0점';
  }

  const sign = amount > 0 ? '+' : '-';
  const absoluteAmount = Math.abs(amount);

  if (mode === 'money') {
    return `${sign}₩${currencyFormatter.format(Math.round(absoluteAmount))}`;
  }

  return `${sign}${roundToTwo(absoluteAmount)}점`;
}

function transferAmountLabel(amount: number, unit: 'money' | 'points'): string {
  return unit === 'money' ? `₩${currencyFormatter.format(Math.round(amount))}` : `${roundToTwo(amount)}점`;
}

function playerTeam(index: number): '청팀' | '백팀' {
  return index < 2 ? '청팀' : '백팀';
}

function playerStyle(index: number): CSSProperties {
  return { '--player-tone': playerTones[index % playerTones.length] } as CSSProperties;
}

function toLedgerRound(round: StoredBettingRound): LedgerBettingRound {
  return {
    id: round.id,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    players: round.players.map((player) => ({
      id: player.id,
      name: player.name,
      handicap: player.handicap,
    })),
    settings: {
      holeCount: round.settings.holeCount,
      scoringMode: round.settings.scoringMode,
      handicapMode: round.settings.handicapMode,
    },
    enabledGames: {
      stroke: round.enabledGames.stroke,
      skins: round.enabledGames.skins,
      vegas: round.enabledGames.vegas,
      events: round.enabledGames.events,
      missions: round.enabledGames.missions,
    },
    gameUnits: {
      stroke: { pointValue: round.gameUnits.stroke.points, moneyPerPoint: round.gameUnits.stroke.money },
      skins: { pointValue: round.gameUnits.skins.points, moneyPerPoint: round.gameUnits.skins.money },
      vegas: { pointValue: round.gameUnits.vegas.points, moneyPerPoint: round.gameUnits.vegas.money },
      events: { pointValue: round.gameUnits.events.points, moneyPerPoint: round.gameUnits.events.money },
      missions: { pointValue: round.gameUnits.missions.points, moneyPerPoint: round.gameUnits.missions.money },
    },
    holes: round.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      strokes: Object.fromEntries(round.players.map((player) => [
        player.id,
        hole.scores.find((score) => score.playerId === player.id)?.strokes ?? 0,
      ])) as Record<PlayerId, number>,
      events: hole.events.map((event) => ({
        type: event.event as BettingEventType,
        playerId: event.playerId,
        points: event.points,
        label: eventLabels[event.event],
      })),
      missions: hole.missions
        .filter((mission) => mission.outcome !== 'pending')
        .map((mission) => ({
          cardId: mission.missionId,
          playerId: mission.playerId,
          result: mission.outcome === 'success' ? 'success' : 'fail',
        })),
    })),
  };
}

function scoreForPlayer(round: StoredBettingRound, holeNumber: number, playerId: string): number | undefined {
  return round.holes
    .find((hole) => hole.holeNumber === holeNumber)
    ?.scores.find((score) => score.playerId === playerId)?.strokes;
}

function eventIsActive(round: StoredBettingRound, holeNumber: number, event: BettingEventKey, playerId: string): boolean {
  return round.holes
    .find((hole) => hole.holeNumber === holeNumber)
    ?.events.some((item) => item.event === event && item.playerId === playerId) ?? false;
}

export function App() {
  const session = useBettingRoundSession();
  const { round } = session;
  const [roundName, setRoundName] = useState('금요 새벽 라운드');
  const [courseName, setCourseName] = useState('남서울 · OUT');
  const [currentHoleDraft, setCurrentHoleDraft] = useState('1');
  const [parDraft, setParDraft] = useState('4');
  const [holeCountDraft, setHoleCountDraft] = useState<string | null>(null);
  const [playerHandicapDrafts, setPlayerHandicapDrafts] = useState<Record<string, string>>({});
  const [gameUnitDrafts, setGameUnitDrafts] = useState<Record<string, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [missionPlayerId, setMissionPlayerId] = useState(round.players[0]?.id ?? '');
  const [missionCleared, setMissionCleared] = useState(true);
  const [shareReady, setShareReady] = useState(false);

  const holeNumber = Math.min(round.settings.holeCount, Math.max(1, parseIntegerDraft(currentHoleDraft, 1)));
  const holePar = Math.max(3, Math.min(5, parseIntegerDraft(parDraft, 4)));
  const missionCard = drawMissionCard(holeNumber);
  const ledger = useMemo(() => calculateRoundLedger(toLedgerRound(round)), [round]);
  const settlementUnit = round.settings.scoringMode;
  const balanceRows = round.players
    .map((player, index) => ({
      player,
      index,
      amount: settlementUnit === 'money'
        ? (ledger.playerBalances[player.id]?.money ?? 0)
        : (ledger.playerBalances[player.id]?.points ?? 0),
    }))
    .sort((left, right) => right.amount - left.amount);
  const completedHoleCount = ledger.handicap.completedHoleNumbers.length;
  const leader = balanceRows[0];
  const shareCopy = `${roundName} ${completedHoleCount || holeNumber}H 정산 · ${balanceRows
    .map((entry) => `${entry.player.name} ${signedAmountLabel(entry.amount, settlementUnit)}`)
    .join(' / ')}`;
  const activeMissionPlayerId = round.players.some((player) => player.id === missionPlayerId)
    ? missionPlayerId
    : (round.players[0]?.id ?? '');

  function scoreInputValue(playerId: string): string {
    const draftKey = `${holeNumber}:${playerId}`;
    return scoreDrafts[draftKey] ?? scoreForPlayer(round, holeNumber, playerId)?.toString() ?? '';
  }

  function gameUnitDraftKey(game: BettingGameKey, field: GameUnitField): string {
    return `${game}:${field}`;
  }

  function gameUnitInputValue(game: BettingGameKey, field: GameUnitField): string {
    return gameUnitDrafts[gameUnitDraftKey(game, field)] ?? round.gameUnits[game][field].toString();
  }

  function playerHandicapInputValue(playerId: string, handicap: number): string {
    return playerHandicapDrafts[playerId] ?? handicap.toString();
  }

  function commitIntegerDraft(value: string, commit: (parsedValue: number) => void) {
    const parsedValue = parseEditableIntegerDraft(value);

    if (parsedValue !== null) {
      commit(parsedValue);
    }
  }

  function updatePlayerHandicap(playerId: string, value: string) {
    setPlayerHandicapDrafts((current) => ({ ...current, [playerId]: value }));
    setShareReady(false);
    commitIntegerDraft(value, (handicap) => session.updatePlayer(playerId, { handicap }));
  }

  function updateGameUnitDraft(game: BettingGameKey, field: GameUnitField, value: string) {
    setGameUnitDrafts((current) => ({ ...current, [gameUnitDraftKey(game, field)]: value }));
    setShareReady(false);
    commitIntegerDraft(value, (unitValue) => {
      session.updateGameUnit(game, field === 'points' ? { points: unitValue } : { money: unitValue });
    });
  }

  function updateHoleCountDraft(value: string) {
    setHoleCountDraft(value);
    setShareReady(false);
    commitIntegerDraft(value, (holeCount) => session.updateRoundSetup({ holeCount }));
  }

  function updateScore(playerId: string, value: string) {
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: value }));
    setShareReady(false);

    if (/^\d{1,2}$/.test(value)) {
      session.updateHoleScore(holeNumber, playerId, parseIntegerDraft(value, holePar + 1));
    }
  }

  function updateMission(playerId: string, cleared: boolean) {
    setMissionPlayerId(playerId);
    setMissionCleared(cleared);
    setShareReady(false);
    session.setHoleMission(holeNumber, {
      id: `hole-${holeNumber}:mission:${missionCard.id}:${playerId}`,
      playerId,
      missionId: missionCard.id,
      title: missionCard.title,
      points: cleared ? missionCard.successPoints : -missionCard.failPenaltyPoints,
      outcome: cleared ? 'success' : 'fail',
    });
  }

  function updateHoleDraft(value: string) {
    setCurrentHoleDraft(value);
    setShareReady(false);
  }

  return (
    <main className="app-shell" aria-labelledby="app-title" data-mobile-layout="safe-area-inset">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">펀골프 정산 장부</p>
          <h1 id="app-title">한국형 골프 내기 정산</h1>
          <p>2~4명 라운드 세팅부터 홀 입력, 이벤트, 미션, 순정산, 공유 카드까지 한 화면에서 처리하는 모바일 우선 장부입니다.</p>
        </div>
        <div className="hero-metric" aria-label="현재 1위">
          <span>{completedHoleCount}개 홀 반영</span>
          <strong>{leader?.player.name ?? '대기'}</strong>
          <em>{signedAmountLabel(leader?.amount ?? 0, settlementUnit)}</em>
        </div>
      </section>

      <section className="control-panel" aria-labelledby="setup-title">
        <div className="section-heading">
          <p className="eyebrow">라운드 세팅</p>
          <h2 id="setup-title">플레이어와 내기 룰</h2>
          <p>{session.storageMessage}</p>
        </div>

        <div className="setup-grid">
          <label>
            라운드 이름
            <input value={roundName} onChange={(event) => setRoundName(event.currentTarget.value)} />
          </label>
          <label>
            코스 / 티
            <input value={courseName} onChange={(event) => setCourseName(event.currentTarget.value)} />
          </label>
          <label>
            정산 방식
            <select value={round.settings.scoringMode} onChange={(event) => session.updateRoundSetup({ scoringMode: event.currentTarget.value as 'money' | 'points' })}>
              <option value="money">원화 정산</option>
              <option value="points">포인트 정산</option>
            </select>
          </label>
          <label>
            핸디 방식
            <select value={round.settings.handicapMode} onChange={(event) => session.updateRoundSetup({ handicapMode: event.currentTarget.value as 'final-total' | 'hole-allocation' })}>
              <option value="final-total">최종 합계 보정</option>
              <option value="hole-allocation">홀별 핸디 배분</option>
            </select>
          </label>
          <label>
            플레이어 수
            <select value={round.players.length} onChange={(event) => session.setPlayerCount(parseIntegerDraft(event.currentTarget.value, round.players.length))}>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
            </select>
          </label>
          <button className="secondary-action" type="button" onClick={() => session.saveRound()}>로컬 저장</button>
          <button className="secondary-action" type="button" onClick={() => session.resetRound()}>새 라운드</button>
        </div>

        <div className="player-strip" aria-label="플레이어와 핸디캡">
          {round.players.map((player, index) => (
            <article className="player-chip editable-chip" key={player.id} style={playerStyle(index)}>
              <span>{playerTeam(index)}</span>
              <label>
                이름
                <input value={player.name} onChange={(event) => session.updatePlayer(player.id, { name: event.currentTarget.value })} />
              </label>
              <label>
                핸디
                <input
                  inputMode="numeric"
                  value={playerHandicapInputValue(player.id, player.handicap)}
                  onChange={(event) => updatePlayerHandicap(player.id, event.currentTarget.value)}
                />
              </label>
            </article>
          ))}
        </div>

        <div className="game-stack" aria-label="내기 게임 구성">
          {gameKeys.map((game) => {
            const availability = session.gameAvailability[game];
            const isEnabled = round.enabledGames[game] && availability.available;

            return (
              <article key={game} className={isEnabled ? 'game-card active' : 'game-card'}>
                <button type="button" disabled={!availability.available} onClick={() => session.setGameEnabled(game, !round.enabledGames[game])}>
                  <span>{availability.available ? (isEnabled ? '켜짐' : '꺼짐') : '사용 불가'}</span>
                  <strong>{gameLabels[game]}</strong>
                </button>
                <p>{availability.reason ?? gameDescriptions[game]}</p>
                <label>
                  점수 단위
                  <input
                    inputMode="numeric"
                    value={gameUnitInputValue(game, 'points')}
                    onChange={(event) => updateGameUnitDraft(game, 'points', event.currentTarget.value)}
                  />
                </label>
                <label>
                  1점 금액
                  <input
                    inputMode="numeric"
                    value={gameUnitInputValue(game, 'money')}
                    onChange={(event) => updateGameUnitDraft(game, 'money', event.currentTarget.value)}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className="control-panel hole-panel" aria-labelledby="hole-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">홀 입력</p>
          <h2 id="hole-title">{holeNumber}번 홀 스코어</h2>
        </div>

        <div className="hole-toolbar">
          <label>
            홀
            <input inputMode="numeric" value={currentHoleDraft} onChange={(event) => updateHoleDraft(event.currentTarget.value)} />
          </label>
          <label>
            파
            <input inputMode="numeric" value={parDraft} onChange={(event) => setParDraft(event.currentTarget.value)} />
          </label>
          <label>
            총 홀 수
            <input
              inputMode="numeric"
              value={holeCountDraft ?? round.settings.holeCount.toString()}
              onChange={(event) => updateHoleCountDraft(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="score-list" aria-label="홀별 타수 입력">
          {round.players.map((player, index) => {
            const rawScore = scoreForPlayer(round, holeNumber, player.id) ?? 0;
            const netScore = ledger.handicap.netHoleScores[holeNumber]?.[player.id] ?? rawScore;

            return (
              <label className="score-row" key={player.id}>
                <span>
                  <strong>{player.name}</strong>
                  <em>{playerTeam(index)} · 네트 {netScore || '-'}</em>
                </span>
                <input
                  inputMode="numeric"
                  value={scoreInputValue(player.id)}
                  placeholder={`${holePar + 1}`}
                  onChange={(event) => updateScore(player.id, event.currentTarget.value)}
                  aria-label={`${player.name} 타수`}
                />
                <b>{signedAmountLabel(ledger.playerBalances[player.id]?.money ?? 0, 'money')}</b>
              </label>
            );
          })}
        </div>
      </section>

      <section className="mission-card" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">미션 카드</p>
          <h2 id="mission-title">{missionCard.title}</h2>
          <p>{missionCard.description}</p>
        </div>
        <div className="mission-controls">
          <label>
            대상자
            <select value={activeMissionPlayerId} onChange={(event) => updateMission(event.currentTarget.value, missionCleared)}>
              {round.players.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
          <button className={missionCleared ? 'toggle-action active' : 'toggle-action'} type="button" onClick={() => updateMission(activeMissionPlayerId, !missionCleared)}>
            {missionCleared ? '성공 반영' : '실패 반영'}
          </button>
        </div>
      </section>

      <section className="mission-card event-card" aria-labelledby="event-title">
        <div>
          <p className="eyebrow">이벤트 보너스</p>
          <h2 id="event-title">한 번 터치로 반영</h2>
          <p>니어핀, 롱기스트, 버디, OB/벌타를 현재 홀에 바로 넣고 정산표에 근거를 남깁니다.</p>
        </div>
        <div className="event-grid">
          {eventKeys.flatMap((event) => round.players.map((player) => (
            <button
              className={eventIsActive(round, holeNumber, event, player.id) ? 'event-pill active' : 'event-pill'}
              key={`${event}-${player.id}`}
              type="button"
              onClick={() => {
                setShareReady(false);
                session.toggleHoleEvent(holeNumber, event, player.id, eventBasePoints[event as BettingEventType]);
              }}
            >
              <span>{eventLabels[event]}</span>
              <strong>{player.name}</strong>
            </button>
          )))}
        </div>
      </section>

      <section className="ledger-grid" aria-label="실시간 정산 대시보드">
        <article className="ledger-card settlement-card">
          <div className="section-heading compact-heading">
            <p className="eyebrow">실시간 장부</p>
            <h2>순정산</h2>
          </div>
          <div className="balance-list">
            {balanceRows.map((entry) => (
              <div className="balance-row" key={entry.player.id}>
                <span>
                  <strong>{entry.player.name}</strong>
                  <em>{playerTeam(entry.index)}</em>
                </span>
                <b className={entry.amount >= 0 ? 'positive' : 'negative'}>{signedAmountLabel(entry.amount, settlementUnit)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="ledger-card transfer-card">
          <div className="section-heading compact-heading">
            <p className="eyebrow">정산표</p>
            <h2>보낼 금액</h2>
          </div>
          <div className="transfer-list">
            {ledger.netTransfers.length === 0 ? <p className="empty-row">아직 정산할 금액이 없습니다.</p> : ledger.netTransfers.map((transfer) => (
              <p key={`${transfer.payerId}-${transfer.payeeId}-${transfer.amount}`}>
                <strong>{round.players.find((player) => player.id === transfer.payerId)?.name ?? transfer.payerId}</strong>
                <span>→</span>
                <strong>{round.players.find((player) => player.id === transfer.payeeId)?.name ?? transfer.payeeId}</strong>
                <b>{transferAmountLabel(transfer.amount, transfer.unit)}</b>
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="calculation-card" aria-labelledby="calculation-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">계산 내역</p>
          <h2 id="calculation-title">공식별 근거</h2>
        </div>
        <div className="calculation-list">
          {ledger.breakdownRows.slice(0, 12).map((line) => (
            <article key={line.id}>
              <span>{line.label}</span>
              <strong>{line.detail}</strong>
              <b className={line.money >= 0 ? 'positive' : 'negative'}>{signedAmountLabel(line.money, 'money')}</b>
            </article>
          ))}
          {ledger.breakdownRows.length === 0 ? <article><span>대기</span><strong>각 플레이어 타수를 입력하면 계산 근거가 여기에 쌓입니다.</strong><b>₩0</b></article> : null}
        </div>
      </section>

      <section className="share-card" aria-labelledby="share-title">
        <div>
          <p className="eyebrow">공유 카드</p>
          <h2 id="share-title">{courseName}</h2>
          <p>{shareCopy}</p>
        </div>
        <div className="qr-chip" aria-label="공유 카드 장식 QR">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="share-actions">
          <button className="primary-action" type="button" onClick={() => setShareReady(true)}>공유 문구 고정</button>
        </div>
        <p className="share-status" aria-live="polite">
          {shareReady ? '스코어카드 이미지나 결과 링크로 공유할 현재 정산 요약이 준비되었습니다.' : '공유 카드는 화면 맨 아래에서 스코어카드 내보내기와 결과 링크 공유만 제공합니다.'}
        </p>
      </section>
    </main>
  );
}
