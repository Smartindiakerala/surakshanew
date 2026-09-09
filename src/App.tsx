import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  demoLocation,
  demoRescuerLocation,
  initialFieldUnits,
  initialSos,
  mapCenter,
  roads as seedRoads,
  shelters as seedShelters,
  zones as seedZones,
} from "./data";
import {
  CommMethod,
  CommState,
  Road,
  RoadStatus,
  Shelter,
  Sos,
  Zone,
  CampStatus,
  ResourceStatus,
  RouteStep,
  DestinationType,
  VictimLocation,
  FieldUnit,
} from "./types";
import { calculateSafeRoadRoute, RoadRoute } from "./services/routing";

const icon = (color: string, glyph: string) =>
  L.divIcon({
    className: "pin-wrap",
    html: `<span class="map-pin" style="--pin:${color}">${glyph}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
const campIcon = icon("#12b981", "⌂"),
  victimIcon = icon("#38bdf8", "•"),
  manualVictimIcon = icon("#c084fc", "•"),
  criticalVictimIcon = icon("#f65a5a", "!"),
  rescueIcon = icon("#fbbf24", "✚");
const roadColor: Record<RoadStatus, string> = {
  safe: "#4ade80",
  "at-risk": "#fbbf24",
  flooded: "#ef4444",
  blocked: "#111827",
  destroyed: "#c026d3",
};
const zoneColor: Record<string, string> = {
  flooded: "#ef4444",
  risk: "#f59e0b",
};

function MapClick({ onClick }: { onClick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}
function VictimMarker({ victim, selected }: { victim: Sos; selected: boolean }) {
  const markerRef = useRef<L.Marker | null>(null);
  const lat = Number(victim.lat);
  const lng = Number(victim.lng);
  useEffect(() => {
    if (selected) markerRef.current?.openPopup();
  }, [selected]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (import.meta.env.DEV) console.error("Invalid victim coordinates", victim);
    return null;
  }
  const critical = victim.critical > 0;
  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={critical ? criticalVictimIcon : victimIcon}
      zIndexOffset={selected ? 1000 : critical ? 500 : 0}
    >
      <Popup autoPan autoClose={false}>
        <strong>{critical ? "🚨 CRITICAL VICTIM" : "VICTIM SOS"}</strong>
        <br />
        SOS ID: {victim.id}
        <br />
        Priority: {victim.priority}
        <br />
        Critical: C{victim.critical}
        <br />
        People: {victim.people}
        <br />
        Phone: {victim.phone}
        <br />
        Location: {lat.toFixed(4)}, {lng.toFixed(4)}
        <br />
        Source: {victim.locationSource} LOCATION
        <br />
        Communication: {victim.method}
        <br />
        Status: {victim.status}
      </Popup>
    </Marker>
  );
}
function MapFocus({
  focus,
  victimId,
}: {
  focus: [number, number] | null;
  victimId?: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView(focus, 16, { animate: true });
  }, [focus, map]);
  return null;
}
function DisasterMap({
  zones,
  roads,
  shelters,
  rescuer,
  victims,
  selectedVictim,
  mapFocus,
  showRoutes,
  routePath,
  drawMode,
  onMapClick,
  onCamp,
  onRoad,
  victimLocation,
  manualLocationMode,
  fieldUnits,
}: {
  zones: Zone[];
  roads: Road[];
  shelters: Shelter[];
  rescuer: [number, number];
  victims?: Sos[];
  selectedVictim?: Sos | null;
  mapFocus?: [number, number] | null;
  showRoutes: boolean;
  routePath?: [number, number][];
  drawMode: boolean;
  onMapClick: (p: [number, number]) => void;
  onCamp: (s: Shelter) => void;
  onRoad: (r: Road) => void;
  victimLocation?: VictimLocation | null;
  manualLocationMode?: boolean;
  fieldUnits?: FieldUnit[];
}) {
  return (
    <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className={`map ${manualLocationMode ? "manual-location-mode" : ""}`}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url={
          import.meta.env.VITE_MAP_TILE_URL ||
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        }
      />
      <MapClick onClick={onMapClick} />
      {zones.map((z) => (
        <Polygon
          key={z.id}
          positions={z.polygon}
          pathOptions={{
            color: zoneColor[z.type],
            fillColor: zoneColor[z.type],
            fillOpacity: 0.2,
            weight: 2,
          }}
        >
          <Popup>
            <strong>
              {z.type === "flooded" ? "FLOODED AREA" : "AT-RISK AREA"}
            </strong>
            <br />
            {z.name}
            <br />
            Severity: {z.severity}
          </Popup>
        </Polygon>
      ))}
      {roads.map((r) => (
        <Polyline
          key={r.id}
          positions={r.path}
          pathOptions={{
            color: roadColor[r.status],
            weight: r.status === "safe" ? 5 : 7,
            opacity: 0.9,
            dashArray:
              r.status === "blocked" || r.status === "destroyed"
                ? "8 8"
                : undefined,
          }}
          eventHandlers={{ click: () => onRoad(r) }}
        >
          <Popup>
            <strong>ROAD ALERT</strong>
            <br />
            {r.name}
            <br />
            Status: {r.status.toUpperCase()}
            <br />
            Severity: {r.severity}
            <br />
            Reported: {r.reported}
            <br />
            <b>{r.status === "safe" ? "SAFE TO USE" : "DO NOT USE"}</b>
          </Popup>
        </Polyline>
      ))}
      {shelters.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={campIcon}
          eventHandlers={{ click: () => onCamp(s) }}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />
            {s.distance} · {s.capacity - s.occupancy} spaces available
            <br />
            Status: {s.status}
          </Popup>
        </Marker>
      ))}
      <Marker position={victimLocation ? [victimLocation.latitude, victimLocation.longitude] : demoLocation} icon={victimLocation?.source === "MANUAL" ? manualVictimIcon : victimIcon}>
        <Popup>
          <strong>YOUR LOCATION</strong>
          <br />
          Source: {victimLocation?.source === "MANUAL" ? "Manual Selection" : "GPS Location"}
          <br />
          Latitude: {(victimLocation?.latitude ?? demoLocation[0]).toFixed(5)}
          <br />
          Longitude: {(victimLocation?.longitude ?? demoLocation[1]).toFixed(5)}
        </Popup>
      </Marker>
      {victims?.map((victim) => (
        <VictimMarker
          key={victim.id}
          victim={victim}
          selected={selectedVictim?.id === victim.id}
        />
      ))}
      {(fieldUnits || [{ id: "unit-01", name: "Unit 01", rescuer: "Rescuer 1", latitude: rescuer[0], longitude: rescuer[1], status: "LIVE" as const, lastUpdate: "now" }]).map((unit) => <Marker key={unit.id} position={[unit.latitude, unit.longitude]} icon={rescueIcon}><Popup><strong>{unit.name} · {unit.rescuer}</strong><br />{unit.status} · Updated {unit.lastUpdate}<br />{unit.latitude.toFixed(5)}, {unit.longitude.toFixed(5)}</Popup></Marker>)}
      <MapFocus focus={mapFocus || null} victimId={selectedVictim?.id} />
      {routePath && (
        <Polyline
          positions={routePath}
          pathOptions={{
            color: "#22c55e",
            weight: 7,
            opacity: 1,
            dashArray: selectedVictim ? "10 8" : undefined,
          }}
        />
      )}
      {drawMode && (
        <div className="map-draw-hint">DRAW MODE · CLICK MAP TO ADD POINTS</div>
      )}
    </MapContainer>
  );
}

function Topbar({
  privateView,
  onLogin,
  onHome,
  onLogout,
}: {
  privateView: boolean;
  onLogin: () => void;
  onHome: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome}><span className="brand-mark">R</span><span><b>RAKSHA LINK</b><small>Emergency disaster response</small></span></button>
      <nav className="role-tabs" aria-label="Application areas"><button className={!privateView ? "active" : ""} onClick={onHome}>Victim <small>Public</small></button><button className={privateView ? "active" : ""} onClick={onLogin}>Rescuer <small>Private</small></button></nav>
      <div className="top-actions"><span className="live-dot"><i /> SYSTEM OPERATIONAL</span>{privateView ? <button className="ghost-button" onClick={onLogout}>Sign out</button> : <button className="login-link" onClick={onLogin}>Rescuer login <span>↗</span></button>}</div>
    </header>
  );
}
function Legend() {
  return <div className="legend"><b>LIVE MAP KEY</b><span><i className="dot flood" />Flooded</span><span><i className="dot risk" />At risk</span><span><i className="dot blocked" />Blocked / destroyed</span><span><i className="dot safe" />Safe route</span><span><i className="dot camp" />Relief camp</span></div>;
}
function Panel({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          {eyebrow && <small>{eyebrow}</small>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function VictimPage({
  zones,
  roads,
  shelters,
  comm,
  setComm,
  sos,
  setSos,
  victimLocation,
  setVictimLocation,
  onLogin,
}: {
  zones: Zone[];
  roads: Road[];
  shelters: Shelter[];
  comm: CommState;
  setComm: React.Dispatch<React.SetStateAction<CommState>>;
  sos: Sos[];
  setSos: React.Dispatch<React.SetStateAction<Sos[]>>;
  victimLocation: VictimLocation;
  setVictimLocation: React.Dispatch<React.SetStateAction<VictimLocation>>;
  onLogin: () => void;
}) {
  const [selected, setSelected] = useState<Shelter | null>(shelters[0]);
  const [route, setRoute] = useState(false);
  const [destinationType, setDestinationType] = useState<DestinationType>("RELIEF_CAMP");
  const [navigationStep, setNavigationStep] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [phone, setPhone] = useState("+91 98765 43210");
  const [people, setPeople] = useState(1);
  const [critical, setCritical] = useState(0);
  const [notice, setNotice] = useState("");
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  useEffect(() => {
    if (!route || !selected) return;
    const controller = new AbortController();
    setRouteLoading(true);
    setRouteError("");
    calculateSafeRoadRoute(victimLocation, selected, roads, controller.signal)
      .then(setRoadRoute)
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") {
          setRoadRoute(null);
          setRouteError("Unable to calculate a safe road route. Check your connection and try again.");
        }
      })
      .finally(() => setRouteLoading(false));
    return () => controller.abort();
  }, [route, selected, victimLocation, roads]);
  const routePath = roadRoute?.path || null;
  const navigationSteps = roadRoute?.steps || [];
  const method =
    comm.method === "AUTO"
      ? comm.internet
        ? "4G / 5G"
        : comm.cellular
          ? "SMS"
          : "USSD"
      : comm.method;
  const payload = `RAKSHA|SOS|${phone.replace(/\s/g, "")}|01|${people}|C${critical}|${victimLocation.latitude},${victimLocation.longitude}`;
  const sendSos = () => {
    const id = `RL-SOS-${1025 + sos.length}`;
    const item: Sos = {
      id,
      phone,
      lat: victimLocation.latitude,
      lng: victimLocation.longitude,
      locationSource: victimLocation.source,
      cityCode: "01",
      people,
      critical,
      priority: critical ? "CRITICAL" : people > 3 ? "HIGH" : "MEDIUM",
      score: critical ? 94 : 58,
      method: method as CommMethod,
      payload,
      status: "TRANSMITTED",
      createdAt: "just now",
    };
    setSos([item, ...sos]);
    setComm((c) => ({
      ...c,
      lastEvent: `SOS ${id} acknowledged by demo gateway`,
      lastSosId: id,
    }));
    setNotice(
      `${id} transmitted via ${method}. Demo gateway acknowledged receipt.`,
    );
    setSosOpen(false);
  };
  return (
    <>
      <Topbar
        privateView={false}
        onLogin={onLogin}
        onHome={() => {}}
        onLogout={() => {}}
      />
      <main className="page victim-page">
        <div className="hero-copy">
          <div>
            <span className="eyebrow">
              THRISSUR · CITY CODE 01 · URBAN FLOOD
            </span>
            <h1>
              Get to safety,
              <br />
              <em>together.</em>
            </h1>
            <p>
              A live picture of the roads around you, connected to the people
              moving help.
            </p>
          </div>
          <div className="network-chip">
            <i className={comm.internet ? "online" : "offline"} />
            {comm.internet ? "Network connected" : "Internet unavailable"}
            <small>
              {comm.internet
                ? "4G / 5G primary"
                : comm.cellular
                  ? "SMS fallback ready"
                  : "USSD fallback ready"}
            </small>
          </div>
        </div>
        <div className="map-layout">
          <div className="map-card">
            <div className="map-toolbar">
              <span>
                <i className="live-dot">
                  <i />
                </i>{" "}
                LIVE DISASTER MAP
              </span>
              <button className="map-mode" onClick={() => setManualLocationMode((active) => !active)}>{manualLocationMode ? "LOCATION MODE ACTIVE" : "📍 SET LOCATION MANUALLY"}</button>
            </div>
            {manualLocationMode && <div className="manual-location-banner">Click on the map to set your current location.</div>}
            <DisasterMap
              zones={zones}
              roads={roads}
              shelters={shelters}
              rescuer={demoRescuerLocation}
              showRoutes={false}
              routePath={routePath || undefined}
              drawMode={false}
              victimLocation={victimLocation}
              manualLocationMode={manualLocationMode}
              onMapClick={(point) => {
                if (!manualLocationMode) return;
                const [latitude, longitude] = point;
                if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setNotice("Unable to set location. Please select another point."); return; }
                setVictimLocation({ latitude, longitude, source: "MANUAL" });
                setManualLocationMode(false);
                setRoute(false);
                setNavigationStep(0);
                setNotice(`Manual location set at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}. Safe routes recalculated.`);
              }}
              onCamp={setSelected}
              onRoad={() => {}}
            />
            <Legend />
          </div>
          <aside className="side-stack">
            <Panel eyebrow="YOUR LOCATION" title="Nearest safe shelter">
              <div className="location-row">
                <div className="location-pulse">⌖</div>
                <div>
                  <b>YOUR LOCATION · {victimLocation.source}</b>
                  <small>{victimLocation.latitude.toFixed(5)}° N · {victimLocation.longitude.toFixed(5)}° E</small>
                </div>
                <button className="tiny-button" onClick={() => { setVictimLocation({ latitude: demoLocation[0], longitude: demoLocation[1], source: "GPS" }); setRoute(false); }}>USE MY GPS LOCATION</button>
              </div>
              <p className="location-disclaimer">Manual location is approximate. For better accuracy, enable GPS when available.</p>
              {selected && (
                <div className="camp-focus">
                  <div>
                    <span className={`status-pill ${selected.status === "OPEN" ? "open" : "closed"}`}>{selected.status}</span>
                    <h3>{selected.name}</h3>
                    <p>
                      {selected.distance} away ·{" "}
                      {selected.capacity - selected.occupancy} spaces available
                    </p>
                    <div className="camp-resources">Medicine: {selected.medicineStatus} · Food: {selected.foodStatus}</div>
                  </div>
                  <button
                    className="select-button"
                    onClick={() => { setDestinationType("RELIEF_CAMP"); setNavigationStep(0); setRoute(true); }}
                  >
                    {route ? "ROUTE ACTIVE" : "SELECT CAMP"} <span>→</span>
                  </button>
                </div>
              )}
              <div className="camp-list">
                {shelters.map((s) => (
                  <button
                    className={`camp-item ${selected?.id === s.id ? "active" : ""}`}
                    key={s.id}
                    onClick={() => setSelected(s)}
                  >
                    <span className="camp-icon">⌂</span>
                    <span>
                      <b>{s.name.split(" · ")[0]}</b>
                      <small>
                        {s.distance} · {Math.max(0, s.capacity - s.occupancy)} free · {s.status}
                      </small>
                    </span>
                    <span className="arrow">›</span>
                  </button>
                ))}
              </div>
            </Panel>
            {route && (
              <Panel eyebrow="ROUTE RECOMMENDATION" title="Safest route">
                {routeLoading ? <div className="route-loading">CALCULATING ROAD-SAFE ROUTE…</div> : routeError ? <div className="error-note">⚠ {routeError}</div> : !routePath ? <div className="error-note">⚠ NO SAFE ROAD ROUTE AVAILABLE<br />This destination is closed/full or all known roads are affected.</div> : <>
                <div className="route-summary">
                  <strong>
                    {(roadRoute!.distanceMeters / 1000).toFixed(1)} <small>KM</small>
                  </strong>
                  <span>
                    {Math.max(1, Math.round(roadRoute!.durationSeconds / 60))} min
                    <br />
                    <small>walking</small>
                  </span>
                  <span className="route-badge">SHORTEST SAFE</span>
                </div>
                <div className="why-route">
                  <b>WHY THIS ROUTE?</b>
                  <span>✓ Avoids 2 flooded roads</span>
                  <span>✓ Avoids blocked bridge</span>
                  <span>✓ Lowest danger score · {destinationType === "RELIEF_CAMP" ? "camp is available" : "rescue unit"}</span>
                </div>
                <div className="next-turn"><small>NEXT</small><b>{navigationSteps[navigationStep]?.instruction}</b><span>{navigationSteps[navigationStep]?.road}</span><strong>{navigationSteps[navigationStep]?.distance}</strong></div>
                <div className="nav-steps">{navigationSteps.map((step, index) => <div className={index === navigationStep ? "current" : ""} key={`${step.instruction}-${index}`}><b>{step.instruction}</b><span>{step.distance}</span><small>{step.road}</small></div>)}</div>
                <button className="ghost-button full" onClick={() => setNavigationStep((step) => Math.min(step + 1, navigationSteps.length - 1))}>NEXT STEP →</button>
                <button
                  className="primary-button full"
                  onClick={() =>
                    setNotice("Navigation started. Stay on the green route.")
                  }
                >
                  START NAVIGATION <span>↗</span>
                </button>
                </>}
              </Panel>
            )}
            <button className="sos-button" onClick={() => setSosOpen(true)}>
              <span className="sos-icon">!</span>
              <span>
                <b>REQUEST RESCUE</b>
                <small>Send an emergency SOS</small>
              </span>
              <span className="sos-arrow">→</span>
            </button>
            {notice && <div className="success-note">✓ {notice}</div>}
          </aside>
        </div>
        <div className="bottom-grid">
          <Panel eyebrow="COMMUNICATION MODE" title="Always connected to help">
            <div className="comm-switches">
              {(["AUTO", "4G / 5G", "SMS", "USSD"] as CommMethod[]).map((m) => (
                <button
                  className={comm.method === m ? "selected" : ""}
                  key={m}
                  onClick={() => setComm((c) => ({ ...c, method: m }))}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="network-controls">
              <label>
                Internet{" "}
                <button
                  onClick={() =>
                    setComm((c) => ({ ...c, internet: !c.internet }))
                  }
                  className={comm.internet ? "toggle on" : "toggle"}
                >
                  {comm.internet ? "ON" : "OFF"}
                </button>
              </label>
              <label>
                Cellular{" "}
                <button
                  onClick={() =>
                    setComm((c) => ({ ...c, cellular: !c.cellular }))
                  }
                  className={comm.cellular ? "toggle on" : "toggle"}
                >
                  {comm.cellular ? "ON" : "OFF"}
                </button>
              </label>
              <span className="demo-label">DEMO GATEWAY</span>
            </div>
            <p className="comm-log">
              {comm.lastEvent ||
                `Auto-selecting the strongest available channel: ${method}`}
            </p>
          </Panel>
          <Panel eyebrow="EMERGENCY REFERENCE" title="Compact city codes">
            <div className="code-grid">
              <span>
                <b>CITY</b>01 · Thrissur
              </span>
              <span>
                <b>CRITICAL</b>C0 none · C1 one · C2 two+
              </span>
            </div>
          </Panel>
        </div>
      </main>
      {sosOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={() => setSosOpen(false)}>
              ×
            </button>
            <span className="eyebrow red">EMERGENCY SOS</span>
            <h2>Tell the command centre.</h2>
            <p>Your location will be attached automatically.</p>
            <label>
              Phone number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <div className="form-row">
              <label>
                People
                <input
                  type="number"
                  min="1"
                  value={people}
                  onChange={(e) => setPeople(Number(e.target.value))}
                />
              </label>
              <label>
                Critical people
                <select
                  value={critical}
                  onChange={(e) => setCritical(Number(e.target.value))}
                >
                  <option value="0">None</option>
                  <option value="1">1 person</option>
                  <option value="2">2 people</option>
                </select>
              </label>
            </div>
            <div className="payload-preview">
              <b>TRANSMISSION PREVIEW · {method}</b>
              <code>{payload}</code>
            </div>
            <button className="primary-button full" onClick={sendSos}>
              TRANSMIT SOS <span>↗</span>
            </button>
            <small className="fine-print">
              This is a simulated {method} gateway for the localhost prototype.
            </small>
          </div>
        </div>
      )}
    </>
  );
}

function Login({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [user, setUser] = useState("Rescuer 1");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <Topbar
        privateView={false}
        onLogin={() => {}}
        onHome={onBack}
        onLogout={() => {}}
      />
      <main className="login-page">
        <div className="login-art">
          <span className="eyebrow">RAKSHA LINK · SECURE ACCESS</span>
          <h1>
            The view that
            <br />
            <em>moves help.</em>
          </h1>
          <p>
            Command centre tools for a city that needs everyone looking in the
            same direction.
          </p>
          <div className="login-stats">
            <span>
              <b>03</b> active zones
            </span>
            <span>
              <b>08</b> active victims
            </span>
            <span>
              <b>24/7</b> response
            </span>
          </div>
        </div>
        <div className="login-card">
          <span className="eyebrow">COMMAND CENTRE</span>
          <h2>Welcome back.</h2>
          <p>Sign in with your response team credentials.</p>
          <label>
            Rescuer account
            <select value={user} onChange={(e) => setUser(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>Rescuer {n}</option>
              ))}
            </select>
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Enter demo password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="error-note">{error}</div>}
          <button
            className="primary-button full"
            onClick={() =>
              password
                ? onSuccess()
                : setError("Enter the demo password to continue.")
            }
          >
            AUTHENTICATE <span>↗</span>
          </button>
          <div className="demo-credentials">
            <b>DEMO CREDENTIALS</b>
            <span>
              All six accounts · password: <strong>raksha123</strong>
            </span>
          </div>
          <button className="back-link" onClick={onBack}>
            ← Return to public map
          </button>
        </div>
      </main>
    </>
  );
}
function CampManagement({ shelters, setShelters, onUpdate }: { shelters: Shelter[]; setShelters: React.Dispatch<React.SetStateAction<Shelter[]>>; onUpdate: (message: string) => void }) {
  const [editing, setEditing] = useState<Shelter | null>(null);
  const save = () => {
    if (!editing) return;
    const next = { ...editing, occupancy: Math.min(editing.capacity, Math.max(0, editing.occupancy)), status: editing.occupancy >= editing.capacity ? "FULL" as CampStatus : editing.status === "FULL" ? "OPEN" as CampStatus : editing.status };
    setShelters((items) => items.map((item) => item.id === next.id ? next : item));
    setEditing(null);
    onUpdate(`${next.name.split(" · ")[0]} updated successfully. Victim information is synced.`);
  };
  return <Panel eyebrow="RESOURCE OPERATIONS" title="Relief camp management"><div className="camp-management-grid">{shelters.map((camp) => <div className="camp-admin-card" key={camp.id}><div className="camp-admin-head"><div><b>{camp.name.split(" · ")[0]}</b><small>{camp.name.split(" · ")[1]}</small></div><span className={`status-pill ${camp.status === "OPEN" ? "open" : "closed"}`}>{camp.status}</span></div><div className="camp-admin-stats"><span>Capacity <b>{camp.capacity}</b></span><span>Occupied <b>{camp.occupancy}</b></span><span>Available <b>{Math.max(0, camp.capacity - camp.occupancy)}</b></span></div><div className="camp-admin-resources"><span>Medicine <b>{camp.medicineStatus}</b></span><span>Food <b>{camp.foodStatus}</b></span><span>Supplies <b>{camp.emergencySupplies}</b></span></div><button className="primary-button full" onClick={() => setEditing({ ...camp })}>UPDATE CAMP <span>↗</span></button></div>)}</div>{editing && <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => setEditing(null)}>×</button><span className="eyebrow">UPDATE RELIEF CAMP</span><h2>{editing.name.split(" · ")[0]}</h2><div className="form-row"><label>Capacity<input type="number" value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} /></label><label>Occupancy<input type="number" value={editing.occupancy} onChange={(e) => setEditing({ ...editing, occupancy: Number(e.target.value) })} /></label></div><div className="form-row"><label>Medicine<select value={editing.medicineStatus} onChange={(e) => setEditing({ ...editing, medicineStatus: e.target.value as ResourceStatus })}><option>AVAILABLE</option><option>LOW</option><option>OUT OF STOCK</option></select></label><label>Medical kits<input type="number" value={editing.medicalKits} onChange={(e) => setEditing({ ...editing, medicalKits: Number(e.target.value) })} /></label></div><div className="form-row"><label>Food<select value={editing.foodStatus} onChange={(e) => setEditing({ ...editing, foodStatus: e.target.value as ResourceStatus })}><option>AVAILABLE</option><option>LOW</option><option>OUT OF STOCK</option></select></label><label>Food stock<input type="number" value={editing.foodStock} onChange={(e) => setEditing({ ...editing, foodStock: Number(e.target.value) })} /></label></div><div className="form-row"><label>Emergency supplies<select value={editing.emergencySupplies} onChange={(e) => setEditing({ ...editing, emergencySupplies: e.target.value as ResourceStatus })}><option>AVAILABLE</option><option>LOW</option><option>OUT OF STOCK</option></select></label><label>Camp status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as CampStatus })}><option>OPEN</option><option>FULL</option><option>CLOSED</option><option>EMERGENCY</option></select></label></div><button className="primary-button full" onClick={save}>SAVE CHANGES <span>↗</span></button></div></div>}</Panel>;
}

function RescuerDashboard({
  zones,
  setZones,
  roads,
  setRoads,
  shelters,
  setShelters,
  sos,
  setSos,
  comm,
  onLogout,
}: {
  zones: Zone[];
  setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
  roads: Road[];
  setRoads: React.Dispatch<React.SetStateAction<Road[]>>;
  shelters: Shelter[];
  setShelters: React.Dispatch<React.SetStateAction<Shelter[]>>;
  sos: Sos[];
  setSos: React.Dispatch<React.SetStateAction<Sos[]>>;
  comm: CommState;
  onLogout: () => void;
}) {
  const [drawMode, setDrawMode] = useState<Zone["type"] | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [roadMode, setRoadMode] = useState(false);
  const [unitLocationMode, setUnitLocationMode] = useState(false);
  const [fieldUnits, setFieldUnits] = useState<FieldUnit[]>(initialFieldUnits);
  const [selectedUnitId, setSelectedUnitId] = useState(initialFieldUnits[0].id);
  const [flash, setFlash] = useState("");
  const [selectedVictim, setSelectedVictim] = useState<Sos | null>(null);
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
  const [victimRoute, setVictimRoute] = useState<RoadRoute | null>(null);
  const critical = useMemo(
    () => [...sos].sort((a, b) => b.score - a.score),
    [sos],
  );
  useEffect(() => {
    if (!selectedVictim) { setVictimRoute(null); return; }
    const controller = new AbortController();
    calculateSafeRoadRoute({ latitude: demoRescuerLocation[0], longitude: demoRescuerLocation[1], source: "GPS" }, [selectedVictim.lat, selectedVictim.lng], roads, controller.signal)
      .then(setVictimRoute)
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setVictimRoute(null); });
    return () => controller.abort();
  }, [selectedVictim, roads]);
  const handleViewVictim = (sosId: string) => {
    const victim = sos.find((item) => item.id === sosId);
    if (!victim) {
      console.error("Victim SOS not found:", sosId);
      return;
    }
    const lat = Number(victim.lat);
    const lng = Number(victim.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error("Invalid victim coordinates", victim);
      setFlash(`LOCATION UNAVAILABLE · ${victim.id}`);
      return;
    }
    setSelectedVictim(victim);
    setMapFocus([lat, lng]);
    setFlash(`${victim.id} selected · map centered on victim location.`);
  };
  const saveZone = () => {
    if (points.length < 3 || !drawMode) return;
    setZones((z) => [
      ...z,
      {
        id: `zone-${Date.now()}`,
        name: drawMode === "flooded" ? "New flooded sector" : "New risk sector",
        type: drawMode,
        severity: "HIGH",
        polygon: points,
      },
    ]);
    setPoints([]);
    setDrawMode(null);
    setFlash("Zone published to every connected victim map.");
  };
  const markRoad = (road: Road) => {
    if (!roadMode) return;
    setRoads((rs) =>
      rs.map((r) =>
        r.id === road.id
          ? { ...r, status: "blocked", severity: "CRITICAL" }
          : r,
      ),
    );
    setRoadMode(false);
    setFlash(`${road.name} marked blocked. Safe routes will recalculate.`);
  };
  const handleRescuerMapClick = (point: [number, number]) => {
    if (drawMode) {
      setPoints((current) => [...current, point]);
      return;
    }
    if (unitLocationMode) {
      setFieldUnits((units) => units.map((unit) => unit.id === selectedUnitId ? { ...unit, latitude: point[0], longitude: point[1], lastUpdate: "just now", status: "LIVE" } : unit));
      setUnitLocationMode(false);
      setFlash(`${fieldUnits.find((unit) => unit.id === selectedUnitId)?.name || "Field unit"} location updated at ${point[0].toFixed(5)}, ${point[1].toFixed(5)}.`);
    }
  };
  const addFieldUnit = () => {
    const number = fieldUnits.length + 1;
    const unit: FieldUnit = { id: `unit-${String(number).padStart(2, "0")}`, name: `Unit ${String(number).padStart(2, "0")}`, rescuer: `Rescuer ${number}`, latitude: demoRescuerLocation[0] + number * 0.002, longitude: demoRescuerLocation[1] + number * 0.002, status: "LIVE", lastUpdate: "just now" };
    setFieldUnits((units) => [...units, unit]);
    setSelectedUnitId(unit.id);
    setFlash(`${unit.name} added. Select SET MAP LOCATION to place it precisely.`);
  };
  return (
    <>
      <Topbar
        privateView
        onLogin={() => {}}
        onHome={() => {}}
        onLogout={onLogout}
      />
      <main className="page dashboard">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">
              COMMAND CENTRE · SHIFT A · 09 SEP 2026
            </span>
            <h1>
              Good morning, <em>Rescuer 1.</em>
            </h1>
            <p>Here is what needs attention across Thrissur right now.</p>
          </div>
          <div className="live-status">
            <i /> LIVE SYNC <small>WebSocket connected</small>
          </div>
        </div>
        <div className="metric-row">
          <div>
            <span>ACTIVE EMERGENCIES</span>
            <b>
              {sos
                .filter((s) => s.status !== "ACKNOWLEDGED")
                .length.toString()
                .padStart(2, "0")}
            </b>
            <small className="red-text">↑ 2 since 08:00</small>
          </div>
          <div>
            <span>FLOODED AREAS</span>
            <b>
              {zones
                .filter((z) => z.type === "flooded")
                .length.toString()
                .padStart(2, "0")}
            </b>
            <small>1 critical</small>
          </div>
          <div>
            <span>ROAD ALERTS</span>
            <b>
              {roads
                .filter((r) => r.status !== "safe")
                .length.toString()
                .padStart(2, "0")}
            </b>
            <small className="amber-text">2 need action</small>
          </div>
          <div>
            <span>PEOPLE SHELTERED</span>
            <b>576</b>
            <small className="green-text">68% capacity</small>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="dash-map-wrap">
            <Panel
              eyebrow="SITUATIONAL AWARENESS"
              title="Live disaster map"
              action={
                <span className="map-live-tag">
                  <i /> SYNCED
                </span>
              }
            >
              <div className="dash-map">
                <DisasterMap
                  zones={zones}
                  roads={roads}
                  shelters={shelters}
                  rescuer={demoRescuerLocation}
                  fieldUnits={fieldUnits}
                  victims={sos}
                  selectedVictim={selectedVictim}
                  mapFocus={mapFocus}
                  routePath={victimRoute?.path}
                  showRoutes={false}
                  drawMode={!!drawMode}
                  onMapClick={handleRescuerMapClick}
                  onCamp={() => {}}
                  onRoad={markRoad}
                />
              </div>
              {(drawMode || roadMode || unitLocationMode) && (
                <div className="map-action-bar">
                  {unitLocationMode ? (
                    <><b>Field unit placement</b><span>Click anywhere on the map to place {fieldUnits.find((unit) => unit.id === selectedUnitId)?.name}</span><button className="text-button" onClick={() => setUnitLocationMode(false)}>CANCEL</button></>
                  ) : drawMode ? (
                    <>
                      <b>
                        {drawMode === "flooded" ? "Flooded" : "At-risk"} area
                        drawing
                      </b>
                      <span>
                        {points.length} points · click 3+ points on map
                      </span>
                      <button onClick={saveZone}>SAVE ZONE</button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setDrawMode(null);
                          setPoints([]);
                        }}
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <>
                      <b>Road marking mode</b>
                      <span>Click a road to mark it blocked</span>
                      <button
                        className="text-button"
                        onClick={() => setRoadMode(false)}
                      >
                        CANCEL
                      </button>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </div>
          <aside className="dash-sidebar">
            <Panel
              eyebrow="INCOMING PRIORITY"
              title="Active emergencies"
              action={<span className="count-badge">{sos.length}</span>}
            >
              {critical.map((item) => (
                <div
                  className={`sos-row ${item.priority === "CRITICAL" ? "critical" : ""}`}
                  key={item.id}
                >
                  <div className="sos-row-top">
                    <span className={`priority ${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                    <small>{item.createdAt}</small>
                  </div>
                  <b>{item.id}</b>
                  <span>
                    {item.people} people ·{" "}
                    {item.critical
                      ? `C${item.critical} critical`
                      : "No critical injury"}{" "}
                    · {item.method} · {item.locationSource} LOCATION
                  </span>
                  <div className="sos-row-actions">
                    <button
                      onClick={() =>
                        setSos(
                          sos.map((s) =>
                            s.id === item.id
                              ? { ...s, status: "ACKNOWLEDGED" }
                              : s,
                          ),
                        )
                      }
                    >
                      {item.status === "ACKNOWLEDGED"
                        ? "ACKNOWLEDGED"
                        : "ACKNOWLEDGE"}
                    </button>
                    <button onClick={() => handleViewVictim(item.id)}>
                      VIEW MAP ↗
                    </button>
                  </div>
                </div>
              ))}
            </Panel>
            <Panel eyebrow="RESPONSE TOOLS" title="Update the city">
              <div className="tool-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setDrawMode("flooded");
                    setRoadMode(false);
                    setUnitLocationMode(false);
                    setPoints([]);
                    setFlash("Flooded-area marking is active. Click at least three map points.");
                  }}
                >
                  <span className="tool-icon flood-bg">≋</span>
                  <span>
                    <b>Mark flooded area</b>
                    <small>Draw a live zone</small>
                  </span>
                  <i>→</i>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawMode("risk");
                    setRoadMode(false);
                    setUnitLocationMode(false);
                    setPoints([]);
                    setFlash("At-risk-area marking is active. Click at least three map points.");
                  }}
                >
                  <span className="tool-icon risk-bg">△</span>
                  <span>
                    <b>Mark at-risk area</b>
                    <small>Flag a watch zone</small>
                  </span>
                  <i>→</i>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoadMode(true);
                    setDrawMode(null);
                    setUnitLocationMode(false);
                    setFlash("Blocked-road mode is active. Click a road line on the map.");
                  }}
                >
                  <span className="tool-icon road-bg">━</span>
                  <span>
                    <b>Mark blocked road</b>
                    <small>Stop unsafe routing</small>
                  </span>
                  <i>→</i>
                </button>
              </div>
            </Panel>
          </aside>
        </div>
        <div className="dashboard-bottom">
          <Panel eyebrow="SHELTER NETWORK" title="Relief camps">
            <div className="shelter-table">
              {shelters.map((s) => (
                <div key={s.id}>
                  <span className="camp-icon">⌂</span>
                  <b>{s.name.split(" · ")[0]}</b>
                  <span>
                    {s.occupancy} / {s.capacity} occupied
                  </span>
                  <div className="capacity">
                    <i
                      style={{ width: `${(s.occupancy / s.capacity) * 100}%` }}
                    />
                  </div>
                  <strong
                    className={s.status === "FULL" ? "red-text" : "green-text"}
                  >
                    {s.status}
                  </strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="FIELD UNITS" title="Rescuer locations" action={<button className="add-unit-button" type="button" onClick={addFieldUnit}>+ ADD UNIT</button>}>
            <div className="field-unit-list">{fieldUnits.map((unit) => <div className={`field-unit-card ${selectedUnitId === unit.id ? "selected" : ""}`} key={unit.id}><div className="unit-location"><span className="unit-icon">✚</span><div><b>{unit.name} · {unit.rescuer}</b><small>{unit.latitude.toFixed(5)}° N · {unit.longitude.toFixed(5)}° E</small></div><span className="live-pill">{unit.status}</span></div><div className="unit-card-footer"><small>Last update {unit.lastUpdate}</small><button type="button" onClick={() => { setSelectedUnitId(unit.id); setUnitLocationMode(true); setDrawMode(null); setRoadMode(false); setFlash(`Click the map to place ${unit.name}.`); }}>📍 SET MAP LOCATION</button></div></div>)}</div>
            <p className="muted">Select a unit, then place or update its pin directly on the map.</p>
          </Panel>
        </div>
        <div className="camp-management-section"><CampManagement shelters={shelters} setShelters={setShelters} onUpdate={setFlash} /></div>
        {flash && <div className="toast">✓ {flash}</div>}
      </main>
    </>
  );
}

export default function App() {
  const [zones, setZones] = useState(seedZones);
  const [roads, setRoads] = useState(seedRoads);
  const [shelters, setShelters] = useState(() => {
    try {
      const saved = localStorage.getItem("raksha-shelters");
      return saved ? JSON.parse(saved) as typeof seedShelters : seedShelters;
    } catch {
      return seedShelters;
    }
  });
  const [sos, setSos] = useState(initialSos);
  const [victimLocation, setVictimLocation] = useState<VictimLocation>(() => {
    try {
      const saved = sessionStorage.getItem("raksha-victim-location");
      return saved ? JSON.parse(saved) as VictimLocation : { latitude: demoLocation[0], longitude: demoLocation[1], source: "GPS" };
    } catch {
      return { latitude: demoLocation[0], longitude: demoLocation[1], source: "GPS" };
    }
  });
  const [comm, setComm] = useState<CommState>({
    internet: true,
    cellular: true,
    method: "AUTO",
    lastEvent: "",
  });
  useEffect(() => {
    localStorage.setItem("raksha-shelters", JSON.stringify(shelters));
  }, [shelters]);
  useEffect(() => {
    sessionStorage.setItem("raksha-victim-location", JSON.stringify(victimLocation));
  }, [victimLocation]);
  const navigate = useNavigate();
  const goVictim = () => navigate("/");
  const goLogin = () => navigate("/login");
  const logout = () => { sessionStorage.removeItem("raksha-auth"); navigate("/"); };
  const victim = <VictimPage zones={zones} roads={roads} shelters={shelters} comm={comm} setComm={setComm} sos={sos} setSos={setSos} victimLocation={victimLocation} setVictimLocation={setVictimLocation} onLogin={goLogin} />;
  const rescuer = sessionStorage.getItem("raksha-auth") === "true" ? <RescuerDashboard zones={zones} setZones={setZones} roads={roads} setRoads={setRoads} shelters={shelters} setShelters={setShelters} sos={sos} setSos={setSos} comm={comm} onLogout={logout} /> : <Navigate to="/login" replace />;
  return <Routes><Route path="/" element={victim} /><Route path="/login" element={<Login onSuccess={() => { sessionStorage.setItem("raksha-auth", "true"); navigate("/rescuer"); }} onBack={goVictim} />} /><Route path="/rescuer" element={rescuer} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
