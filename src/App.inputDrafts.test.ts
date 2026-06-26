import { describe, expect, it } from 'vitest';

import appSource from './App.tsx?raw';
import { parseEditableIntegerDraft } from './App';

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
});
