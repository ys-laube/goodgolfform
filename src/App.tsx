import { useMemo, useState, type CSSProperties } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import { ScorecardGrid } from './ScorecardGrid';
import { calculateRoundLedger, type BettingRound as LedgerBettingRound, type PlayerId } from './domain/bettingLedger';
import {
  bettingShareHashMaxLength,
  createBettingRoundShareHash,
  restoreBettingRoundShareHashToStorage,
  type BettingShareLabels,
  type BettingShareRestoreResult,
} from './domain/bettingShareSnapshot';
import { maximumHoleScoreStrokes, type BettingRound as StoredBettingRound } from './domain/bettingStorage';
import { parseEditableIntegerDraft } from './inputDrafts';
import { createScorecardExportSvg, scorecardExportFileName } from './scorecardExport';
import { parseIntegerDraft, scoreForPlayer, scoreLabel, scoreSummary, useScorecardController } from './useScorecardController';
import { useBettingRoundSession } from './useBettingRoundSession';

const playerTones = ['#4f8cff', '#ff8aab', '#6ee7b7', '#fbbf24'] as const;
const currencyFormatter = new Intl.NumberFormat('ko-KR');
const onGreenChoices = [1, 2, 3, 4, 5, 6] as const;
const puttChoices = [0, 1, 2, 3, 4, 5] as const;

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
    return `결과 링크에서 오장 라운드를 복원했습니다. 해시 ${initialShareHashRestoreResult.payloadLength}자, 이 기기에만 저장됩니다.`;
  }

  if (initialShareHashRestoreResult.reason === 'unsupported' || initialShareHashRestoreResult.reason === 'empty') {
    return null;
  }

  return `결과 링크를 복원하지 못했습니다: ${shareRestoreReasonLabel(initialShareHashRestoreResult.reason)}.`;
}

function initialShareLabels(): BettingShareLabels {
  return initialShareHashRestoreResult?.restored ? initialShareHashRestoreResult.labels : { roundName: '', courseName: '' };
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

function signedMoneyLabel(amount: number): string {
  if (Math.abs(amount) < 0.005) {
    return '₩0';
  }

  const sign = amount > 0 ? '+' : '-';
  return `${sign}₩${currencyFormatter.format(Math.round(Math.abs(amount)))}`;
}

function transferAmountLabel(amount: number): string {
  return `₩${currencyFormatter.format(Math.round(amount))}`;
}

function playerTeam(index: number): '청팀' | '백팀' {
  return index < 2 ? '청팀' : '백팀';
}

function displayPlayerName(name: string): string {
  return name.trim();
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
      unitAmount: round.settings.unitAmount,
    },
    holes: round.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      backdoorOpen: hole.backdoorOpen,
      nearPlayerId: hole.nearPlayerId ?? null,
      scores: round.players.flatMap((player) => {
        const score = hole.scores.find((candidate) => candidate.playerId === player.id);
        return score ? [{ ...score, playerId: player.id as PlayerId }] : [];
      }),
    })),
  };
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

function downloadScorecardExportSvg(fileName: string, svg: string): boolean {
  try {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
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
  const restoredLabels = initialShareLabels();
  const [roundName, setRoundName] = useState(() => restoredLabels.roundName);
  const [courseName, setCourseName] = useState(() => restoredLabels.courseName);
  const [holeCountDraft, setHoleCountDraft] = useState<string | null>(null);
  const [unitAmountDraft, setUnitAmountDraft] = useState<string | null>(null);
  const [playerHandicapDrafts, setPlayerHandicapDrafts] = useState<Record<string, string>>({});
  const [shareReady, setShareReady] = useState(false);
  const [ruleDetailsOpen, setRuleDetailsOpen] = useState(false);
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(() => initialShareHashStatus());

  const {
    activeNine,
    backdoorOpen,
    backdoorOpenForHole,
    currentHoleDraft,
    holeNumber,
    holePar,
    holeParDraft,
    parForHole,
    parInputValue,
    resetScorecardDrafts,
    scoreInputValue,
    scorecardCellLabel,
    toggleBackdoorOpen,
    toggleBackdoorOpenForHole,
    updateHoleDraft,
    updateHoleInOne,
    updateOnGreenShots,
    updateParDraft,
    updateParDraftForHole,
    updatePutts,
    updateScoreDraft,
    visibleHoleNumbers,
  } = useScorecardController({
    round,
    updateHoleSetup: session.updateHoleSetup,
    updateHoleScore: session.updateHoleScore,
    markDirty: markShareDirty,
  });
  const ledger = useMemo(() => calculateRoundLedger(toLedgerRound(round)), [round]);
  const balanceRows = round.players
    .map((player, index) => ({
      player,
      index,
      amount: ledger.playerBalances[player.id]?.money ?? 0,
    }))
    .sort((left, right) => right.amount - left.amount);
  const completedHoleCount = ledger.completedHoleNumbers.length;
  const leader = balanceRows[0];
  const selectedHole = round.holes.find((hole) => hole.holeNumber === holeNumber);
  const shareCopy = `${roundName} ${completedHoleCount || holeNumber}H 오장 정산 · ${balanceRows
    .map((entry) => `${displayPlayerName(entry.player.name)} ${signedMoneyLabel(entry.amount)}`)
    .join(' / ')}`;
  const shareHashResult = useMemo(() => createBettingRoundShareHash(round, { roundName, courseName }), [courseName, round, roundName]);
  const shareHash = shareHashResult.ok ? shareHashResult.hash : '';
  const resultLink = shareHashResult.ok ? localResultLink(shareHashResult.hash) : '';
  const qrCells = useMemo(() => localQrCells(shareHash || shareCopy), [shareHash, shareCopy]);

  function markShareDirty() {
    setShareReady(false);
    setShareStatusMessage('입력값이 바뀌었습니다. 최신 스코어카드나 결과 링크를 다시 준비하세요.');
  }

  function prepareScorecardExport() {
    const generatedAt = new Date().toISOString();
    const exportSvg = createScorecardExportSvg({
      roundName,
      courseName,
      summary: shareCopy,
      generatedAt,
      players: round.players.map((player, index) => ({
        name: displayPlayerName(player.name),
        team: playerTeam(index),
        balance: signedMoneyLabel(ledger.playerBalances[player.id]?.money ?? 0),
      })),
      holes: Array.from({ length: round.settings.holeCount }, (_, index) => {
        const exportHoleNumber = index + 1;
        return {
          holeNumber: exportHoleNumber,
          par: parForHole(exportHoleNumber),
          backdoorOpen: backdoorOpenForHole(exportHoleNumber),
          playerScores: round.players.map((player) => scorecardCellLabel(exportHoleNumber, player.id)),
        };
      }),
    });
    const exported = downloadScorecardExportSvg(scorecardExportFileName(courseName || roundName, generatedAt), exportSvg);

    setShareReady(exported);
    setShareStatusMessage(
      exported
        ? '현재 전후반 오장 스코어카드를 SVG 이미지 파일로 로컬 내보내기했습니다.'
        : '브라우저가 로컬 파일 내보내기를 허용하지 않아 스코어카드를 만들지 못했습니다.',
    );
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

  function unitAmountInputValue(): string {
    return unitAmountDraft ?? round.settings.unitAmount.toString();
  }

  function playerHandicapInputValue(playerId: string, handicap: number): string {
    return playerHandicapDrafts[playerId] ?? handicap.toString();
  }

  function displayPlayerNameById(playerId: string): string {
    const playerIndex = round.players.findIndex((player) => player.id === playerId);

    return playerIndex >= 0 ? displayPlayerName(round.players[playerIndex].name) : playerId;
  }

  function commitIntegerDraft(value: string, commit: (parsedValue: number) => void) {
    const parsedValue = parseEditableIntegerDraft(value);

    if (parsedValue !== null) {
      commit(parsedValue);
    }
  }

  function updateRoundName(value: string) {
    setRoundName(value);
    markShareDirty();
  }

  function updateCourseName(value: string) {
    setCourseName(value);
    markShareDirty();
  }

  function updatePlayerCount(value: string) {
    markShareDirty();
    session.setPlayerCount(parseIntegerDraft(value, round.players.length));
  }

  function updatePlayerName(playerId: string, value: string) {
    markShareDirty();
    session.updatePlayer(playerId, { name: value });
  }

  function updatePlayerHandicap(playerId: string, value: string) {
    setPlayerHandicapDrafts((current) => ({ ...current, [playerId]: value }));
    markShareDirty();
    commitIntegerDraft(value, (handicap) => session.updatePlayer(playerId, { handicap }));
  }

  function updateUnitAmountDraft(value: string) {
    setUnitAmountDraft(value);
    markShareDirty();
    commitIntegerDraft(value, (unitAmount) => session.updateUnitAmount(unitAmount));
  }

  function updateHoleCountDraft(value: string) {
    setHoleCountDraft(value);
    markShareDirty();
    commitIntegerDraft(value, (holeCount) => session.updateRoundSetup({ holeCount }));
  }

  function resetEditableRound() {
    session.resetRound();
    setRoundName('');
    setCourseName('');
    resetScorecardDrafts();
    setHoleCountDraft('');
    setUnitAmountDraft('');
    setPlayerHandicapDrafts({});
    setShareReady(false);
    setShareStatusMessage('새 오장 라운드로 초기화했습니다. 공유 링크와 내보내기는 다시 준비하세요.');
  }

  return (
    <main className="app-shell" aria-labelledby="app-title" data-mobile-layout="safe-area-inset">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-copy">
          <h1 id="app-title">오늘 폼 정말 좋으시네요 ^0^</h1>
          <button className="rule-disclosure" type="button" onClick={() => setRuleDetailsOpen((current) => !current)} aria-expanded={ruleDetailsOpen}>
            오장 룰 자세히 보기
          </button>
          {ruleDetailsOpen ? (
            <div className="rule-detail-panel">
              <p><strong>오장:</strong> 매 홀 전원 1:1로 타수차 × 타당 금액을 계산합니다.</p>
              <p><strong>배판:</strong> 버디 이상, 트리플 이상, 파3 더블 이상, 3명 동타는 현재 홀 2배입니다. 4명 동타는 다음 홀 배판으로 넘어갑니다.</p>
              <p><strong>버디값/니어:</strong> 버디 +1, 이글 +2, 홀인원 +3 타값. 파3 니어는 파 이하 성공 +1, 실패 -1 타값입니다.</p>
              <p><strong>핸디 보정:</strong> 홀별 배분 없이 마지막에 총타-핸디 기준 차액만 따로 반영합니다.</p>
            </div>
          ) : null}
        </div>
        <div className="hero-metric" aria-label="현재 1위">
          <span>{completedHoleCount}개 홀 반영</span>
          <strong>{leader ? displayPlayerName(leader.player.name) : '대기'}</strong>
          <em>{signedMoneyLabel(leader?.amount ?? 0)}</em>
        </div>
      </section>

      <section className="control-panel" aria-labelledby="setup-title">
        <div className="section-heading setup-heading-row">
          <div>
            <p className="eyebrow">라운드 세팅</p>
            <h2 id="setup-title">플레이어와 오장 룰</h2>
            <p>{session.storageMessage}</p>
          </div>
          <div className="setup-actions" aria-label="로컬 라운드 작업">
            <button className="secondary-action compact-action" type="button" onClick={() => session.saveRound()}>로컬 저장</button>
            <button className="secondary-action compact-action" type="button" onClick={() => resetEditableRound()}>새 라운드</button>
          </div>
        </div>

        <div className="setup-grid">
          <label>
            라운드 이름
            <input value={roundName} onChange={(event) => updateRoundName(event.currentTarget.value)} />
          </label>
          <label>
            코스 / 티
            <input value={courseName} onChange={(event) => updateCourseName(event.currentTarget.value)} />
          </label>
          <label>
            타당 금액
            <input inputMode="numeric" value={unitAmountInputValue()} onChange={(event) => updateUnitAmountDraft(event.currentTarget.value)} />
          </label>
          <label>
            플레이어 수
            <select value={round.players.length} onChange={(event) => updatePlayerCount(event.currentTarget.value)}>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
            </select>
          </label>
        </div>

        <div className="player-strip" aria-label="플레이어와 핸디캡">
          {round.players.map((player, index) => (
            <article className="player-chip editable-chip" key={player.id} style={playerStyle(index)}>
              <span>{playerTeam(index)}</span>
              <label>
                이름
                <input value={player.name} onChange={(event) => updatePlayerName(player.id, event.currentTarget.value)} />
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

      </section>

      <section className="control-panel hole-panel" aria-labelledby="hole-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">홀 입력</p>
          <h2 id="hole-title">{holeNumber}번 홀 온/펏 스코어</h2>
        </div>

        <ScorecardGrid
          activeNine={activeNine}
          holeCount={round.settings.holeCount}
          selectedHoleNumber={holeNumber}
          visibleHoleNumbers={visibleHoleNumbers}
          players={round.players}
          displayPlayerName={displayPlayerName}
          playerStyle={playerStyle}
          parInputValue={parInputValue}
          parForHole={parForHole}
          backdoorOpenForHole={backdoorOpenForHole}
          scoreForPlayer={(scorecardHoleNumber, playerId) => scoreForPlayer(round, scorecardHoleNumber, playerId)?.strokes}
          scorecardCellLabel={scorecardCellLabel}
          scoreSummary={scoreSummary}
          onSelectHole={(scorecardHoleNumber) => updateHoleDraft(scorecardHoleNumber.toString())}
          onChangePar={updateParDraftForHole}
          onToggleBackdoor={toggleBackdoorOpenForHole}
        />

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
            <span>{holePar}파 기준 · 온/펏 버튼 합계가 총타로 저장됩니다.</span>
          </p>
          <label className={backdoorOpen ? 'backdoor-toggle active' : 'backdoor-toggle'}>
            <input type="checkbox" checked={backdoorOpen} onChange={toggleBackdoorOpen} />
            <strong>뒷문오픈 row</strong>
            <span>{backdoorOpen ? `${maximumHoleScoreStrokes}타까지 직접 입력` : '직접 총타 수정은 예외 입력으로 유지'}</span>
          </label>
          {holePar === 3 ? (
            <label className="near-selector">
              파3 니어 선택
              <select value={selectedHole?.nearPlayerId ?? ''} onChange={(event) => session.setNearPlayer(holeNumber, event.currentTarget.value || null)}>
                <option value="">니어 미선택</option>
                {round.players.map((player) => (
                  <option key={player.id} value={player.id}>{displayPlayerName(player.name) || player.id}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="score-list" aria-label="홀별 온/펏 입력">
          {round.players.map((player, index) => {
            const score = scoreForPlayer(round, holeNumber, player.id);
            const rawScore = score?.strokes ?? 0;
            const selectedOn = score?.entryMode === 'on-putt' && score.onGreenShots !== undefined ? score.onGreenShots : null;
            const selectedPutts = score?.entryMode === 'on-putt' && score.putts !== undefined ? score.putts : null;

            return (
              <article className="score-row" key={player.id}>
                <div className="score-row-header">
                  <span>
                    <strong>{displayPlayerName(player.name)}</strong>
                    <em>{playerTeam(index)} · {score ? scoreLabel(score) : '입력 전'}</em>
                  </span>
                  <small>{scoreSummary(rawScore, holePar)}</small>
                  <b>{signedMoneyLabel(ledger.playerBalances[player.id]?.money ?? 0)}</b>
                </div>
                <div className="score-input-grid" aria-label={`${displayPlayerName(player.name)} 온펏 입력`}>
                  <div className="score-row-context">
                    <span>몇 온</span>
                    <div className="score-options compact-options">
                      {onGreenChoices.map((onGreenShots) => (
                        <button
                          className={selectedOn === onGreenShots ? 'score-choice active' : 'score-choice'}
                          key={`${player.id}:on:${onGreenShots}`}
                          type="button"
                          onClick={() => updateOnGreenShots(player.id, onGreenShots)}
                        >
                          <strong>{onGreenShots}온</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="score-row-context">
                    <span>몇 펏</span>
                    <div className="score-options compact-options">
                      {puttChoices.map((putts) => (
                        <button
                          className={selectedPutts === putts ? 'score-choice active' : 'score-choice'}
                          key={`${player.id}:putt:${putts}`}
                          type="button"
                          onClick={() => updatePutts(player.id, putts)}
                        >
                          <strong>{putts}펏</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                  {holePar === 3 ? (
                    <button className={score?.entryMode === 'hio' ? 'score-choice active hio-choice' : 'score-choice hio-choice'} type="button" onClick={() => updateHoleInOne(player.id)}>
                      <strong>홀인원</strong>
                      <span>1타 저장</span>
                    </button>
                  ) : null}
                </div>
                {backdoorOpen ? (
                  <label className="extended-score-entry">
                    뒷문오픈 직접 타수
                    <input
                      inputMode="numeric"
                      value={scoreInputValue(player.id)}
                      placeholder={`${holePar * 2 + 1}–${maximumHoleScoreStrokes}`}
                      onChange={(event) => updateScoreDraft(player.id, event.currentTarget.value)}
                      aria-label={`${displayPlayerName(player.name)} 뒷문오픈 타수`}
                    />
                  </label>
                ) : null}
              </article>
            );
          })}
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
                  <strong>{displayPlayerName(entry.player.name)}</strong>
                  <em>{playerTeam(entry.index)}</em>
                </span>
                <b className={entry.amount >= 0 ? 'positive' : 'negative'}>{signedMoneyLabel(entry.amount)}</b>
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
                <strong>{displayPlayerNameById(transfer.payerId)}</strong>
                <span>→</span>
                <strong>{displayPlayerNameById(transfer.payeeId)}</strong>
                <b>{transferAmountLabel(transfer.amount)}</b>
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="calculation-card" aria-labelledby="calculation-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">계산 내역</p>
          <h2 id="calculation-title">오장 공식별 근거</h2>
        </div>
        <div className="calculation-list">
          {ledger.breakdownRows.slice(0, 14).map((line) => (
            <article key={line.id}>
              <span>{line.label}</span>
              <strong>{line.detail}</strong>
              <b className={line.money >= 0 ? 'positive' : 'negative'}>{signedMoneyLabel(line.money)}</b>
            </article>
          ))}
          {ledger.breakdownRows.length === 0 ? <article><span>대기</span><strong>각 플레이어 타수를 입력하면 배판, 니어, 버디값, 핸디 보정 근거가 여기에 쌓입니다.</strong><b>₩0</b></article> : null}
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
          {shareStatusMessage ?? (shareReady ? '스코어카드 이미지나 결과 링크로 공유할 현재 오장 요약이 준비되었습니다.' : '공유 카드는 화면 맨 아래에서 스코어카드 내보내기와 결과 링크 공유만 제공합니다.')}
        </p>
      </section>
    </main>
  );
}
