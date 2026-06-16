import { useMemo, useState } from 'react';
import { MapShell } from './components/MapShell';
import { approximateDistanceDisclaimer, nonGoals, privacyNotes, productPrinciples } from './domain/copy';
import { sampleCourseTargets } from './domain/courseTargets';
import { targetDistances } from './domain/geo';
import { buildMockMapModel } from './domain/mapAdapter';
import type { Coordinate, ShotPin, ShotPinCategory } from './domain/models';
import { createRemoteRoomApiClient, createRoomApiClient, createRoomApiHandler } from './domain/roomApi';
import { createRoomRepository, createSharedRoomBackend, type RoomMembership } from './domain/roomRepository';
import { buildShotPinInput, findShotPinCategory, shotPinCategories, type ShotPinLocationSource } from './domain/shotPinFlow';
import { useCurrentLocation } from './hooks/useCurrentLocation';

const foundationCards = [
  {
    title: 'Create a round room',
    body: 'Start with a lightweight invite-link concept for friends sharing the same round context.',
  },
  {
    title: 'Add playful shot pins',
    body: 'Drop emoji notes for memorable shots without turning the app into scoring or social feed software.',
  },
  {
    title: 'Keep maps swappable',
    body: 'This foundation intentionally avoids provider-specific map SDKs so a later adapter can be selected safely.',
  },
] as const;

const initialManualLocation = {
  lat: sampleCourseTargets[0].lat,
  lng: sampleCourseTargets[0].lng,
} as const;

export function App() {
  const { state: locationState, requestLocation } = useCurrentLocation();
  const [roomName, setRoomName] = useState('Saturday nine');
  const [displayName, setDisplayName] = useState('Golf friend');
  const [inviteToken, setInviteToken] = useState('');
  const [membership, setMembership] = useState<RoomMembership>();
  const [pins, setPins] = useState<readonly ShotPin[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ShotPinCategory>('shot');
  const [comment, setComment] = useState('');
  const [tappedLocation, setTappedLocation] = useState<Coordinate>(sampleCourseTargets[1]);
  const [manualLocation, setManualLocation] = useState<Coordinate>(initialManualLocation);
  const [flowMessage, setFlowMessage] = useState('Create or join a room to drop quick shot pins.');
  const mapTileTemplate = import.meta.env.VITE_MAP_TILE_URL_TEMPLATE as string | undefined;

  const roomApi = useMemo(() => {
    const remoteBaseUrl = import.meta.env.VITE_ROOM_API_BASE_URL as string | undefined;
    if (remoteBaseUrl) {
      return createRemoteRoomApiClient(remoteBaseUrl);
    }

    const handler = createRoomApiHandler(createRoomRepository(createSharedRoomBackend()));
    return createRoomApiClient({ baseUrl: 'https://fungolf.local', fetch: handler });
  }, []);

  const currentLocation =
    locationState.status === 'ready' || locationState.status === 'low_accuracy'
      ? locationState.sample
      : undefined;
  const mapModel = buildMockMapModel({
    targets: sampleCourseTargets,
    currentLocation,
    tileTemplate: mapTileTemplate,
  });
  const distances = currentLocation ? targetDistances(currentLocation, sampleCourseTargets) : [];
  const activeCategory = findShotPinCategory(selectedCategory);
  const canDropCurrentPin = Boolean(membership && currentLocation);
  const canDropTappedPin = Boolean(membership && tappedLocation);
  const canDropManualPin = Boolean(membership && Number.isFinite(manualLocation.lat) && Number.isFinite(manualLocation.lng));

  async function createRoom() {
    const nextMembership = await roomApi.createRoom({ name: roomName, hostDisplayName: displayName });
    setMembership(nextMembership);
    setInviteToken(nextMembership.room.inviteToken ?? '');
    setPins(await roomApi.listPins(nextMembership));
    setFlowMessage(`Room ready: ${nextMembership.room.name}. Share invite token ${nextMembership.room.inviteToken}.`);
  }

  async function joinRoom() {
    const nextMembership = await roomApi.joinRoom({ inviteToken, displayName });
    setMembership(nextMembership);
    setPins(await roomApi.listPins(nextMembership));
    setFlowMessage(`Joined ${nextMembership.room.name}. Pins refresh with loose freshness, not live tracking.`);
  }

  async function dropPin(source: ShotPinLocationSource) {
    if (!membership) {
      setFlowMessage('Create or join an invite-link room before dropping shot pins.');
      return;
    }

    try {
      const pin = await roomApi.createPin(
        buildShotPinInput({
          membership,
          source,
          category: selectedCategory,
          comment,
          currentLocation,
          tappedLocation,
          manualLocation,
        }),
      );
      setPins(await roomApi.listPins(membership));
      setComment('');
      setFlowMessage(`${pin.emoji} ${pin.comment} saved from ${source} location as an approximate room pin.`);
    } catch (error) {
      setFlowMessage(error instanceof Error ? error.message : 'Shot pin could not be saved.');
    }
  }

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="hero-card">
        <p className="eyebrow">Golf field GPS shot pins</p>
        <h1 id="app-title">FunGolf helps friends mark shots with approximate on-course context.</h1>
        <p className="hero-copy">{approximateDistanceDisclaimer}</p>
        <div className="hero-actions" aria-label="Foundation actions">
          <a href="#room-flow" className="primary-action">
            Start room
          </a>
          <a href="#privacy" className="secondary-action">
            Privacy notes
          </a>
        </div>
      </section>

      <section className="status-strip" aria-label="MVP foundation constraints">
        {productPrinciples.map((principle) => (
          <span key={principle}>{principle}</span>
        ))}
      </section>

      <section id="room-flow" className="room-flow" aria-labelledby="room-flow-title">
        <div className="room-card">
          <p className="eyebrow">G003 invite room</p>
          <h2 id="room-flow-title">Mobile room flow</h2>
          <p>{flowMessage}</p>
          <label>
            Room name
            <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          </label>
          <label>
            Your display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <div className="split-actions">
            <button type="button" className="primary-action button-action" onClick={() => void createRoom()}>
              Create room
            </button>
            <button type="button" className="secondary-action button-action" onClick={() => void joinRoom()}>
              Join token
            </button>
          </div>
          <label>
            Invite token
            <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Paste invite token" />
          </label>
        </div>

        <div className="pin-card" aria-labelledby="quick-pin-title">
          <p className="eyebrow">One-handed quick pins</p>
          <h2 id="quick-pin-title">Emoji/comment categories</h2>
          <div className="category-grid" aria-label="Shot pin categories">
            {shotPinCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={category.id === selectedCategory ? 'category-pill selected' : 'category-pill'}
                onClick={() => setSelectedCategory(category.id)}
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.label}
              </button>
            ))}
          </div>
          <label>
            Comment
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={activeCategory.commentHint}
              rows={3}
            />
          </label>
          <div className="quick-actions" aria-label="Drop shot pin from location source">
            <button type="button" className="primary-action button-action" disabled={!canDropCurrentPin} onClick={() => void dropPin('current')}>
              Use current
            </button>
            <button type="button" className="primary-action button-action" disabled={!canDropTappedPin} onClick={() => void dropPin('tapped')}>
              Use tapped
            </button>
            <button type="button" className="primary-action button-action" disabled={!canDropManualPin} onClick={() => void dropPin('manual')}>
              Use manual
            </button>
          </div>
          <small className="privacy-copy">Pins use approximate room coordinates and are visible only inside this invite-link room.</small>
        </div>
      </section>

      <section className="geo-panel" aria-labelledby="location-title">
        <div>
          <p className="eyebrow">G002 map/geolocation core</p>
          <h2 id="location-title">Current location states and manual course targets</h2>
          <p>{locationState.message}</p>
          <button type="button" className="primary-action button-action" onClick={() => void requestLocation()}>
            Use current location
          </button>
        </div>
        <div className={`location-badge ${locationState.status}`}>
          <span>Status</span>
          <strong>{locationState.status.replace('_', ' ')}</strong>
          {'sample' in locationState ? <small>Accuracy ≈ {Math.round(locationState.sample.accuracyMeters)} m</small> : null}
        </div>
      </section>

      <MapShell model={mapModel} />

      <section className="detail-panel" aria-labelledby="targets-title">
        <h2 id="targets-title">Tapped and manual targets</h2>
        <p>Tap a sample target or type rough coordinates. These are approximate field notes, not official measurements.</p>
        <ul className="target-list">
          {sampleCourseTargets.map((target) => {
            const distance = distances.find((item) => item.target.id === target.id);
            return (
              <li key={target.id}>
                <button type="button" className="target-button" onClick={() => setTappedLocation(target)}>
                  <span>{target.type}</span>
                  <strong>{target.label}</strong>
                  <small>{distance ? distance.label : 'Request location for approximate distance'}</small>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="manual-grid" aria-label="Manual shot pin coordinate">
          <label>
            Manual lat
            <input
              type="number"
              step="0.00001"
              value={manualLocation.lat}
              onChange={(event) => setManualLocation((location) => ({ ...location, lat: Number(event.target.value) }))}
            />
          </label>
          <label>
            Manual lng
            <input
              type="number"
              step="0.00001"
              value={manualLocation.lng}
              onChange={(event) => setManualLocation((location) => ({ ...location, lng: Number(event.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="detail-panel" aria-labelledby="pins-title">
        <h2 id="pins-title">Room shot pins</h2>
        {membership ? <p>{membership.room.name} · {membership.participant.displayName} · loose freshness list</p> : <p>No room joined yet.</p>}
        <ul className="pin-list">
          {pins.map((pin) => (
            <li key={pin.id}>
              <span>{pin.emoji}</span>
              <strong>{pin.comment}</strong>
              <small>
                {pin.category} · {pin.participantName} · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section id="foundation" className="card-grid" aria-label="Foundation capabilities">
        {foundationCards.map((card) => (
          <article key={card.title} className="info-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section id="privacy" className="detail-panel" aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy and implementation boundaries</h2>
        <ul>
          {privacyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="detail-panel muted" aria-labelledby="non-goals-title">
        <h2 id="non-goals-title">Non-goals for this foundation</h2>
        <ul>
          {nonGoals.map((nonGoal) => (
            <li key={nonGoal}>{nonGoal}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
