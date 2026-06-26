import type { CSSProperties } from 'react';

import type { ScorecardPlayer, ScorecardRoundView } from './domain/scorecard';
import './scorecard.css';

type ScorecardGridProps = {
  readonly activeNine: 'front' | 'back';
  readonly holeCount: number;
  readonly selectedHoleNumber: number;
  readonly visibleHoleNumbers: readonly number[];
  readonly players: readonly ScorecardPlayer[];
  readonly roundView: ScorecardRoundView;
  readonly displayPlayerName: (player: ScorecardPlayer, index: number) => string;
  readonly playerStyle: (index: number) => CSSProperties;
  readonly parInputValue: (holeNumber: number) => string;
  readonly onSelectHole: (holeNumber: number) => void;
  readonly onChangePar: (holeNumber: number, value: string) => void;
};

export function ScorecardGrid({
  activeNine,
  holeCount,
  selectedHoleNumber,
  visibleHoleNumbers,
  players,
  roundView,
  displayPlayerName,
  playerStyle,
  parInputValue,
  onSelectHole,
  onChangePar,
}: ScorecardGridProps) {
  function holeView(holeNumber: number) {
    return roundView.holes.find((hole) => hole.holeNumber === holeNumber);
  }

  return (
    <section className="scorecard-section" aria-labelledby="scorecard-title">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Live scorecard</p>
          <h2 id="scorecard-title">스코어카드</h2>
        </div>
        <div className="scorecard-tabs" role="tablist" aria-label="전반 후반 선택">
          <button className={activeNine === 'front' ? 'scorecard-tab active' : 'scorecard-tab'} type="button" onClick={() => onSelectHole(1)}>
            전반 1-9
          </button>
          <button
            className={activeNine === 'back' ? 'scorecard-tab active' : 'scorecard-tab'}
            type="button"
            onClick={() => onSelectHole(Math.min(10, holeCount))}
            disabled={holeCount < 10}
          >
            후반 10-18
          </button>
        </div>
      </div>

      <div className="scorecard-scroll" aria-label="전후반 스코어카드 전체표">
        <div className="scorecard-matrix">
          <div className="scorecard-row scorecard-header-row">
            <span className="scorecard-row-label">홀</span>
            {visibleHoleNumbers.map((scorecardHoleNumber) => (
              <button
                className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell header-cell active' : 'scorecard-cell header-cell'}
                key={`header-${scorecardHoleNumber}`}
                type="button"
                onClick={() => onSelectHole(scorecardHoleNumber)}
              >
                {scorecardHoleNumber}H
              </button>
            ))}
          </div>
          <div className="scorecard-row scorecard-par-row">
            <span className="scorecard-row-label">파</span>
            {visibleHoleNumbers.map((scorecardHoleNumber) => (
              <label
                className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell input-cell active' : 'scorecard-cell input-cell'}
                key={`par-${scorecardHoleNumber}`}
              >
                <span className="sr-only">{scorecardHoleNumber}번 홀 파</span>
                <input
                  inputMode="numeric"
                  value={parInputValue(scorecardHoleNumber)}
                  onFocus={() => onSelectHole(scorecardHoleNumber)}
                  onChange={(event) => onChangePar(scorecardHoleNumber, event.currentTarget.value)}
                  aria-label={`${scorecardHoleNumber}번 홀 파`}
                />
              </label>
            ))}
          </div>
          {players.map((player, playerIndex) => (
            <div className="scorecard-row player-scorecard-row" key={`scorecard-row-${player.id}`}>
              <span className="scorecard-row-label player-label" style={playerStyle(playerIndex)}>
                {displayPlayerName(player, playerIndex)}
              </span>
              {visibleHoleNumbers.map((scorecardHoleNumber) => {
                const cell = holeView(scorecardHoleNumber)?.cells.find((candidate) => candidate.playerId === player.id);

                return (
                  <button
                    className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell score-cell active' : 'scorecard-cell score-cell'}
                    key={`${player.id}-${scorecardHoleNumber}`}
                    type="button"
                    onClick={() => onSelectHole(scorecardHoleNumber)}
                    aria-label={`${displayPlayerName(player, playerIndex)} ${scorecardHoleNumber}번 홀 ${cell?.main ?? '미입력'}`}
                  >
                    <strong>{cell?.main ?? '—'}</strong>
                    <span>{cell ? cell.sub : '온 · 펏'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
