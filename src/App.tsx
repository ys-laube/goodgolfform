import { useState, type CSSProperties } from 'react';

import { ScorecardGrid } from './ScorecardGrid';
import { displayPlayerName, relativeScoreLabel, scoreTypeLabel, scorecardPlayerCountOptions } from './domain/scorecard';
import { parseEditableIntegerDraft } from './inputDrafts';
import { createScorecardExportSvg, downloadScorecardExportSvg, scorecardExportFileName } from './scorecardExport';
import { useScorecardController } from './useScorecardController';
import { useScorecardSession } from './useScorecardSession';

const playerTones = ['#2563eb', '#db2777', '#059669', '#d97706'] as const;
const onGreenChoices = [1, 2, 3, 4, 5, 6] as const;
const puttChoices = [0, 1, 2, 3, 4, 5] as const;

export function App() {
  const session = useScorecardSession();
  const { round } = session;
  const [holeCountDraft, setHoleCountDraft] = useState(() => round.settings.holeCount.toString());
  const [manualScoreDrafts, setManualScoreDrafts] = useState<Record<string, string>>({});
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const controller = useScorecardController({ round, session });
  const selectedHole = controller.roundView.holes.find((hole) => hole.holeNumber === controller.holeNumber);

  function playerStyle(index: number): CSSProperties {
    return { '--player-tone': playerTones[index % playerTones.length] } as CSSProperties;
  }

  function updateHoleCountDraft(value: string) {
    const parsedValue = parseEditableIntegerDraft(value);
    if (parsedValue !== null) {
      const normalizedHoleCount = clampInteger(parsedValue, 1, 18);
      setHoleCountDraft(normalizedHoleCount.toString());
      session.updateRoundSetup({ holeCount: normalizedHoleCount });
      return;
    }
    setHoleCountDraft(value);
  }

  function updatePlayerCount(playerCount: number) {
    session.setPlayerCount(playerCount);
  }

  function normalizeHoleCountDraft() {
    const parsedValue = parseEditableIntegerDraft(holeCountDraft);
    const normalizedHoleCount = parsedValue === null ? round.settings.holeCount : clampInteger(parsedValue, 1, 18);
    setHoleCountDraft(normalizedHoleCount.toString());
    if (normalizedHoleCount !== round.settings.holeCount) {
      session.updateRoundSetup({ holeCount: normalizedHoleCount });
    }
  }

  function resetRound() {
    setHoleCountDraft('18');
    setManualScoreDrafts({});
    setExportStatus(null);
    controller.resetScorecardDrafts();
    session.resetRound();
  }

  function clearSavedRound() {
    setHoleCountDraft('18');
    setManualScoreDrafts({});
    setExportStatus(null);
    controller.resetScorecardDrafts();
    session.clearSavedRound();
  }

  function manualDraftKey(playerId: string) {
    return `${controller.holeNumber}:${playerId}`;
  }

  function updateManualScoreDraft(playerId: string, value: string) {
    setManualScoreDrafts((current) => ({ ...current, [manualDraftKey(playerId)]: value }));
    controller.updateManualScore(playerId, value);
  }

  function handleExportSvg() {
    const now = new Date().toISOString();
    const exportSvg = createScorecardExportSvg({ roundName: round.roundName, courseName: round.courseName, generatedAt: now, view: controller.roundView });
    const ok = downloadScorecardExportSvg(scorecardExportFileName(round.courseName || round.roundName, now), exportSvg);
    setExportStatus(ok ? '스코어카드 SVG 이미지를 저장했습니다.' : '브라우저 밖에서는 이미지 저장을 실행할 수 없습니다.');
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="top-actions" aria-label="라운드 저장 작업">
          <button className="ghost-button" type="button" onClick={() => session.saveRound()}>
            로컬 저장
          </button>
          <button className="ghost-button strong" type="button" onClick={resetRound}>
            새 라운드
          </button>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Private field scorecard</p>
          <h1>오늘 폼 정말 좋으시네요 ^0^</h1>
          <p>필드에서 온·펏으로 빠르게 적고, 홀 메모까지 남기는 개인 기록용 골프 스코어카드입니다.</p>
        </div>
        <div className="hero-metric" aria-label="저장 상태">
          <span>저장 상태</span>
          <strong>{session.storageStatus === 'loaded' ? '불러옴' : session.storageStatus === 'saved' ? '저장됨' : '로컬'}</strong>
          <small>{session.storageMessage}</small>
        </div>
      </section>

      <section className="control-panel" aria-labelledby="setup-title">
        <div className="section-heading">
          <p className="eyebrow">Setup</p>
          <h2 id="setup-title">라운드 세팅</h2>
          <p>1인 기본으로 시작하고, 필요하면 최대 4명까지 같은 화면에 기록합니다.</p>
        </div>

        <div className="form-grid">
          <label className="field-card">
            <span>라운드 이름</span>
            <input value={round.roundName} onChange={(event) => session.updateRoundLabels({ roundName: event.currentTarget.value })} placeholder="예: 토요일 오전" />
          </label>
          <label className="field-card">
            <span>코스 이름</span>
            <input value={round.courseName} onChange={(event) => session.updateRoundLabels({ courseName: event.currentTarget.value })} placeholder="예: 남코스 OUT" />
          </label>
          <label className="field-card compact-field">
            <span>홀 수</span>
            <input inputMode="numeric" value={holeCountDraft} onBlur={normalizeHoleCountDraft} onChange={(event) => updateHoleCountDraft(event.currentTarget.value)} />
          </label>
          <div className="field-card">
            <span>플레이어 수</span>
            <div className="segmented-control" role="radiogroup" aria-label="플레이어 수">
              {scorecardPlayerCountOptions.map((count) => (
                <button
                  className={round.players.length === count ? 'segment active' : 'segment'}
                  key={count}
                  type="button"
                  onClick={() => updatePlayerCount(count)}
                >
                  {count}명
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="player-editor" aria-label="플레이어 이름">
          {round.players.map((player, index) => (
            <label className="player-name-card" key={player.id} style={playerStyle(index)}>
              <span>{index + 1}번</span>
              <input
                value={player.name}
                onChange={(event) => session.updatePlayer(player.id, { name: event.currentTarget.value })}
                placeholder={`${index + 1}번 플레이어`}
              />
            </label>
          ))}
        </div>
      </section>

      <ScorecardGrid
        activeNine={controller.activeNine}
        holeCount={round.settings.holeCount}
        selectedHoleNumber={controller.holeNumber}
        visibleHoleNumbers={controller.visibleHoleNumbers}
        players={round.players}
        roundView={controller.roundView}
        displayPlayerName={displayPlayerName}
        playerStyle={playerStyle}
        parInputValue={controller.parInputValue}
        onSelectHole={controller.selectHole}
        onChangePar={controller.updateParDraftForHole}
        onNormalizePar={controller.normalizeParDraftForHole}
      />

      <section className="hole-panel" aria-labelledby="hole-input-title">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Hole input</p>
            <h2 id="hole-input-title">{controller.holeNumber}번 홀 입력</h2>
          </div>
          <label className="mini-number-field">
            홀
            <input inputMode="numeric" value={controller.currentHoleDraft} onBlur={controller.normalizeHoleDraft} onChange={(event) => controller.updateHoleDraft(event.currentTarget.value)} />
          </label>
        </div>

        <label className="memo-card">
          <span>홀 메모</span>
          <textarea
            value={controller.memoInputValue(controller.holeNumber)}
            onChange={(event) => controller.updateMemoDraft(controller.holeNumber, event.currentTarget.value)}
            placeholder="예: 티샷 우측 러프, 세컨 짧음, 퍼트 거리감 좋음"
          />
        </label>

        <div className="entry-list">
          {round.players.map((player, index) => {
            const currentScore = controller.scoreForPlayer(controller.holeNumber, player.id);
            const manualKey = manualDraftKey(player.id);
            return (
              <article className="entry-card" key={player.id} style={playerStyle(index)}>
                <div className="entry-card-title">
                  <div>
                    <span className="player-dot" />
                    <strong>{displayPlayerName(player, index)}</strong>
                  </div>
                  <output>{selectedHole?.cells.find((cell) => cell.playerId === player.id)?.main ?? '—'}</output>
                </div>

                <div className="button-row" aria-label={`${displayPlayerName(player, index)} 온 선택`}>
                  <span>온</span>
                  {onGreenChoices.map((choice) => (
                    <button
                      className={currentScore?.onGreenShots === choice ? 'choice-chip active' : 'choice-chip'}
                      key={choice}
                      type="button"
                      onClick={() => controller.updateOnGreenShots(player.id, choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                <div className="button-row" aria-label={`${displayPlayerName(player, index)} 펏 선택`}>
                  <span>펏</span>
                  {puttChoices.map((choice) => (
                    <button
                      className={currentScore?.putts === choice ? 'choice-chip active' : 'choice-chip'}
                      key={choice}
                      type="button"
                      onClick={() => controller.updatePutts(player.id, choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                <div className="entry-footer">
                  <button type="button" className="secondary-button" onClick={() => controller.updateHoleInOne(player.id)}>
                    홀인원
                  </button>
                  <label className="manual-score">
                    직접 타수
                    <input
                      inputMode="numeric"
                      value={manualScoreDrafts[manualKey] ?? ''}
                      onChange={(event) => updateManualScoreDraft(player.id, event.currentTarget.value)}
                      placeholder="예: 7"
                    />
                  </label>
                  <button type="button" className="secondary-button danger" onClick={() => controller.clearPlayerScore(player.id)}>
                    지우기
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="review-card" aria-labelledby="review-title">
        <div className="section-heading">
          <p className="eyebrow">Round review</p>
          <h2 id="review-title">라운드 리뷰</h2>
          <p>전체 스코어, 전·후반 흐름, 온/펏 평균과 메모 하이라이트만 간단히 봅니다.</p>
        </div>
        <div className="review-grid">
          {controller.roundView.reviews.map((review, index) => (
            <article className="review-player-card" key={review.playerId} style={playerStyle(index)}>
              <strong>{displayPlayerName(round.players[index] ?? { id: review.playerId, name: review.playerName }, index)}</strong>
              <div className="review-score">
                <span>{review.completedHoles}홀</span>
                <b>{review.completedHoles ? relativeScoreLabel(review.totalRelative) : '—'}</b>
              </div>
              <dl>
                <div><dt>총타</dt><dd>{review.completedHoles ? `${review.totalStrokes}타` : '—'}</dd></div>
                <div><dt>전반/후반</dt><dd>{relativeScoreLabel(review.frontRelative)} / {relativeScoreLabel(review.backRelative)}</dd></div>
                <div><dt>온 평균</dt><dd>{review.averageOnGreenShots ?? '—'}</dd></div>
                <div><dt>펏 평균</dt><dd>{review.averagePutts ?? '—'}</dd></div>
                <div><dt>3펏</dt><dd>{review.threePuttCount}회</dd></div>
              </dl>
              <div className="score-type-list" aria-label="스코어 유형 개수">
                {Object.entries(review.scoreTypeCounts).map(([key, value]) => (
                  <span key={key}>{scoreTypeLabel(key as keyof typeof review.scoreTypeCounts)} {value}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="memo-highlights">
          <h3>메모 하이라이트</h3>
          {controller.roundView.memoHighlights.length ? (
            <ul>
              {controller.roundView.memoHighlights.map((memo) => (
                <li key={memo.holeNumber}><strong>{memo.holeNumber}H</strong> {memo.memo}</li>
              ))}
            </ul>
          ) : (
            <p>아직 남긴 홀 메모가 없습니다.</p>
          )}
        </div>
      </section>

      <section className="export-card" aria-labelledby="export-title">
        <div>
          <p className="eyebrow">Save image</p>
          <h2 id="export-title">스코어카드 이미지 저장</h2>
          <p>전체 스코어카드와 입력한 홀 메모를 SVG 이미지 파일로 휴대폰에 저장합니다.</p>
        </div>
        <div className="export-actions">
          <button className="primary-button" type="button" onClick={handleExportSvg}>스코어카드 SVG 저장</button>
          <button className="secondary-button" type="button" onClick={clearSavedRound}>저장 기록 지우기</button>
        </div>
        {exportStatus ? <p className="status-text">{exportStatus}</p> : null}
      </section>
    </main>
  );
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
