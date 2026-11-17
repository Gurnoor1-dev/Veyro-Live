import { useEffect, useMemo } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type AircraftPosition = {
  id: string;
  state?: number;
  isOnGround?: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  verticalSpeed?: number;
  lastPilotId?: string | null;
  lastPilotUsername?: string | null;
  updatedAt?: string;
};

function ageMs(value?: string) {
  if (!value) return Infinity;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity;
}
function ageLabel(value?: string) {
  const age = ageMs(value);
  if (!Number.isFinite(age)) return "Update time unavailable";
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}
function aircraftState(position?: AircraftPosition) {
  if (!position) return { label: "Position unavailable", tone: "muted" };
  const age = ageMs(position.updatedAt);
  if (position.state === 5) return { label: "Maintenance", tone: "muted" };
  if (position.state === 3) return { label: "Cancelled", tone: "muted" };
  if (position.state === 4) return { label: "Stopped", tone: "stopped" };
  if (position.isOnGround) {
    if (age >= 24 * 60 * 60 * 1000) return { label: "Parked 24h+", tone: "parked" };
    if (age >= 12 * 60 * 60 * 1000) return { label: "Parked 12h+", tone: "parked" };
    return { label: "On ground", tone: "ground" };
  }
  if (position.state === 2 || position.isOnGround === false) {
    return { label: age > 30 * 60 * 1000 ? "Last known airborne" : "Airborne", tone: "air" };
  }
  return { label: "Status unknown", tone: "muted" };
}
function AircraftMapViewport({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 5);
    else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 6 });
  }, [map, points]);
  return null;
}
function AircraftMapMarker({ aircraft, position, dark }: { aircraft: any; position: AircraftPosition; dark: boolean }) {
  const state = aircraftState(position);
  const icon = useMemo(() => L.divIcon({
    className: "veyro-aircraft-marker",
    html: '<span class="veyro-aircraft-marker-core tone-' + state.tone + (dark ? ' is-dark' : ' is-light') + '"><svg viewBox="0 0 24 28" aria-hidden="true" style="transform:rotate(' + Number(position.heading || 0) + 'deg)"><path d="M12 1.5 14.6 10l7.1 4.1v2.8l-7.1-2.2v7l2.7 1.8v2.1L12 24l-5.3 1.6v-2.1L9.4 21v-7l-7.1 2.2v-2.8L9.4 10z"/></svg></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  }), [dark, position.heading, state.tone]);

  return (
    <Marker position={[position.latitude, position.longitude]} icon={icon}>
      <Popup>
        <div className="aircraft-map-popup">
          <strong>{aircraft.registration || "Fleet aircraft"}</strong>
          <span>{position.lastPilotUsername || "Pilot not reported"} · {state.label}</span>
          <div>
            <b>{Math.round(position.altitude || 0).toLocaleString()} ft</b>
            <b>{Math.round(position.speed || 0)} kt</b>
            <b>{Math.round(position.heading || 0)}° HDG</b>
            <b>{Math.round(position.verticalSpeed || 0)} ft/min</b>
          </div>
          <small>{position.latitude.toFixed(4)}, {position.longitude.toFixed(4)} · {ageLabel(position.updatedAt)}</small>
        </div>
      </Popup>
    </Marker>
  );
}

export default function AircraftLiveMap({ aircraft, positions, dark }: {
  aircraft: any[];
  positions: Record<string, AircraftPosition>;
  dark: boolean;
}) {
  const tracked = useMemo(() => aircraft.flatMap(item => {
    const position = positions[item.id];
    return position &&
      Number.isFinite(position.latitude) &&
      Number.isFinite(position.longitude) &&
      Math.abs(position.latitude) <= 90 &&
      Math.abs(position.longitude) <= 180
      ? [{ aircraft: item, position }]
      : [];
  }), [aircraft, positions]);
  const points = useMemo(() => tracked.map(item => [item.position.latitude, item.position.longitude] as [number, number]), [tracked]);
  const counts = tracked.reduce((result, item) => {
    const tone = aircraftState(item.position).tone;
    result[tone] = (result[tone] || 0) + 1;
    return result;
  }, {} as Record<string, number>);

  return (
    <div className="aircraft-map-layout">
      <div className="aircraft-map-main">
        <div className="aircraft-map-frame">
          <MapContainer
            key={dark ? "dark" : "light"}
            center={points[0] ?? L.latLng(25, 10)}
            zoom={points.length ? 4 : 2}
            scrollWheelZoom
            zoomControl={false}
            className="aircraft-live-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={dark
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
            />
            <AircraftMapViewport points={points} />
            {tracked.map(({ aircraft: item, position }) => (
              <AircraftMapMarker key={item.id} aircraft={item} position={position} dark={dark} />
            ))}
          </MapContainer>
          {tracked.length === 0 && <div className="aircraft-map-empty">Waiting for aircraft position reports.</div>}
          <div className="aircraft-map-count"><span className="map-live-dot"/>{tracked.length} positioned · {aircraft.length} in fleet</div>
        </div>
        <div className="aircraft-map-legend" aria-label="Aircraft map legend">
          <span><i className="tone-air"/>Airborne</span>
          <span><i className="tone-stopped"/>Stopped</span>
          <span><i className="tone-ground"/>On ground</span>
          <span><i className="tone-parked"/>Parked 12h+</span>
        </div>
      </div>
      <aside className="aircraft-map-roster">
        <div className="aircraft-map-roster-heading"><strong>Fleet positions</strong><span>{tracked.length}/{aircraft.length} tracked</span></div>
        <div className="aircraft-map-roster-list">
          {aircraft.map(item => {
            const position = positions[item.id];
            const state = aircraftState(position);
            const hasPosition = !!position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude);
            return <article className="aircraft-map-roster-item" key={item.id}>
              <span className={"aircraft-status-dot " + state.tone}/>
              <div className="aircraft-map-roster-copy">
                <strong>{item.registration || "Aircraft"}</strong>
                <span>{state.label}{position?.lastPilotUsername ? " · " + position.lastPilotUsername : ""}</span>
                {hasPosition && <small>{position.latitude.toFixed(2)}, {position.longitude.toFixed(2)} · {ageLabel(position.updatedAt)}</small>}
              </div>
            </article>;
          })}
        </div>
        <div className="aircraft-map-roster-summary">
          <span><i className="tone-air"/>{counts.air || 0} airborne</span>
          <span><i className="tone-ground"/>{counts.ground || 0} ground</span>
          <span><i className="tone-stopped"/>{counts.stopped || 0} stopped</span>
          <span><i className="tone-parked"/>{counts.parked || 0} parked</span>
        </div>
      </aside>
    </div>
  );
}
