import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronRight, LogOut, Moon, Plane, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { ApplicationStatusPage, OrganizationApplicationPage, OrganizationDirectory, PublicOrganizationPage } from "./pages/PortalPages";
import DocsPage from "./pages/DocsPage";

function Brand(){return <Link className="brand" to="/"><span className="brand-mark">V</span><span>VEYRO<span className="brand-light"> LIVE</span></span></Link>}
function ThemeToggle(){const [dark,setDark]=useState(()=>localStorage.getItem("veyro-theme")==="dark");useEffect(()=>{document.documentElement.classList.toggle("dark",dark);localStorage.setItem("veyro-theme",dark?"dark":"light")},[dark]);return <button className="theme-toggle" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={15}/>:<Moon size={15}/>}</button>}
function Header({right}:{right?:ReactNode}){return <header className="topbar"><Brand/><span className="topbar-note">LIVE OPERATIONS PLATFORM</span><div className="top-actions">{right}<ThemeToggle/></div></header>}
function Footer(){return <footer className="footer"><span>© {new Date().getFullYear()} VEYRO</span><span>Independent third-party software</span></footer>}
function Landing(){return <main className="shell landing"><Header right={<a className="top-link" href="https://infiniteflight.com/account/api-keys" target="_blank" rel="noreferrer">Infinite Flight OAuth <ArrowUpRight size={14}/></a>}/><section className="hero"><div className="eyebrow"><span className="pulse"/> BUILT FOR INFINITE FLIGHT LIVE</div><h1>Your airline.<br/><span>One connected operation.</span></h1><p className="hero-copy">Fleet, schedules and crew reservations — brought together in one focused workspace for your Virtual Airline.</p><div className="hero-actions"><Link className="button button-primary" to="/login">Open your workspace <ChevronRight size={16}/></Link><Link className="button button-quiet" to="/docs">Explore documentation <ArrowUpRight size={15}/></Link></div><div className="hero-footnote">Live remains the schedule source of truth. VEYRO does not store Live flight data snapshots.</div></section><section className="feature-grid"><article className="feature"><div className="feature-icon"><Plane size={18}/></div><h3>Fleet, in context</h3><p>View the organization's active fleet directly from Infinite Flight Live.</p></article><article className="feature"><div className="feature-icon"><CalendarDays size={18}/></div><h3>Published schedules</h3><p>Read the schedules your administrators publish in Infinite Flight Live.</p></article><article className="feature"><div className="feature-icon"><ShieldCheck size={18}/></div><h3>Controlled access</h3><p>Organization roles and server-side authorization protect operational actions.</p></article></section><OrganizationDirectory/><Footer/></main>}
let oauthStartRequest: Promise<{ data: any; error: any }> | null = null;
function prepareInfiniteFlightOAuth(){if(!supabase)return Promise.resolve({data:null,error:new Error("Supabase is not configured.")});if(!oauthStartRequest)oauthStartRequest=supabase.functions.invoke("if-oauth-start",{body:{}}).then((result)=>{if(result.error)oauthStartRequest=null;return result;});return oauthStartRequest;}

function Login(){const [session,setSession]=useState<Session|null>(null);const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState(new URLSearchParams(location.search).get("pending")||"");const [orgs,setOrgs]=useState<any[]>([]);const [selected,setSelected]=useState("");const [error,setError]=useState("");const navigate=useNavigate();
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session&&!pending)void prepareInfiniteFlightOAuth()},[session,pending]);
 useEffect(()=>{const next=new URLSearchParams(location.search).get("next");if(next)localStorage.setItem("veyro-after-login",next);const target=localStorage.getItem("veyro-after-login");if(session&&target&&!pending){localStorage.removeItem("veyro-after-login");navigate(target,{replace:true})}},[session,pending,navigate]);
 useEffect(()=>{if(!session||!pending||!supabase)return;let active=true;setBusy(true);supabase.functions.invoke("if-oauth-organizations",{body:{pendingId:pending}}).then(({data,error})=>{if(!active)return;if(error)throw error;setOrgs(data.organizations||[]);if(data.organizations?.length===1)setSelected(data.organizations[0].id)}).catch(e=>setError(e.message||"Could not load Infinite Flight organizations.")).finally(()=>setBusy(false));return()=>{active=false}},[session,pending]);
 const signIn=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError("");const nextPath=new URLSearchParams(location.search).get("next")||"/";const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+"/login?next="+encodeURIComponent(nextPath)}});setMessage(error? "": "Check your email for the secure sign-in link.");if(error)setError(error.message);setBusy(false)};
 const connect=async()=>{if(!supabase)return;setBusy(true);setError("");try{const {data,error}=await prepareInfiniteFlightOAuth();if(error||!data?.authorizationUrl)throw error||new Error("Could not start Infinite Flight authorization.");location.assign(data.authorizationUrl)}catch(e){oauthStartRequest=null;setError(e instanceof Error?e.message:"Could not start Infinite Flight authorization.");setBusy(false)}};
 const openPilot=async()=>{if(!supabase||!selected)return;setBusy(true);setError("");const {data,error}=await supabase.functions.invoke("pilot-live-data",{body:{pendingId:pending,organizationId:selected}});if(error||!data?.organization){setError(data?.error||error?.message||"Could not open pilot dashboard.");setBusy(false);return}navigate("/pilot/"+selected)};
 const signOut=async()=>{await supabase?.auth.signOut();setSession(null);setPending("");setOrgs([])};
 if(!isSupabaseConfigured)return <main className="shell narrow"><Header/><section className="panel login-panel"><h1>Backend not configured</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project environment, then redeploy.</p></section><Footer/></main>;
 return (
  <main className="shell narrow">
   <Header right={session?<button className="top-link" onClick={signOut}><LogOut size={14}/> Sign out</button>:<Link className="top-link" to="/">Back home</Link>}/>
   <section className="panel login-panel">
    <div className="feature-icon"><ShieldCheck size={20}/></div>
    <h1>{!session?"Sign in to VEYRO Live":pending?"Choose your Live organization":"Connect Infinite Flight"}</h1>
    {!session ? (
     <>
      <p>Sign in with your email first. We use a secure one-time link to create your VEYRO session.</p>
      <form onSubmit={signIn}>
       <label className="field-label">Email address</label>
       <input className="text-field" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
       <button className="button button-primary full" disabled={busy}>{busy?"Sending…":"Send secure sign-in link"} <ChevronRight size={16}/></button>
      </form>
     </>
    ) : !pending ? (
     <>
      <p>Your VEYRO session is active. Connect your own Infinite Flight account to see every Live organization you belong to.</p>
      <button className="button button-primary full" onClick={connect} disabled={busy}>{busy?"Connecting…":"Continue with Infinite Flight"} <ChevronRight size={16}/></button>
     </>
    ) : (
     <>
      <p>Select any Infinite Flight organization you belong to. You can open its read-only pilot dashboard even if the VA has not connected a Veyro admin portal. Member access is enough.</p>
      {orgs.length===0&&!busy ? (
       <div className="notice">No organizations were returned. Confirm that this Infinite Flight account belongs to an active Live organization and that the OAuth client has the required scopes.</div>
      ) : (
       <>
        <label className="field-label">Your Infinite Flight organizations</label>
        <select className="text-field" value={selected} onChange={e=>setSelected(e.target.value)}>
         <option value="">Select an organization</option>
         {orgs.map(o=><option key={o.id} value={o.id}>{o.name} · {o.role===2?"Owner":o.role===1?"Admin":"Member"}{o.portal?" · Veyro portal connected":""}</option>)}
        </select>
        {selected ? (
         <>
          <div className="notice success">Your Infinite Flight membership is verified for this organization. Veyro will fetch its schedules and fleet using your own authorization.</div>
          <button className="button button-primary full" disabled={busy} onClick={openPilot}>{busy?"Opening pilot dashboard…":"Open pilot dashboard"} <ChevronRight size={16}/></button>
          {[1,2].includes(orgs.find(o=>o.id===selected)?.role) ? <Link className="button button-quiet full" to={"/apply?pending="+encodeURIComponent(pending)+"&org="+encodeURIComponent(selected)}>Apply for an organisation portal <ArrowUpRight size={14}/></Link> : null}
         </>
        ) : null}
       </>
      )}
     </>
    )}
    {message&&<div className="notice success">{message}</div>}
    {error&&<div className="notice error">{error}</div>}
   </section>
   <Footer/>
  </main>
 );
}

function Organization(){const {slug=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [sessionLoading,setSessionLoading]=useState(true);const [org,setOrg]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");
 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const [organizationResult,a,s]=await Promise.all([supabase.from("organizations").select("id,slug,display_name,live_organization_id").eq("slug",slug).eq("is_active",true).single(),supabase.functions.invoke("if-api",{body:{organizationSlug:slug,action:"aircraft"}}),supabase.functions.invoke("if-api",{body:{organizationSlug:slug,action:"schedules"}})]);const organization=organizationResult.data;if(organizationResult.error||!organization){setError("This organization is unavailable to your account.");setLoading(false);return}setOrg(organization);if(a.error||s.error){setError(a.error?.message||s.error?.message||"Live data could not be loaded.");setLoading(false);return}setAircraft(a.data?.result||[]);setSchedules(s.data?.result||[]);setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,slug]);
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to="/login" replace/>;
 const list=tab==="fleet"?aircraft:schedules;
 return <main className="shell"><Header right={<Link className="top-link" to="/login"><LogOut size={14}/> Account</Link>}/><section className="dashboard-heading"><div><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>{org?.display_name||slug}</h1><p>Live organization data · fetched on demand</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></section><div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organization aircraft</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current Live schedules</small></article><article className="stat-card"><span>Portal status</span><strong className="status-online">Connected</strong><small><ShieldCheck size={12}/> Membership verified</small></article><article className="stat-card"><span>Data source</span><strong>Live v3</strong><small>Not persisted by VEYRO</small></article></div><section className="panel dashboard-panel"><div className="section-heading"><div><h2>Operations</h2><p>Read-only Live view in this release</p></div><div className="tab-switch"><button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</button><button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</button></div></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="empty-state">Loading current Live data…</div>:list.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"schedules"} were returned by Infinite Flight Live.</div>:<div className="data-list">{list.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?"Fleet rank "+(item.fleetRank??"—")+" · "+(item.isFleetActiveSlot?"Active slot":"Storage"):((item.callsign||"Schedule")+" · "+(item.flightPlan||"No flight plan"))}</small></div><span className="row-status">{tab==="fleet"?(item.visibility===1?"Visible":"Hangared"):(item.status??"Scheduled")}</span></article>)}</div>}</section><Footer/></main>}
function PilotDashboard(){
 const {organizationId=""}=useParams();
 const location=useLocation();
 const [session,setSession]=useState<Session|null>(null);
 const [sessionLoading,setSessionLoading]=useState(true);
 const [organization,setOrganization]=useState<any>(null);
 const [aircraft,setAircraft]=useState<any[]>([]);
 const [schedules,setSchedules]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const navigate=useNavigate();
 const tail=location.pathname.split("/").filter(Boolean).at(-1)||"overview";
 const page=["overview","schedules","fleet","profile"].includes(tail)?tail:"overview";
 const tab=page==="fleet"?"fleet":"schedules";
 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 const load=async()=>{if(!supabase||!session||!organizationId)return;setLoading(true);setError("");const {data,error}=await supabase.functions.invoke("pilot-live-data",{body:{organizationId}});if(error||!data?.organization){setError(data?.error||error?.message||"Could not load this Live organization.");setLoading(false);return}setOrganization(data.organization);setAircraft(data.aircraft||[]);setSchedules(data.schedules||[]);setLastUpdated(new Date());setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,organizationId]);
 const signOut=async()=>{await supabase?.auth.signOut();navigate("/login")};
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to="/login" replace/>;
 const items=tab==="fleet"?aircraft:schedules;
 const nav=[{id:"overview",label:"Overview"},{id:"schedules",label:"Schedules"},{id:"fleet",label:"Fleet"},{id:"profile",label:"Pilot profile"}];
 return <main className="shell pilot-shell"><Header right={<><Link className="top-link" to="/login">Switch organisation</Link><button className="top-link" onClick={signOut}><LogOut size={14}/> Sign out</button></>}/>
  <div className="pilot-layout">
   <aside className="pilot-sidebar"><div className="pilot-sidebar-org"><span className="pilot-org-mark">{(organization?.name||"V").slice(0,1)}</span><div><strong>{organization?.name||"Live organisation"}</strong><small>PILOT WORKSPACE</small></div></div><nav>{nav.map(item=><Link key={item.id} className={page===item.id?"active":""} to={"/pilot/"+organizationId+"/"+item.id}>{item.label}</Link>)}</nav><div className="pilot-sidebar-foot">READ-ONLY ACCESS<br/>Powered by Infinite Flight Live</div></aside>
   <section className="pilot-content">
    <div className="dashboard-heading"><div><div className="eyebrow">PILOT WORKSPACE · {page.toUpperCase()}</div><h1>{page==="overview"?(organization?.name||"Your Live organisation"):page==="schedules"?"Published schedules":page==="fleet"?"Organisation fleet":"Pilot profile"}</h1><p>Personal Infinite Flight access · {organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"} · Read-only</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<div className="notice error">{error}</div>}
    {page==="overview" ? <>
      <div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organisation fleet</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current schedules</small></article><article className="stat-card"><span>Your Live role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":organization?"Member":"—"}</strong><small><ShieldCheck size={12}/> Verified by Infinite Flight</small></article><article className="stat-card"><span>Last refreshed</span><strong className="stat-time">{lastUpdated?lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</strong><small>Live API v3</small></article></div>
      <section className="panel dashboard-panel pilot-data-panel"><div className="section-heading"><div><h2>Upcoming schedules</h2><p>Published by your organisation in Infinite Flight Live</p></div><Link className="top-link" to={"/pilot/"+organizationId+"/schedules"}>View all <ChevronRight size={13}/></Link></div>{loading?<div className="empty-state">Loading Live data…</div>:schedules.length===0?<div className="empty-state">No published schedules were returned.</div>:<div className="data-list">{schedules.slice(0,6).map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{(item.originIcao||"—")+" → "+(item.destinationIcao||"—")}</strong><small>{[item.callsign||"Schedule",item.flightPlan||"No flight plan"].join(" · ")}</small></div><span className="row-status">{item.status??"Published"}</span></article>)}</div>}</section>
    </> : page==="profile" ? <section className="panel dashboard-panel"><div className="section-heading"><div><h2>Live membership</h2><p>Your access is verified directly by Infinite Flight</p></div><ShieldCheck size={17}/></div><div className="profile-detail"><span>Organisation</span><strong>{organization?.name||"—"}</strong></div><div className="profile-detail"><span>Infinite Flight role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"}</strong></div><div className="profile-detail"><span>Access type</span><strong>Personal OAuth · Read-only</strong></div><div className="profile-detail"><span>Data source</span><strong>Infinite Flight Public API v3</strong></div></section>
    : <section className="panel dashboard-panel pilot-data-panel"><div className="section-heading"><div><h2>{page==="fleet"?"Aircraft":"Schedules"}</h2><p>Fetched directly from Infinite Flight Public API v3{lastUpdated?" · Updated "+lastUpdated.toLocaleTimeString():""}</p></div></div>{loading?<div className="empty-state">Loading your organisation's Live data…</div>:items.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"published schedules"} were returned.</div>:<div className="data-list">{items.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||item.name||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?[item.aircraftType||item.type,item.isFleetActiveSlot?"Active fleet slot":"Fleet aircraft"].filter(Boolean).join(" · "):[item.callsign||"Schedule",item.flightType===1?"Passenger":item.flightType===2?"Cargo":null,item.isTimeless?"Timeless":item.departureTime||item.startTime].filter(Boolean).join(" · ")}</small></div><span className="row-status">{tab==="fleet"?"Aircraft":(item.status??"Published")}</span></article>)}</div>}</section>}
    <div className="hero-footnote">Testing / preview mode. Booking and crew assignment are not enabled in this read-only pilot workspace.</div>
   </section>
  </div><Footer/></main>
}
function NotFound(){return <main className="shell narrow"><Header/><section className="panel"><h1>Page not found</h1><Link to="/">Return home</Link></section></main>}
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/docs/*" element={<DocsPage/>}/><Route path="/login" element={<Login/>}/><Route path="/org/:slug/*" element={<Organization/>}/><Route path="/pilot/:organizationId/*" element={<PilotDashboard/>}/><Route path="/apply" element={<OrganizationApplicationPage/>}/><Route path="/application-status/:trackingCode" element={<ApplicationStatusPage/>}/><Route path="/:slug" element={<PublicOrganizationPage/>}/><Route path="*" element={<NotFound/>}/></Routes>}
