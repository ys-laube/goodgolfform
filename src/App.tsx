import { useState, type CSSProperties } from 'react';

import {
  caddieClubLabels,
  distanceFor,
  greenRiskLabels,
  ballPositionSlotLabels,
  clubGroupLabels,
  handednessLabels,
  lieLabels,
  pinPositionLabels,
  replaceClubDistance,
  sideHillRelationLabels,
  sideSlopeLabels,
  stanceSlopeLabels,
  useCaddieSession,
  windDirectionLabels,
  windStrengthLabels,
  type CaddieGreenRisk,
  type CaddieHandedness,
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
const handednessOptions = Object.keys(handednessLabels) as readonly CaddieHandedness[];

type ShotVisualStyle = CSSProperties & { readonly '--ball-position': string };

type DistanceDrafts = Record<string, string>;

function numericInputValue(value: number): string {
  return String(value);
}

function parseNumericDraft(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const [targetDistanceDraft, setTargetDistanceDraft] = useState(() => numericInputValue(scenario.targetDistanceMeters));
  const [clubDistanceDrafts, setClubDistanceDrafts] = useState<DistanceDrafts>(() =>
    Object.fromEntries(caddieClubOrder.map((club) => [club, numericInputValue(distanceFor(activePreset, club))])),
  );

  function handleTargetDistanceDraft(value: string) {
    setTargetDistanceDraft(value);
    const parsedDistance = parseNumericDraft(value);

    if (parsedDistance !== null) {
      setScenario({ ...scenario, targetDistanceMeters: parsedDistance });
    }
  }

  function handleTargetDistanceBlur() {
    setTargetDistanceDraft(numericInputValue(scenario.targetDistanceMeters));
  }

  function handleClubDistanceDraft(club: (typeof caddieClubOrder)[number], value: string) {
    setClubDistanceDrafts((drafts) => ({ ...drafts, [club]: value }));
    const parsedDistance = parseNumericDraft(value);

    if (parsedDistance !== null) {
      setActivePreset(replaceClubDistance(activePreset, club, parsedDistance));
    }
  }

  function handleClubDistanceBlur(club: (typeof caddieClubOrder)[number]) {
    setClubDistanceDrafts((drafts) => ({ ...drafts, [club]: numericInputValue(distanceFor(activePreset, club)) }));
  }

  function handlePresetSelection(presetId: string) {
    const selectedPreset = selectablePresets.find((preset) => preset.id === presetId);

    if (selectedPreset) {
      setClubDistanceDrafts(Object.fromEntries(caddieClubOrder.map((club) => [club, numericInputValue(distanceFor(selectedPreset, club))])));
    }

    selectPreset(presetId);
  }

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section id="preset-panel" className="lab-panel" aria-labelledby="app-title">
        <div className="section-heading">
          <p className="eyebrow">1단계 · 거리 프리셋</p>
          <h1 id="app-title">거리 프리셋</h1>
          <p>내 클럽별 캐리 거리를 타이핑해서 맞추고, 자주 쓰는 거리표는 이 기기에 저장합니다.</p>
        </div>

        <label>
          저장된 프리셋 불러오기
          <select value={selectedPresetId} onChange={(event) => handlePresetSelection(event.target.value)}>
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
                type="text"
                min="30"
                max="330"
                inputMode="numeric"
                value={clubDistanceDrafts[club] ?? numericInputValue(distanceFor(activePreset, club))}
                onChange={(event) => handleClubDistanceDraft(club, event.currentTarget.value)}
                onBlur={() => handleClubDistanceBlur(club)}
              />
            </label>
          ))}
        </div>

        <button className="primary-action button-action sticky-action" type="button" onClick={saveCurrentPreset}>
          로컬 프리셋 저장
        </button>
        <p className="storage-note">{storageMessage}</p>
      </section>

      <section id="shot-panel" className="lab-panel caddie-input-panel" aria-labelledby="scenario-title">
        <div className="section-heading">
          <p className="eyebrow">2단계 · 샷 상황 입력</p>
          <h2 id="scenario-title">남은 거리, 라이, 바람</h2>
          <p>현장에서 보이는 조건만 직접 넣습니다. 대표값은 100m · 페어웨이 · 공이 발보다 낮음 · 약한 맞바람입니다.</p>
        </div>

        <div className="form-grid two-column">
          <label>
            남은 거리 (m)
            <input
              type="text"
              min="30"
              max="330"
              inputMode="numeric"
              value={targetDistanceDraft}
              onChange={(event) => handleTargetDistanceDraft(event.currentTarget.value)}
              onBlur={handleTargetDistanceBlur}
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
            <select value={scenario.stanceSlope} onChange={(event) => setScenario({ ...scenario, stanceSlope: event.target.value as CaddieStanceSlope })}>
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
            <select value={scenario.windDirection} onChange={(event) => setScenario({ ...scenario, windDirection: event.target.value as CaddieWindDirection })}>
              {windDirectionOptions.map((option) => (
                <option key={option} value={option}>
                  {windDirectionLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            바람 세기
            <select value={scenario.windStrength} onChange={(event) => setScenario({ ...scenario, windStrength: event.target.value as CaddieWindStrength })}>
              {windStrengthOptions.map((option) => (
                <option key={option} value={option}>
                  {windStrengthLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            핀 위치
            <select value={scenario.pinPosition} onChange={(event) => setScenario({ ...scenario, pinPosition: event.target.value as CaddiePinPosition })}>
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
          <fieldset className="segmented-control" aria-label="타석 방향">
            <legend>타석 방향</legend>
            {handednessOptions.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="handedness"
                  value={option}
                  checked={scenario.handedness === option}
                  onChange={() => setScenario({ ...scenario, handedness: option })}
                />
                <span>{handednessLabels[option]}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      <section id="analysis-panel" className="analysis-preview" aria-labelledby="analysis-title">
        <div className="section-heading">
          <p className="eyebrow">3단계 · 처방 결과</p>
          <h2 id="analysis-title">왜 이렇게 치나요?</h2>
        </div>

        <div className="analysis-card-grid" aria-label="상황별 이유">
          {prescription.reasonCards.map((card) => (
            <article className="analysis-card" key={card.id}>
              <p className="card-label">{card.title}</p>
              <strong>{card.summary}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <section className="shot-visual" aria-labelledby="shot-visual-title">
          <div className="shot-visual-copy">
            <p className="eyebrow">한국형 2D 셋업 비주얼</p>
            <h3 id="shot-visual-title">발, 공, 라이를 두 시점으로 나눠 확인합니다</h3>
            <p>탄도·바람 그림 대신 클럽군, 우타/좌타, 공 위치와 경사 관계만 셋업 정보로 보여줍니다.</p>
          </div>

          <div className="shot-visual-views" aria-label="셋업 비주얼">
            <figure className="shot-visual-view shot-visual-top">
              <figcaption>위에서 본 스탠스 / 공 위치</figcaption>
              <div
                className="shot-visual-stage"
                data-handedness={prescription.shotVisual.handedness}
                data-club-group={prescription.shotVisual.clubGroup}
                style={{ '--ball-position': `${prescription.shotVisual.ballPositionPercent}%` } as ShotVisualStyle}
                aria-hidden="true"
              >
                <span className="shot-visual-target-line">타깃 방향</span>
                <span className="shot-visual-foot shot-visual-foot-lead" />
                <span className="shot-visual-foot shot-visual-foot-trail" />
                <span className="shot-visual-ball" />
              </div>
              <p>
                {handednessLabels[prescription.shotVisual.handedness]} · {clubGroupLabels[prescription.shotVisual.clubGroup]} ·{' '}
                {ballPositionSlotLabels[prescription.shotVisual.ballPositionSlot]}
              </p>
            </figure>

            <figure className="shot-visual-view shot-visual-rear">
              <figcaption>뒤에서 본 라이 / 경사</figcaption>
              <div
                className="shot-visual-stage"
                data-front-back={prescription.shotVisual.frontBackSlope}
                data-side-hill={prescription.shotVisual.sideHillRelation}
                aria-hidden="true"
              >
                <span className="shot-visual-horizon" />
                <span className="shot-visual-slope" />
                <span className="shot-visual-ball" />
              </div>
              <p>
                앞뒤 경사 {stanceSlopeLabels[prescription.shotVisual.frontBackSlope]} · 공 위치{' '}
                {sideHillRelationLabels[prescription.shotVisual.sideHillRelation]}
              </p>
            </figure>
          </div>

          <details className="shot-visual-evidence">
            <summary>근거 보기</summary>
            <ul>
              <li>드라이버는 리드발 안쪽, 짧은 클럽일수록 중앙 쪽으로 공 위치를 이동합니다.</li>
              <li>미들 아이언은 대체로 스탠스 중앙 기준으로 보고, 롱 아이언과 우드는 약간 리드발 쪽을 봅니다.</li>
              <li>오르막·내리막은 앞뒤 경사로, 공이 발보다 높거나 낮은 상태는 발끝 라이로 분리해서 봅니다.</li>
            </ul>
          </details>
        </section>
      </section>
    </main>
  );
}
