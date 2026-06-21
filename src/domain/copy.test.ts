import { describe, expect, it } from 'vitest';
import copySource from './copy.ts?raw';
import {
  approximateDistanceCopy,
  nonGoals,
  privacyNotes,
  productPrinciples,
} from './copy';

const commandLikeCopyPattern = /\b(coach|caddie|caddy|must|should|need to|try to|take|hit|aim|choose|use|recommend)\b/i;

describe('foundation product copy', () => {
  it('keeps approximate distance boundary copy available without notice-style wording', () => {
    expect(approximateDistanceCopy).toMatch(/approximate practice estimates/i);
    expect(approximateDistanceCopy).not.toMatch(/official|rangefinder|safety-critical|disclaimer|legal notice/i);
  });

  it('keeps exported product copy naming free of disclaimer and notice surfaces', () => {
    expect(copySource).toMatch(/approximateDistanceCopy/);
    expect(copySource).not.toMatch(/Disclaimer|LegalNotice|legal notice|disclaimer/i);
  });

  it('documents local-only privacy boundaries without shared persistence promises', () => {
    expect(privacyNotes.join(' ')).toMatch(/local device storage/i);
    expect(privacyNotes.join(' ')).toMatch(/does not create remote accounts or transmit player context/i);
    expect(privacyNotes.join(' ')).not.toMatch(/invite-link|shared persistence|backend storage|\bshould\b/i);
  });

  it('locks MVP non-goals out of the foundation scope', () => {
    expect(nonGoals.join(' ')).toMatch(/No scorecards/i);
    expect(nonGoals.join(' ')).toMatch(/No scorecards, betting, public social feed/i);
    expect(productPrinciples.join(' ')).toMatch(/Manual scenario inputs/i);
    const joinedCopy = [...productPrinciples, ...nonGoals, ...privacyNotes, approximateDistanceCopy].join(' ');

    expect(joinedCopy).not.toMatch(/official|rangefinder|safety-critical|disclaimer|legal notice/i);
    expect(joinedCopy).not.toMatch(commandLikeCopyPattern);
  });
});
