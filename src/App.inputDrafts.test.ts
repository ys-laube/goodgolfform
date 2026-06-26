import { describe, expect, it } from 'vitest';

import appSource from './App.tsx?raw';
import { parseEditableIntegerDraft } from './inputDrafts';
import scorecardGridSource from './ScorecardGrid.tsx?raw';
import scorecardExportSource from './scorecardExport.ts?raw';
import scorecardControllerSource from './useScorecardController.ts?raw';

describe('editable input draft helpers', () => {
  it('parses commit-ready integer drafts without treating blank Backspace drafts as zero or fallback', () => {
    expect(parseEditableIntegerDraft('')).toBeNull();
    expect(parseEditableIntegerDraft('   ')).toBeNull();
    expect(parseEditableIntegerDraft('-')).toBeNull();
    expect(parseEditableIntegerDraft('09')).toBe(9);
    expect(parseEditableIntegerDraft('-3')).toBe(-3);
  });

  it('keeps persisted numeric inputs on local draft state so Backspace can clear the visible field', () => {
    expect(appSource).toContain('const [holeCountDraft, setHoleCountDraft]');
    expect(appSource).toContain('const [playerHandicapDrafts, setPlayerHandicapDrafts]');
    expect(appSource).toContain('const [gameUnitDrafts, setGameUnitDrafts]');
    expect(appSource).toContain('value={holeCountDraft ?? round.settings.holeCount.toString()}');
    expect(appSource).toContain("value={gameUnitInputValue(game, 'points')}");
    expect(appSource).toContain('value={playerHandicapInputValue(player.id, player.handicap)}');
    expect(appSource).not.toContain('parseIntegerDraft(event.currentTarget.value, player.handicap)');
    expect(appSource).not.toContain('parseIntegerDraft(event.currentTarget.value, round.gameUnits[game].points)');
    expect(appSource).not.toContain('parseIntegerDraft(event.currentTarget.value, round.settings.holeCount)');
  });

  it('resets local editable round drafts to blank values instead of sample labels', () => {
    expect(appSource).toContain('const restoredLabels = initialShareLabels();');
    expect(appSource).toContain('const [roundName, setRoundName] = useState(() => restoredLabels.roundName)');
    expect(appSource).toContain('const [courseName, setCourseName] = useState(() => restoredLabels.courseName)');
    expect(appSource).toContain('useScorecardController({');
    expect(appSource).toContain('session.updateHoleSetup');
    expect(scorecardControllerSource).toContain("const [currentHoleDraft, setCurrentHoleDraft] = useState('')");
    expect(scorecardControllerSource).toContain('const [parDraftsByHole, setParDraftsByHole]');
    expect(scorecardControllerSource).toContain('const [scoreDrafts, setScoreDrafts]');
    expect(scorecardControllerSource).toContain('updateHoleSetup(targetHoleNumber, { par })');
    expect(scorecardControllerSource).toContain('function resetScorecardDrafts()');
    expect(scorecardControllerSource).toContain("setCurrentHoleDraft('')");
    expect(scorecardControllerSource).toContain('setParDraftsByHole({})');
    expect(scorecardControllerSource).toContain('setScoreDrafts({})');
    expect(appSource).not.toContain('const [backdoorOpenByHole, setBackdoorOpenByHole]');
    expect(appSource).toContain('function resetEditableRound()');
    expect(appSource).toContain("setRoundName('')");
    expect(appSource).toContain("setCourseName('')");
    expect(appSource).toContain('resetScorecardDrafts();');
    expect(appSource).not.toContain('setBackdoorOpenByHole({})');
    expect(appSource).toContain("setHoleCountDraft('')");
    expect(appSource).toContain('onClick={() => resetEditableRound()}');
    expect(appSource).not.toContain("useState('금요 새벽 라운드')");
    expect(appSource).not.toContain("useState('남서울 · OUT')");
    expect(appSource).toContain('function displayPlayerName(name: string');
    expect(appSource).toContain('return name.trim();');
    expect(appSource).not.toContain('`플레이어 ${index + 1}`');
  });

  it('renders a front/back scorecard matrix before the selected-hole controls', () => {
    expect(appSource).toContain('<ScorecardGrid');
    expect(scorecardGridSource).toContain('className="scorecard-matrix"');
    expect(scorecardGridSource).toContain('aria-label="전후반 스코어카드 전체표"');
    expect(scorecardGridSource).toContain('scorecard-par-row');
    expect(scorecardGridSource).toContain('scorecard-backdoor-row');
    expect(scorecardGridSource).toContain('type="checkbox"');
    expect(scorecardGridSource).toContain('scorecardCellLabel(scorecardHoleNumber, player.id)');
    expect(appSource.indexOf('<ScorecardGrid')).toBeLessThan(appSource.indexOf('className="hole-toolbar"'));
  });

  it('wires bottom share actions to real local SVG export and restoreable URL-hash labels', () => {
    expect(appSource).toContain('createScorecardExportSvg({');
    expect(appSource).toContain('downloadScorecardExportSvg(scorecardExportFileName(courseName || roundName, generatedAt), exportSvg)');
    expect(appSource).toContain('createBettingRoundShareHash(round, { roundName, courseName })');
    expect(appSource).toContain('initialShareLabels()');
    expect(appSource).toContain('function updateRoundName(value: string)');
    expect(appSource).toContain('function updateRoundSetupDraft');
    expect(appSource).toContain('function toggleGameEnabled(game: BettingGameKey)');
    expect(scorecardExportSource).toContain('export function createScorecardExportSvg');
    expect(scorecardExportSource).toContain('new Intl.DateTimeFormat');
  });
});
