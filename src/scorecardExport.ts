import { displayPlayerName, relativeScoreLabel, scoreTypeLabel, type ScorecardRoundView } from './domain/scorecard';

export type ScorecardExportInput = {
  readonly roundName: string;
  readonly courseName: string;
  readonly generatedAt: string;
  readonly view: ScorecardRoundView;
};

export type ScorecardExportSaveResult =
  | { readonly ok: true; readonly method: 'photo-menu' | 'download' }
  | { readonly ok: false; readonly reason: 'browser-unavailable' | 'conversion-failed' | 'share-cancelled' };

export type ScorecardExportShareResult =
  | { readonly ok: true; readonly method: 'photo-menu' }
  | { readonly ok: false; readonly reason: 'browser-unavailable' | 'share-unavailable' | 'share-cancelled' | 'share-failed' };

const cellWidth = 78;
const rowHeight = 52;
const labelWidth = 140;
const horizontalPadding = 34;
const topHeaderHeight = 136;
const reviewSectionTitleHeight = 38;
const reviewCardHeight = 92;
const memoSectionTitleHeight = 40;
const memoRowHeight = 28;
const memoWrapLength = 82;
const bottomPadding = 42;
const svgNamespace = 'http' + '://www.w3.org/2000/svg';
const pngMimeType = 'image/png';

export function createScorecardExportSvg(input: ScorecardExportInput): string {
  const width = horizontalPadding * 2 + labelWidth + cellWidth * input.view.holes.length;
  const scorecardHeight = rowHeight * (2 + input.view.players.length);
  const reviewHeight = reviewSectionTitleHeight + input.view.reviews.length * reviewCardHeight;
  const memoLines = memoTextLines(input.view);
  const memoHeight = memoLines.length ? memoSectionTitleHeight + memoLines.length * memoRowHeight : 0;
  const height = topHeaderHeight + scorecardHeight + reviewHeight + memoHeight + bottomPadding + 30;
  const title = input.courseName.trim() || input.roundName.trim() || '골프 스코어카드';
  const subtitle = [input.roundName.trim(), scoreSummaryText(input.view)].filter(Boolean).join(' · ') || '필드 기록 저장용 이미지';
  const generatedAt = formatExportTimestamp(input.generatedAt);
  const headerRowY = topHeaderHeight;
  const parRowY = headerRowY + rowHeight;
  const playerStartY = parRowY + rowHeight;
  const reviewStartY = playerStartY + rowHeight * input.view.players.length + 32;
  const memoStartY = reviewStartY + reviewHeight + (memoLines.length ? 18 : 0);

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} 스코어카드">`,
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#14532d"/></linearGradient>',
    '<style><![CDATA[text{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif}.label{font-size:16px;font-weight:850;fill:#f8fafc}.small{font-size:13px;font-weight:700;fill:#cbd5e1}.cell-main{font-size:18px;font-weight:950}.cell-sub{font-size:11px;font-weight:750}.memo{font-size:14px;font-weight:700;fill:#e2e8f0}.review-name{font-size:18px;font-weight:900;fill:#ffffff}.review-score{font-size:28px;font-weight:950;fill:#ffffff}.review-line{font-size:14px;font-weight:750;fill:#dbeafe}]]></style>',
    '</defs>',
    '<rect width="100%" height="100%" rx="28" fill="url(#bg)"/>',
    `<text x="${horizontalPadding}" y="58" font-size="30" font-weight="950" fill="#ffffff">${escapeXml(title)}</text>`,
    `<text x="${horizontalPadding}" y="90" class="small">${escapeXml(subtitle)}</text>`,
    `<text x="${width - horizontalPadding}" y="58" text-anchor="end" class="small">${escapeXml(generatedAt)}</text>`,
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
    ...renderReviewRows(input.view, reviewStartY, width),
    ...renderMemoRows(memoLines, memoStartY),
    '</svg>',
  ].join('');
}

export async function createScorecardExportPngBlob(svg: string): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  return svgToPngBlob(svg);
}

export async function shareScorecardExportPng(fileName: string, blob: Blob): Promise<ScorecardExportShareResult> {
  if (typeof File === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, reason: 'browser-unavailable' };
  }

  const file = new File([blob], fileName, { type: pngMimeType });
  if (!canOpenPhotoSaveMenu(navigator, file)) {
    return { ok: false, reason: 'share-unavailable' };
  }

  try {
    await navigator.share({ files: [file], title: '스코어카드 사진' });
    return { ok: true, method: 'photo-menu' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, reason: 'share-cancelled' };
    }
    return { ok: false, reason: 'share-failed' };
  }
}

export function downloadScorecardExportPng(fileName: string, blob: Blob): void {
  downloadBlob(fileName, blob);
}

export async function saveScorecardExportPng(fileName: string, svg: string): Promise<ScorecardExportSaveResult> {
  const blob = await createScorecardExportPngBlob(svg);
  if (!blob) {
    return { ok: false, reason: 'conversion-failed' };
  }

  const shareResult = await shareScorecardExportPng(fileName, blob);
  if (shareResult.ok) {
    return { ok: true, method: 'photo-menu' };
  }
  if (shareResult.reason === 'share-cancelled') {
    return { ok: false, reason: 'share-cancelled' };
  }

  downloadScorecardExportPng(fileName, blob);
  return { ok: true, method: 'download' };
}

export function scorecardExportFileName(courseName: string, generatedAt: string): string {
  const baseName = (courseName.trim() || 'fungolf-scorecard')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'fungolf-scorecard';
  const dateStamp = generatedAt.slice(0, 10) || 'local';

  return `${baseName}-${dateStamp}.png`;
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

function renderReviewRows(view: ScorecardRoundView, y: number, width: number): readonly string[] {
  if (view.reviews.length === 0) {
    return [];
  }

  const cardWidth = width - horizontalPadding * 2;
  return [
    `<text x="${horizontalPadding}" y="${y}" class="label">라운드 리뷰</text>`,
    ...view.reviews.map((review, index) => {
      const rowY = y + 16 + reviewCardHeight * index;
      const scoreTypes = Object.entries(review.scoreTypeCounts)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${scoreTypeLabel(key as keyof typeof review.scoreTypeCounts)} ${value}`)
        .join(' · ') || '기록 전';
      return [
        `<rect x="${horizontalPadding}" y="${rowY}" width="${cardWidth}" height="${reviewCardHeight - 12}" rx="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.16)"/>`,
        `<text x="${horizontalPadding + 18}" y="${rowY + 30}" class="review-name">${escapeXml(displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index))}</text>`,
        `<text x="${width - horizontalPadding - 18}" y="${rowY + 34}" text-anchor="end" class="review-score">${escapeXml(review.completedHoles ? relativeScoreLabel(review.totalRelative) : '—')}</text>`,
        `<text x="${horizontalPadding + 18}" y="${rowY + 56}" class="review-line">${escapeXml(`${review.completedHoles}홀 · 총타 ${review.completedHoles ? `${review.totalStrokes}타` : '—'} · 전/후 ${relativeScoreLabel(review.frontRelative)} / ${relativeScoreLabel(review.backRelative)} · 온 평균 ${review.averageOnGreenShots ?? '—'} · 펏 평균 ${review.averagePutts ?? '—'} · 3펏 ${review.threePuttCount}회`)}</text>`,
        `<text x="${horizontalPadding + 18}" y="${rowY + 76}" class="small">${escapeXml(scoreTypes)}</text>`,
      ].join('');
    }),
  ];
}

function renderMemoRows(lines: readonly string[], y: number): readonly string[] {
  if (lines.length === 0) {
    return [];
  }

  return [
    `<text x="${horizontalPadding}" y="${y}" class="label">홀 메모</text>`,
    ...lines.map((line, index) => {
      const rowY = y + 28 + memoRowHeight * index;
      return `<text x="${horizontalPadding}" y="${rowY}" class="memo">${escapeXml(line)}</text>`;
    }),
  ];
}

function memoTextLines(view: ScorecardRoundView): readonly string[] {
  return view.memoHighlights.flatMap((memo) => wrapText(`${memo.holeNumber}H · ${memo.memo}`, memoWrapLength));
}

function wrapText(value: string, maxLength: number): readonly string[] {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return [value];
  }

  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += maxLength) {
    lines.push(characters.slice(index, index + maxLength).join(''));
  }
  return lines;
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

async function svgToPngBlob(svg: string): Promise<Blob | null> {
  const size = exportedSvgSize(svg);
  if (!size) {
    return null;
  }

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, size.width, size.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, pngMimeType, 0.96));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('scorecard export image load failed'));
    image.src = url;
  });
}

function exportedSvgSize(svg: string): { readonly width: number; readonly height: number } | null {
  const width = Number(svg.match(/<svg[^>]*\swidth="(\d+)"/)?.[1]);
  const height = Number(svg.match(/<svg[^>]*\sheight="(\d+)"/)?.[1]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null;
}

function canOpenPhotoSaveMenu(value: Navigator | null, file: File): value is Navigator & { share: (data: ShareData) => Promise<void>; canShare: (data: ShareData) => boolean } {
  if (!value || !('share' in value) || !('canShare' in value)) {
    return false;
  }

  try {
    return value.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
