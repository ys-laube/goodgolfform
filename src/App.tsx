import { SwingMotionViewer } from './components/SwingMotionViewer';
import { builtInProfilePresets } from './domain/profilePresets';
import type {
  ClubKey,
  GolferLevel,
  LieCondition,
  ShotShape,
  ShotWindow,
  TempoPreference,
  TrajectoryTendency,
  WindDirection,
  WindStrength,
} from './domain/swingLabModels';
import { distanceFor, presetSummary, replaceClubDistance, useSwingLabSession } from './useSwingLabSession';

const levelOptions: readonly GolferLevel[] = ['beginner', 'developing', 'single-digit', 'scratch'];
const shotShapeOptions: readonly ShotShape[] = ['straight', 'draw', 'fade'];
const trajectoryOptions: readonly TrajectoryTendency[] = ['low', 'mid', 'high'];
const tempoOptions: readonly TempoPreference[] = ['smooth', 'neutral', 'assertive'];
const windDirections: readonly WindDirection[] = ['none', 'headwind', 'tailwind', 'left-to-right', 'right-to-left'];
const windStrengths: readonly WindStrength[] = ['calm', 'light', 'steady', 'strong'];
const lieOptions: readonly LieCondition[] = ['tee', 'fairway', 'rough', 'bunker'];
const windowOptions: readonly ShotWindow[] = ['standard', 'low', 'high'];
const editableClubKeys: readonly ClubKey[] = ['driver', '7i', 'pw'];

const levelLabels = {
  beginner: '입문',
  developing: '성장 중',
  'single-digit': '싱글 핸디캡',
  scratch: '스크래치',
} satisfies Record<GolferLevel, string>;

const shotShapeLabels = {
  straight: '스트레이트',
  draw: '드로',
  fade: '페이드',
} satisfies Record<ShotShape, string>;

const trajectoryLabels = {
  low: '낮은 탄도',
  mid: '중간 탄도',
  high: '높은 탄도',
} satisfies Record<TrajectoryTendency, string>;

const tempoLabels = {
  smooth: '부드러운 템포',
  neutral: '중립 템포',
  assertive: '과감한 템포',
} satisfies Record<TempoPreference, string>;

const windDirectionLabels = {
  none: '무풍',
  headwind: '맞바람',
  tailwind: '뒷바람',
  'left-to-right': '왼쪽에서 오른쪽',
  'right-to-left': '오른쪽에서 왼쪽',
} satisfies Record<WindDirection, string>;

const windStrengthLabels = {
  calm: '잔잔함',
  light: '약함',
  steady: '꾸준함',
  strong: '강함',
} satisfies Record<WindStrength, string>;

const lieLabels = {
  tee: '티',
  fairway: '페어웨이',
  rough: '러프',
  bunker: '벙커',
} satisfies Record<LieCondition, string>;

const windowLabels = {
  standard: '표준 탄도창',
  low: '낮은 탄도창',
  high: '높은 탄도창',
} satisfies Record<ShotWindow, string>;

function clubLabel(club: ClubKey): string {
  const labels = { driver: '드라이버', '3w': '3번 우드', '5w': '5번 우드', '4i': '4번 아이언', '5i': '5번 아이언', '6i': '6번 아이언', '7i': '7번 아이언', '8i': '8번 아이언', '9i': '9번 아이언', pw: '피칭 웨지', gw: '갭 웨지', sw: '샌드 웨지' } satisfies Record<ClubKey, string>;
  return labels[club];
}

export function App() {
  const {
    activeProfile,
    analysisCards,
    motionParameters,
    recommendation,
    savedProfiles,
    scenario,
    selectedPresetId,
    setActiveProfile,
    setScenario,
    selectProfile,
    saveCurrentProfile,
    storageMessage,
  } = useSwingLabSession();

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card swing-hero">
        <p className="eyebrow">진지한 골프 스윙 랩</p>
        <h1 id="app-title">플레이어 프로필과 상황을 넣으면 분석 카드가 바로 준비됩니다.</h1>
        <p className="hero-copy">
          골프 친구들을 위한 모바일 우선 연습 랩입니다. 저장한 프로필, 핵심 성향, 수동 샷 상황으로
          결정적 분석 카드와 모션 뷰어 상태, 진지한 연습 읽기를 만듭니다.
        </p>
        <div className="hero-actions" aria-label="주요 스윙 랩 동작">
          <a href="#profile-panel" className="primary-action">
            프로필 패널
          </a>
          <a href="#scenario-panel" className="secondary-action">
            상황 패널
          </a>
        </div>
      </section>

      <section id="profile-panel" className="lab-panel" aria-labelledby="profile-title">
        <div className="section-heading">
          <p className="eyebrow">1단계 · 프로필 프리셋</p>
          <h2 id="profile-title">골퍼 프로필 정보</h2>
          <p>{storageMessage}</p>
        </div>

        <label>
          프로필 프리셋
          <select value={selectedPresetId} onChange={(event) => selectProfile(event.target.value)}>
            <optgroup label="기본 프리셋">
              {builtInProfilePresets.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} — {presetSummary(profile)}
                </option>
              ))}
            </optgroup>
            {savedProfiles.length > 0 ? (
              <optgroup label="이 기기에 저장됨">
                {savedProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} — {presetSummary(profile)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <div className="form-grid two-column">
          <label>
            프로필 이름
            <input value={activeProfile.name} onChange={(event) => setActiveProfile({ ...activeProfile, name: event.target.value })} />
          </label>
          <label>
            아키타입 메모
            <input value={activeProfile.archetype} onChange={(event) => setActiveProfile({ ...activeProfile, archetype: event.target.value })} />
          </label>
          <label>
            키 (cm)
            <input
              type="number"
              min="120"
              max="230"
              value={activeProfile.heightCm}
              onChange={(event) => setActiveProfile({ ...activeProfile, heightCm: Number(event.target.value) })}
            />
          </label>
          <label>
            몸무게 (kg)
            <input
              type="number"
              min="40"
              max="160"
              value={activeProfile.weightKg}
              onChange={(event) => setActiveProfile({ ...activeProfile, weightKg: Number(event.target.value) })}
            />
          </label>
          <label>
            핸디캡
            <input
              type="number"
              min="-5"
              max="54"
              value={activeProfile.handicap}
              onChange={(event) => setActiveProfile({ ...activeProfile, handicap: Number(event.target.value) })}
            />
          </label>
          <label>
            레벨
            <select
              value={activeProfile.level}
              onChange={(event) => setActiveProfile({ ...activeProfile, level: event.target.value as GolferLevel })}
            >
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {levelLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            구질
            <select
              value={activeProfile.shotShape}
              onChange={(event) => setActiveProfile({ ...activeProfile, shotShape: event.target.value as ShotShape })}
            >
              {shotShapeOptions.map((option) => (
                <option key={option} value={option}>
                  {shotShapeLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            탄도 성향
            <select
              value={activeProfile.trajectoryTendency}
              onChange={(event) => setActiveProfile({ ...activeProfile, trajectoryTendency: event.target.value as TrajectoryTendency })}
            >
              {trajectoryOptions.map((option) => (
                <option key={option} value={option}>
                  {trajectoryLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            템포 선호
            <select
              value={activeProfile.tempoPreference}
              onChange={(event) => setActiveProfile({ ...activeProfile, tempoPreference: event.target.value as TempoPreference })}
            >
              {tempoOptions.map((option) => (
                <option key={option} value={option}>
                  {tempoLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="club-grid" aria-label="수정 가능한 캐리 거리">
          {editableClubKeys.map((club) => (
            <label key={club}>
              {clubLabel(club)} 캐리 (m)
              <input
                type="number"
                min="30"
                max="330"
                value={distanceFor(activeProfile, club)}
                onChange={(event) => setActiveProfile(replaceClubDistance(activeProfile, club, Number(event.target.value)))}
              />
            </label>
          ))}
        </div>

        <button type="button" className="primary-action button-action sticky-action" onClick={saveCurrentProfile}>
          프로필 로컬 저장
        </button>
      </section>

      <section id="scenario-panel" className="lab-panel" aria-labelledby="scenario-title">
        <div className="section-heading">
          <p className="eyebrow">2단계 · 수동 샷 상황</p>
          <h2 id="scenario-title">수동 샷 조건</h2>
          <p>모든 입력은 수동이며 결정적이어서 주요 흐름은 오프라인과 정적 스모크 테스트에서도 동작합니다.</p>
        </div>

        <div className="form-grid two-column">
          <label>
            목표 거리 (m)
            <input
              type="number"
              min="30"
              max="330"
              value={scenario.targetDistanceMeters}
              onChange={(event) => setScenario({ ...scenario, targetDistanceMeters: Number(event.target.value) })}
            />
          </label>
          <label>
            바람 방향
            <select
              value={scenario.windDirection}
              onChange={(event) => setScenario({ ...scenario, windDirection: event.target.value as WindDirection })}
            >
              {windDirections.map((option) => (
                <option key={option} value={option}>
                  {windDirectionLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            바람 세기
            <select
              value={scenario.windStrength}
              onChange={(event) => setScenario({ ...scenario, windStrength: event.target.value as WindStrength })}
            >
              {windStrengths.map((option) => (
                <option key={option} value={option}>
                  {windStrengthLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            라이
            <select value={scenario.lie} onChange={(event) => setScenario({ ...scenario, lie: event.target.value as LieCondition })}>
              {lieOptions.map((option) => (
                <option key={option} value={option}>
                  {lieLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            원하는 탄도창
            <select
              value={scenario.desiredWindow}
              onChange={(event) => setScenario({ ...scenario, desiredWindow: event.target.value as ShotWindow })}
            >
              {windowOptions.map((option) => (
                <option key={option} value={option}>
                  {windowLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="analysis-preview" aria-labelledby="analysis-title">
        <div className="section-heading">
          <p className="eyebrow">실시간 분석 리포트</p>
          <h2 id="analysis-title">{recommendation.clubLabel} · {recommendation.swingSizeLabel}</h2>
          <p>
            결정적 샷 모델에서 나온 진지한 게임 카드 읽기입니다. 거리감, 스윙 부하, 비행 라인, 상황 적합도를
            지시형 문구 없이 프로필에 맞춰 보여줍니다.
          </p>
        </div>

        <div className="analysis-card-grid" aria-label="분석 리포트 카드">
          {analysisCards.map((card) => (
            <article className="analysis-card" key={card.id}>
              <p className="card-label">{card.label}</p>
              <strong>{card.title}</strong>
              <p>{card.detail}</p>
              <span>{card.meta}</span>
            </article>
          ))}
        </div>

        {recommendation.adjustments.length > 0 ? (
          <div className="adjustment-strip" aria-label="상황 보정 읽기">
            {recommendation.adjustments.map((adjustment) => (
              <span key={adjustment.label}>
                <strong>{adjustment.label}</strong> {adjustment.meters > 0 ? '+' : ''}{adjustment.meters} m · {adjustment.reason}
              </span>
            ))}
          </div>
        ) : null}

        <div className="why-panel" aria-labelledby="why-title">
          <p className="card-label" id="why-title">
            이 카드의 이유
          </p>
          <ul className="why-list">
            {recommendation.why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </section>

      <SwingMotionViewer parameters={motionParameters} recommendation={recommendation} />
    </main>
  );
}
