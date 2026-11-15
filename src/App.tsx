import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronRight, LogOut, Moon, Plane, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

function Brand(){return <Link className="brand" to="/"><span className="brand-mark">V</span><span>VEYRO<span className="brand-light"> LIVE</span></span></Link>}
function ThemeToggle(){const [dark,setDark]=useState(()=>localStorage.getItem("veyro-theme")==="dark");useEffect(()=>{document.documentElement.classList.toggle("dark",dark);localStorage.setItem("veyro-theme",dark?"dark":"light")},[dark]);return <button className="theme-toggle" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={15}/>:<Moon size={15}/>}</button>}
function Header({right}:{right?:ReactNode}){return <header className="topbar"><Brand/><span className="topbar-note">LIVE OPERATIONS PLATFORM</span><div className="top-actions">{right}<ThemeToggle/></div></header>}
function Footer(){return <footer className="footer"><span>© {new Date().getFullYear()} VEYRO</span><span>Independent third-party software</span></footer>}
function Landing(){return <main className="shell landing"><Header right={<a className="top-link" href="https://infiniteflight.com/account/api-keys" target="_blank" rel="noreferrer">Infinite Flight OAuth <ArrowUpRight size={14}/></a>}/><section className="hero"><div className="eyebrow"><span className="pulse"/> BUILT FOR INFINITE FLIGHT LIVE</div><h1>Your airline.<br/><span>One connected operation.</span></h1><p className="hero-copy">Fleet, schedules and crew reservations — brought together in one focused workspace for your Virtual Airline.</p><div className="hero-actions"><Link className="button button-primary" to="/login">Open your workspace <ChevronRight size={16}/></Link><a className="button button-quiet" href="https://infiniteflight.com/guide/developer-reference/live-api-v3/overview" target="_blank" rel="noreferrer">API documentation <ArrowUpRight size={15}/></a></div><div className="hero-footnote">Live remains the schedule source of truth. VEYRO does not store Live flight data snapshots.</div></section><section className="feature-grid"><article className="feature"><div className="feature-icon"><Plane size={18}/></div><h3>Fleet, in context</h3><p>View the organization's active fleet directly from Infinite Flight Live.</p></article><article className="feature"><div className="feature-icon"><CalendarDays size={18}/></div><h3>Published schedules</h3><p>Read the schedules your administrators publish in Infinite Flight Live.</p></article><article className="feature"><div className="feature-icon"><ShieldCheck size={18}/></div><h3>Controlled access</h3><p>Organization roles and server-side authorization protect operational actions.</p></article></section><Footer/></main>}
function Login(){const [session,setSession]=useState<Session|null>(null);const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState(new URLSearchParams(location.search).get("pending")||"");const [orgs,setOrgs]=useState<any[]>([]);const [selected,setSelected]=useState("");const [slug,setSlug]=useState("");const [displayName,setDisplayName]=useState("");const [error,setError]=useState("");const navigate=useNavigate();
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session||!pending||!supabase)return;let active=true;setBusy(true);supabase.functions.invoke("if-oauth-organizations",{body:{pendingId:pending}}).then(({data,error})=>{if(!active)return;if(error)throw error;setOrgs(data.organizations||[]);if(data.organizations?.length===1)setSelected(data.organizations[0].id)}).catch(e=>setError(e.message||"Could not load Infinite Flight organizations.")).finally(()=>setBusy(false));return()=>{active=false}},[session,pending]);
 const signIn=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError("");const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+"/login"}});setMessage(error? "": "Check your email for the secure sign-in link.");if(error)setError(error.message);setBusy(false)};
 const connect=async()=>{if(!supabase)return;setBusy(true);setError("");const {data,error}=await supabase.functions.invoke("if-oauth-start",{body:{}});if(error||!data?.authorizationUrl){setError(error?.message||"Could not start Infinite Flight authorization.");setBusy(false);return}location.assign(data.authorizationUrl)};
 const create=async()=>{if(!supabase)return;setBusy(true);setError("");const {data,error}=await supabase.functions.invoke("if-oauth-connect",{body:{pendingId:pending,liveOrganizationId:selected,slug:slug.toLowerCase().trim(),displayName:displayName.trim()}});if(error||!data?.organization){setError(error?.message||"Could not connect organization.");setBusy(false);return}navigate("/org/"+data.organization.slug)};
 const join=async()=>{if(!supabase||!selected)return;setBusy(true);setError("");const {data,error}=await supabase.functions.invoke("pilot-join",{body:{pendingId:pending,liveOrganizationId:selected}});if(error||!data?.organization){setError(error?.message||data?.error||"Could not join this organization.");setBusy(false);return}navigate("/org/"+data.organization.slug)};
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
         </>
        ) : null}
        {selected && [1,2].includes(orgs.find(o=>o.id===selected)?.role) && !orgs.find(o=>o.id===selected)?.portal ? (
         <>
          <div className="notice">Want to set up the VA's shared Veyro portal as well? You can create it as an Owner/Admin.</div>
          <label className="field-label">Portal display name</label>
          <input className="text-field" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your Virtual Airline"/>
          <label className="field-label">Portal URL slug</label>
          <input className="text-field" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="your-airline"/>
          <button className="button button-quiet full" disabled={busy||!slug||!displayName.trim()} onClick={create}>{busy?"Creating portal…":"Create organization portal"} <ChevronRight size={16}/></button>
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
 }

function Organization(){const {slug=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [org,setOrg]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");
 useEffect(()=>{supabase?.auth.getSession().then(({data})=>setSession(data.session))},[]);
 const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const {data:organization,error:orgError}=await supabase.from("organizations").select("id,slug,display_name,live_organization_id").eq("slug",slug).eq("is_active",true).single();if(orgError||!organization){setError("This organization is unavailable to your account.");setLoading(false);return}setOrg(organization);const [a,s]=await Promise.all([supabase.functions.invoke("if-api",{body:{organizationSlug:slug,action:"aircraft"}}),supabase.functions.invoke("if-api",{body:{organizationSlug:slug,action:"schedules"}})]);if(a.error||s.error){setError(a.error?.message||s.error?.message||"Live data could not be loaded.");setLoading(false);return}setAircraft(a.data?.result||[]);setSchedules(s.data?.result||[]);setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,slug]);
 if(!session)return <Navigate to="/login" replace/>;
 const list=tab==="fleet"?aircraft:schedules;
 return <main className="shell"><Header right={<Link className="top-link" to="/login"><LogOut size={14}/> Account</Link>}/><section className="dashboard-heading"><div><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>{org?.display_name||slug}</h1><p>Live organization data · fetched on demand</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></section><div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organization aircraft</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current Live schedules</small></article><article className="stat-card"><span>Portal status</span><strong className="status-online">Connected</strong><small><ShieldCheck size={12}/> Membership verified</small></article><article className="stat-card"><span>Data source</span><strong>Live v3</strong><small>Not persisted by VEYRO</small></article></div><section className="panel dashboard-panel"><div className="section-heading"><div><h2>Operations</h2><p>Read-only Live view in this release</p></div><div className="tab-switch"><button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</button><button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</button></div></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="empty-state">Loading current Live data…</div>:list.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"schedules"} were returned by Infinite Flight Live.</div>:<div className="data-list">{list.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?"Fleet rank "+(item.fleetRank??"—")+" · "+(item.isFleetActiveSlot?"Active slot":"Storage"):((item.callsign||"Schedule")+" · "+(item.flightPlan||"No flight plan"))}</small></div><span className="row-status">{tab==="fleet"?(item.visibility===1?"Visible":"Hangared"):(item.status??"Scheduled")}</span></article>)}</div>}</section><Footer/></main>}
function PilotDashboard(){const {organizationId=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [organization,setOrganization]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [lastUpdated,setLastUpdated]=useState<Date|null>(null);const navigate=useNavigate();
 useEffect(()=>{supabase?.auth.getSession().then(({data})=>setSession(data.session))},[]);
 const load=async()=>{if(!supabase||!session||!organizationId)return;setLoading(true);setError("");const {data,error}=await supabase.functions.invoke("pilot-live-data",{body:{organizationId}});if(error||!data?.organization){setError(data?.error||error?.message||"Could not load this Live organization.");setLoading(false);return}setOrganization(data.organization);setAircraft(data.aircraft||[]);setSchedules(data.schedules||[]);setLastUpdated(new Date());setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,organizationId]);
 const signOut=async()=>{await supabase?.auth.signOut();navigate("/login")};
 if(!session)return <Navigate to="/login" replace/>;
 const items=tab==="fleet"?aircraft:schedules;
 return <main className="shell"><Header right={<><Link className="top-link" to="/login">Switch organization</Link><button className="top-link" onClick={signOut}><LogOut size={14}/> Sign out</button></>}/><section className="dashboard-heading"><div><div className="eyebrow">PILOT WORKSPACE · READ ONLY</div><h1>{organization?.name||"Your Live organization"}</h1><p>Personal Infinite Flight access · {organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"} · No Veyro VA admin connection required</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></section><div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organization fleet</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current schedules</small></article><article className="stat-card"><span>Your Live role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":organization?"Member":"—"}</strong><small><ShieldCheck size={12}/> Verified by Infinite Flight</small></article><article className="stat-card"><span>Access mode</span><strong>Preview</strong><small>Read-only pilot dashboard</small></article></div><section className="panel dashboard-panel"><div className="section-heading"><div><h2>{tab==="schedules"?"Published schedules":"Organization fleet"}</h2><p>Fetched directly from Infinite Flight Public API v3{lastUpdated?" · Updated "+lastUpdated.toLocaleTimeString():""}</p></div><div className="tab-switch"><button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</button><button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</button></div></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="empty-state">Loading your organization's Live data…</div>:items.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"published schedules"} were returned for this organization.</div>:<div className="data-list">{items.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||item.name||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?[item.aircraftType||item.type,item.isFleetActiveSlot?"Active fleet slot":"Fleet aircraft"].filter(Boolean).join(" · "):[item.callsign||"Schedule",item.flightType===1?"Passenger":item.flightType===2?"Cargo":null,item.isTimeless?"Timeless":item.departureTime||item.startTime].filter(Boolean).join(" · ")}</small></div><span className="row-status">{tab==="fleet"?"Aircraft":(item.status??"Published")}</span></article>)}</div>}</section><div className="hero-footnote">Testing / preview mode. You can browse only organizations your own Infinite Flight account belongs to. Booking and crew assignment are not enabled in this read-only dashboard.</div><Footer/></main>}
function NotFound(){return <main className="shell narrow"><Header/><section className="panel"><h1>Page not found</h1><Link to="/">Return home</Link></section></main>}
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/org/:slug/*" element={<Organization/>}/><Route path="/pilot/:organizationId" element={<PilotDashboard/>}/><Route path="*" element={<NotFound/>}/></Routes>}
