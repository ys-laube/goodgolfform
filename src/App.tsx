import { useMemo, useState, type CSSProperties } from 'react';

type PlayerId = 'minjun' | 'seoyeon' | 'taeo' | 'jian';

type Player = {
  readonly id: PlayerId;
  readonly name: string;
  readonly handicap: number;
  readonly team: '청팀' | '백팀';
  readonly tone: string;
};

type StrokeDrafts = Record<PlayerId, string>;
type PlayerMoneyMap = Record<PlayerId, number>;

type CalculationLine = {
  readonly label: string;
  readonly detail: string;
  readonly amount: number;
};

type Transfer = {
  readonly from: Player;
  readonly to: Player;
  readonly amount: number;
};

const players: readonly Player[] = [
  { id: 'minjun', name: '민준', handicap: 8, team: '청팀', tone: '#4f8cff' },
  { id: 'seoyeon', name: '서연', handicap: 14, team: '백팀', tone: '#ff8aab' },
  { id: 'taeo', name: '태오', handicap: 4, team: '청팀', tone: '#6ee7b7' },
  { id: 'jian', name: '지안', handicap: 18, team: '백팀', tone: '#fbbf24' },
] as const;

const initialStrokeDrafts: StrokeDrafts = {
  minjun: '5',
  seoyeon: '4',
  taeo: '5',
  jian: '6',
};

const playerById = Object.fromEntries(players.map((player) => [player.id, player])) as Record<PlayerId, Player>;
const currencyFormatter = new Intl.NumberFormat('ko-KR');

function parseDraft(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function moneyLabel(amount: number): string {
  if (amount === 0) {
    return '₩0';
  }

  return `${amount > 0 ? '+' : '-'}₩${currencyFormatter.format(Math.abs(amount))}`;
}

function addAmount(map: PlayerMoneyMap, playerId: PlayerId, amount: number) {
  map[playerId] += amount;
}

function createEmptyMoneyMap(): PlayerMoneyMap {
  return {
    minjun: 0,
    seoyeon: 0,
    taeo: 0,
    jian: 0,
  };
}

function calculateTransfers(balanceByPlayer: PlayerMoneyMap): readonly Transfer[] {
  const debtors = players
    .map((player) => ({ player, amount: Math.max(0, -balanceByPlayer[player.id]) }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const creditors = players
    .map((player) => ({ player, amount: Math.max(0, balanceByPlayer[player.id]) }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({ from: debtor.player, to: creditor.player, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }

    if (creditor.amount === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

export function App() {
  const [roundName, setRoundName] = useState('금요 새벽 라운드');
  const [courseName, setCourseName] = useState('남서울 · OUT');
  const [currentHoleDraft, setCurrentHoleDraft] = useState('7');
  const [parDraft, setParDraft] = useState('4');
  const [strokeDrafts, setStrokeDrafts] = useState<StrokeDrafts>(initialStrokeDrafts);
  const [skinWinnerId, setSkinWinnerId] = useState<PlayerId>('seoyeon');
  const [missionPlayerId, setMissionPlayerId] = useState<PlayerId>('minjun');
  const [missionCleared, setMissionCleared] = useState(true);
  const [shareReady, setShareReady] = useState(false);

  const holeNumber = parseDraft(currentHoleDraft, 7);
  const holePar = parseDraft(parDraft, 4);
  const settlement = useMemo(() => {
    const balanceByPlayer = createEmptyMoneyMap();
    const calculationLines: CalculationLine[] = [];
    const netScores = players.map((player) => {
      const gross = parseDraft(strokeDrafts[player.id], holePar + 1);
      const handicapStroke = player.handicap >= holeNumber ? 1 : 0;
      const net = Math.max(1, gross - handicapStroke);
      const strokeAmount = (holePar - net) * 1_000;

      addAmount(balanceByPlayer, player.id, strokeAmount);

      return { player, gross, handicapStroke, net, strokeAmount };
    });

    const skinWinner = playerById[skinWinnerId];
    const skinPrize = 2_000 * (players.length - 1);
    players.forEach((player) => addAmount(balanceByPlayer, player.id, player.id === skinWinnerId ? skinPrize : -2_000));
    calculationLines.push({
      label: '스킨스',
      detail: `${skinWinner.name} 단독 승 · 기본 2,000원 × ${players.length - 1}`,
      amount: skinPrize,
    });

    const teamTotals = players.reduce<Record<Player['team'], number>>(
      (totals, player) => {
        const score = netScores.find((entry) => entry.player.id === player.id)?.net ?? holePar;
        totals[player.team] += score;
        return totals;
      },
      { 청팀: 0, 백팀: 0 },
    );
    const teamDifference = Math.abs(teamTotals.청팀 - teamTotals.백팀);
    const vegasAmount = teamDifference * 1_500;
    const winningTeam: Player['team'] = teamTotals.청팀 <= teamTotals.백팀 ? '청팀' : '백팀';

    players.forEach((player) => addAmount(balanceByPlayer, player.id, player.team === winningTeam ? vegasAmount / 2 : -vegasAmount / 2));
    calculationLines.push({
      label: '팀 베가스',
      detail: `${winningTeam} ${teamDifference}타 우세 · 팀당 ${currencyFormatter.format(vegasAmount)}원`,
      amount: vegasAmount,
    });

    if (missionCleared) {
      const missionPrize = 3_000;
      const splitPenalty = missionPrize / (players.length - 1);
      players.forEach((player) => addAmount(balanceByPlayer, player.id, player.id === missionPlayerId ? missionPrize : -splitPenalty));
      calculationLines.push({
        label: '고정 미션',
        detail: `${playerById[missionPlayerId].name} 니어 핀 성공 · 나머지 균등 정산`,
        amount: missionPrize,
      });
    } else {
      calculationLines.push({
        label: '고정 미션',
        detail: '이번 홀 성공자 없음 · 다음 홀로 이월',
        amount: 0,
      });
    }

    netScores.forEach((entry) => {
      calculationLines.unshift({
        label: `${entry.player.name} 스트로크`,
        detail: `${entry.gross}타 - 핸디 ${entry.handicapStroke} = 네트 ${entry.net}타`,
        amount: entry.strokeAmount,
      });
    });

    const sortedBalances = [...players]
      .map((player) => ({ player, amount: Math.round(balanceByPlayer[player.id]) }))
      .sort((a, b) => b.amount - a.amount);

    return {
      balanceByPlayer,
      calculationLines,
      netScores,
      sortedBalances,
      transfers: calculateTransfers(balanceByPlayer),
      winningTeam,
    };
  }, [holeNumber, holePar, missionCleared, missionPlayerId, skinWinnerId, strokeDrafts]);

  const shareCopy = `${roundName} ${holeNumber}H 정산 · ${settlement.sortedBalances
    .map((entry) => `${entry.player.name} ${moneyLabel(entry.amount)}`)
    .join(' / ')}`;

  function updateStrokeDraft(playerId: PlayerId, value: string) {
    setStrokeDrafts((current) => ({ ...current, [playerId]: value }));
    setShareReady(false);
  }

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">FunGolf Ledger</p>
          <h1 id="app-title">한국형 골프 내기 정산</h1>
          <p>
            라운드 세팅부터 홀 입력, 미션, 순정산, 공유 카드까지 한 화면에서 확인하는 모바일 우선 베팅 장부입니다.
          </p>
        </div>
        <div className="hero-metric" aria-label="현재 1위">
          <span>현재 리더</span>
          <strong>{settlement.sortedBalances[0]?.player.name}</strong>
          <em>{moneyLabel(settlement.sortedBalances[0]?.amount ?? 0)}</em>
        </div>
      </section>

      <section className="control-panel" aria-labelledby="setup-title">
        <div className="section-heading">
          <p className="eyebrow">라운드 세팅</p>
          <h2 id="setup-title">플레이어와 내기 룰</h2>
          <p>로컬 화면에서만 쓰는 입력값입니다. 팀, 핸디, 스킨스, 팀 베가스, 고정 미션을 함께 보여줍니다.</p>
        </div>

        <div className="setup-grid">
          <label>
            라운드 이름
            <input value={roundName} onChange={(event) => setRoundName(event.currentTarget.value)} />
          </label>
          <label>
            코스 / 티
            <input value={courseName} onChange={(event) => setCourseName(event.currentTarget.value)} />
          </label>
        </div>

        <div className="player-strip" aria-label="플레이어와 핸디캡">
          {players.map((player) => (
            <article className="player-chip" key={player.id} style={{ '--player-tone': player.tone } as CSSProperties}>
              <span>{player.team}</span>
              <strong>{player.name}</strong>
              <em>핸디 {player.handicap}</em>
            </article>
          ))}
        </div>

        <div className="game-stack" aria-label="내기 게임 구성">
          <article>
            <span>스트로크</span>
            <strong>네트 파 기준 ±1,000원</strong>
          </article>
          <article>
            <span>스킨스</span>
            <strong>홀 단독 승 2,000원</strong>
          </article>
          <article>
            <span>팀 베가스</span>
            <strong>청팀 vs 백팀 · 차이당 1,500원</strong>
          </article>
        </div>
      </section>

      <section className="control-panel hole-panel" aria-labelledby="hole-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">홀 입력</p>
          <h2 id="hole-title">{holeNumber}번 홀 스코어</h2>
        </div>

        <div className="hole-toolbar">
          <label>
            홀
            <input inputMode="numeric" value={currentHoleDraft} onChange={(event) => setCurrentHoleDraft(event.currentTarget.value)} />
          </label>
          <label>
            파
            <input inputMode="numeric" value={parDraft} onChange={(event) => setParDraft(event.currentTarget.value)} />
          </label>
          <label>
            스킨 승자
            <select value={skinWinnerId} onChange={(event) => setSkinWinnerId(event.currentTarget.value as PlayerId)}>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="score-list" aria-label="홀별 타수 입력">
          {settlement.netScores.map((entry) => (
            <label className="score-row" key={entry.player.id}>
              <span>
                <strong>{entry.player.name}</strong>
                <em>
                  {entry.player.team} · 핸디 보정 {entry.handicapStroke}
                </em>
              </span>
              <input
                inputMode="numeric"
                value={strokeDrafts[entry.player.id]}
                onChange={(event) => updateStrokeDraft(entry.player.id, event.currentTarget.value)}
                aria-label={`${entry.player.name} 타수`}
              />
              <b>{moneyLabel(entry.strokeAmount)}</b>
            </label>
          ))}
        </div>
      </section>

      <section className="mission-card" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">미션 카드</p>
          <h2 id="mission-title">니어 핀 챌린지</h2>
          <p>고정 미션 3,000원. 성공자는 보너스를 받고 나머지는 균등 부담합니다.</p>
        </div>
        <div className="mission-controls">
          <label>
            성공자
            <select value={missionPlayerId} onChange={(event) => setMissionPlayerId(event.currentTarget.value as PlayerId)}>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <button className={missionCleared ? 'toggle-action active' : 'toggle-action'} type="button" onClick={() => setMissionCleared((value) => !value)}>
            {missionCleared ? '성공 반영됨' : '이월 처리'}
          </button>
        </div>
      </section>

      <section className="ledger-grid" aria-label="실시간 정산 대시보드">
        <article className="ledger-card settlement-card">
          <div className="section-heading compact-heading">
            <p className="eyebrow">실시간 장부</p>
            <h2>순정산</h2>
          </div>
          <div className="balance-list">
            {settlement.sortedBalances.map((entry) => (
              <div className="balance-row" key={entry.player.id}>
                <span>
                  <strong>{entry.player.name}</strong>
                  <em>{entry.player.team}</em>
                </span>
                <b className={entry.amount >= 0 ? 'positive' : 'negative'}>{moneyLabel(entry.amount)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="ledger-card transfer-card">
          <div className="section-heading compact-heading">
            <p className="eyebrow">정산 보드</p>
            <h2>보낼 금액</h2>
          </div>
          <div className="transfer-list">
            {settlement.transfers.map((transfer) => (
              <p key={`${transfer.from.id}-${transfer.to.id}-${transfer.amount}`}>
                <strong>{transfer.from.name}</strong>
                <span>→</span>
                <strong>{transfer.to.name}</strong>
                <b>₩{currencyFormatter.format(transfer.amount)}</b>
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="calculation-card" aria-labelledby="calculation-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">계산 내역</p>
          <h2 id="calculation-title">{settlement.winningTeam} 우세 흐름</h2>
        </div>
        <div className="calculation-list">
          {settlement.calculationLines.map((line) => (
            <article key={`${line.label}-${line.detail}`}>
              <span>{line.label}</span>
              <strong>{line.detail}</strong>
              <b className={line.amount >= 0 ? 'positive' : 'negative'}>{moneyLabel(line.amount)}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="share-card" aria-labelledby="share-title">
        <div>
          <p className="eyebrow">공유 카드</p>
          <h2 id="share-title">{courseName}</h2>
          <p>{shareCopy}</p>
        </div>
        <button className="primary-action" type="button" onClick={() => setShareReady(true)}>
          공유 문구 준비
        </button>
        <p className="share-status" aria-live="polite">
          {shareReady ? '카카오톡이나 문자에 붙여넣기 좋은 요약이 준비되었습니다.' : '버튼을 누르면 현재 홀 정산 요약을 카드 형태로 고정합니다.'}
        </p>
      </section>
    </main>
  );
}
