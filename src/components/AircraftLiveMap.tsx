import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Plane } from "lucide-react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import { chakra } from "@chakra-ui/react";

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
  
  // Rotate element according to the API heading
  const heading = Number(position.heading || 0);
  root.style.transform = `rotate(${heading}deg)`;
  root.style.transformOrigin = "center center";

  // Render filled Lucide Plane icon inside the marker container using React's createRoot
  const iconContainer = document.createElement("div");
  iconContainer.style.display = "flex";
  iconContainer.style.alignItems = "center";
  iconContainer.style.justifyContent = "center";
  root.appendChild(iconContainer);

  const reactRoot = createRoot(iconContainer);
  reactRoot.render(<Plane size={18} fill="currentColor" strokeWidth={1} />);

  return root;
}

function styleUrl(dark: boolean) {
  const key = import.meta.env.VITE_MAPTILER_API_KEY?.trim();
  if (!key) return "https://demotiles.maplibre.org/style.json";
  const style = dark ? "streets-v4-dark" : "streets-v4";
  return "https://api.maptiler.com/maps/" + style + "/style.json?key=" + encodeURIComponent(key);
}

export default function AircraftLiveMap({ aircraft, positions, dark, onAircraftSelect }: {
  aircraft: any[];
  positions: Record<string, AircraftPosition>;
  dark: boolean;
  onAircraftSelect?: (aircraft: any, position: AircraftPosition) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const hasFittedRef = useRef(false);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const onAircraftSelectRef = useRef(onAircraftSelect);
  useEffect(() => { onAircraftSelectRef.current = onAircraftSelect; }, [onAircraftSelect]);
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
      attributionControl: {},
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
      const element = markerElement(position, state.tone);
      element.style.cursor = "pointer";
      element.addEventListener("click", () => onAircraftSelectRef.current?.(item, position));
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([position.longitude, position.latitude]).addTo(map);
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
    <chakra.div className="aircraft-map-layout">
      <chakra.div className="aircraft-map-main">
        <chakra.div className="aircraft-map-frame">
          <chakra.div ref={containerRef} className="aircraft-live-map" />
          {!mapReady && <chakra.div className="aircraft-map-loading-overlay">Preparing vector map…</chakra.div>}
          {mapError && <chakra.div className="aircraft-map-error">{mapError}</chakra.div>}
          <chakra.div className="aircraft-map-count"><chakra.span className="map-live-dot"/>{tracked.length} positioned · {aircraft.length} in fleet</chakra.div>
        </chakra.div>
        <chakra.div className="aircraft-map-legend" aria-label="Aircraft map legend">
          <chakra.span><chakra.i className="tone-air"/>Airborne</chakra.span>
          <chakra.span><chakra.i className="tone-stopped"/>Stopped</chakra.span>
          <chakra.span><chakra.i className="tone-ground"/>On ground</chakra.span>
          <chakra.span><chakra.i className="tone-parked"/>Parked 12h+</chakra.span>
        </chakra.div>
        {!import.meta.env.VITE_MAPTILER_API_KEY && <chakra.p className="aircraft-map-provider-note">Using MapLibre demo tiles. Add a MapTiler key for production map coverage.</chakra.p>}
      </chakra.div>
      <chakra.aside className="aircraft-map-roster">
        <chakra.div className="aircraft-map-roster-heading"><chakra.strong>Fleet positions</chakra.strong><chakra.span>{tracked.length}/{aircraft.length} tracked</chakra.span></chakra.div>
        <chakra.div className="aircraft-map-roster-list">
          {aircraft.map(item => {
            const position = positions[item.id];
            const state = aircraftState(position);
            const hasPosition = !!position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude);
            return <chakra.button type="button" className="aircraft-map-roster-item" key={item.id} onClick={() => position && hasPosition && onAircraftSelectRef.current?.(item, position)} disabled={!hasPosition}>
              <chakra.span className={"aircraft-status-dot " + state.tone}/>
              <chakra.div className="aircraft-map-roster-copy">
                <chakra.strong>{item.registration || "Aircraft"}</chakra.strong>
                <chakra.span>{state.label}{position?.lastPilotUsername ? " · " + position.lastPilotUsername : ""}</chakra.span>
                {hasPosition && <chakra.small>{position.latitude.toFixed(2)}, {position.longitude.toFixed(2)} · {ageLabel(position.updatedAt)}</chakra.small>}
              </chakra.div>
            </chakra.button>;
          })}
        </chakra.div>
        <chakra.div className="aircraft-map-roster-summary">
          <chakra.span><chakra.i className="tone-air"/>{counts.air || 0} airborne</chakra.span>
          <chakra.span><chakra.i className="tone-ground"/>{counts.ground || 0} ground</chakra.span>
          <chakra.span><chakra.i className="tone-stopped"/>{counts.stopped || 0} stopped</chakra.span>
          <chakra.span><chakra.i className="tone-parked"/>{counts.parked || 0} parked</chakra.span>
        </chakra.div>
      </chakra.aside>
    </chakra.div>
  );
}
