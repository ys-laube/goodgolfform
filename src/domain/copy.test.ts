import { describe, expect, it } from 'vitest';
import {
  approximateDistanceDisclaimer,
  nonGoals,
  privacyNotes,
  productPrinciples,
} from './copy';

describe('foundation product copy', () => {
  it('keeps approximate distance boundary copy available without disclaimer-style wording', () => {
    expect(approximateDistanceDisclaimer).toMatch(/approximate practice estimates/i);
    expect(approximateDistanceDisclaimer).not.toMatch(/official|rangefinder|safety-critical|disclaimer|legal notice/i);
  });

  it('documents privacy and deferred shared persistence boundaries', () => {
    expect(privacyNotes.join(' ')).toMatch(/invite-link rooms/i);
    expect(privacyNotes.join(' ')).toMatch(/does not implement backend storage/i);
  });

  it('locks MVP non-goals out of the foundation scope', () => {
    expect(nonGoals.join(' ')).toMatch(/No scorecards/i);
    expect(nonGoals.join(' ')).toMatch(/No public social feed/i);
    expect(productPrinciples.join(' ')).toMatch(/Shot pins stay playful/i);
    expect([...productPrinciples, ...nonGoals, approximateDistanceDisclaimer].join(' ')).not.toMatch(
      /official|rangefinder|safety-critical|disclaimer|legal notice/i,
    );
  });
});
