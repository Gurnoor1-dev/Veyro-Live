import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./AircraftLiveMap.css";

maplibregl.setWorkerUrl(mapWorkerUrl);

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
type TrackedAircraft = { aircraft: any; position: AircraftPosition };

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
function markerElement(position: AircraftPosition, tone: string) {
  const root = document.createElement("div");
  root.className = "veyro-map-aircraft tone-" + tone;
  root.setAttribute("aria-label", aircraftState(position).label);
  root.innerHTML = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1.5 14.6 10l7.1 4.1v2.8l-7.1-2.2v7l2.7 1.8v2.1L12 24l-5.3 1.6v-2.1L9.4 21v-7l-7.1 2.2v-2.8L9.4 10z"/></svg>';
  root.style.transform = "rotate(" + Number(position.heading || 0) + "deg)";
  return root;
}
function popupElement(aircraft: any, position: AircraftPosition, state: ReturnType<typeof aircraftState>) {
  const root = document.createElement("div");
  root.className = "veyro-map-popup";
  const title = document.createElement("strong");
  title.textContent = aircraft.registration || "Fleet aircraft";
  const subtitle = document.createElement("span");
  subtitle.textContent = (position.lastPilotUsername || "Pilot not reported") + " · " + state.label;
  const metrics = document.createElement("div");
  [Math.round(position.altitude || 0).toLocaleString() + " ft", Math.round(position.speed || 0) + " kt", Math.round(position.heading || 0) + "° HDG", Math.round(position.verticalSpeed || 0) + " ft/min"].forEach(value => {
    const item = document.createElement("b");
    item.textContent = value;
    metrics.append(item);
  });
  const coordinates = document.createElement("small");
  coordinates.textContent = position.latitude.toFixed(4) + ", " + position.longitude.toFixed(4) + " · " + ageLabel(position.updatedAt);
  root.append(title, subtitle, metrics, coordinates);
  return root;
}
function styleUrl(dark: boolean) {
  const key = import.meta.env.VITE_MAPTILER_API_KEY?.trim();
  if (!key) return "https://demotiles.maplibre.org/style.json";
  const style = dark ? "streets-v4-dark" : "streets-v4";
  return "https://api.maptiler.com/maps/" + style + "/style.json?key=" + encodeURIComponent(key);
}

export default function AircraftLiveMap({ aircraft, positions, dark }: {
  aircraft: any[];
  positions: Record<string, AircraftPosition>;
  dark: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const hasFittedRef = useRef(false);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const tracked = useMemo<TrackedAircraft[]>(() => aircraft.flatMap(item => {
    const position = positions[item.id];
    return position &&
      Number.isFinite(position.latitude) &&
      Number.isFinite(position.longitude) &&
      Math.abs(position.latitude) <= 90 &&
      Math.abs(position.longitude) <= 180
      ? [{ aircraft: item, position }]
      : [];
  }), [aircraft, positions]);
  const counts = useMemo(() => tracked.reduce((result, item) => {
    const tone = aircraftState(item.position).tone;
    result[tone] = (result[tone] || 0) + 1;
    return result;
  }, {} as Record<string, number>), [tracked]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(dark),
      center: [10, 25],
      zoom: 2,
      attributionControl: true,
      maplibreLogo: true,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapReady(true));
    map.on("error", event => {
      const message = event.error?.message || "Map tiles could not be loaded.";
      if (/401|403|key|unauthor/i.test(message)) setMapError("Map provider rejected the key. Check the VITE_MAPTILER_API_KEY setting and its allowed domain.");
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setMapError("");
    map.setStyle(styleUrl(dark));
  }, [dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = tracked.map(({ aircraft: item, position }) => {
      const state = aircraftState(position);
      const popup = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: "280px" })
        .setDOMContent(popupElement(item, position, state));
      const marker = new maplibregl.Marker({
        element: markerElement(position, state.tone),
        anchor: "center",
      }).setLngLat([position.longitude, position.latitude]).setPopup(popup).addTo(map);
      return marker;
    });
    if (!hasFittedRef.current && tracked.length) {
      if (tracked.length === 1) map.flyTo({ center: [tracked[0].position.longitude, tracked[0].position.latitude], zoom: 5, duration: 700 });
      else {
        const bounds = new maplibregl.LngLatBounds();
        tracked.forEach(item => bounds.extend([item.position.longitude, item.position.latitude]));
        map.fitBounds(bounds, { padding: 54, maxZoom: 6, duration: 700 });
      }
      hasFittedRef.current = true;
    }
  }, [mapReady, tracked]);

  return (
    <div className="aircraft-map-layout">
      <div className="aircraft-map-main">
        <div className="aircraft-map-frame">
          <div ref={containerRef} className="aircraft-live-map" />
          {!mapReady && <div className="aircraft-map-loading-overlay">Preparing vector map…</div>}
          {mapError && <div className="aircraft-map-error">{mapError}</div>}
          <div className="aircraft-map-count"><span className="map-live-dot"/>{tracked.length} positioned · {aircraft.length} in fleet</div>
        </div>
        <div className="aircraft-map-legend" aria-label="Aircraft map legend">
          <span><i className="tone-air"/>Airborne</span>
          <span><i className="tone-stopped"/>Stopped</span>
          <span><i className="tone-ground"/>On ground</span>
          <span><i className="tone-parked"/>Parked 12h+</span>
        </div>
        {!import.meta.env.VITE_MAPTILER_API_KEY && <p className="aircraft-map-provider-note">Using MapLibre demo tiles. Add a MapTiler key for production map coverage.</p>}
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
