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

function ageLabel(value?: string) {
  if (!value) return "Update time unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Update time unavailable";
  const age = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return "Updated " + minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "Updated " + hours + "h ago";
  return "Updated " + Math.floor(hours / 24) + "d ago";
}

function aircraftState(position?: AircraftPosition) {
  if (!position) return { label: "Position unavailable" };
  const age = position.updatedAt ? Date.now() - new Date(position.updatedAt).getTime() : Infinity;
  if (position.state === 5) return { label: "Maintenance" };
  if (position.state === 3) return { label: "Cancelled" };
  if (position.state === 4) return { label: "Stopped" };
  if (position.isOnGround) {
    if (age > 6 * 60 * 60 * 1000) return { label: "Parked · " + ageLabel(position.updatedAt).replace("Updated ", "") };
    return { label: "On ground" };
  }
  if (position.state === 2 || position.isOnGround === false) {
    return { label: age > 30 * 60 * 1000 ? "Last known in air" : "In air" };
  }
  return { label: "Status unknown" };
}

function AircraftMapViewport({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 4);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 5 });
  }, [map, points.length]);
  return null;
}

function AircraftMapMarker({ aircraft, position, dark }: { aircraft: any; position: AircraftPosition; dark: boolean }) {
  const icon = useMemo(() => L.divIcon({
    className: "veyro-aircraft-marker",
    html: '<span class="veyro-aircraft-marker-core ' + (dark ? "is-dark" : "is-light") + '"><svg viewBox="0 0 24 28" aria-hidden="true" style="transform:rotate(' + Number(position.heading || 0) + 'deg)"><path d="M12 1.5 14.6 10l7.1 4.1v2.8l-7.1-2.2v7l2.7 1.8v2.1L12 24l-5.3 1.6v-2.1L9.4 21v-7l-7.1 2.2v-2.8L9.4 10z"/></svg></span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  }), [dark, position.heading]);

  return (
    <Marker position={[position.latitude, position.longitude]} icon={icon}>
      <Popup>
        <div className="aircraft-map-popup">
          <strong>{aircraft.registration || "Fleet aircraft"}</strong>
          <span>{position.lastPilotUsername || "Pilot not reported"} · {aircraftState(position).label}</span>
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
  const plotted = aircraft
    .map(item => ({ aircraft: item, position: positions[item.id] }))
    .filter(item =>
      item.position &&
      item.position.state === 2 &&
      item.position.isOnGround === false &&
      Number.isFinite(item.position.latitude) &&
      Number.isFinite(item.position.longitude) &&
      Number.isFinite(new Date(item.position.updatedAt || "").getTime()) &&
      Date.now() - new Date(item.position.updatedAt || "").getTime() < 30 * 60_000
    );
  const points = plotted.map(item => [item.position.latitude, item.position.longitude] as [number, number]);

  return (
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
        {plotted.length === 0 && <div className="aircraft-map-empty">No aircraft are currently reporting an active in-air position.</div>}
        {plotted.map(({ aircraft: item, position }) => (
          <AircraftMapMarker key={item.id} aircraft={item} position={position} dark={dark} />
        ))}
      </MapContainer>
      <div className="aircraft-map-count"><span className="map-live-dot"/>{plotted.length} airborne · {aircraft.length} aircraft in fleet</div>
    </div>
  );
}
