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
      <section className="hero-card caddie-hero">
        <p className="eyebrow">캐디 한줄 처방</p>
        <h1 id="app-title">남은 거리와 라이만 빠르게 넣고 한 줄 조언을 먼저 봅니다.</h1>
        <p className="hero-copy">
          위치·날씨 자동 연동이나 로그인 없이 현장에서 직접 본 조건만 넣습니다. 거리 프리셋은 이 기기에 저장하고,
          결과는 한 손으로 바로 읽히는 압축 카드로 보여줍니다.
        </p>
        <div className="hero-actions" aria-label="주요 캐디 카드 동작">
          <a href="#analysis-panel" className="primary-action">
            지금 처방
          </a>
          <a href="#shot-panel" className="secondary-action">
            샷 상황 입력
          </a>
        </div>
      </section>

      <section id="analysis-panel" className="analysis-preview" aria-labelledby="analysis-title">
        <div className="section-heading">
          <p className="eyebrow">지금 처방</p>
          <h2 id="analysis-title">{prescription.headline}</h2>
          <p>
            추천 요약 · 클럽 {prescription.selectedClubLabel} · 스윙 {prescription.swingPercent}% · 플레이 거리 {prescription.playDistanceMeters}m
          </p>
        </div>

        <h3>왜 이렇게 치나요?</h3>
        <p>짧은 이유</p>
        <div className="analysis-card-grid" aria-label="짧은 이유">
          {prescription.reasonCards.map((card) => (
            <article className="analysis-card" key={card.id}>
              <p className="card-label">{card.title}</p>
              <strong>{card.summary}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <div className="adjustment-strip" aria-label="핵심 보정">
          <span>
            <strong>조준</strong> {prescription.aimText}
          </span>
          <span>
            <strong>탄도</strong> {prescription.trajectoryText}
          </span>
          <span>
            <strong>미스 경고</strong> {prescription.warningText}
          </span>
        </div>

        <section className="shot-dashboard" aria-labelledby="shot-dashboard-title">
          <div className="dashboard-copy">
            <p className="eyebrow">정적 샷 대시보드</p>
            <h3 id="shot-dashboard-title">한 장으로 보는 타깃 라인</h3>
            <p>타깃 라인, 공 위치, 바람, 탄도, 추천 요약을 한 패널에 모았습니다.</p>
          </div>
          <div className="dashboard-stage" aria-hidden="true">
            <span className="target-pin" />
            <span className="target-line" />
            <span className="trajectory-arc" />
            <span className="ball-marker" />
            <span className="wind-arrow">WIND</span>
          </div>
          <div className="dashboard-metrics" aria-label="샷 대시보드 요약">
            <span><strong>추천 요약</strong>{prescription.shotDashboard.recommendationSummary}</span>
            <span><strong>공 위치</strong>{prescription.shotDashboard.ballHeightSummary}</span>
            <span><strong>앞뒤 경사</strong>{prescription.shotDashboard.slopeSummary}</span>
            <span><strong>바람</strong>{prescription.shotDashboard.windSummary}</span>
            <span><strong>탄도</strong>{prescription.shotDashboard.trajectorySummary}</span>
            <span><strong>라이</strong>{prescription.shotDashboard.lieSummary}</span>
          </div>
        </section>
      </section>

      <section id="shot-panel" className="lab-panel caddie-input-panel" aria-labelledby="scenario-title">
        <div className="section-heading">
          <p className="eyebrow">1단계 · 수동 샷 입력</p>
          <h2 id="scenario-title">남은 거리, 라이, 바람</h2>
          <p>현장에서 보이는 조건만 직접 넣습니다. 대표값은 100m · 페어웨이 · 공이 발보다 낮음 · 약한 맞바람입니다.</p>
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
            앞뒤 경사
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
            공 위치 높이
            <select value={scenario.sideSlope} onChange={(event) => setScenario({ ...scenario, sideSlope: event.target.value as CaddieSideSlope })}>
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
            <select value={scenario.greenRisk} onChange={(event) => setScenario({ ...scenario, greenRisk: event.target.value as CaddieGreenRisk })}>
              {greenRiskOptions.map((option) => (
                <option key={option} value={option}>
                  {greenRiskLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section id="preset-panel" className="lab-panel" aria-labelledby="profile-title">
        <div className="section-heading">
          <p className="eyebrow">2단계 · 거리 프리셋</p>
          <h2 id="profile-title">내 클럽별 캐리 거리</h2>
          <p>{storageMessage}</p>
        </div>

        <label>
          저장된 프리셋 불러오기
          <select value={selectedPresetId} onChange={(event) => selectPreset(event.target.value)}>
            {selectablePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} — 드라이버 {preset.anchorDistances.driver}m · 7번 {preset.anchorDistances.sevenIron}m · 피칭 웨지 {preset.anchorDistances.pitchingWedge}m
              </option>
            ))}
          </select>
        </label>

        {savedPresets.length > 0 ? <p className="storage-note">이 기기에 저장됨: {savedPresets.map((preset) => preset.name).join(', ')}</p> : null}

        <label>
          프리셋 이름
          <input value={activePreset.name} onChange={(event) => setActivePreset({ ...activePreset, name: event.target.value })} />
        </label>

        <div className="club-grid" aria-label="수정 가능한 캐리 거리">
          {caddieClubOrder.map((club) => (
            <label key={club}>
              {caddieClubLabels[club]} 캐리 (m)
              <input
                type="number"
                min="30"
                max="330"
                value={distanceFor(activePreset, club)}
                onChange={(event) => setActivePreset(replaceClubDistance(activePreset, club, Number(event.target.value)))}
              />
            </label>
          ))}
        </div>

        <button type="button" className="primary-action button-action sticky-action" onClick={saveCurrentPreset}>
          로컬 프리셋 저장
        </button>
      </section>
    </main>
  );
}
