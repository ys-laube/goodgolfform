import {
  caddieClubLabels,
  distanceFor,
  greenRiskLabels,
  lieLabels,
  pinPositionLabels,
  replaceClubDistance,
  sideSlopeLabels,
  stanceSlopeLabels,
  useCaddieSession,
  windDirectionLabels,
  windStrengthLabels,
  type CaddieGreenRisk,
  type CaddieLie,
  type CaddiePinPosition,
  type CaddieSideSlope,
  type CaddieStanceSlope,
  type CaddieWindDirection,
  type CaddieWindStrength,
} from './useCaddieSession';

const lieOptions = Object.keys(lieLabels) as readonly CaddieLie[];
const stanceSlopeOptions = Object.keys(stanceSlopeLabels) as readonly CaddieStanceSlope[];
const sideSlopeOptions = Object.keys(sideSlopeLabels) as readonly CaddieSideSlope[];
const windDirectionOptions = Object.keys(windDirectionLabels) as readonly CaddieWindDirection[];
const windStrengthOptions = Object.keys(windStrengthLabels) as readonly CaddieWindStrength[];
const pinPositionOptions = Object.keys(pinPositionLabels) as readonly CaddiePinPosition[];
const greenRiskOptions = Object.keys(greenRiskLabels) as readonly CaddieGreenRisk[];

export function App() {
  const {
    activePreset,
    caddieClubOrder,
    prescription,
    savedPresets,
    scenario,
    selectablePresets,
    selectedPresetId,
    setActivePreset,
    setScenario,
    selectPreset,
    saveCurrentPreset,
    storageMessage,
  } = useCaddieSession();

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
          <a href="#analysis-panel" className="primary-action">
            분석 리포트
          </a>
          <a href="#profile-panel" className="secondary-action">
            프로필 조정
          </a>
        </div>
      </section>

      <section id="analysis-panel" className="analysis-preview" aria-labelledby="analysis-title">
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

      <section id="shot-panel" className="lab-panel caddie-input-panel" aria-labelledby="shot-title">
        <div className="section-heading">
          <p className="eyebrow">1단계 · 수동 샷 입력</p>
          <h2 id="shot-title">남은 거리, 라이, 바람</h2>
          <p>GPS나 날씨 API 없이 현장에서 보이는 조건만 직접 넣습니다.</p>
        </div>

        <div className="form-grid two-column">
          <label>
            남은 거리 (m)
            <input
              type="number"
              min="30"
              max="330"
              value={scenario.targetDistanceMeters}
              onChange={(event) => setScenario({ ...scenario, targetDistanceMeters: Number(event.target.value) })}
            />
          </label>
          <label>
            라이
            <select value={scenario.lie} onChange={(event) => setScenario({ ...scenario, lie: event.target.value as CaddieLie })}>
              {lieOptions.map((option) => (
                <option key={option} value={option}>
                  {lieLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            경사/스탠스
            <select
              value={scenario.stanceSlope}
              onChange={(event) => setScenario({ ...scenario, stanceSlope: event.target.value as CaddieStanceSlope })}
            >
              {stanceSlopeOptions.map((option) => (
                <option key={option} value={option}>
                  {stanceSlopeLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            좌우 경사
            <select
              value={scenario.sideSlope}
              onChange={(event) => setScenario({ ...scenario, sideSlope: event.target.value as CaddieSideSlope })}
            >
              {sideSlopeOptions.map((option) => (
                <option key={option} value={option}>
                  {sideSlopeLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            바람 방향
            <select
              value={scenario.windDirection}
              onChange={(event) => setScenario({ ...scenario, windDirection: event.target.value as CaddieWindDirection })}
            >
              {windDirectionOptions.map((option) => (
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
              onChange={(event) => setScenario({ ...scenario, windStrength: event.target.value as CaddieWindStrength })}
            >
              {windStrengthOptions.map((option) => (
                <option key={option} value={option}>
                  {windStrengthLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            핀 위치
            <select
              value={scenario.pinPosition}
              onChange={(event) => setScenario({ ...scenario, pinPosition: event.target.value as CaddiePinPosition })}
            >
              {pinPositionOptions.map((option) => (
                <option key={option} value={option}>
                  {pinPositionLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            그린 위험
            <select
              value={scenario.greenRisk}
              onChange={(event) => setScenario({ ...scenario, greenRisk: event.target.value as CaddieGreenRisk })}
            >
              {greenRiskOptions.map((option) => (
                <option key={option} value={option}>
                  {greenRiskLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <SwingMotionViewer parameters={motionParameters} recommendation={recommendation} />
    </main>
  );
}
