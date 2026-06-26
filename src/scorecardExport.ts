import { displayPlayerName, relativeScoreLabel, type ScorecardRoundView } from './domain/scorecard';

export type ScorecardExportInput = {
  readonly roundName: string;
  readonly courseName: string;
  readonly generatedAt: string;
  readonly view: ScorecardRoundView;
};

const cellWidth = 78;
const rowHeight = 52;
const labelWidth = 140;
const horizontalPadding = 34;
const topHeaderHeight = 154;
const memoRowHeight = 34;
const bottomPadding = 42;
const svgNamespace = 'http' + '://www.w3.org/2000/svg';

export function createScorecardExportSvg(input: ScorecardExportInput): string {
  const width = horizontalPadding * 2 + labelWidth + cellWidth * input.view.holes.length;
  const memoHeight = Math.max(0, input.view.memoHighlights.length) * memoRowHeight + (input.view.memoHighlights.length ? 42 : 0);
  const height = topHeaderHeight + rowHeight * (2 + input.view.players.length) + memoHeight + bottomPadding;
  const title = input.courseName.trim() || input.roundName.trim() || '골프 스코어카드';
  const subtitle = [input.roundName.trim(), scoreSummaryText(input.view)].filter(Boolean).join(' · ') || '필드 기록 저장용 이미지';
  const generatedAt = formatExportTimestamp(input.generatedAt);
  const headerRowY = topHeaderHeight;
  const parRowY = headerRowY + rowHeight;
  const playerStartY = parRowY + rowHeight;
  const memoStartY = playerStartY + rowHeight * input.view.players.length + 28;

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} 스코어카드">`,
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#14532d"/></linearGradient>',
    '<style><![CDATA[text{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif}.label{font-size:16px;font-weight:850;fill:#f8fafc}.small{font-size:13px;font-weight:700;fill:#cbd5e1}.cell-main{font-size:18px;font-weight:950}.cell-sub{font-size:11px;font-weight:750}.memo{font-size:14px;font-weight:700;fill:#e2e8f0}]]></style>',
    '</defs>',
    '<rect width="100%" height="100%" rx="28" fill="url(#bg)"/>',
    `<text x="${horizontalPadding}" y="48" class="small">스코어카드 · 홀 메모 포함 · 로컬 이미지 저장</text>`,
    `<text x="${horizontalPadding}" y="88" font-size="30" font-weight="950" fill="#ffffff">${escapeXml(title)}</text>`,
    `<text x="${horizontalPadding}" y="120" class="small">${escapeXml(subtitle)}</text>`,
    `<text x="${width - horizontalPadding}" y="48" text-anchor="end" class="small">${escapeXml(generatedAt)}</text>`,
    renderRow('홀', input.view.holes.map((hole) => ({ main: `${hole.holeNumber}H`, sub: '' })), headerRowY, true),
    renderRow('파', input.view.holes.map((hole) => ({ main: `${hole.par}`, sub: '' })), parRowY, false),
    ...input.view.players.map((player, index) =>
      renderRow(
        displayPlayerName(player, index),
        input.view.holes.map((hole) => {
          const cell = hole.cells.find((candidate) => candidate.playerId === player.id);
          return { main: cell?.main ?? '—', sub: cell?.sub ?? '' };
        }),
        playerStartY + rowHeight * index,
        false,
      ),
    ),
    ...renderMemoRows(input.view, memoStartY),
    '</svg>',
  ].join('');
}

export function downloadScorecardExportSvg(fileName: string, svg: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function scorecardExportFileName(courseName: string, generatedAt: string): string {
  const baseName = (courseName.trim() || 'fungolf-scorecard')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'fungolf-scorecard';
  const dateStamp = generatedAt.slice(0, 10) || 'local';

  return `${baseName}-${dateStamp}.svg`;
}

function renderRow(label: string, values: readonly { readonly main: string; readonly sub: string }[], y: number, header: boolean): string {
  const cells = values.map((value, index) => renderCell(value.main, value.sub, horizontalPadding + labelWidth + cellWidth * index, y, header));

  return [
    `<rect x="${horizontalPadding}" y="${y}" width="${labelWidth - 10}" height="${rowHeight - 8}" rx="14" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)"/>`,
    `<text x="${horizontalPadding + 14}" y="${y + 30}" class="label">${escapeXml(label)}</text>`,
    ...cells,
  ].join('');
}

function renderCell(main: string, sub: string, x: number, y: number, header: boolean): string {
  const fill = header ? '#ffffff' : 'rgba(255,255,255,0.08)';
  const mainFill = header ? '#101828' : '#f8fafc';
  const subFill = header ? '#334155' : '#cbd5e1';
  return [
    `<rect x="${x}" y="${y}" width="${cellWidth - 8}" height="${rowHeight - 8}" rx="14" fill="${fill}" stroke="rgba(255,255,255,0.16)"/>`,
    `<text x="${x + (cellWidth - 8) / 2}" y="${y + (sub ? 24 : 30)}" text-anchor="middle" class="cell-main" fill="${mainFill}">${escapeXml(main)}</text>`,
    sub ? `<text x="${x + (cellWidth - 8) / 2}" y="${y + 40}" text-anchor="middle" class="cell-sub" fill="${subFill}">${escapeXml(sub)}</text>` : '',
  ].join('');
}

function renderMemoRows(view: ScorecardRoundView, y: number): readonly string[] {
  if (view.memoHighlights.length === 0) {
    return [];
  }

  return [
    `<text x="${horizontalPadding}" y="${y}" class="label">홀 메모</text>`,
    ...view.memoHighlights.map((memo, index) => {
      const rowY = y + 28 + memoRowHeight * index;
      return `<text x="${horizontalPadding}" y="${rowY}" class="memo">${escapeXml(`${memo.holeNumber}H · ${memo.memo}`)}</text>`;
    }),
  ];
}

function scoreSummaryText(view: ScorecardRoundView): string {
  const firstReview = view.reviews[0];
  if (!firstReview || firstReview.completedHoles === 0) {
    return '기록 전';
  }
  return `${firstReview.completedHoles}홀 ${relativeScoreLabel(firstReview.totalRelative)}`;
}

function formatExportTimestamp(value: string): string {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(parsed);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
