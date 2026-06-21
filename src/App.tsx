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
    <main className="app-shell caddie-app" aria-labelledby="app-title">
      <section className="hero-card caddie-hero">
        <p className="eyebrow">한국어 모바일 필드 도구</p>
        <h1 id="app-title">캐디 한줄 처방</h1>
        <p className="hero-copy">남은 거리와 라이만 빠르게 넣고, 지금 칠 클럽·조준·탄도를 먼저 확인하세요.</p>
        <div className="hero-actions" aria-label="주요 입력 이동">
          <a href="#shot-panel" className="primary-action">
            샷 상황 입력
          </a>
          <a href="#preset-panel" className="secondary-action">
            프리셋 저장
          </a>
        </div>
      </section>

      <section className="result-first prescription-card" aria-labelledby="prescription-title">
        <p className="eyebrow">지금 처방</p>
        <h2 id="prescription-title">{prescription.headline}</h2>
        <dl className="prescription-metrics" aria-label="추천 요약">
          <div>
            <dt>클럽</dt>
            <dd>{prescription.selectedClubLabel}</dd>
          </div>
          <div>
            <dt>스윙</dt>
            <dd>{prescription.swingPercent}%</dd>
          </div>
          <div>
            <dt>플레이 거리</dt>
            <dd>{prescription.playDistanceMeters}m</dd>
          </div>
        </dl>
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

      <section id="preset-panel" className="lab-panel caddie-preset-panel" aria-labelledby="preset-title">
        <div className="section-heading">
          <p className="eyebrow">2단계 · 로컬 거리 프리셋</p>
          <h2 id="preset-title">프리셋</h2>
          <p>{storageMessage}</p>
        </div>

        <label>
          저장된 프리셋 불러오기
          <select value={selectedPresetId} onChange={(event) => selectPreset(event.target.value)}>
            {selectablePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          프리셋 이름
          <input value={activePreset.name} onChange={(event) => setActivePreset({ ...activePreset, name: event.target.value })} />
        </label>

        <div className="anchor-grid" aria-label="기준 3개 클럽 거리">
          {(['driver', '7i', 'pw'] as const).map((club) => (
            <label key={club}>
              {caddieClubLabels[club]} 기준 거리 (m)
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

        <div className="club-grid" aria-label="추정 및 수정 가능한 전체 클럽 거리">
          {caddieClubOrder.map((club) => (
            <label key={club}>
              {caddieClubLabels[club]}
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
        {savedPresets.length > 0 ? <p className="save-note">저장된 프리셋 {savedPresets.length}개를 이 기기에서 불러올 수 있습니다.</p> : null}
      </section>

      <section className="reason-card-grid" aria-labelledby="reason-title">
        <div className="section-heading">
          <p className="eyebrow">짧은 이유</p>
          <h2 id="reason-title">왜 이렇게 치나요?</h2>
        </div>
        {prescription.reasonCards.map((card) => (
          <article className="reason-card" key={card.id}>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="visual-card-grid" aria-labelledby="visual-title">
        <div className="section-heading">
          <p className="eyebrow">2D 보조</p>
          <h2 id="visual-title">조준과 라이 미니카드</h2>
        </div>
        {prescription.visualCards.map((card) => (
          <article className={`visual-card ${card.marker}`} key={card.id}>
            <div className="mini-map" aria-hidden="true">
              <span />
            </div>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
