import { describe, expect, it } from 'vitest';
import readmeSource from '../../README.md?raw';
import copySource from './copy.ts?raw';
import {
  approximateDistanceCopy,
  nonGoals,
  privacyNotes,
  productPrinciples,
} from './copy';

const commandLikeCopyPattern = /\b(coach|must|should|need to|try to|take this|hit this|aim at|choose this|use this)\b|반드시|해야|보장|정확|코치/i;
const staleMiniCardPattern = /2D 미니카드|미니카드|mini-card|visual-card|visualCards|조준과 라이 미니카드|2D 보조/i;

describe('foundation product copy', () => {
  it('keeps approximate distance boundary copy available without notice-style wording', () => {
    expect(approximateDistanceCopy).toMatch(/근사|연습|추정/);
    expect(approximateDistanceCopy).not.toMatch(/official|rangefinder|safety-critical|disclaimer|legal notice|공식|거리측정기|면책|법적 고지|안전 필수/i);
  });

  it('keeps exported product copy naming free of disclaimer and notice surfaces', () => {
    expect(copySource).toMatch(/approximateDistanceCopy/);
    expect(copySource).not.toMatch(/Disclaimer|LegalNotice|legal notice|disclaimer/i);
  });

  it('documents local-only privacy boundaries without shared persistence promises', () => {
    expect(privacyNotes.join(' ')).toMatch(/로컬 기기 저장소/);
    expect(privacyNotes.join(' ')).toMatch(/원격 계정.*플레이어 맥락을 전송하지/);
    expect(privacyNotes.join(' ')).not.toMatch(/invite-link|shared persistence|backend storage|\bshould\b|초대 링크|공유 저장|백엔드 저장|해야/i);
  });

  it('locks MVP non-goals out of the foundation scope', () => {
    expect(nonGoals.join(' ')).toMatch(/스코어카드/);
    expect(nonGoals.join(' ')).toMatch(/스코어카드, 베팅, 공개 소셜 피드/);
    expect(productPrinciples.join(' ')).toMatch(/남은 거리, 라이, 앞뒤 경사, 공 위치 높이, 바람, 핀/);
    const joinedCopy = [...productPrinciples, ...nonGoals, ...privacyNotes, approximateDistanceCopy].join(' ');

    expect(joinedCopy).not.toMatch(/official|rangefinder|safety-critical|disclaimer|legal notice|공식|거리측정기|면책|법적 고지|안전 필수/i);
    expect(joinedCopy).not.toMatch(commandLikeCopyPattern);
    expect(joinedCopy).not.toMatch(staleMiniCardPattern);
  });

  it('keeps docs and product copy on the reactive 2D shot/stance visual terminology', () => {
    const docsAndCopy = `${readmeSource}\n${copySource}\n${productPrinciples.join(' ')}`;

    expect(docsAndCopy).toMatch(/reactive 2D shot\/stance visual|반응형 2D 샷\/스탠스 비주얼/);
    expect(docsAndCopy).not.toMatch(/추천:|추천 요약|짧은 이유|static shot dashboard|정적 샷 대시보드|2D mini cards|2D aim\/lie mini cards|미니카드|경사\/스탠스|좌우 경사|발끝 오르막|발끝 내리막|좌측 경사|우측 경사/);
  });
});
