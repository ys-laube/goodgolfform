import { describe, expect, it } from 'vitest';

import appSource from './App.tsx?raw';
import { parseEditableIntegerDraft } from './inputDrafts';

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
    expect(appSource).toContain("const [roundName, setRoundName] = useState('')");
    expect(appSource).toContain("const [courseName, setCourseName] = useState('')");
    expect(appSource).toContain("const [currentHoleDraft, setCurrentHoleDraft] = useState('')");
    expect(appSource).toContain("const [parDraft, setParDraft] = useState('')");
    expect(appSource).toContain('function resetEditableRound()');
    expect(appSource).toContain("setCurrentHoleDraft('')");
    expect(appSource).toContain("setParDraft('')");
    expect(appSource).toContain("setHoleCountDraft('')");
    expect(appSource).toContain('onClick={() => resetEditableRound()}');
    expect(appSource).not.toContain("useState('금요 새벽 라운드')");
    expect(appSource).not.toContain("useState('남서울 · OUT')");
  });
});
