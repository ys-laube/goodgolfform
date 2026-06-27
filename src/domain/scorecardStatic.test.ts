import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { App } from '../App';

const forbiddenRuntimeConcepts = ['오장', '정산', '타당 금액', '배판', '니어', 'QR', '공유 링크', 'GPS', '날씨', '캐디 추천', '클럽 거리'];

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function runtimeSourceFiles(directory: string): readonly string[] {
  return readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    const absolutePath = join(process.cwd(), path);
    if (statSync(absolutePath).isDirectory()) {
      return runtimeSourceFiles(path);
    }
    if (!/\.(ts|tsx|css)$/.test(path) || /\.test\.tsx?$/.test(path) || path.endsWith('vitest-node.d.ts')) {
      return [];
    }
    return [path];
  });
}

describe('simple scorecard static guardrails', () => {
  it('SSR renders the Korean scorecard concepts without browser globals', () => {
    const html = renderToString(React.createElement(App));

    expect(html).toContain('오늘 폼 정말 좋으시네요 ^0^');
    expect(html).toContain('스코어카드');
    expect(html).toContain('홀 메모');
    expect(html).toContain('온');
    expect(html).toContain('펏');
    expect(html).toContain('라운드 리뷰');
    expect(html).toContain('이미지 저장');
    expect(html).toContain('스코어카드 저장');
    expect(html).not.toContain('스코어카드 PNG 저장');
  });

  it('index metadata describes the simple scorecard product', () => {
    const indexHtml = readRepoFile('index.html');
    expect(indexHtml).toContain('골프 스코어카드');
    expect(indexHtml).toContain('온·펏');
    expect(indexHtml).not.toContain('오장');
    expect(indexHtml).not.toContain('정산');
  });

  it('runtime source and public docs keep retired concepts out', () => {
    const sources = ['README.md', 'DESIGN.md', 'index.html', ...runtimeSourceFiles('src')].map(readRepoFile).join('\n');

    for (const forbidden of forbiddenRuntimeConcepts) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('keeps each nine-hole scorecard half inside the available width', () => {
    const scorecardCss = readRepoFile('src/scorecard.css');

    expect(scorecardCss).toContain('repeat(9, minmax(0, 1fr))');
    expect(scorecardCss).toContain('width: 100%');
    expect(scorecardCss).not.toContain('min-width: max-content');
  });

  it('keeps compact mobile scorecard labels centered and par inputs visible', () => {
    const scorecardCss = readRepoFile('src/scorecard.css');

    expect(scorecardCss).toContain(`.scorecard-header-row .scorecard-row-label,
.scorecard-par-row .scorecard-row-label`);
    expect(scorecardCss).toContain('justify-content: center');
    expect(scorecardCss).toContain('text-align: center');
    expect(scorecardCss).toContain('min-width: 0');
    expect(scorecardCss).toContain('padding: 0');
  });

  it('keeps mobile on-putt choice buttons in two balanced rows of three', () => {
    const styles = readRepoFile('src/styles.css');

    expect(styles).toContain('grid-template-columns: 2.2rem repeat(3, minmax(2.75rem, 1fr))');
    expect(styles).toContain('grid-row: 1 / span 2');
    expect(styles).toContain('.choice-chip');
    expect(styles).toContain('width: 100%');
  });

  it('uses the scorecard storage key and does not reference the old ledger key in runtime source', () => {
    const runtime = ['src/domain/scorecardStorage.ts', 'src/useScorecardSession.ts', 'src/App.tsx'].map(readRepoFile).join('\n');
    expect(runtime).toContain('fungolf-scorecard:active-round');
    expect(runtime).not.toContain('golf-bet-ledger');
  });
});
