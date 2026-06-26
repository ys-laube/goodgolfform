export type ScorecardExportPlayer = {
  readonly name: string;
  readonly team: string;
  readonly balance: string;
};

export type ScorecardExportHole = {
  readonly holeNumber: number;
  readonly par: number;
  readonly backdoorOpen: boolean;
  readonly playerScores: readonly string[];
};

export type ScorecardExportInput = {
  readonly roundName: string;
  readonly courseName: string;
  readonly summary: string;
  readonly generatedAt: string;
  readonly players: readonly ScorecardExportPlayer[];
  readonly holes: readonly ScorecardExportHole[];
};

const cellWidth = 82;
const rowHeight = 44;
const labelWidth = 132;
const horizontalPadding = 36;
const topHeaderHeight = 150;
const bottomPadding = 34;
const svgNamespace = 'http' + '://www.w3.org/2000/svg';

export function createScorecardExportSvg(input: ScorecardExportInput): string {
  const width = horizontalPadding * 2 + labelWidth + cellWidth * input.holes.length;
  const height = topHeaderHeight + rowHeight * (3 + input.players.length) + bottomPadding;
  const title = input.courseName.trim() || input.roundName.trim() || '펀골프 스코어카드';
  const subtitle = [input.roundName.trim(), input.summary.trim()].filter(Boolean).join(' · ') || '로컬 정산 스코어카드';
  const generatedAt = formatExportTimestamp(input.generatedAt);
  const headerRowY = topHeaderHeight;
  const parRowY = headerRowY + rowHeight;
  const backdoorRowY = parRowY + rowHeight;
  const playerStartY = backdoorRowY + rowHeight;

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} 스코어카드">`,
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101828"/><stop offset="1" stop-color="#1d2939"/></linearGradient>',
    '<style><![CDATA[text{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif}.label{font-size:17px;font-weight:800;fill:#f8fafc}.small{font-size:13px;font-weight:700;fill:#cbd5e1}.cell{font-size:15px;font-weight:900}.muted{fill:#94a3b8}.balance{font-size:14px;font-weight:800;fill:#d1fadf}]]></style>',
    '</defs>',
    '<rect width="100%" height="100%" rx="28" fill="url(#bg)"/>',
    `<text x="${horizontalPadding}" y="48" class="small">펀골프 정산 장부 · 로컬 내보내기</text>`,
    `<text x="${horizontalPadding}" y="86" font-size="30" font-weight="950" fill="#ffffff">${escapeXml(title)}</text>`,
    `<text x="${horizontalPadding}" y="116" class="small">${escapeXml(subtitle)}</text>`,
    `<text x="${width - horizontalPadding}" y="48" text-anchor="end" class="small">${escapeXml(generatedAt)}</text>`,
    renderRow('홀', input.holes.map((hole) => `${hole.holeNumber}H`), headerRowY, true),
    renderRow('파', input.holes.map((hole) => `${hole.par}`), parRowY, false),
    renderRow('뒷문', input.holes.map((hole) => (hole.backdoorOpen ? '오픈' : '닫힘')), backdoorRowY, false),
    ...input.players.map((player, index) => renderRow(`${player.name} · ${player.team}`, input.holes.map((hole) => hole.playerScores[index] ?? '—'), playerStartY + rowHeight * index, false, player.balance)),
    '</svg>',
  ].join('');
}

export function scorecardExportFileName(courseName: string, generatedAt: string): string {
  const baseName = (courseName.trim() || 'fungolf-scorecard')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'fungolf-scorecard';
  const dateStamp = generatedAt.slice(0, 10) || 'local';

  return `${baseName}-${dateStamp}.svg`;
}

function renderRow(label: string, values: readonly string[], y: number, header: boolean, trailingLabel?: string): string {
  const labelText = trailingLabel ? `${label} ${trailingLabel}` : label;
  const cells = values.map((value, index) => renderCell(value, horizontalPadding + labelWidth + cellWidth * index, y, header));

  return [
    `<rect x="${horizontalPadding}" y="${y}" width="${labelWidth - 8}" height="${rowHeight - 8}" rx="13" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)"/>`,
    `<text x="${horizontalPadding + 14}" y="${y + 27}" class="label">${escapeXml(labelText)}</text>`,
    ...cells,
  ].join('');
}

function renderCell(value: string, x: number, y: number, header: boolean): string {
  return [
    `<rect x="${x}" y="${y}" width="${cellWidth - 8}" height="${rowHeight - 8}" rx="13" fill="${header ? '#ffffff' : 'rgba(255,255,255,0.08)'}" stroke="rgba(255,255,255,0.16)"/>`,
    `<text x="${x + (cellWidth - 8) / 2}" y="${y + 26}" text-anchor="middle" class="cell" fill="${header ? '#101828' : '#f8fafc'}">${escapeXml(value)}</text>`,
  ].join('');
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
