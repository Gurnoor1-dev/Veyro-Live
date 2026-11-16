import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, LogOut, Moon, Plane, RefreshCw, ShieldCheck, Sun, Users, Building2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { invokeFunction } from "./lib/functions";
import { ApplicationStatusPage, OrganizationApplicationPage, OrganizationDirectory, PublicOrganizationPage } from "./pages/PortalPages";
import DocsPage from "./pages/DocsPage";
import AdminPortal from "./pages/AdminPortal";
import PilotSignIn from "./pages/PilotSignIn";

function Brand(){return <Link className="brand" to="/"><span className="brand-mark">V</span><span>VEYRO<span className="brand-light"> LIVE</span></span></Link>}
function ThemeToggle(){const [dark,setDark]=useState(()=>localStorage.getItem("veyro-theme")==="dark");useEffect(()=>{document.documentElement.classList.toggle("dark",dark);localStorage.setItem("veyro-theme",dark?"dark":"light")},[dark]);return <button className="theme-toggle" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={15}/>:<Moon size={15}/>}</button>}
export function InfiniteFlightAccount(){const [session,setSession]=useState<Session|null>(null);const [connected,setConnected]=useState(false);const [checked,setChecked]=useState(false);const [busy,setBusy]=useState(false);useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>{active=false;data.subscription.unsubscribe()}},[]);useEffect(()=>{if(!session||!supabase){setConnected(false);setChecked(true);return}let active=true;invokeFunction(supabase,"if-connection-status").then(({data,error})=>{if(active){setConnected(!error&&Boolean(data?.connected));setChecked(true)}});return()=>{active=false}},[session]);const connect=async()=>{if(!supabase)return;setBusy(true);const {data,error}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo:"/account"}});if(error||!data?.authorizationUrl){setBusy(false);window.location.assign("/account?connect_error="+encodeURIComponent(error?.message||"Could not connect Infinite Flight."));return}window.location.assign(data.authorizationUrl)};if(!session)return <Link className="nav-account-link" to="/login">Sign in <ArrowUpRight size={13}/></Link>;if(!checked)return <Link className="nav-account-link" to="/account">My Veyro</Link>;return <div className="nav-account-group"><span className={"if-connection-dot "+(connected?"connected":"")}/><Link className="nav-account-link" to="/account">{connected?"My Veyro":"Connect Infinite Flight"}</Link>{!connected&&<button className="if-connect-button" onClick={connect} disabled={busy}>{busy?"Opening…":"Connect"}</button>}</div>}
function Header({right}:{right?:ReactNode}){return <header className="topbar"><Brand/><span className="topbar-note">LIVE OPERATIONS PLATFORM</span><div className="top-actions"><InfiniteFlightAccount/>{right}<ThemeToggle/></div></header>}
function Footer(){return <footer className="footer"><span>© {new Date().getFullYear()} VEYRO</span><span>Independent third-party software</span></footer>}
function Landing(){return <main className="shell landing landing-cosmic"><section className="cosmic-frame"><header className="cosmic-nav"><Brand/><nav><Link to="/#markets">Airlines</Link><Link to="/docs">Technology</Link><Link to="/docs">Documentation</Link><a href="https://infiniteflight.com" target="_blank" rel="noreferrer">Infinite Flight</a></nav><Link className="cosmic-register" to="/account">My Veyro <ArrowUpRight size={13}/></Link></header><div className="cosmic-scene" aria-hidden="true"><div className="cosmic-arch arch-one"/><div className="cosmic-arch arch-two"/><div className="cosmic-planet planet-one"/><div className="cosmic-planet planet-two"/><div className="cosmic-orb orb-one"/><div className="cosmic-orb orb-two"/><div className="cosmic-pillar pillar-one"/><div className="cosmic-pillar pillar-two"/><div className="cosmic-pillar pillar-three"/><div className="cosmic-floor"/><div className="cosmic-horizon"/></div><div className="cosmic-copy"><div className="eyebrow"><span className="pulse"/> THE NEXT ERA OF VIRTUAL AVIATION</div><h1>Connected skies.<br/><em>Limitless operations.</em></h1><p>One command centre for your Virtual Airline. Manage your fleet, publish schedules and bring your pilots together — powered by Infinite Flight Live.</p><div className="cosmic-actions"><Link className="cosmic-cta" to="/login">Enter Veyro Live <ArrowRight size={16}/></Link><Link className="cosmic-secondary" to="/docs">Explore the platform <ArrowUpRight size={14}/></Link></div></div><div className="cosmic-bottom"><span>BUILT FOR INFINITE FLIGHT LIVE</span><span>FLEET · SCHEDULES · CREW</span><span>01 / VEYRO LIVE</span></div></section><section className="cosmic-intro" id="markets"><div><div className="eyebrow">A BETTER WAY TO FLY TOGETHER</div><h2>Your airline,<br/><span>beautifully organised.</span></h2></div><p>From the first pilot sign-in to the final schedule approval, Veyro gives every organization a dedicated home and every pilot a connected workspace.</p></section><section className="feature-grid"><article className="feature"><div className="feature-icon"><Plane size={18}/></div><h3>Fleet, in context</h3><p>Manage your aircraft and keep your operations aligned with Infinite Flight Live.</p></article><article className="feature"><div className="feature-icon"><CalendarDays size={18}/></div><h3>Schedules that move</h3><p>Publish aircraft schedules and let pilots request the legs they want to fly.</p></article><article className="feature"><div className="feature-icon"><ShieldCheck size={18}/></div><h3>Access, under control</h3><p>One secure account, organization-specific permissions and Discord approvals.</p></article></section><OrganizationDirectory/><Footer/></main>}
function Login(){const [session,setSession]=useState<Session|null>(null);const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState(new URLSearchParams(location.search).get("pending")||"");const [orgs,setOrgs]=useState<any[]>([]);const [selected,setSelected]=useState("");const [error,setError]=useState("");const navigate=useNavigate();
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session&&!pending){const next=new URLSearchParams(location.search).get("next");navigate("/account"+(next?"?next="+encodeURIComponent(next):""),{replace:true})}},[session,pending,navigate]);
 useEffect(()=>{const next=new URLSearchParams(location.search).get("next");if(next)localStorage.setItem("veyro-after-login",next);const target=localStorage.getItem("veyro-after-login");const isAdminDestination=!!target&&target.split("?")[0].split("/")[2]==="admin";if(session&&target&&(!pending||isAdminDestination)){localStorage.removeItem("veyro-after-login");navigate(target,{replace:true})}},[session,pending,navigate]);
 useEffect(()=>{if(!session||!pending||!supabase)return;let active=true;setBusy(true);invokeFunction(supabase,"if-oauth-organizations",{body:{pendingId:pending}}).then(({data,error})=>{if(!active)return;if(error)throw error;setOrgs(data.organizations||[]);if(data.organizations?.length===1)setSelected(data.organizations[0].id)}).catch(e=>setError(e.message||"Could not load Infinite Flight organizations.")).finally(()=>setBusy(false));return()=>{active=false}},[session,pending]);
 const signIn=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError("");const nextPath=new URLSearchParams(location.search).get("next")||"/";const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+"/login?next="+encodeURIComponent(nextPath)}});setMessage(error? "": "Check your email for the secure sign-in link.");if(error)setError(error.message);setBusy(false)};
 const connect=async()=>{if(!supabase)return;setBusy(true);setError("");try{const target=new URLSearchParams(location.search).get("next")||"/";const {data,error}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo:"/login?next="+encodeURIComponent(target)}});if(error||!data?.authorizationUrl)throw error||new Error("Could not start Infinite Flight authorization.");location.assign(data.authorizationUrl)}catch(e){setError(e instanceof Error?e.message:"Could not start Infinite Flight authorization.");setBusy(false)}};
 const openPilot=async()=>{if(!supabase||!selected)return;const chosen=orgs.find(o=>o.id===selected);if(chosen?.portal&&[1,2].includes(chosen.role)){navigate("/"+chosen.portal.slug+"/admin");return}setBusy(true);setError("");const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{pendingId:pending,organizationId:selected,cacheScope:getPilotCacheScope()}});if(error||!data?.organization){let message=data?.error||error?.message||"Could not open pilot dashboard.";if(error&&"context" in error&&error.context instanceof Response){try{const detail=await error.context.clone().json();message=detail?.error||message}catch{}}setError(message);setBusy(false);return}navigate("/pilot/"+selected)};
 const chosenOrganization=orgs.find(o=>o.id===selected);const chosenIsAdmin=!!(chosenOrganization?.portal&&[1,2].includes(chosenOrganization.role));
 const signOut=async()=>{await supabase?.auth.signOut();setSession(null);setPending("");setOrgs([])};
 if(!isSupabaseConfigured)return <main className="shell narrow"><Header/><section className="panel login-panel"><h1>Backend not configured</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project environment, then redeploy.</p></section><Footer/></main>;
 return (
  <main className="shell narrow">
   <Header right={session?<div className="session-actions"><span className="session-pill"><span className="session-dot"/> Stay signed in</span><button className="account-signout" onClick={signOut}><LogOut size={14}/> Sign out</button></div>:<Link className="top-link" to="/">Back home</Link>}/>
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
          <button className="button button-primary full" disabled={busy} onClick={openPilot}>{busy?"Opening workspace…":chosenIsAdmin?"Open Admin Dashboard":"Open Pilot Dashboard"} <ChevronRight size={16}/></button>
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

function MyVeyro(){const location=useLocation();const navigate=useNavigate();const [session,setSession]=useState<Session|null>(null);const [authLoading,setAuthLoading]=useState(true);const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");const query=new URLSearchParams(location.search);const next=query.get("next");useEffect(()=>{let active=true;if(!supabase){setAuthLoading(false);setLoading(false);return}supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setAuthLoading(false)}});const {data:listener}=supabase.auth.onAuthStateChange((_e,s)=>{if(active)setSession(s)});return()=>{active=false;listener.subscription.unsubscribe()}},[]);const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const {data:result,error:invokeError}=await invokeFunction(supabase,"my-portals");if(invokeError){let message=invokeError.message;if("context" in invokeError&&invokeError.context instanceof Response){try{message=(await invokeError.context.clone().json()).error||message}catch{}}setError(message);setLoading(false);return}setData(result);setLoading(false)};useEffect(()=>{if(session)void load();else setLoading(false)},[session]);useEffect(()=>{const err=query.get("connect_error");if(err)setError(err)},[location.search]);const connect=async()=>{if(!supabase)return;setBusy("connect");setError("");const {data:result,error:invokeError}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo:"/account"+(next?"?next="+encodeURIComponent(next):"")}});if(invokeError||!result?.authorizationUrl){setError(invokeError?.message||"Could not start Infinite Flight authorization.");setBusy("");return}window.location.assign(result.authorizationUrl)};const join=async(invite:any)=>{if(!supabase)return;setBusy(invite.organization.id);setError("");const {data:result,error:invokeError}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:invite.organization.live_organization_id,cacheScope:getPilotCacheScope()}});if(invokeError||!result?.portal){let message=invokeError?.message||"Could not activate your pilot access.";if(invokeError&&"context" in invokeError&&invokeError.context instanceof Response){try{message=(await invokeError.context.clone().json()).error||message}catch{}}setError(message);setBusy("");return}setNotice("You're now a member of "+invite.organization.display_name+".");await load();setBusy("")};const signOut=async()=>{await supabase?.auth.signOut();setSession(null);setData(null);navigate("/")};const memberships=data?.memberships||[];const invitations=data?.invitations||[];const directory=data?.directory||[];const joinedIds=new Set(memberships.map((x:any)=>x.id));const invitedIds=new Set(invitations.map((x:any)=>x.organization.id));if(authLoading)return <main className="shell"><Header/><section className="account-loading">Restoring your VEYRO session…</section></main>;if(!session)return <main className="shell"><Header/><section className="account-welcome"><div className="eyebrow">YOUR VEYRO ACCOUNT</div><h1>One identity.<br/><span>Every airline you fly with.</span></h1><p>Sign in once to access your pilot portals, airline memberships and organization administration.</p><Link className="cosmic-cta account-primary" to="/login">Sign in to VEYRO <ArrowRight size={16}/></Link></section><Footer/></main>;return <main className="shell account-shell"><Header right={<div className="account-nav-user"><span>{data?.profile?.display_name||session.user.email}</span><button className="account-signout" onClick={signOut}><LogOut size={14}/> Sign out</button></div>}/><section className="account-hero"><div><div className="eyebrow"><span className="pulse"/> PERSONAL OPERATIONS CENTRE</div><h1>Welcome back{data?.profile?.display_name?", "+data.profile.display_name:""}.</h1><p>Your airlines, your crew spaces and your Infinite Flight connection — together in one place.</p></div><div className={"account-connection-card "+(data?.infiniteFlight?.connected?"is-connected":"")}><span className="connection-orb"/><div><strong>{data?.infiniteFlight?.connected?"Infinite Flight connected":"Connect Infinite Flight"}</strong><small>{data?.infiniteFlight?.connected?"Your account is ready across VEYRO":"One secure connection unlocks your airline workspaces"}</small></div><button className={data?.infiniteFlight?.connected?"button button-quiet":"button button-primary"} disabled={busy==="connect"} onClick={connect}>{busy==="connect"?"Opening Infinite Flight…":data?.infiniteFlight?.connected?"Reconnect Infinite Flight":"Connect account"}</button></div></section>{error&&<div className="notice error">{error}</div>}{notice&&<div className="notice success">{notice}</div>}<section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">YOUR ORGANISATIONS</div><h2>My airline portals</h2><p>Workspaces where your membership is active.</p></div><span className="account-count">{memberships.length} PORTALS</span></div>{loading?<div className="account-card-grid"><div className="account-skeleton"/><div className="account-skeleton"/></div>:memberships.length===0?<div className="account-empty"><Building2 size={22}/><strong>Your airline spaces will appear here.</strong><span>Join an invited airline to unlock its pilot dashboard, or explore the network below.</span></div>:<div className="account-card-grid">{memberships.map((org:any)=><article className="airline-account-card" key={org.id}><div className="airline-card-top"><div className="airline-card-logo">{org.logo_url?<img src={org.logo_url} alt=""/>:<span>{org.display_name?.slice(0,1)||"V"}</span>}</div><span className="membership-chip">{org.role==="owner"||org.role==="admin"?"ADMIN":"PILOT"}</span></div><h3>{org.display_name}</h3><p>{org.tagline||"Your dedicated Infinite Flight workspace."}</p><div className="airline-card-actions">{(org.role==="owner"||org.role==="admin")&&<Link className="button button-primary" to={"/"+org.slug+"/admin"}>Admin dashboard <ArrowRight size={14}/></Link>}<Link className="button button-quiet" to={"/"+org.slug+"/pilot/"+session.user.id}>Pilot dashboard <ArrowRight size={14}/></Link><Link className="airline-text-link" to={"/"+org.slug}>View airline <ArrowUpRight size={13}/></Link></div></article>)}</div>}</section><section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">INVITATIONS</div><h2>Ready to join</h2><p>Airlines that have invited this VEYRO account.</p></div><span className="account-count">{invitations.length} INVITATIONS</span></div>{invitations.length===0?<div className="account-empty compact"><Users size={20}/><span>No pending pilot invitations. Ask an airline administrator to add your email address.</span></div>:<div className="account-card-grid">{invitations.map((invite:any)=><article className="airline-account-card invite-card" key={invite.id}><div className="airline-card-top"><div className="airline-card-logo">{invite.organization.logo_url?<img src={invite.organization.logo_url} alt=""/>:<span>{invite.organization.display_name?.slice(0,1)||"V"}</span>}</div><span className="membership-chip invited">INVITED</span></div><h3>{invite.organization.display_name}</h3><p>Welcome, {invite.pilotName}. Your airline has invited you to join its pilot community.</p><button className="button button-primary" disabled={busy===invite.organization.id||!data?.infiniteFlight?.connected} onClick={()=>join(invite)}>{busy===invite.organization.id?"Verifying membership…":data?.infiniteFlight?.connected?"Join airline":"Connect Infinite Flight first"} <ArrowRight size={14}/></button></article>)}</div>}</section><section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">THE VEYRO NETWORK</div><h2>Explore airlines</h2><p>Discover public airline portals and learn about their operations.</p></div><span className="account-count">{directory.length} PUBLIC PORTALS</span></div>{loading?<div className="account-skeleton"/>:directory.length===0?<div className="account-empty">No public portals are available yet.</div>:<div className="account-directory-grid">{directory.map((org:any)=><article className="directory-account-card" key={org.id}><div className="airline-card-logo">{org.logo_url?<img src={org.logo_url} alt=""/>:<span>{org.display_name?.slice(0,1)||"V"}</span>}</div><div className="directory-account-copy"><h3>{org.display_name}</h3><p>{org.tagline||"Virtual airline on Infinite Flight Live."}</p><div className="airline-card-actions"><Link className="airline-text-link" to={"/"+org.slug}>Website info <ArrowUpRight size={13}/></Link>{joinedIds.has(org.id)?<span className="membership-chip">MEMBER</span>:invitedIds.has(org.id)?<span className="membership-chip invited">INVITED</span>:<Link className="button button-quiet" to={"/"+org.slug+"/pilot-sign-in"}>Join airline <ArrowRight size={13}/></Link>}</div></div></article>)}</div>}</section><div className="account-bottom-actions"><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh my portals</button><Link className="button button-quiet" to="/docs">Platform documentation <ArrowUpRight size={14}/></Link></div><Footer/></main>}
function Organization(){const {slug=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [sessionLoading,setSessionLoading]=useState(true);const [org,setOrg]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");
 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const [organizationResult,a,s]=await Promise.all([supabase.from("organizations").select("id,slug,display_name,live_organization_id").eq("slug",slug).eq("is_active",true).single(),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"aircraft"}}),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"schedules"}})]);const organization=organizationResult.data;if(organizationResult.error||!organization){setError("This organization is unavailable to your account.");setLoading(false);return}setOrg(organization);if(a.error||s.error){setError(a.error?.message||s.error?.message||"Live data could not be loaded.");setLoading(false);return}setAircraft(a.data?.result||[]);setSchedules(s.data?.result||[]);setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,slug]);
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to="/login" replace/>;
 const list=tab==="fleet"?aircraft:schedules;
 return <main className="shell"><Header right={<Link className="top-link" to="/login"><LogOut size={14}/> Account</Link>}/><section className="dashboard-heading"><div><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>{org?.display_name||slug}</h1><p>Live organization data · fetched on demand</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></section><div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organization aircraft</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current Live schedules</small></article><article className="stat-card"><span>Portal status</span><strong className="status-online">Connected</strong><small><ShieldCheck size={12}/> Membership verified</small></article><article className="stat-card"><span>Data source</span><strong>Live v3</strong><small>Not persisted by VEYRO</small></article></div><section className="panel dashboard-panel"><div className="section-heading"><div><h2>Operations</h2><p>Read-only Live view in this release</p></div><div className="tab-switch"><button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</button><button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</button></div></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="empty-state">Loading current Live data…</div>:list.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"schedules"} were returned by Infinite Flight Live.</div>:<div className="data-list">{list.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?"Fleet rank "+(item.fleetRank??"—")+" · "+(item.isFleetActiveSlot?"Active slot":"Storage"):((item.callsign||"Schedule")+" · "+(item.flightPlan||"No flight plan"))}</small></div><span className="row-status">{tab==="fleet"?(item.visibility===1?"Visible":"Hangared"):(item.status??"Scheduled")}</span></article>)}</div>}</section><Footer/></main>}
type AircraftPosition = {
 id: string; state?: number; isOnGround?: boolean; latitude: number; longitude: number;
 altitude?: number; heading?: number; speed?: number; verticalSpeed?: number;
 lastPilotId?: string|null; lastPilotUsername?: string|null; updatedAt?: string;
};
function getPilotCacheScope(){
 try{
  const key="veyro-live-if-cache-scope";
  let scope=sessionStorage.getItem(key);
  if(!scope){scope=crypto.randomUUID();sessionStorage.setItem(key,scope)}
  return scope;
 }catch{return undefined}
}
function currentRateBudget(rateLimit:{remaining:number|null;resetAt:string|null;isPro:boolean}|null){
 if(!rateLimit)return undefined;
 const value=rateLimit.resetAt;const numeric=value?Number(value):NaN;
 const resetTime=value?(Number.isFinite(numeric)?(numeric<1e12?numeric*1000:numeric):Date.parse(value)):0;
 return resetTime&&resetTime>Date.now()?rateLimit.remaining??undefined:undefined;
}
function ageLabel(value?:string){
 if(!value)return "Update time unavailable";
 const timestamp=new Date(value).getTime();if(!Number.isFinite(timestamp))return "Update time unavailable";
 const age=Math.max(0,Date.now()-timestamp);
 const minutes=Math.floor(age/60000);
 if(minutes<1)return "Updated just now";
 if(minutes<60)return "Updated "+minutes+"m ago";
 const hours=Math.floor(minutes/60);
 if(hours<24)return "Updated "+hours+"h ago";
 return "Updated "+Math.floor(hours/24)+"d ago";
}
function aircraftState(position?:AircraftPosition){
 if(!position)return {label:"Position unavailable",tone:"muted"};
 const age=position.updatedAt?Date.now()-new Date(position.updatedAt).getTime():Infinity;
 if(position.state===5)return {label:"Maintenance",tone:"warning"};
 if(position.state===3)return {label:"Cancelled",tone:"danger"};
 if(position.state===4)return {label:"Stopped",tone:"muted"};
 if(position.isOnGround){
  if(age>6*60*60*1000)return {label:"Parked · "+ageLabel(position.updatedAt).replace("Updated ",""),tone:"muted"};
  return {label:"On ground",tone:"ground"};
 }
 if(position.state===2||position.isOnGround===false){
  return age>30*60*1000?{label:"Last known in air",tone:"warning"}:{label:"In air",tone:"air"};
 }
 return {label:"Status unknown",tone:"muted"};
}
function scheduleStatusLabel(status:number){
 return ({0:"Unknown",1:"Scheduled",2:"Boarding",3:"Boarded",4:"Taxiing to runway",6:"In flight",7:"Diverted",8:"Delayed",9:"Cancelled",10:"Taxiing to parking",11:"Arrived"} as Record<number,string>)[status]||"Scheduled";
}
function flightTypeLabel(type:number){
 return (["Unspecified","Commercial","Charter","Cargo","Training","Test flight","Medical emergency","Military","VIP / Executive","Humanitarian","General aviation","Airshow","Other"] as string[])[type]||"Flight";
}
function AircraftMapViewport({points}:{points:[number,number][]}){
 const map=useMap();
 useEffect(()=>{
  if(points.length===1)map.setView(points[0],4);
  else if(points.length>1)map.fitBounds(points,{padding:[36,36],maxZoom:5});
 },[map,points.length]);
 return null;
}
function AircraftMapMarker({aircraft,position,dark}:{aircraft:any;position:AircraftPosition;dark:boolean}){
 const icon=useMemo(()=>L.divIcon({
  className:"veyro-aircraft-marker",
  html:'<span class="veyro-aircraft-marker-core '+(dark?"is-dark":"is-light")+'"><svg viewBox="0 0 24 28" aria-hidden="true" style="transform:rotate('+Number(position.heading||0)+'deg)"><path d="M12 1.5 14.6 10l7.1 4.1v2.8l-7.1-2.2v7l2.7 1.8v2.1L12 24l-5.3 1.6v-2.1L9.4 21v-7l-7.1 2.2v-2.8L9.4 10z"/></svg></span>',
  iconSize:[38,38],iconAnchor:[19,19],
 }),[dark,position.heading]);
 return <Marker position={[position.latitude,position.longitude]} icon={icon}>
  <Popup>
   <div className="aircraft-map-popup">
    <strong>{aircraft.registration||"Fleet aircraft"}</strong>
    <span>{position.lastPilotUsername||"Pilot not reported"} · {aircraftState(position).label}</span>
    <div><b>{Math.round(position.altitude||0).toLocaleString()} ft</b><b>{Math.round(position.speed||0)} kt</b><b>{Math.round(position.heading||0)}° HDG</b><b>{Math.round(position.verticalSpeed||0)} ft/min</b></div>
    <small>{position.latitude.toFixed(4)}, {position.longitude.toFixed(4)} · {ageLabel(position.updatedAt)}</small>
   </div>
  </Popup>
 </Marker>;
}
function AircraftLiveMap({aircraft,positions,dark}:{aircraft:any[];positions:Record<string,AircraftPosition>;dark:boolean}){
 const plotted=aircraft.map(item=>({aircraft:item,position:positions[item.id]})).filter(item=>item.position&&item.position.state===2&&item.position.isOnGround===false&&Number.isFinite(item.position.latitude)&&Number.isFinite(item.position.longitude)&&Number.isFinite(new Date(item.position.updatedAt||"").getTime())&&Date.now()-new Date(item.position.updatedAt||"").getTime()<30*60_000);
 const points=plotted.map(item=>[item.position.latitude,item.position.longitude] as [number,number]);
 return <div className="aircraft-map-frame">
  <MapContainer key={dark?"dark":"light"} center={points[0]??L.latLng(25,10)} zoom={points.length?4:2} scrollWheelZoom zoomControl={false} className="aircraft-live-map">
   <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url={dark?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png":"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}/>
   <AircraftMapViewport points={points}/>
   {plotted.length===0&&<div className="aircraft-map-empty">No aircraft are currently reporting an active in-air position.</div>}
   {plotted.map(({aircraft:item,position})=><AircraftMapMarker key={item.id} aircraft={item} position={position} dark={dark}/>)}
  </MapContainer>
  <div className="aircraft-map-count"><span className="map-live-dot"/>{plotted.length} airborne · {aircraft.length} aircraft in fleet</div>
 </div>;
}
function FleetAircraftCard({aircraft}:{aircraft:any}){
 const [imageFailed,setImageFailed]=useState(false);
 const registration=String(aircraft.registration||"UNREGISTERED");
 return <article className="fleet-aircraft-card">
  <div className="fleet-aircraft-visual">
   {!imageFailed?<img src={"/aircrafts/"+encodeURIComponent(registration)+"/aircraft.png"} alt={registration+" aircraft"} onError={()=>setImageFailed(true)}/>:<div className="fleet-aircraft-fallback"><Plane size={76} strokeWidth={1}/><span>VEYRO FLEET</span></div>}
   <span className="fleet-rank">FLEET {aircraft.fleetRank??"—"}</span>
  </div>
  <div className="fleet-aircraft-copy"><div><span className="eyebrow">AIRCRAFT REGISTRATION</span><h3>{registration}</h3></div><span className={"aircraft-status-chip "+(aircraft.isFleetActiveSlot?"tone-air":"tone-muted")}>{aircraft.isFleetActiveSlot?"Active fleet slot":"Reserve / storage"}</span></div>
  <div className="fleet-aircraft-meta"><span>{aircraft.visibility===2?"Hangared":"Visible in fleet"}</span><span>{aircraft.status===0?"Active record":"Inactive record"}</span></div>
 </article>;
}
function PilotDashboard(){
 const {organizationId="",slug="",pilotId=""}=useParams();
 const [resolvedOrganizationId,setResolvedOrganizationId]=useState(organizationId);
 const [cacheScope]=useState(()=>getPilotCacheScope());
 const [portalId,setPortalId]=useState("");
 const [bookings,setBookings]=useState<any[]>([]);
 const [members,setMembers]=useState<any[]>([]);
 const [membersLoading,setMembersLoading]=useState(false);
 const [membersError,setMembersError]=useState("");
 const [requestBusy,setRequestBusy]=useState("");
 const location=useLocation();
 const [session,setSession]=useState<Session|null>(null);
 const [sessionLoading,setSessionLoading]=useState(true);
 const [organization,setOrganization]=useState<any>(null);
 const [aircraft,setAircraft]=useState<any[]>([]);
 const [schedules,setSchedules]=useState<any[]>([]);
 const [schedulePagination,setSchedulePagination]=useState<{page:number;pageSize:number;totalCount:number;totalPages:number}>({page:1,pageSize:100,totalCount:0,totalPages:1});
 const [scheduleLoadingMore,setScheduleLoadingMore]=useState(false);
 const [scheduleLoadError,setScheduleLoadError]=useState("");
 const [aircraftCursor,setAircraftCursor]=useState(0);
 const [positions,setPositions]=useState<Record<string,AircraftPosition>>({});
 const [latestFlights,setLatestFlights]=useState<Record<string,any>>({});
 const [apiRateLimit,setApiRateLimit]=useState<{remaining:number|null;resetAt:string|null;isPro:boolean}|null>(null);
 const [positionLoading,setPositionLoading]=useState(false);
 const [positionError,setPositionError]=useState("");
 const [positionsUpdated,setPositionsUpdated]=useState<Date|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const [darkMap,setDarkMap]=useState(()=>document.documentElement.classList.contains("dark"));
 const lastUserActivity=useRef(Date.now());
 const navigate=useNavigate();
 const tail=location.pathname.split("/").filter(Boolean).at(-1)||"overview";
 const page=["overview","schedules","fleet","members","bookings","profile"].includes(tail)?tail:"overview";

 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 useEffect(()=>{
  const observer=new MutationObserver(()=>setDarkMap(document.documentElement.classList.contains("dark")));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const markActivity=()=>{lastUserActivity.current=Date.now()};
  const events=["pointerdown","keydown","touchstart","wheel"];
  events.forEach(event=>window.addEventListener(event,markActivity,{passive:true}));
  return()=>events.forEach(event=>window.removeEventListener(event,markActivity));
 },[]);
 useEffect(()=>{if(!slug||!supabase)return;supabase.from("organizations").select("live_organization_id").eq("slug",slug).single().then(({data})=>{if(data?.live_organization_id)setResolvedOrganizationId(data.live_organization_id)})},[slug]);

 const load=async()=>{
  if(!supabase||!session||!resolvedOrganizationId)return;
  setLoading(true);setError("");
  const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:resolvedOrganizationId,cacheScope}});
  if(error||!data?.organization){setError(data?.error||error?.message||"Could not load this Live organization.");setLoading(false);return}
  setOrganization(data.organization);setPortalId(data.portal?.id||"");setAircraft(data.aircraft||[]);setSchedules(data.schedules||[]);setSchedulePagination(data.schedulesPagination||{page:1,pageSize:100,totalCount:(data.schedules||[]).length,totalPages:1});setMembers([]);if(data.rateLimit)setApiRateLimit(data.rateLimit);
  if(data.portal?.id){const {data:rows}=await supabase.from("booking_requests").select("id,live_schedule_id,status,request_note,created_at,reviewed_at,rejection_reason").eq("organization_id",data.portal.id).eq("pilot_user_id",session.user.id).order("created_at",{ascending:false}).limit(30);setBookings(rows||[])}
  setLastUpdated(new Date());setLoading(false);
 };
 useEffect(()=>{if(session&&resolvedOrganizationId)void load();else if(!isSupabaseConfigured)setLoading(false)},[session,resolvedOrganizationId]);

 const fetchFleetData=async(includeFlights=false)=>{
  if(!supabase||!resolvedOrganizationId||aircraft.length===0)return;
  setPositionLoading(true);
  try{
   const budget=currentRateBudget(apiRateLimit);
   const orderedAircraft=aircraft.length?[...aircraft.slice(aircraftCursor),...aircraft.slice(0,aircraftCursor)]:[];
   const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:resolvedOrganizationId,cacheScope,action:includeFlights?"aircraft_operations":"aircraft_positions",aircraftIds:orderedAircraft.map(item=>item.id),apiRateRemaining:budget,apiRateResetAt:apiRateLimit?.resetAt,isPro:apiRateLimit?.isPro??false}});
   if(error)throw error;
   const nextPositions=(data?.positions||{}) as Record<string,AircraftPosition>;
   setPositions(previous=>({...previous,...nextPositions}));
   if(includeFlights)setLatestFlights(previous=>({...previous,...(data?.latestFlights||{})}) as Record<string,any>);if(data?.rateLimit)setApiRateLimit(data.rateLimit);
   const processed=Number(data?.completed||0)+Object.keys(data?.failures||{}).length;if(processed&&aircraft.length)setAircraftCursor(previous=>(previous+processed)%aircraft.length);
   if(Number(data?.completed)>0)setPositionsUpdated(data?.updatedAt?new Date(data.updatedAt):new Date());
   if(data?.rateLimited){
    setPositionError(Number(data?.completed)>0?"Infinite Flight rate limit reached. Updated "+data.completed+" of "+(data.total||aircraft.length)+" aircraft; remaining positions will update after the API reset.":"Infinite Flight request allowance is exhausted. Automatic position updates will resume after the rate-limit reset.");
   }else if(Object.keys(data?.failures||{}).length){
    setPositionError("Some aircraft positions are unavailable. Their last known positions are retained where available.");
   }else setPositionError("");
  }catch(e){
   setPositionError(e instanceof Error?e.message:"Could not retrieve aircraft positions.");
  }finally{setPositionLoading(false)}
 };

 useEffect(()=>{
  if(page!=="overview"||!session||aircraft.length===0)return;
  let active=true;
  const poll=async()=>{if(active&&document.visibilityState==="visible"&&Date.now()-lastUserActivity.current<15*60_000)await fetchFleetData(false)};
  void poll();
  const timer=window.setInterval(()=>{void poll()},30000);
  return()=>{active=false;window.clearInterval(timer)};
 },[page,session,resolvedOrganizationId,aircraft.length]);

 useEffect(()=>{
  if(page!=="members"||!session||!resolvedOrganizationId||!supabase)return;
  let active=true;setMembersLoading(true);setMembersError("");
  invokeFunction(supabase,"pilot-live-data",{body:{organizationId:resolvedOrganizationId,cacheScope,action:"organization_members",apiRateRemaining:currentRateBudget(apiRateLimit),apiRateResetAt:apiRateLimit?.resetAt,isPro:apiRateLimit?.isPro??false}})
   .then(({data,error})=>{if(error)throw error;if(active){setMembers(data?.members||[]);if(data?.rateLimit)setApiRateLimit(data.rateLimit);if(data?.rateLimited)setMembersError("Infinite Flight request allowance is currently exhausted. Try again after the rate-limit reset.")}})
   .catch(e=>{if(active)setMembersError(e instanceof Error?e.message:"Could not load organization crew.")})
   .finally(()=>{if(active)setMembersLoading(false)});
  return()=>{active=false};
 },[page,session,resolvedOrganizationId]);
 useEffect(()=>{
  if(page!=="schedules"||!session||aircraft.length===0)return;
  let active=true;
  const refresh=async()=>{if(active)await fetchFleetData(true)};
  void refresh();
  return()=>{active=false};
 },[page,session,resolvedOrganizationId,aircraft.length]);

 const loadMoreSchedules=async()=>{
  if(!supabase||scheduleLoadingMore||schedulePagination.page>=schedulePagination.totalPages)return;
  setScheduleLoadingMore(true);setScheduleLoadError("");
  try{
   const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:resolvedOrganizationId,cacheScope,action:"schedule_page",page:schedulePagination.page+1,apiRateRemaining:currentRateBudget(apiRateLimit),apiRateResetAt:apiRateLimit?.resetAt,isPro:apiRateLimit?.isPro??false}});
   if(error)throw error;
   if(data?.rateLimited)throw new Error("Infinite Flight request allowance is currently exhausted. Try again after the rate-limit reset.");
   setSchedules(previous=>[...previous,...(data?.schedules||[])]);
   if(data?.pagination)setSchedulePagination(data.pagination);
   if(data?.rateLimit)setApiRateLimit(data.rateLimit);
  }catch(e){setScheduleLoadError(e instanceof Error?e.message:"Could not load the next schedule page.")}
  finally{setScheduleLoadingMore(false)}
 };
 const refreshPage=async()=>{await load();if(page==="overview")await fetchFleetData(false);if(page==="schedules")await fetchFleetData(true)};
 const requestLeg=async(item:any)=>{
  if(!supabase||!portalId)return;
  setRequestBusy(item.id);setError("");
  try{const {data,error}=await invokeFunction(supabase,"booking-request",{body:{organizationId:portalId,scheduleId:item.id,aircraftId:item.aircraftId}});if(error)throw error;if(data?.booking?.status==="approved")setError("");await load()}
  catch(e){setError(e instanceof Error?e.message:"Could not request this schedule leg.")}
  finally{setRequestBusy("")}
 };
 const signOut=async()=>{await supabase?.auth.signOut();navigate(slug?"/"+slug+"/pilot-sign-in":"/login")};
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to={slug?"/"+slug+"/pilot-sign-in":"/login"} replace/>;
 const nav=[{id:"overview",label:"Overview"},{id:"schedules",label:"Schedules"},{id:"fleet",label:"Fleet"},{id:"members",label:"Crew"},{id:"bookings",label:"My bookings"},{id:"profile",label:"Pilot profile"}];
 const schedulesByAircraft=new Map<string,any[]>();
 schedules.forEach(item=>{const key=String(item.aircraftId||"");if(!schedulesByAircraft.has(key))schedulesByAircraft.set(key,[]);schedulesByAircraft.get(key)!.push(item)});
 schedulesByAircraft.forEach(items=>items.sort((a,b)=>(a.sequence??0)-(b.sequence??0)));
 const positionedCount=Object.keys(positions).length;

 return <main className="shell pilot-shell">
  <Header right={<div className="session-actions"><span className="session-pill"><span className="session-dot"/> Session active</span><button className="button button-quiet" onClick={async()=>{if(!supabase)return;setError("");try{const {data,error}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo:location.pathname+location.search}});if(error||!data?.authorizationUrl)throw error||new Error("Could not start Infinite Flight reconnection.");window.location.assign(data.authorizationUrl)}catch(e){setError(e instanceof Error?e.message:"Could not reconnect Infinite Flight.")}}}>Reconnect Infinite Flight</button><Link className="top-link" to={slug?"/"+slug+"/pilot-sign-in":"/login"}>Switch organisation</Link><button className="account-signout" onClick={signOut}><LogOut size={14}/> Sign out</button></div>}/>
  <div className="pilot-layout">
   <aside className="pilot-sidebar"><div className="pilot-sidebar-org"><span className="pilot-org-mark">{(organization?.name||"V").slice(0,1)}</span><div><strong>{organization?.name||"Live organisation"}</strong><small>PILOT WORKSPACE</small></div></div><nav>{nav.map(item=><Link key={item.id} className={page===item.id?"active":""} to={slug?"/"+slug+"/pilot/"+pilotId+"/"+item.id:"/pilot/"+organizationId+"/"+item.id}>{item.label}</Link>)}</nav><div className="pilot-sidebar-foot">PILOT OPERATIONS<br/>Bookings synced to Live</div></aside>
   <section className="pilot-content">
    <div className="dashboard-heading"><div><div className="eyebrow">PILOT WORKSPACE · {page.toUpperCase()}</div><h1>{page==="overview"?(organization?.name||"Your Live organisation"):page==="schedules"?"Fleet & schedules":page==="fleet"?"Organisation fleet":page==="members"?"Organization crew":page==="bookings"?"My bookings":"Pilot profile"}</h1><p>Personal Infinite Flight access · {organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"} · Verified Live member</p></div><button className="button button-quiet" onClick={()=>void refreshPage()} disabled={loading||positionLoading}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<div className="notice error">{error}</div>}
    {page==="overview" ? <>
      <div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organisation fleet</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current schedules</small></article><article className="stat-card"><span>Your Live role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":organization?"Member":"—"}</strong><small><ShieldCheck size={12}/> Verified by Infinite Flight</small></article><article className="stat-card"><span>Last refreshed</span><strong className="stat-time">{lastUpdated?lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</strong><small>Live API v3</small></article></div>
      <section className="panel dashboard-panel aircraft-map-panel">
       <div className="section-heading"><div><h2>Live fleet map</h2><p>Aircraft positions from Infinite Flight Live · 30-second refresh cycle, paced to your API allowance</p></div><button className="button button-quiet" onClick={()=>void fetchFleetData(false)} disabled={positionLoading||aircraft.length===0}><RefreshCw size={13}/>{positionLoading?"Updating…":"Refresh positions"}</button></div>
       {positionError&&<div className="notice">{positionError}</div>}
       {aircraft.length===0?<div className="empty-state">No aircraft are attached to this organization.</div>:<AircraftLiveMap aircraft={aircraft} positions={positions} dark={darkMap}/>}
       <div className="aircraft-map-footer"><span>{positionLoading?"Fetching aircraft positions…":positionsUpdated?"Last position refresh "+positionsUpdated.toLocaleTimeString():"Waiting for first position update"}</span><span>{positionedCount} / {aircraft.length} positions available</span></div>
       <div className="map-position-list">{aircraft.map(item=>{const position=positions[item.id];const state=aircraftState(position);return <div className="map-position-item" key={item.id}><span className={"aircraft-status-dot "+state.tone}/><strong>{item.registration||"Aircraft"}</strong><span>{state.label}</span>{position?.lastPilotUsername&&<small>{position.lastPilotUsername}</small>}</div>})}</div>
      </section>
      <section className="panel dashboard-panel pilot-data-panel"><div className="section-heading"><div><h2>Upcoming schedules</h2><p>Published by your organisation in Infinite Flight Live</p></div><Link className="top-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}>View all <ChevronRight size={13}/></Link></div>{loading?<div className="empty-state">Loading Live data…</div>:schedules.length===0?<div className="empty-state">No published schedules were returned.</div>:<div className="data-list">{schedules.slice(0,6).map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{(item.originIcao||"—")+" → "+(item.destinationIcao||"—")}</strong><small>{[item.callsign||"Schedule",item.flightPlan||"No flight plan"].join(" · ")}</small></div><div className="admin-action-row"><span className="row-status">{scheduleStatusLabel(item.status??1)}</span><button className="button button-primary" disabled={requestBusy===item.id} onClick={()=>requestLeg(item)}>{requestBusy===item.id?"Requesting…":"Request this leg"}</button></div></article>)}</div>}</section>
    </> : page==="members" ? <section className="panel dashboard-panel"><div className="section-heading"><div><h2>Organization crew</h2><p>Current Live members and their active lift counts.</p></div></div>{membersError&&<div className="notice error">{membersError}</div>}{membersLoading?<div className="empty-state">Loading current Infinite Flight crew…</div>:members.length===0?<div className="empty-state">No member data is available.</div>:<div className="data-list">{members.map((m:any)=><article className="data-row" key={m.userId}><div><strong>{m.username||"Infinite Flight pilot"}</strong><small>{m.role===2?"Owner":m.role===1?"Admin":"Member"} · Joined {m.joinedAt?new Date(m.joinedAt).toLocaleDateString():"—"}</small></div><span className="row-status">{m.activeLifts??0} active lifts</span></article>)}</div>}</section> : page==="bookings" ? <section className="panel dashboard-panel"><div className="section-heading"><div><h2>Your leg requests</h2><p>Requests and Live crew assignment status for this organization.</p></div></div>{bookings.length===0?<div className="empty-state">You have not requested any legs yet.</div>:<div className="data-list">{bookings.map((b:any)=><article className="data-row" key={b.id}><div><strong>{schedules.find((s:any)=>s.id===b.live_schedule_id)?.callsign||"Flight leg"}</strong><small>{b.request_note||"No request note"} · {new Date(b.created_at).toLocaleString()}</small></div><span className="row-status">{b.status.replaceAll("_"," ")}</span></article>)}</div>}</section> : page==="profile" ? <section className="panel dashboard-panel"><div className="section-heading"><div><h2>Live membership</h2><p>Your access is verified directly by Infinite Flight</p></div><ShieldCheck size={17}/></div><div className="profile-detail"><span>Organisation</span><strong>{organization?.name||"—"}</strong></div><div className="profile-detail"><span>Infinite Flight role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"}</strong></div><div className="profile-detail"><span>Access type</span><strong>Personal OAuth · Encrypted server-side</strong></div><div className="profile-detail"><span>Data source</span><strong>Infinite Flight Public API v3</strong></div></section>
    : page==="fleet" ? <section className="panel dashboard-panel"><div className="section-heading"><div><h2>Aircraft fleet</h2><p>Every active organization aircraft · images shown only in the fleet view</p></div><span className="fleet-total">{aircraft.length} AIRCRAFT</span></div>{loading?<div className="empty-state">Loading fleet…</div>:aircraft.length===0?<div className="empty-state">No active aircraft were returned by Infinite Flight.</div>:<div className="fleet-aircraft-grid">{aircraft.map(item=><FleetAircraftCard key={item.id} aircraft={item}/>)}</div>}</section>
    : page==="schedules" ? <section className="panel dashboard-panel aircraft-schedule-panel">
      <div className="section-heading"><div><h2>Fleet operations</h2><p>Aircraft status, last flown leg and every next scheduled leg. No aircraft images in this view.</p></div><button className="button button-quiet" onClick={()=>void fetchFleetData(true)} disabled={positionLoading}><RefreshCw size={13}/>{positionLoading?"Updating…":"Refresh status"}</button></div>
      {positionError&&<div className="notice">{positionError}</div>}
      {loading?<div className="empty-state">Loading aircraft and schedules…</div>:aircraft.length===0?<div className="empty-state">No aircraft are attached to this organization.</div>:<div className="aircraft-operations-list">{aircraft.map(item=>{
       const position=positions[item.id];const state=aircraftState(position);const legs=schedulesByAircraft.get(item.id)||[];const lastFlight=latestFlights[item.id];const flightLogLoaded=Object.prototype.hasOwnProperty.call(latestFlights,item.id);
       return <details className="aircraft-operation-card" key={item.id}>
        <summary><div className="aircraft-operation-main"><span className={"aircraft-status-dot "+state.tone}/><div><span className="eyebrow">FLEET AIRCRAFT</span><strong>{item.registration||"UNREGISTERED"}</strong><small>{state.label}</small></div></div><div className="aircraft-operation-summary"><span className={"aircraft-status-chip tone-"+state.tone}>{state.label}</span><span>{legs.length} next {legs.length===1?"leg":"legs"}</span><span className="operation-chevron">⌄</span></div></summary>
        <div className="aircraft-operation-detail">
         <div className="operation-facts"><div><span>Last flown leg</span><strong>{lastFlight?(lastFlight.originIcao||"—")+" → "+(lastFlight.destinationIcao||"—"):flightLogLoaded?"No flight history":"Not loaded yet"}</strong><small>{lastFlight?(lastFlight.actualDepartureUtc?new Date(lastFlight.actualDepartureUtc).toLocaleString():"Departure time unavailable"):flightLogLoaded?"No flight-log entries were returned.":"Waiting for available API allowance to load the flight log."}</small></div><div><span>Last pilot</span><strong>{position?.lastPilotUsername||lastFlight?.crew?.[0]?.username||"Not reported"}</strong><small>{ageLabel(position?.updatedAt)}</small></div></div>
         <div className="next-legs-heading"><div><strong>Next scheduled legs</strong><span>{legs.length?"Published by your organization":"No active schedules"}</span></div></div>
         {legs.length===0?<div className="no-aircraft-legs"><CalendarDays size={20}/><div><strong>No legs have been made for this aircraft.</strong><span>Ask your organization administrator to publish more schedules for this registration.</span></div></div>:<div className="next-leg-list">{legs.map((leg:any)=><article className="next-leg-card" key={leg.id}><div className="next-leg-route"><strong>{leg.originIcao||"—"} <span>→</span> {leg.destinationIcao||"—"}</strong><small>{leg.callsign||item.registration} · {flightTypeLabel(leg.flightType??0)}</small></div><div className="next-leg-meta"><span className={"aircraft-status-chip tone-"+(leg.status===9?"danger":leg.status===8?"warning":"air")}>{scheduleStatusLabel(leg.status??1)}</span><small>{leg.isTimeless?"Timeless schedule":leg.scheduledDepartureUtc?new Date(leg.scheduledDepartureUtc).toLocaleString():"Departure not set"}</small></div><button className="button button-primary" disabled={requestBusy===leg.id} onClick={()=>void requestLeg(leg)}>{requestBusy===leg.id?"Requesting…":"Request leg"}</button></article>)}</div>}
        </div>
       </details>;
      })}</div>}
      {scheduleLoadError&&<div className="notice error">{scheduleLoadError}</div>}
      {schedulePagination.page<schedulePagination.totalPages&&<div className="schedule-pagination"><span>Showing {schedules.length.toLocaleString()} of {schedulePagination.totalCount.toLocaleString()} scheduled legs</span><button className="button button-quiet" onClick={()=>void loadMoreSchedules()} disabled={scheduleLoadingMore}>{scheduleLoadingMore?"Loading next page…":"Load next 100 legs"}</button></div>}
      <div className="aircraft-map-footer"><span>Position and flight-log data is temporary and fetched from Infinite Flight.</span><span>{positionsUpdated?"Updated "+positionsUpdated.toLocaleTimeString():"Not yet refreshed"}</span></div>
     </section> : null}
    <div className="hero-footnote">Your booking requests follow the organization approval policy. Infinite Flight Live remains the source of truth.</div>
   </section>
  </div><Footer/></main>;
}
function NotFound(){return <main className="shell narrow"><Header/><section className="panel"><h1>Page not found</h1><Link to="/">Return home</Link></section></main>}
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/docs/*" element={<DocsPage/>}/><Route path="/login" element={<Login/>}/><Route path="/account" element={<MyVeyro/>}/><Route path="/org/:slug/*" element={<Organization/>}/><Route path="/pilot/:organizationId/*" element={<PilotDashboard/>}/><Route path="/:slug/admin/*" element={<AdminPortal/>}/><Route path="/:slug/pilot-sign-in" element={<PilotSignIn/>}/><Route path="/:slug/pilot/:pilotId/*" element={<PilotDashboard/>}/><Route path="/apply" element={<OrganizationApplicationPage/>}/><Route path="/application-status/:trackingCode" element={<ApplicationStatusPage/>}/><Route path="/:slug" element={<PublicOrganizationPage/>}/><Route path="*" element={<NotFound/>}/></Routes>}
