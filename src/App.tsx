import { useMemo, useState, type CSSProperties } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import {
  calculateRoundLedger,
  drawMissionCard,
  eventBasePoints,
  type BettingEventType,
  type BettingRound as LedgerBettingRound,
  type PlayerId,
} from './domain/bettingLedger';
import {
  bettingShareHashMaxLength,
  createBettingRoundShareHash,
  restoreBettingRoundShareHashToStorage,
  type BettingShareRestoreResult,
} from './domain/bettingShareSnapshot';
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

let shareHashRestoreAttempted = false;
let initialShareHashRestoreResult: BettingShareRestoreResult | null = null;

function shareHashRestoringLocalStorage() {
  const storage = availableLocalStorage();

  if (!shareHashRestoreAttempted) {
    shareHashRestoreAttempted = true;
    const hash = currentLocationHash();
    initialShareHashRestoreResult = hash ? restoreBettingRoundShareHashToStorage(hash, storage) : null;
  }

  return storage;
}

function initialShareHashStatus(): string | null {
  if (!initialShareHashRestoreResult) {
    return null;
  }

  if (initialShareHashRestoreResult.restored) {
    return `결과 링크에서 라운드를 복원했습니다. 해시 ${initialShareHashRestoreResult.payloadLength}자, 이 기기에만 저장됩니다.`;
  }

  if (initialShareHashRestoreResult.reason === 'unsupported' || initialShareHashRestoreResult.reason === 'empty') {
    return null;
  }

  return `결과 링크를 복원하지 못했습니다: ${shareRestoreReasonLabel(initialShareHashRestoreResult.reason)}.`;
}

function shareRestoreReasonLabel(reason: Exclude<BettingShareRestoreResult, { readonly restored: true }>['reason']): string {
  const labels: Record<typeof reason, string> = {
    empty: '빈 링크',
    unsupported: '지원하지 않는 해시',
    'payload-too-large': `링크가 ${bettingShareHashMaxLength}자를 초과함`,
    invalid: '잘못된 링크',
    'storage-unavailable': '로컬 저장소 사용 불가',
  };

  return labels[reason];
}

const eventLabels: Record<BettingEventKey, string> = {
  'near-pin': '니어핀',
  'longest-drive': '롱기스트',
  birdie: '버디',
  'ob-penalty': 'OB/벌타',
};

type GameUnitField = 'points' | 'money';

function parseEditableIntegerDraft(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed === '' || !/^-?\d+$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

function parseIntegerDraft(value: string, fallback: number): number {
  return parseEditableIntegerDraft(value) ?? fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
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

function relativeScoreLabel(relativeScore: number): string {
  if (relativeScore === 0) {
    return '파';
  }

  return relativeScore > 0 ? `+${relativeScore}` : `${relativeScore}`;
}

function scoreChoiceLabel(strokes: number, holePar: number): string {
  return relativeScoreLabel(strokes - holePar);
}

function scoreChoiceHint(strokes: number, holePar: number): string {
  if (strokes === 1) {
    return '홀인원 · 1타';
  }

  if (strokes === holePar * 2) {
    return `더블파 · ${strokes}타`;
  }

  return `${strokes}타`;
}

function scoreSummary(strokes: number, holePar: number): string {
  if (strokes <= 0) {
    return '미입력';
  }

  const relativeLabel = relativeScoreLabel(strokes - holePar);

  if (strokes === holePar * 2) {
    return `${strokes}타 · ${relativeLabel} 더블파`;
  }

  if (strokes > holePar * 2) {
    return `${strokes}타 · 뒷문 ${relativeLabel}`;
  }

  return `${strokes}타 · ${relativeLabel}`;
}

function scoreChoicesForPar(holePar: number): readonly number[] {
  return Array.from({ length: holePar * 2 }, (_, index) => index + 1);
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

function currentLocationHash(): string {
  try {
    return globalThis.location?.hash ?? '';
  } catch {
    return '';
  }
}

function replaceCurrentLocationHash(hash: string): boolean {
  try {
    globalThis.location.hash = hash;
    return true;
  } catch {
    return false;
  }
}

function localResultLink(hash: string): string {
  try {
    const location = globalThis.location;
    const baseUrl = location?.origin && location.pathname ? `${location.origin}${location.pathname}${location.search}` : '';
    return `${baseUrl}${hash}`;
  } catch {
    return hash;
  }
}

function localQrCells(value: string): readonly boolean[] {
  const source = value || 'fungolf-local-share';

  return Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    const finderPattern = (row < 2 && column < 2) || (row < 2 && column > 2) || (row > 2 && column < 2);
    const charCode = source.charCodeAt(index % source.length);

    return finderPattern || ((charCode + (index + 1) * 17) % 5) < 3;
  });
}

export function App() {
  const session = useBettingRoundSession(shareHashRestoringLocalStorage);
  const { round } = session;
  const [roundName, setRoundName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [currentHoleDraft, setCurrentHoleDraft] = useState('');
  const [parDraftsByHole, setParDraftsByHole] = useState<Record<number, string>>({});
  const [backdoorOpenByHole, setBackdoorOpenByHole] = useState<Record<number, boolean>>({});
  const [holeCountDraft, setHoleCountDraft] = useState<string | null>(null);
  const [playerHandicapDrafts, setPlayerHandicapDrafts] = useState<Record<string, string>>({});
  const [gameUnitDrafts, setGameUnitDrafts] = useState<Record<string, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [missionPlayerId, setMissionPlayerId] = useState(round.players[0]?.id ?? '');
  const [missionCleared, setMissionCleared] = useState(true);
  const [shareReady, setShareReady] = useState(false);
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(() => initialShareHashStatus());

  const holeNumber = Math.min(round.settings.holeCount, Math.max(1, parseIntegerDraft(currentHoleDraft, 1)));
  const holeParDraft = parDraftsByHole[holeNumber] ?? '4';
  const holePar = clampInteger(parseIntegerDraft(holeParDraft, 4), 3, 5);
  const scoreChoices = useMemo(() => scoreChoicesForPar(holePar), [holePar]);
  const backdoorOpen = backdoorOpenByHole[holeNumber] ?? false;
  const activeNine = holeNumber > 9 ? 'back' : 'front';
  const firstHoleInActiveNine = activeNine === 'front' ? 1 : 10;
  const visibleHoleNumbers = Array.from(
    { length: Math.max(0, Math.min(9, round.settings.holeCount - firstHoleInActiveNine + 1)) },
    (_, index) => firstHoleInActiveNine + index,
  );
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
  const shareHashResult = useMemo(() => createBettingRoundShareHash(round), [round]);
  const shareHash = shareHashResult.ok ? shareHashResult.hash : '';
  const resultLink = shareHashResult.ok ? localResultLink(shareHashResult.hash) : '';
  const qrCells = useMemo(() => localQrCells(shareHash || shareCopy), [shareHash, shareCopy]);
  const activeMissionPlayerId = round.players.some((player) => player.id === missionPlayerId)
    ? missionPlayerId
    : (round.players[0]?.id ?? '');

  function markShareDirty() {
    setShareReady(false);
    setShareStatusMessage('입력값이 바뀌었습니다. 최신 스코어카드나 결과 링크를 다시 준비하세요.');
  }

  function prepareScorecardExport() {
    setShareReady(true);
    setShareStatusMessage('스코어카드 캡처/내보내기용 현재 정산 카드가 준비되었습니다.');
  }

  function prepareResultLinkShare() {
    if (!shareHashResult.ok) {
      setShareReady(false);
      setShareStatusMessage(`결과 링크가 ${shareHashResult.payloadLength}자로 ${shareHashResult.maxLength}자 제한을 넘어 QR/해시 공유를 중단했습니다.`);
      return;
    }

    const hashUpdated = replaceCurrentLocationHash(shareHashResult.hash);
    setShareReady(hashUpdated);
    setShareStatusMessage(
      hashUpdated
        ? `로컬 결과 링크가 준비되었습니다 (${shareHashResult.payloadLength}자${shareHashResult.withinTarget ? '' : ', 긴 링크'}). 서버 없이 이 주소의 해시만 공유합니다.`
        : '브라우저 주소 해시를 갱신할 수 없어 결과 링크를 만들지 못했습니다.',
    );
  }

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

  function updateParDraft(value: string) {
    setParDraftsByHole((current) => ({ ...current, [holeNumber]: value }));
    setShareReady(false);
  }

  function toggleBackdoorOpen() {
    setBackdoorOpenByHole((current) => ({ ...current, [holeNumber]: !(current[holeNumber] ?? false) }));
    setShareReady(false);
  }

  function updateScoreDraft(playerId: string, value: string) {
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: value }));
    markShareDirty();

    if (value === '') {
      setScoreDrafts((current) => ({ ...current, [draftKey]: value }));
      return;
    }

    if (/^\d{1,2}$/.test(value)) {
      const normalizedScore = clampInteger(parseIntegerDraft(value, holePar + 1), 1, maximumHoleScoreStrokes);
      setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
      session.updateHoleScore(holeNumber, playerId, normalizedScore);
    }

    if (/^\d{1,2}$/.test(value)) {
      const normalizedScore = clampInteger(parseIntegerDraft(value, holePar + 1), 1, maximumHoleScoreStrokes);
      setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
      session.updateHoleScore(holeNumber, playerId, normalizedScore);
    }
  }

  function updateScoreButton(playerId: string, strokes: number) {
    const normalizedScore = clampInteger(strokes, 1, maximumHoleScoreStrokes);
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
    setShareReady(false);
    session.updateHoleScore(holeNumber, playerId, normalizedScore);
  }

  function updateScoreButton(playerId: string, strokes: number) {
    const normalizedScore = clampInteger(strokes, 1, maximumHoleScoreStrokes);
    const draftKey = `${holeNumber}:${playerId}`;
    setScoreDrafts((current) => ({ ...current, [draftKey]: normalizedScore.toString() }));
    setShareReady(false);
    session.updateHoleScore(holeNumber, playerId, normalizedScore);
  }

  function updateMission(playerId: string, cleared: boolean) {
    setMissionPlayerId(playerId);
    setMissionCleared(cleared);
    markShareDirty();
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
    markShareDirty();
  }

  function resetEditableRound() {
    session.resetRound();
    setRoundName('');
    setCourseName('');
    setCurrentHoleDraft('');
    setParDraftsByHole({});
    setBackdoorOpenByHole({});
    setHoleCountDraft('');
    setPlayerHandicapDrafts({ 'player-1': '', 'player-2': '', 'player-3': '', 'player-4': '' });
    setGameUnitDrafts({});
    setScoreDrafts({});
    setMissionPlayerId('player-1');
    setMissionCleared(true);
    setShareReady(false);
  }

  function updateParDraft(value: string) {
    setParDraftsByHole((current) => ({ ...current, [holeNumber]: value }));
    setShareReady(false);
  }

  function toggleBackdoorOpen() {
    setBackdoorOpenByHole((current) => ({ ...current, [holeNumber]: !backdoorOpen }));
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
          <button className="secondary-action" type="button" onClick={() => resetEditableRound()}>새 라운드</button>
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

        <div className="scorecard-nav" aria-label="스코어카드 홀 선택">
          <div className="scorecard-tabs" role="tablist" aria-label="전반 후반 선택">
            <button className={activeNine === 'front' ? 'scorecard-tab active' : 'scorecard-tab'} type="button" onClick={() => updateHoleDraft('1')}>
              전반 1-9
            </button>
            <button
              className={activeNine === 'back' ? 'scorecard-tab active' : 'scorecard-tab'}
              type="button"
              onClick={() => updateHoleDraft(Math.min(10, round.settings.holeCount).toString())}
              disabled={round.settings.holeCount < 10}
            >
              후반 10-18
            </button>
          </div>
          <div className="scorecard-hole-grid">
            {visibleHoleNumbers.map((scorecardHoleNumber) => (
              <button
                className={scorecardHoleNumber === holeNumber ? 'scorecard-hole active' : 'scorecard-hole'}
                key={scorecardHoleNumber}
                type="button"
                onClick={() => updateHoleDraft(scorecardHoleNumber.toString())}
              >
                {scorecardHoleNumber}H
              </button>
            ))}
          </div>
        </div>

        <div className="hole-toolbar">
          <label>
            홀
            <input inputMode="numeric" value={currentHoleDraft} onChange={(event) => updateHoleDraft(event.currentTarget.value)} />
          </label>
          <label>
            파
            <input inputMode="numeric" value={holeParDraft} onChange={(event) => updateParDraft(event.currentTarget.value)} />
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

        <div className="scorecard-meta-grid" aria-label="현재 홀 입력 규칙">
          <p>
            <strong>파 row</strong>
            <span>{holePar}파 기준 · 홀인원부터 더블파({holePar * 2}타)까지 버튼 입력</span>
          </p>
          <button className={backdoorOpen ? 'backdoor-toggle active' : 'backdoor-toggle'} type="button" onClick={toggleBackdoorOpen}>
            <strong>뒷문오픈 row</strong>
            <span>{backdoorOpen ? `${maximumHoleScoreStrokes}타까지 직접 입력` : '더블파까지만 버튼 입력'}</span>
          </button>
        </div>

        <div className="score-list" aria-label="홀별 타수 입력">
          {round.players.map((player, index) => {
            const rawScore = scoreForPlayer(round, holeNumber, player.id) ?? 0;
            const netScore = ledger.handicap.netHoleScores[holeNumber]?.[player.id] ?? rawScore;

            return (
              <article className="score-row" key={player.id}>
                <div className="score-row-header">
                  <span>
                    <strong>{player.name}</strong>
                    <em>{playerTeam(index)} · 네트 {netScore || '-'}</em>
                  </span>
                  <small>{scoreSummary(rawScore, holePar)}</small>
                  <b>{signedAmountLabel(ledger.playerBalances[player.id]?.money ?? 0, 'money')}</b>
                </div>
                <div className="score-options" aria-label={`${player.name} 상대 스코어`}>
                  {scoreChoices.map((strokes) => (
                    <button
                      className={rawScore === strokes ? 'score-choice active' : 'score-choice'}
                      key={`${player.id}:${strokes}`}
                      type="button"
                      onClick={() => updateScoreButton(player.id, strokes)}
                    >
                      <strong>{scoreChoiceLabel(strokes, holePar)}</strong>
                      <span>{scoreChoiceHint(strokes, holePar)}</span>
                    </button>
                  ))}
                </div>
                {backdoorOpen ? (
                  <label className="extended-score-entry">
                    뒷문오픈 직접 타수
                    <input
                      inputMode="numeric"
                      value={scoreInputValue(player.id)}
                      placeholder={`${holePar * 2 + 1}–${maximumHoleScoreStrokes}`}
                      onChange={(event) => updateScoreDraft(player.id, event.currentTarget.value)}
                      aria-label={`${player.name} 뒷문오픈 타수`}
                    />
                  </label>
                ) : null}
              </article>
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
                markShareDirty();
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
        <div className="qr-chip" aria-label="로컬 결과 링크 QR 패턴">
          {qrCells.map((isActive, index) => <span key={`qr-${index}`} data-active={isActive ? 'true' : 'false'} />)}
        </div>
        <div className="share-actions">
          <button className="primary-action" type="button" onClick={prepareScorecardExport}>스코어카드 캡처/내보내기</button>
          <button className="secondary-action" type="button" onClick={prepareResultLinkShare} disabled={!shareHashResult.ok}>QR·결과 링크 공유</button>
        </div>
        {resultLink ? <p className="result-link" aria-label="로컬 결과 링크">{resultLink}</p> : <p className="result-link warning">라운드 입력량이 많아 2200자 제한 안의 결과 링크를 만들 수 없습니다.</p>}
        <p className="share-status" aria-live="polite">
          {shareStatusMessage ?? (shareReady ? '스코어카드 이미지나 결과 링크로 공유할 현재 정산 요약이 준비되었습니다.' : '공유 카드는 화면 맨 아래에서 스코어카드 내보내기와 결과 링크 공유만 제공합니다.')}
        </p>
      </section>
    </main>
  );
}
