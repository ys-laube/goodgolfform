import type { CSSProperties } from 'react';

import type { BettingPlayer } from './domain/bettingStorage';
import './scorecard.css';

type ScorecardGridProps = {
  readonly activeNine: 'front' | 'back';
  readonly holeCount: number;
  readonly selectedHoleNumber: number;
  readonly visibleHoleNumbers: readonly number[];
  readonly players: readonly BettingPlayer[];
  readonly displayPlayerName: (name: string) => string;
  readonly playerStyle: (index: number) => CSSProperties;
  readonly parInputValue: (holeNumber: number) => string;
  readonly parForHole: (holeNumber: number) => number;
  readonly backdoorOpenForHole: (holeNumber: number) => boolean;
  readonly scoreForPlayer: (holeNumber: number, playerId: string) => number | undefined;
  readonly scorecardCellLabel: (holeNumber: number, playerId: string) => string;
  readonly scoreSummary: (strokes: number, holePar: number) => string;
  readonly onSelectHole: (holeNumber: number) => void;
  readonly onChangePar: (holeNumber: number, value: string) => void;
  readonly onToggleBackdoor: (holeNumber: number) => void;
};

export function ScorecardGrid({
  activeNine,
  holeCount,
  selectedHoleNumber,
  visibleHoleNumbers,
  players,
  displayPlayerName,
  playerStyle,
  parInputValue,
  parForHole,
  backdoorOpenForHole,
  scoreForPlayer,
  scorecardCellLabel,
  scoreSummary,
  onSelectHole,
  onChangePar,
  onToggleBackdoor,
}: ScorecardGridProps) {
  return (
    <>
      <div className="scorecard-nav" aria-label="스코어카드 홀 선택">
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
        <div className="scorecard-hole-grid">
          {visibleHoleNumbers.map((scorecardHoleNumber) => (
            <button
              className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-hole active' : 'scorecard-hole'}
              key={scorecardHoleNumber}
              type="button"
              onClick={() => onSelectHole(scorecardHoleNumber)}
            >
              {scorecardHoleNumber}H
            </button>
          ))}
        </div>
      </div>

      <div className="scorecard-matrix" aria-label="전후반 스코어카드 전체표">
        <div className="scorecard-row scorecard-header-row">
          <span className="scorecard-row-label">구분</span>
          {visibleHoleNumbers.map((scorecardHoleNumber) => (
            <button
              className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell active' : 'scorecard-cell'}
              key={`header-${scorecardHoleNumber}`}
              type="button"
              onClick={() => onSelectHole(scorecardHoleNumber)}
            >
              {scorecardHoleNumber}H
            </button>
          ))}
        </div>
        <div className="scorecard-row scorecard-par-row">
          <span className="scorecard-row-label">파 row</span>
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
              />
            </label>
          ))}
        </div>
        <div className="scorecard-row scorecard-backdoor-row">
          <span className="scorecard-row-label">뒷문오픈</span>
          {visibleHoleNumbers.map((scorecardHoleNumber) => (
            <label
              className={backdoorOpenForHole(scorecardHoleNumber) ? 'scorecard-cell checkbox-cell active' : 'scorecard-cell checkbox-cell'}
              key={`backdoor-${scorecardHoleNumber}`}
            >
              <input
                type="checkbox"
                checked={backdoorOpenForHole(scorecardHoleNumber)}
                onChange={() => onToggleBackdoor(scorecardHoleNumber)}
              />
              <span>{backdoorOpenForHole(scorecardHoleNumber) ? '오픈' : '닫힘'}</span>
            </label>
          ))}
        </div>
        {players.map((player, playerIndex) => (
          <div className="scorecard-row player-scorecard-row" key={`scorecard-row-${player.id}`}>
            <span className="scorecard-row-label" style={playerStyle(playerIndex)}>
              {displayPlayerName(player.name)}
            </span>
            {visibleHoleNumbers.map((scorecardHoleNumber) => {
              const strokes = scoreForPlayer(scorecardHoleNumber, player.id);

              return (
                <button
                  className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell score-cell active' : 'scorecard-cell score-cell'}
                  key={`${player.id}-${scorecardHoleNumber}`}
                  type="button"
                  onClick={() => onSelectHole(scorecardHoleNumber)}
                >
                  <strong>{scorecardCellLabel(scorecardHoleNumber, player.id)}</strong>
                  <span>{strokes ? scoreSummary(strokes, parForHole(scorecardHoleNumber)) : '입력 전'}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
