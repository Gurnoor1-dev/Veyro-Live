import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, Compass, Download, ExternalLink,
  FileText, Globe2, Layers3, LogOut, Menu, Moon, Plane, RefreshCw, Search,
  Settings2, ShieldCheck, Sun, Users, X, Zap
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { invokeFunction } from "../lib/functions";
import AircraftLiveMap from "../components/AircraftLiveMap";
import "./virtual-blue.css";

type View = "overview" | "fleet" | "schedules" | "flightbag" | "dispatch" | "crew" | "admin";
type AircraftPosition = {
  id: string; state?: number; isOnGround?: boolean; latitude: number; longitude: number;
  altitude?: number; heading?: number; speed?: number; verticalSpeed?: number;
  lastPilotId?: string | null; lastPilotUsername?: string | null; updatedAt?: string;
};
const ORG_SLUG = "virtualblue";
const viewLabels: Record<View, string> = {
  overview: "Operations overview", fleet: "Fleet", schedules: "Flight schedules",
  flightbag: "Flight bag", dispatch: "Dispatch", crew: "Crew", admin: "Administration"
};
const statusText = (status: number) => ({
  0: "Unknown", 1: "Scheduled", 2: "Boarding", 3: "Boarded", 4: "Taxiing",
  6: "In flight", 7: "Diverted", 8: "Delayed", 9: "Cancelled", 10: "Taxiing", 11: "Arrived"
} as Record<number, string>)[status] || "Scheduled";
const airport = (value: any) => typeof value === "string" ? value : String(value?.icao || value?.icaoCode || value?.code || "—");
const time = (value?: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Any time";
const routeText = (item: any) => (item.originIcao || "—") + " → " + (item.destinationIcao || "—");

function dispatchUrl(form: { airline: string; flightNumber: string; type: string; registration: string; origin: string; destination: string; route: string; units: string }) {
  const url = new URL("https://dispatch.simbrief.com/options/custom");
  const params: Record<string, string> = {
    airline: form.airline.trim().toUpperCase(),
    fltnum: form.flightNumber.trim(),
    type: form.type.trim().toUpperCase(),
    orig: form.origin.trim().toUpperCase(),
    dest: form.destination.trim().toUpperCase(),
    units: form.units,
    navlog: "1",
    notams: "1",
    firnot: "1",
    maps: "detail",
    planformat: "LIDO"
  };
  if (form.registration.trim()) params.reg = form.registration.trim().toUpperCase();
  if (form.route.trim()) params.route = form.route.trim();
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
  return url.toString();
}

function AppIcon({ children }: { children: ReactNode }) {
  return <span className="vb-icon">{children}</span>;
}

function Metric({ label, value, hint, icon, tone = "" }: { label: string; value: ReactNode; hint: string; icon: ReactNode; tone?: string }) {
  return <article className="vb-metric">
    <div className="vb-metric-top"><span>{label}</span><AppIcon>{icon}</AppIcon></div>
    <strong className={tone}>{value}</strong><small>{hint}</small>
  </article>;
}

export default function VirtualBlueWorkspace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedView = (params.get("view") || "overview") as View;
  const view: View = ["overview", "fleet", "schedules", "flightbag", "dispatch", "crew", "admin"].includes(requestedView) ? requestedView : "overview";
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("veyro-vb-theme") !== "light"; } catch { return true; }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [organization, setOrganization] = useState<any>(null);
  const [portalId, setPortalId] = useState("");
  const [pilotData, setPilotData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [positions, setPositions] = useState<Record<string, AircraftPosition>>({});
  const [positionsUpdated, setPositionsUpdated] = useState<string | null>(null);
  const [positionBusy, setPositionBusy] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersBusy, setMembersBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [seatSchedule, setSeatSchedule] = useState<any>(null);
  const [seatRole, setSeatRole] = useState<0 | 1>(0);
  const [bookingBusy, setBookingBusy] = useState("");
  const [scheduleForm, setScheduleForm] = useState({
    aircraftId: "", callsign: "", flightType: 1, originIcao: "", destinationIcao: "",
    timeless: true, departure: "", arrival: "", briefing: "", flightPlan: ""
  });
  const [dispatchForm, setDispatchForm] = useState({
    airline: "VBL", flightNumber: "", type: "A320", registration: "",
    origin: "", destination: "", route: "", units: "KGS"
  });
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlSummary, setXmlSummary] = useState<any>(null);
  const [attachScheduleId, setAttachScheduleId] = useState("");
  const [xmlBusy, setXmlBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [cacheScope] = useState(() => {
    try { return crypto.randomUUID(); } catch { return undefined; }
  });

  useEffect(() => {
    if (!supabase) { setSessionLoading(false); setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); })
      .finally(() => { if (active) setSessionLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.vbTheme = dark ? "dark" : "light";
    try { localStorage.setItem("veyro-vb-theme", dark ? "dark" : "light"); } catch { /* storage is optional */ }
  }, [dark]);

  const call = useCallback(async (name: string, body: Record<string, unknown>) => {
    if (!supabase) throw new Error("VEYRO is not configured.");
    const { data, error: invokeError } = await invokeFunction(supabase, name, { body });
    if (invokeError) throw invokeError;
    return data;
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!supabase || !session) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const { data: org, error: orgError } = await supabase.from("organizations")
        .select("id,slug,display_name,logo_url,live_organization_id,booking_mode,created_by")
        .eq("slug", ORG_SLUG).eq("is_active", true).single();
      if (orgError || !org) throw new Error("VirtualBlue's Veyro portal could not be loaded.");
      const { data: membership } = await supabase.from("organization_memberships")
        .select("role,is_active").eq("organization_id", org.id).eq("user_id", session.user.id).maybeSingle();
      const canAttemptAdmin = Boolean(
        membership?.is_active && ["owner", "admin"].includes(membership.role)
      ) || org.created_by === session.user.id;
      setOrganization(org);
      setPortalId(org.id);
      if (canAttemptAdmin) {
        try {
          const admin = await call("organization-admin", { action: "get_admin_portal", slug: ORG_SLUG });
          const role = membership?.role === "admin" ? 1 : 2;
          setAdminData(admin);
          setPilotData({
            role, portalId: org.id, portal: { id: org.id, slug: org.slug },
            bookings: admin.bookingRequests || [], profile: admin.adminProfile || null
          });
        } catch (adminError) {
          console.warn("[VEYRO] Admin workspace unavailable; falling back to pilot data", adminError);
          setAdminData(null);
          const payload = await call("pilot-live-data", { organizationId: org.live_organization_id, cacheScope });
          if (!payload?.portal?.id) throw new Error("Your Infinite Flight membership could not be verified for VirtualBlue.");
          setPilotData(payload);
        }
      } else {
        const payload = await call("pilot-live-data", { organizationId: org.live_organization_id, cacheScope });
        if (!payload?.portal?.id) throw new Error("Your Infinite Flight membership could not be verified for VirtualBlue.");
        setPilotData(payload);
        setAdminData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load VirtualBlue operations.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [session, cacheScope, call]);

  useEffect(() => {
    if (session) void load(); else if (!sessionLoading) setLoading(false);
  }, [session, sessionLoading, load]);

  const aircraft = pilotData?.aircraft || adminData?.aircraft || [];
  const schedules = adminData?.schedules || pilotData?.schedules || [];
  const bookings = adminData?.bookingRequests || pilotData?.bookings || [];
  const isAdmin = Number(pilotData?.role) === 1 || Number(pilotData?.role) === 2;
  const liveMembers = adminData?.liveMembers || members;
  const filteredAircraft = useMemo(() => aircraft.filter((item: any) => {
    const term = search.trim().toLowerCase();
    return !term || [item.registration, item.name, item.aircraftName, item.icaoCode].some((v: any) => String(v || "").toLowerCase().includes(term));
  }), [aircraft, search]);
  const filteredSchedules = useMemo(() => schedules.filter((item: any) => {
    const term = search.trim().toLowerCase();
    return !term || [item.callsign, item.originIcao, item.destinationIcao, item.flightPlan].some((v: any) => String(v || "").toLowerCase().includes(term));
  }), [schedules, search]);
  const pendingBookings = bookings.filter((b: any) => ["pending_approval", "pending", "sync_failed"].includes(String(b.status).toLowerCase()));
  const activeBookings = bookings.filter((b: any) => ["pending_approval", "approved", "sync_failed"].includes(String(b.status).toLowerCase()));
  const myBookings = adminData ? bookings.filter((b: any) => b.pilot_user_id === session?.user.id) : bookings;
  const myActiveBookings = myBookings.filter((b: any) => ["pending_approval", "approved", "sync_failed"].includes(String(b.status).toLowerCase()));
  const airborneCount = Object.values(positions).filter((p: any) => p && !p.isOnGround && p.state !== 4 && p.state !== 5).length;

  const refreshPositions = async () => {
    if (!organization || !aircraft.length) return;
    setPositionBusy(true); setError("");
    try {
      const ids = aircraft.slice(0, 8).map((item: any) => item.id);
      const result = await call("pilot-live-data", {
        organizationId: organization.live_organization_id,
        action: "aircraft_positions",
        aircraftIds: ids,
        cacheScope
      });
      setPositions((current) => ({ ...current, ...(result?.positions || {}) }));
      setPositionsUpdated(result?.updatedAt || new Date().toISOString());
      if (result?.rateLimited) setNotice("Some aircraft positions were held back to respect the Infinite Flight request allowance. Refresh later for the remaining aircraft.");
      else setNotice("Fleet positions refreshed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aircraft positions could not be refreshed.");
    } finally { setPositionBusy(false); }
  };

  const loadMembers = async () => {
    if (!organization) return;
    setMembersBusy(true);
    try {
      const result = await call("pilot-live-data", {
        organizationId: organization.live_organization_id,
        action: "organization_members",
        cacheScope
      });
      setMembers(result?.members || []);
      if (result?.rateLimited) setNotice("The Live API request allowance is currently exhausted. Try again after it resets.");
    } catch (e) { setError(e instanceof Error ? e.message : "Crew could not be loaded."); }
    finally { setMembersBusy(false); }
  };

  const requestBooking = async () => {
    if (!seatSchedule || !portalId) return;
    setBookingBusy(seatSchedule.id); setError("");
    try {
      const result = await call("booking-request", {
        organizationId: portalId,
        scheduleId: seatSchedule.id,
        aircraftId: seatSchedule.aircraftId,
        seatRole
      });
      setNotice(result?.alreadyExists ? "Your existing request was found." : "Your crew request has been sent to VirtualBlue operations.");
      setSeatSchedule(null);
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "The booking request could not be submitted."); }
    finally { setBookingBusy(""); }
  };

  const openDispatch = (schedule?: any) => {
    const plane = aircraft.find((a: any) => a.id === schedule?.aircraftId);
    const callsign = String(schedule?.callsign || "");
    const digits = callsign.replace(/\D/g, "") || callsign;
    const next = {
      ...dispatchForm,
      flightNumber: digits,
      type: plane?.icaoCode || plane?.aircraftCode || plane?.type || dispatchForm.type,
      registration: plane?.registration || "",
      origin: schedule?.originIcao || dispatchForm.origin,
      destination: schedule?.destinationIcao || dispatchForm.destination,
      route: schedule?.flightPlan || ""
    };
    setDispatchForm(next);
    setAttachScheduleId(schedule?.id || "");
    setParams({ view: "dispatch" });
  };

  const handleXml = async (file: File | null) => {
    setXmlFile(file); setXmlSummary(null);
    if (!file) return;
    if (file.size > 1_500_000) { setError("SimBrief XML must be smaller than 1.5 MB."); setXmlFile(null); return; }
    try {
      const text = await file.text();
      const parsed = new DOMParser().parseFromString(text, "application/xml");
      if (parsed.querySelector("parsererror") || parsed.documentElement.tagName.toLowerCase() !== "ofp") throw new Error("This does not appear to be a valid SimBrief OFP XML file.");
      const pick = (...selectors: string[]) => selectors.map((selector) => parsed.querySelector(selector)?.textContent?.trim()).find(Boolean) || "";
      const summary = {
        callsign: pick("general icao_airline", "general flight_number", "general callsign"),
        origin: pick("origin icao_code"), destination: pick("destination icao_code"),
        aircraft: pick("aircraft icaotype", "aircraft icao_code"), registration: pick("aircraft reg"),
        route: pick("general route"), distance: pick("general air_distance"), blockFuel: pick("fuel plan_ramp"),
        pdf: pick("files pdf link")
      };
      setXmlSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this SimBrief file.");
      setXmlFile(null);
    }
  };

  const attachXml = async () => {
    if (!xmlFile || !attachScheduleId || !adminData) return;
    const schedule = schedules.find((item: any) => item.id === attachScheduleId);
    if (!schedule) { setError("Select a published schedule before attaching this OFP."); return; }
    setXmlBusy(true); setError("");
    try {
      await call("organization-admin", {
        action: "update_schedule", slug: ORG_SLUG, scheduleId: schedule.id,
        schedule: {
          callsign: schedule.callsign, flightType: schedule.flightType ?? 1,
          originIcao: schedule.originIcao, destinationIcao: schedule.destinationIcao,
          isTimeless: !!schedule.isTimeless,
          scheduledDepartureUtc: schedule.scheduledDepartureUtc ?? null,
          scheduledArrivalUtc: schedule.scheduledArrivalUtc ?? null,
          briefing: schedule.briefing ?? null, flightPlan: xmlSummary?.route || schedule.flightPlan || null
        },
        simbriefXml: await xmlFile.text(), simbriefFileName: xmlFile.name
      });
      setNotice("SimBrief OFP attached to " + (schedule.callsign || "the selected schedule") + ".");
      setXmlFile(null); setXmlSummary(null); await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "The SimBrief OFP could not be attached."); }
    finally { setXmlBusy(false); }
  };

  const createSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setScheduleBusy(true); setError("");
    try {
      const schedule = {
        callsign: scheduleForm.callsign.trim(),
        flightType: Number(scheduleForm.flightType),
        originIcao: scheduleForm.originIcao.trim().toUpperCase(),
        destinationIcao: scheduleForm.destinationIcao.trim().toUpperCase(),
        isTimeless: scheduleForm.timeless,
        scheduledDepartureUtc: scheduleForm.timeless || !scheduleForm.departure ? null : new Date(scheduleForm.departure).toISOString(),
        scheduledArrivalUtc: scheduleForm.timeless || !scheduleForm.arrival ? null : new Date(scheduleForm.arrival).toISOString(),
        briefing: scheduleForm.briefing || null,
        flightPlan: scheduleForm.flightPlan || null
      };
      await call("organization-admin", {
        action: "create_schedule", slug: ORG_SLUG, aircraftId: scheduleForm.aircraftId, schedule
      });
      setNotice("The new schedule has been published to Infinite Flight Live.");
      setScheduleForm({ aircraftId: "", callsign: "", flightType: 1, originIcao: "", destinationIcao: "", timeless: true, departure: "", arrival: "", briefing: "", flightPlan: "" });
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "The schedule could not be created."); }
    finally { setScheduleBusy(false); }
  };

  const signOut = async () => { await supabase?.auth.signOut(); navigate("/login"); };

  if (sessionLoading || loading && !pilotData) {
    return <main className="vb-loading"><div className="vb-loader-mark"><Plane size={25}/></div><span>INITIALISING VEYRO OPERATIONS</span><strong>Preparing VirtualBlue workspace…</strong></main>;
  }
  if (!session) {
    return <main className="vb-auth-screen"><div className="vb-auth-card"><div className="vb-brand-mark"><Plane size={21}/></div><span className="vb-kicker">VEYRO LIVE · VIRTUALBLUE</span><h1>Your airline.<br/><em>Your operations.</em></h1><p>Connect your Infinite Flight account to enter the VirtualBlue operations workspace.</p><Link className="vb-primary-button" to="/login?next=%2Fvirtualblue">Connect Infinite Flight <ArrowRight size={16}/></Link><small>Secure OAuth · Tokens remain encrypted server-side</small></div></main>;
  }

  const setView = (next: View) => { setSearch(""); setParams(next === "overview" ? {} : { view: next }); };
  const openScheduleDispatch = (item: any) => openDispatch(item);
  const buildDispatch = () => {
    if (!dispatchForm.origin.trim() || !dispatchForm.destination.trim() || !dispatchForm.type.trim()) {
      setError("Enter an aircraft type and both airport ICAO codes before opening SimBrief."); return;
    }
    const popup = window.open(dispatchUrl(dispatchForm), "_blank", "noopener,noreferrer");
    if (!popup) setError("Your browser blocked the SimBrief tab. Allow pop-ups for VEYRO and try again.");
  };

  return <main className={"vb-app " + (collapsed ? "is-collapsed" : "")}>
    <aside className="vb-sidebar">
      <div className="vb-brand"><span className="vb-brand-mark"><Plane size={20}/></span><span><strong>VEYRO</strong><small>LIVE OPERATIONS</small></span><button className="vb-collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation"><Menu size={17}/></button></div>
      <div className="vb-org-switch"><span className="vb-org-logo">{organization?.logo_url ? <img src={organization.logo_url} alt=""/> : "VB"}</span><span><strong>VirtualBlue</strong><small>INFINITE FLIGHT LIVE</small></span><ChevronDown size={14}/></div>
      <div className="vb-nav-label">WORKSPACE</div>
      <nav className="vb-nav">
        {([
          ["overview", <Layers3 size={17}/>, "Overview"],
          ["fleet", <Plane size={17}/>, "Fleet"],
          ["schedules", <CalendarDays size={17}/>, "Schedules"],
          ["flightbag", <FileText size={17}/>, "Flight bag"],
          ["dispatch", <Compass size={17}/>, "Dispatch"],
          ["crew", <Users size={17}/>, "Crew"]
        ] as [View, ReactNode, string][]).map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{icon}<span>{label}</span>{id === "flightbag" && activeBookings.length > 0 && <i>{activeBookings.length}</i>}</button>)}
      </nav>
      {isAdmin && <><div className="vb-nav-label vb-nav-label-spaced">MANAGEMENT</div><nav className="vb-nav"><button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Settings2 size={17}/><span>Administration</span></button></nav></>}
      <div className="vb-sidebar-bottom">
        <div className="vb-system-status"><i/><span><strong>Live connection</strong><small>VirtualBlue workspace active</small></span></div>
        <button className="vb-user-card" onClick={signOut}><span className="vb-avatar">{(pilotData?.profile?.display_name || session.user.email || "P").slice(0,1).toUpperCase()}</span><span><strong>{pilotData?.profile?.display_name || session.user.email || "Pilot"}</strong><small>{isAdmin ? "Operations administrator" : "VirtualBlue pilot"}</small></span><LogOut size={15}/></button>
      </div>
    </aside>

    <section className="vb-main">
      <header className="vb-topbar">
        <div className="vb-breadcrumb"><span>VIRTUALBLUE</span><ChevronRight size={13}/><strong>{viewLabels[view].toUpperCase()}</strong></div>
        <div className="vb-top-actions">
          <span className="vb-utc-clock"><Globe2 size={14}/> UTC · {new Date().toISOString().slice(11,16)}</span>
          <button className="vb-icon-button" title="Refresh workspace" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "vb-spin" : ""}/></button>
          <button className="vb-icon-button" title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDark(!dark)}>{dark ? <Sun size={16}/> : <Moon size={16}/>}</button>
          <button className="vb-top-avatar" title="Sign out" onClick={signOut}>{(pilotData?.profile?.display_name || "P").slice(0,1).toUpperCase()}</button>
        </div>
      </header>

      <div className="vb-content">
        {error && <div className="vb-alert vb-alert-error"><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
        {notice && <div className="vb-alert vb-alert-success"><Check size={15}/><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}

        <div className="vb-page-heading">
          <div><span className="vb-kicker">VIRTUALBLUE · FLIGHT OPERATIONS</span><h1>{viewLabels[view]}</h1><p>{view === "overview" ? "Your fleet, flight programme and crew activity — all in one place." : view === "fleet" ? "Aircraft availability and live position awareness across your airline." : view === "schedules" ? "Published Live schedules, organised by aircraft and ready for crew." : view === "flightbag" ? "Your reserved legs, flight details and operational documents." : view === "dispatch" ? "Build a flight briefing and open a pre-filled SimBrief dispatch." : view === "crew" ? "The people flying and operating VirtualBlue." : "Publish schedules and review the airline's operational readiness."}</p></div>
          <div className="vb-heading-actions"><span className="vb-live-pill"><i/> LIVE DATA</span><button className="vb-secondary-button" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={14}/> Refresh</button></div>
        </div>

        {view === "overview" && <>
          <div className="vb-metrics-grid">
            <Metric label="FLEET AIRCRAFT" value={aircraft.length.toString().padStart(2,"0")} hint="Connected to Infinite Flight Live" icon={<Plane size={16}/>} />
            <Metric label="PUBLISHED LEGS" value={schedules.length.toString().padStart(2,"0")} hint="Current schedule programme" icon={<CalendarDays size={16}/>} />
            <Metric label="AIRBORNE" value={airborneCount.toString().padStart(2,"0")} hint={positionsUpdated ? "Position data refreshed" : "Refresh fleet positions"} icon={<Activity size={16}/>} tone="vb-number-blue"/>
            <Metric label="CREW REQUESTS" value={pendingBookings.length.toString().padStart(2,"0")} hint="Awaiting operations review" icon={<Bell size={16}/>} tone={pendingBookings.length ? "vb-number-amber" : ""}/>
          </div>
          <section className="vb-panel vb-map-panel">
            <div className="vb-panel-heading"><div><span className="vb-kicker">LIVE FLEET TRACKING</span><h2>Aircraft operations map</h2><p>Position information is requested on demand to protect your API allowance.</p></div><button className="vb-secondary-button" onClick={() => void refreshPositions()} disabled={positionBusy}><RefreshCw size={14} className={positionBusy ? "vb-spin" : ""}/>{positionBusy ? "Refreshing…" : "Refresh positions"}</button></div>
            {aircraft.length ? <AircraftLiveMap aircraft={aircraft} positions={positions} dark={dark} /> : <div className="vb-empty"><Plane size={22}/><strong>No fleet aircraft returned</strong><span>Check the VirtualBlue Infinite Flight connection.</span></div>}
            <div className="vb-map-foot"><span>{positionsUpdated ? "Last updated " + new Date(positionsUpdated).toLocaleTimeString() : "Positions not yet requested"}</span><span>{Object.keys(positions).length} / {aircraft.length} aircraft positioned</span></div>
          </section>
          <div className="vb-two-panels">
            <section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">NEXT DEPARTURES</span><h2>Flight programme</h2></div><button className="vb-text-button" onClick={() => setView("schedules")}>All schedules <ArrowUpRight size={13}/></button></div>
              {schedules.slice(0,5).map((item:any)=><div className="vb-list-row" key={item.id}><span className="vb-row-plane"><Plane size={15}/></span><div className="vb-row-main"><strong>{routeText(item)}</strong><small>{item.callsign || "Scheduled flight"} · {time(item.scheduledDepartureUtc)}</small></div><span className={"vb-status " + (item.status === 9 ? "is-muted" : "")}>{statusText(item.status ?? 1)}</span></div>)}
              {!schedules.length && <div className="vb-empty-inline">No published schedules yet.</div>}
            </section>
            <section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">OPERATIONS QUEUE</span><h2>Recent crew requests</h2></div><button className="vb-text-button" onClick={() => setView("flightbag")}>Open flight bag <ArrowUpRight size={13}/></button></div>
              {bookings.slice(0,5).map((booking:any)=><div className="vb-list-row" key={booking.id}><span className="vb-row-plane"><Users size={15}/></span><div className="vb-row-main"><strong>{booking.flight_number || schedules.find((s:any)=>s.id===booking.live_schedule_id)?.callsign || "Flight request"}</strong><small>{booking.origin_icao || "—"} → {booking.destination_icao || "—"} · {time(booking.created_at)}</small></div><span className={"vb-status " + (booking.status === "approved" ? "is-good" : "is-pending")}>{String(booking.status).replaceAll("_"," ")}</span></div>)}
              {!bookings.length && <div className="vb-empty-inline">No crew requests yet.</div>}
            </section>
          </div>
          <section className="vb-quick-grid">
            <button onClick={() => setView("fleet")}><AppIcon><Plane size={18}/></AppIcon><span><strong>Explore fleet</strong><small>Aircraft details and positions</small></span><ChevronRight size={16}/></button>
            <button onClick={() => setView("schedules")}><AppIcon><CalendarDays size={18}/></AppIcon><span><strong>Browse schedules</strong><small>Choose your next flight</small></span><ChevronRight size={16}/></button>
            <button onClick={() => setView("dispatch")}><AppIcon><Compass size={18}/></AppIcon><span><strong>Open dispatch</strong><small>Prepare a SimBrief OFP</small></span><ChevronRight size={16}/></button>
          </section>
        </>}

        {view === "fleet" && <>
          <div className="vb-toolbar"><label className="vb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search registration or aircraft type…"/></label><button className="vb-secondary-button" onClick={() => void refreshPositions()} disabled={positionBusy}><RefreshCw size={14}/>{positionBusy ? "Refreshing…" : "Refresh positions"}</button><span className="vb-result-count">{filteredAircraft.length} AIRCRAFT</span></div>
          <section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">FLEET OVERVIEW</span><h2>Aircraft map</h2><p>Tap a marker or roster item to inspect its current position.</p></div></div><AircraftLiveMap aircraft={filteredAircraft} positions={positions} dark={dark}/></section>
          <div className="vb-aircraft-grid">{filteredAircraft.map((item:any)=><article className="vb-aircraft-card" key={item.id}><div className="vb-aircraft-image"><img src={"/aircrafts/"+encodeURIComponent(item.registration||"")+"/aircraft.png"} alt="" onError={e=>{e.currentTarget.style.display="none"}}/><span>FLEET #{item.fleetRank ?? "—"}</span></div><div className="vb-aircraft-info"><div><strong>{item.registration || "Unregistered aircraft"}</strong><small>{item.name || item.aircraftName || item.icaoCode || "Infinite Flight aircraft"}</small></div><span className={item.isFleetActiveSlot ? "vb-status is-good" : "vb-status is-muted"}>{item.isFleetActiveSlot ? "Active slot" : "Reserve"}</span></div></article>)}</div>
          {!filteredAircraft.length && <div className="vb-empty"><Plane size={22}/><strong>No matching aircraft</strong><span>Try a different registration or aircraft type.</span></div>}
        </>}

        {view === "schedules" && <>
          <div className="vb-toolbar"><label className="vb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search flight number or route…"/></label><span className="vb-result-count">{filteredSchedules.length} PUBLISHED LEGS</span></div>
          <div className="vb-schedule-groups">{aircraft.map((plane:any)=>{const items=filteredSchedules.filter((item:any)=>item.aircraftId===plane.id).sort((a:any,b:any)=>(a.sequence??0)-(b.sequence??0));if(!items.length)return null;return <section className="vb-panel vb-schedule-group" key={plane.id}><div className="vb-schedule-group-head"><div className="vb-row-plane"><Plane size={17}/></div><div><strong>{plane.registration || "Aircraft"}</strong><small>{plane.name || plane.aircraftName || "Fleet aircraft"} · {items.length} scheduled legs</small></div><span className="vb-result-count">FLEET #{plane.fleetRank ?? "—"}</span></div>{items.map((item:any)=><article className="vb-schedule-row" key={item.id}><div className="vb-schedule-flight"><strong>{item.callsign || "Flight"}</strong><span className="vb-status">{statusText(item.status ?? 1)}</span></div><div className="vb-route-large"><div><strong>{item.originIcao || "—"}</strong><small>{item.originName || item.originCity || "ORIGIN"}</small></div><span/><div><strong>{item.destinationIcao || "—"}</strong><small>{item.destinationName || item.destinationCity || "DESTINATION"}</small></div></div><div className="vb-schedule-meta"><span><Clock3 size={13}/>{time(item.scheduledDepartureUtc)}</span><span><Layers3 size={13}/>{item.blockTime || item.estimatedBlockTime || "Block time —"}</span><span><Users size={13}/>{(item.crew || []).length} / 3 crew</span></div><div className="vb-schedule-actions"><button className="vb-secondary-button" onClick={() => openScheduleDispatch(item)}><Compass size={14}/> SimBrief</button><button className="vb-primary-button vb-small-button" disabled={item.status === 9 || !!bookingBusy} onClick={() => {setSeatSchedule(item);setSeatRole(0)}}>Request leg <ArrowRight size={14}/></button></div></article>)}</section>})}</div>
          {!filteredSchedules.length && <div className="vb-empty"><CalendarDays size={22}/><strong>No published legs found</strong><span>VirtualBlue's published Live schedules will appear here.</span></div>}
        </>}

        {view === "flightbag" && <>
          <div className="vb-metrics-grid vb-metrics-three"><Metric label="MY REQUESTS" value={myBookings.length} hint="Your recent flight requests" icon={<FileText size={16}/>} /><Metric label="ACTIVE RESERVATIONS" value={myActiveBookings.length} hint="Pending or confirmed" icon={<ShieldCheck size={16}/>} /><Metric label="READY TO DISPATCH" value={bookings.filter((b:any)=>b.status==="approved").length} hint="Approved by operations" icon={<Zap size={16}/>} /></div>
          <section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">PERSONAL FLIGHT RECORD</span><h2>My flight bag</h2><p>Requests and confirmed legs associated with your VirtualBlue account.</p></div></div>{myBookings.map((booking:any)=>{const schedule=schedules.find((s:any)=>s.id===booking.live_schedule_id);return <article className="vb-flightbag-row" key={booking.id}><div className="vb-flightbag-mark"><FileText size={18}/></div><div className="vb-flightbag-main"><strong>{schedule?.callsign || booking.flight_number || "Flight reservation"}</strong><span>{schedule ? routeText(schedule) : (booking.origin_icao || "—")+" → "+(booking.destination_icao || "—")}</span><small>{booking.seat_role === 1 ? "First Officer" : "Captain"} · {time(booking.created_at)} · Ref {booking.reference_code || "—"}</small></div><span className={"vb-status " + (booking.status === "approved" ? "is-good" : booking.status === "pending_approval" ? "is-pending" : "is-muted")}>{String(booking.status).replaceAll("_"," ")}</span><button className="vb-icon-button" title="Prepare SimBrief" onClick={() => schedule && openScheduleDispatch(schedule)} disabled={!schedule}><ArrowUpRight size={16}/></button></article>})}{!bookings.length && <div className="vb-empty-inline">Your flight requests will appear here after you reserve a schedule.</div>}</section>
        </>}

        {view === "dispatch" && <>
          <div className="vb-dispatch-layout">
            <section className="vb-panel vb-dispatch-form"><div className="vb-panel-heading"><div><span className="vb-kicker">SIMBRIEF FLIGHT PLANNING</span><h2>Prepare your dispatch</h2><p>VEYRO pre-fills your route and aircraft in SimBrief. Sign in to SimBrief to generate the OFP.</p></div><span className="vb-simbrief-mark">SIMBRIEF</span></div>
              <div className="vb-form-grid"><label>Airline code<input value={dispatchForm.airline} onChange={e=>setDispatchForm({...dispatchForm,airline:e.target.value})} maxLength={3}/></label><label>Flight number<input value={dispatchForm.flightNumber} onChange={e=>setDispatchForm({...dispatchForm,flightNumber:e.target.value})} placeholder="e.g. 204"/></label><label>Aircraft ICAO type<input value={dispatchForm.type} onChange={e=>setDispatchForm({...dispatchForm,type:e.target.value})} placeholder="A320"/></label><label>Registration<input value={dispatchForm.registration} onChange={e=>setDispatchForm({...dispatchForm,registration:e.target.value})} placeholder="Aircraft registration"/></label><label>Origin ICAO<input value={dispatchForm.origin} onChange={e=>setDispatchForm({...dispatchForm,origin:e.target.value.toUpperCase()})} maxLength={4} placeholder="EGLL"/></label><label>Destination ICAO<input value={dispatchForm.destination} onChange={e=>setDispatchForm({...dispatchForm,destination:e.target.value.toUpperCase()})} maxLength={4} placeholder="EDDF"/></label><label className="vb-form-wide">Route (optional)<input value={dispatchForm.route} onChange={e=>setDispatchForm({...dispatchForm,route:e.target.value})} placeholder="Leave blank for SimBrief recommended route"/></label><label>Weight units<select value={dispatchForm.units} onChange={e=>setDispatchForm({...dispatchForm,units:e.target.value})}><option value="KGS">Kilograms</option><option value="LBS">Pounds</option></select></label></div>
              <button className="vb-primary-button vb-dispatch-submit" onClick={buildDispatch}><Compass size={16}/> Continue to SimBrief <ExternalLink size={14}/></button><p className="vb-form-note"><ShieldCheck size={14}/> Dispatch opens on SimBrief. VEYRO does not ask for or store your SimBrief password.</p>
            </section>
            <aside className="vb-panel vb-dispatch-aside"><span className="vb-kicker">DISPATCH WORKFLOW</span><h3>From schedule to OFP</h3><ol><li><b>01</b><span><strong>Choose a leg</strong><small>Start from a published VirtualBlue schedule or enter your route manually.</small></span></li><li><b>02</b><span><strong>Generate on SimBrief</strong><small>Review aircraft, route, fuel and operational flight plan in your SimBrief account.</small></span></li><li><b>03</b><span><strong>Bring the OFP back</strong><small>Download the XML from SimBrief and attach it to the schedule if you are an administrator.</small></span></li></ol></aside>
          </div>
          <section className="vb-panel vb-xml-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">FLIGHT PLAN ATTACHMENT</span><h2>Import a SimBrief OFP</h2><p>Attach a downloaded XML flight plan to a published schedule. Admin permission is required.</p></div><FileText size={19}/></div>
            <div className="vb-xml-controls"><label className="vb-file-picker"><Download size={17}/><span><strong>{xmlFile ? xmlFile.name : "Choose SimBrief XML"}</strong><small>XML format · Maximum 1.5 MB</small></span><input type="file" accept=".xml,text/xml,application/xml" onChange={e=>void handleXml(e.target.files?.[0] || null)}/></label><label className="vb-select-field">Attach to schedule<select value={attachScheduleId} onChange={e=>setAttachScheduleId(e.target.value)}><option value="">Choose a published leg</option>{schedules.map((item:any)=><option key={item.id} value={item.id}>{item.callsign} · {routeText(item)}</option>)}</select></label></div>
            {xmlSummary && <div className="vb-xml-preview"><div><span>ROUTE</span><strong>{xmlSummary.origin || "—"} → {xmlSummary.destination || "—"}</strong></div><div><span>AIRCRAFT</span><strong>{xmlSummary.aircraft || "—"} · {xmlSummary.registration || "No registration"}</strong></div><div><span>FLIGHT PLAN</span><strong>{xmlSummary.route || "Route not found"}</strong></div><div><span>BLOCK FUEL</span><strong>{xmlSummary.blockFuel || "—"}</strong></div></div>}
            <div className="vb-xml-actions"><span>{isAdmin ? "XML is stored with the selected schedule in VEYRO." : "Only VirtualBlue administrators can attach a shared schedule OFP."}</span><button className="vb-primary-button" disabled={!isAdmin || !xmlFile || !attachScheduleId || xmlBusy} onClick={() => void attachXml()}>{xmlBusy ? "Attaching…" : "Attach OFP to schedule"} <ArrowRight size={14}/></button></div>
          </section>
        </>}

        {view === "crew" && <>
          <div className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">VIRTUALBLUE PEOPLE</span><h2>Airline crew</h2><p>Live membership is retrieved on demand and is not stored as a roster snapshot.</p></div><button className="vb-secondary-button" onClick={() => void loadMembers()} disabled={membersBusy}><RefreshCw size={14}/>{membersBusy ? "Loading…" : "Refresh crew"}</button></div>
            {liveMembers.map((member:any)=><div className="vb-list-row" key={member.userId || member.user_id}><span className="vb-crew-avatar">{String(member.username || member.display_name || "P").slice(0,1).toUpperCase()}</span><div className="vb-row-main"><strong>{member.username || member.display_name || "Infinite Flight pilot"}</strong><small>{member.role === 2 ? "Owner" : member.role === 1 ? "Administrator" : "Crew member"}{member.activeLifts != null ? " · "+member.activeLifts+" active lifts" : ""}</small></div><span className="vb-status is-good">LIVE MEMBER</span></div>)}
            {!liveMembers.length && <div className="vb-empty-inline">{membersBusy ? "Loading current Live crew…" : "Select Refresh crew to retrieve the current Infinite Flight roster."}</div>}
          </div>
        </>}

        {view === "admin" && isAdmin && <>
          <div className="vb-metrics-grid"><Metric label="PENDING APPROVALS" value={pendingBookings.length} hint="Requests awaiting action" icon={<Bell size={16}/>} tone="vb-number-amber"/><Metric label="ACTIVE PILOTS" value={(adminData?.members || []).filter((m:any)=>m.is_active).length} hint="Veyro portal membership" icon={<Users size={16}/>} /><Metric label="DISCORD APPROVALS" value={adminData?.discord?.enabled ? "READY" : "SETUP"} hint="Approval integration status" icon={<ShieldCheck size={16}/>} /></div>
          <div className="vb-admin-layout"><section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">PUBLISH TO INFINITE FLIGHT</span><h2>Create a schedule</h2><p>New legs are published directly to the VirtualBlue Live fleet.</p></div></div>
            <form className="vb-create-form" onSubmit={createSchedule}><label>Aircraft<select required value={scheduleForm.aircraftId} onChange={e=>setScheduleForm({...scheduleForm,aircraftId:e.target.value})}><option value="">Select aircraft</option>{aircraft.map((a:any)=><option key={a.id} value={a.id}>{a.registration || "Aircraft"} · #{a.fleetRank ?? "—"}</option>)}</select></label><label>Flight number<input required value={scheduleForm.callsign} onChange={e=>setScheduleForm({...scheduleForm,callsign:e.target.value})} placeholder="VBL204"/></label><label>Origin ICAO<input required maxLength={4} value={scheduleForm.originIcao} onChange={e=>setScheduleForm({...scheduleForm,originIcao:e.target.value.toUpperCase()})} placeholder="EGLL"/></label><label>Destination ICAO<input required maxLength={4} value={scheduleForm.destinationIcao} onChange={e=>setScheduleForm({...scheduleForm,destinationIcao:e.target.value.toUpperCase()})} placeholder="EDDF"/></label><label>Flight type<select value={scheduleForm.flightType} onChange={e=>setScheduleForm({...scheduleForm,flightType:Number(e.target.value)})}><option value={1}>Commercial passenger</option><option value={2}>Charter</option><option value={3}>Cargo</option><option value={4}>Training</option><option value={5}>Test flight</option></select></label><label className="vb-check-field"><input type="checkbox" checked={scheduleForm.timeless} onChange={e=>setScheduleForm({...scheduleForm,timeless:e.target.checked})}/> Timeless schedule</label>{!scheduleForm.timeless && <><label>Departure (local)<input type="datetime-local" required value={scheduleForm.departure} onChange={e=>setScheduleForm({...scheduleForm,departure:e.target.value})}/></label><label>Arrival (local)<input type="datetime-local" required value={scheduleForm.arrival} onChange={e=>setScheduleForm({...scheduleForm,arrival:e.target.value})}/></label></>}<label className="vb-form-wide">Briefing<textarea value={scheduleForm.briefing} onChange={e=>setScheduleForm({...scheduleForm,briefing:e.target.value})} rows={3} placeholder="Operational notes for the crew"/></label><label className="vb-form-wide">Flight plan / route<input value={scheduleForm.flightPlan} onChange={e=>setScheduleForm({...scheduleForm,flightPlan:e.target.value})} placeholder="Optional route"/></label><button className="vb-primary-button vb-form-wide" disabled={scheduleBusy || !aircraft.length}>{scheduleBusy ? "Publishing…" : "Publish Live schedule"} <ArrowRight size={14}/></button></form>
          </section><aside className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">ADMINISTRATION</span><h2>Control centre</h2></div></div><div className="vb-admin-shortcuts"><Link to="/virtualblue/admin"><Settings2 size={16}/><span><strong>Portal settings</strong><small>Branding, pilots and Discord integration</small></span><ChevronRight size={15}/></Link><button onClick={() => setView("dispatch")}><Compass size={16}/><span><strong>SimBrief dispatch</strong><small>Generate and attach operational flight plans</small></span><ChevronRight size={15}/></button><button onClick={() => setView("schedules")}><CalendarDays size={16}/><span><strong>Manage schedule board</strong><small>{schedules.length} published legs</small></span><ChevronRight size={15}/></button></div><div className="vb-admin-note"><ShieldCheck size={16}/><span>Infinite Flight Live remains the source of truth. VEYRO stores only booking state and explicitly attached documents.</span></div></aside></div>
          <section className="vb-panel"><div className="vb-panel-heading"><div><span className="vb-kicker">REQUEST QUEUE</span><h2>Latest booking requests</h2></div><span className="vb-result-count">{bookings.length} RECENT</span></div>{bookings.slice(0,12).map((b:any)=><div className="vb-list-row" key={b.id}><span className="vb-row-plane"><Users size={15}/></span><div className="vb-row-main"><strong>{b.pilot_display_name || "VirtualBlue pilot"} · {b.flight_number || "Flight request"}</strong><small>{b.origin_icao || "—"} → {b.destination_icao || "—"} · {b.seat_role === 1 ? "First Officer" : "Captain"}</small></div><span className={"vb-status " + (b.status === "approved" ? "is-good" : "is-pending")}>{String(b.status).replaceAll("_"," ")}</span></div>)}</section>
        </>}

        {view === "admin" && !isAdmin && <div className="vb-empty"><ShieldCheck size={22}/><strong>Administrator access required</strong><span>This section is available to VirtualBlue owners and administrators.</span></div>}
      </div>
      <footer className="vb-footer"><span>© {new Date().getFullYear()} VEYRO LIVE</span><span>VIRTUALBLUE OPERATIONS · INFINITE FLIGHT LIVE</span><span>DATA REQUESTED ON DEMAND</span></footer>
    </section>

    {seatSchedule && <div className="vb-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSeatSchedule(null)}}><section className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="vb-seat-title"><div className="vb-modal-top"><span className="vb-kicker">CREW RESERVATION</span><button className="vb-icon-button" onClick={()=>setSeatSchedule(null)}><X size={16}/></button></div><h2 id="vb-seat-title">Choose your seat</h2><p>{seatSchedule.callsign || "Flight"} · {routeText(seatSchedule)}</p><div className="vb-seat-options"><button className={seatRole===0?"selected":""} onClick={()=>setSeatRole(0)}><Plane size={17}/><strong>Captain</strong><small>Pilot in command</small></button><button className={seatRole===1?"selected":""} onClick={()=>setSeatRole(1)}><Plane size={17}/><strong>First Officer</strong><small>Second in command</small></button></div><div className="vb-modal-actions"><button className="vb-secondary-button" onClick={()=>setSeatSchedule(null)}>Cancel</button><button className="vb-primary-button" onClick={()=>void requestBooking()} disabled={!!bookingBusy}>{bookingBusy ? "Submitting…" : "Submit request"} <ArrowRight size={14}/></button></div></section></div>}
  </main>;
}
