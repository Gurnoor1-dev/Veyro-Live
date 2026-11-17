import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Plane, RefreshCw, ShieldCheck, Users, Building2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { invokeFunction } from "./lib/functions";
import { ApplicationStatusPage, OrganizationApplicationPage, OrganizationDirectory, PublicOrganizationPage } from "./pages/PortalPages";
import DocsPage from "./pages/DocsPage";
import AdminPortal from "./pages/AdminPortal";
import PilotSignIn from "./pages/PilotSignIn";
import Brand from "./components/Brand";
import ThemeToggle from "./components/ThemeToggle";
import SpotlightNavbar from "./components/SpotlightNavbar";
const AircraftLiveMap = lazy(() => import("./components/AircraftLiveMap"));

function Header(){return <header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro <ArrowUpRight size={13}/></Link><div className="top-actions"><ThemeToggle/></div></header>}
function Footer(){return <footer className="footer"><span>© {new Date().getFullYear()} VEYRO</span><span>Independent third-party software</span></footer>}
function Landing(){
 return <main className="shell landing landing-reimagined">
  <section className="launch-hero">
   <header className="launch-header">
    <Brand/>
    <nav className="launch-nav" aria-label="Main navigation">
     <a href="#platform">Platform</a><a href="#workflow">How it works</a><Link to="/docs">Documentation</Link>
    </nav>
    <div className="launch-header-actions"><Link className="launch-account" to="/account">My Veyro <ArrowUpRight size={14}/></Link><ThemeToggle/></div>
   </header>
   <div className="launch-hero-grid">
    <div className="launch-copy">
     <div className="launch-kicker"><span className="launch-live-dot"/> THE OPERATING SYSTEM FOR VIRTUAL AIRLINES</div>
     <h1>Run your airline.<br/><span>Own every moment.</span></h1>
     <p className="launch-lede">Your fleet, schedules and pilots — finally working as one. Veyro Live connects your organization to Infinite Flight Live and gives every pilot a place to belong.</p>
     <div className="launch-cta-row"><Link className="launch-primary" to="/login">Enter Veyro Live <ArrowRight size={16}/></Link><Link className="launch-text-link" to="/apply">Create an organization <ArrowUpRight size={15}/></Link></div>
     <div className="launch-proof"><span><ShieldCheck size={15}/> Infinite Flight OAuth</span><span><Users size={15}/> Built for crews</span><span><Building2 size={15}/> Multi-VA ready</span></div>
    </div>
    <div className="launch-console" aria-label="Illustrative Veyro Live operations dashboard">
     <div className="launch-console-top"><div><span className="launch-console-mark"><Plane size={16}/></span><div><strong>OPERATIONS CONTROL</strong><small>YOUR AIRLINE AT A GLANCE</small></div></div><span className="launch-online"><i/> LIVE SYSTEM</span></div>
     <div className="launch-console-title"><div><span className="launch-label">TODAY'S OPERATIONS</span><h2>Flight overview</h2></div><span className="launch-date">LIVE · UTC</span></div>
     <div className="launch-metrics"><div><small>ACTIVE FLEET</small><strong>01</strong><span>Connected aircraft</span></div><div><small>FLIGHT SCHEDULES</small><strong>24</strong><span>Ready to request</span></div><div><small>CREW REQUESTS</small><strong>03</strong><span>Awaiting review</span></div></div>
     <div className="launch-route-card"><div className="launch-route-head"><span className="launch-label">FEATURED FLIGHT</span><span className="launch-route-status">SCHEDULED</span></div><div className="launch-route"><div><strong>EGLL</strong><small>LONDON</small></div><div className="launch-route-line"><Plane size={17}/><span/></div><div><strong>EDDF</strong><small>FRANKFURT</small></div></div><div className="launch-route-foot"><span>VYR 204</span><span>AIRBUS A320</span><span>01H 25M</span></div></div>
     <div className="launch-queue"><div><strong>Approval queue</strong><span>Illustrative preview</span></div><div className="launch-queue-row"><span className="launch-queue-avatar">P</span><div><strong>Pilot leg request</strong><small>EGLL → EDDF · VYR 204</small></div><span className="launch-review">REVIEW</span></div><div className="launch-queue-row"><span className="launch-queue-avatar alt">C</span><div><strong>Crew assignment</strong><small>Live schedule synchronization</small></div><span className="launch-synced">READY</span></div></div>
     <div className="launch-console-foot"><span><i/> CONNECTED TO INFINITE FLIGHT LIVE</span><span>VEYRO / CONTROL</span></div>
    </div>
   </div>
   <div className="launch-hero-bottom"><span>DESIGNED FOR VIRTUAL AVIATION</span><span>FLEET <b>·</b> SCHEDULES <b>·</b> CREW <b>·</b> OPERATIONS</span><span>01 — THE PLATFORM</span></div>
  </section>
  <section className="launch-intro" id="platform"><div><span className="launch-section-kicker">ONE CONNECTED WORKSPACE</span><h2>Less admin.<br/><em>More aviation.</em></h2></div><p>Veyro brings the moving parts of your virtual airline into one calm, connected workspace — from organization setup to a pilot's next booked leg.</p></section>
  <section className="launch-feature-grid">
   <article className="launch-feature"><span className="launch-feature-number">01 / FLEET</span><div className="launch-feature-icon"><Plane size={20}/></div><h3>Your fleet, in sync.</h3><p>Connect your Infinite Flight Live organization and work with its aircraft, members and schedules from one place.</p><Link to="/docs">Explore fleet tools <ChevronRight size={14}/></Link></article>
   <article className="launch-feature"><span className="launch-feature-number">02 / SCHEDULING</span><div className="launch-feature-icon"><CalendarDays size={20}/></div><h3>Every leg has a place.</h3><p>Publish schedules, let pilots request available legs and keep booking status clear from request to assignment.</p><Link to="/docs">Explore scheduling <ChevronRight size={14}/></Link></article>
   <article className="launch-feature"><span className="launch-feature-number">03 / APPROVALS</span><div className="launch-feature-icon"><ShieldCheck size={20}/></div><h3>Decisions that travel.</h3><p>Route requests through Discord, verify administrators and synchronize approved crew to Live API v3.</p><Link to="/docs">Explore approvals <ChevronRight size={14}/></Link></article>
  </section>
  <section className="launch-workflow" id="workflow"><div className="launch-workflow-heading"><span className="launch-section-kicker">FROM SIGN-IN TO TAKE-OFF</span><h2>A simpler way<br/><em>to operate.</em></h2></div><div className="launch-steps"><article><span>01</span><h3>Connect</h3><p>Sign in with Infinite Flight and securely connect your organization.</p></article><article><span>02</span><h3>Coordinate</h3><p>Publish aircraft schedules and let your pilots request the legs they want.</p></article><article><span>03</span><h3>Confirm</h3><p>Review requests in Discord and assign approved pilots to Live schedules.</p></article></div></section>
  <section className="launch-directory"><div className="launch-directory-heading"><div><span className="launch-section-kicker">FIND YOUR CREW</span><h2>Airlines on Veyro.</h2></div><p>Discover organizations with a Veyro Live home and find where your next flight begins.</p></div><OrganizationDirectory/></section>
  <section className="launch-final"><div><span className="launch-section-kicker">YOUR NEXT FLIGHT STARTS HERE</span><h2>Bring your airline<br/><em>into focus.</em></h2></div><div><p>Build a connected home for your organization and give your pilots a better way to fly together.</p><Link className="launch-primary" to="/apply">Get started with Veyro <ArrowRight size={16}/></Link></div></section>
  <Footer/>
 </main>
}
function Login(){
 const location=useLocation();
 const [session,setSession]=useState<Session|null>(null);
 const [sessionLoading,setSessionLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(new URLSearchParams(location.search).get("connect_error")||"");
 const query=new URLSearchParams(location.search);
 const pending=query.get("pending");
 const next=query.get("next")||"";
 useEffect(()=>{
  if(!supabase){setSessionLoading(false);return}
  let active=true;
  supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});
  const {data}=supabase.auth.onAuthStateChange((_event,nextSession)=>{if(active)setSession(nextSession)});
  return()=>{active=false;data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{const message=new URLSearchParams(location.search).get("connect_error");if(message)setError(message)},[location.search]);
 if(pending){
  const destination="/account?pending="+encodeURIComponent(pending)+(next?"&next="+encodeURIComponent(next):"");
  return <Navigate to={destination} replace/>;
 }
 const connect=async()=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   let activeSession=session;
   if(!activeSession){
    const {data,error}=await supabase.auth.signInAnonymously({options:{data:{display_name:"Infinite Flight pilot"}}});
    if(error)throw new Error(error.message.includes("Anonymous")||error.message.includes("anonymous")?"Anonymous sign-ins are not enabled. Enable Anonymous Sign-Ins under Supabase Authentication providers.":error.message);
    activeSession=data.session;
    if(!activeSession)throw new Error("Supabase did not create a session. Please try again.");
    setSession(activeSession);
   }
   const returnTo="/account"+(next?"?next="+encodeURIComponent(next):"");
   const {data,error}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo}});
   if(error||!data?.authorizationUrl)throw error||new Error("Could not start Infinite Flight authorization.");
   window.location.assign(data.authorizationUrl);
  }catch(e){setError(e instanceof Error?e.message:"Could not start Infinite Flight authorization.");setBusy(false)}
 };
 if(!isSupabaseConfigured)return <main className="shell narrow"><Header/><section className="panel login-panel"><h1>Backend not configured</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project environment, then redeploy.</p></section><Footer/></main>;
 return <main className="shell narrow"><Header/><section className="panel login-panel login-panel-if">
  <div className="login-brand-stack"><img className="if-live-logo" src="/images/if-live.png" alt="Infinite Flight Live"/><span>ONE CONNECTION. YOUR ENTIRE VEYRO NETWORK.</span></div>
  <h1>Take off with Veyro.</h1>
  <p>Sign in securely with Infinite Flight. Once connected, you’ll land directly in My Veyro, where all your available airline portals are gathered in one place.</p>
  <button className="button button-primary full if-oauth-button" onClick={connect} disabled={busy||sessionLoading}>
   <img src="/images/if-logo.png" alt="" className="if-login-icon"/>
   {busy?"Connecting to Infinite Flight…":"Continue with Infinite Flight"}<ArrowRight size={16}/>
  </button>
  {session&&<Link className="button button-quiet full login-account-link" to="/account">Open My Veyro <ArrowUpRight size={14}/></Link>}
  <div className="login-security-note"><ShieldCheck size={14}/> Your Infinite Flight tokens are encrypted and never exposed to the browser.</div>
  {error&&<div className="notice error">{error}</div>}
  {session?.user.is_anonymous&&<div className="login-session-note">Your Veyro session is saved on this device. Avoid signing out or clearing browser data if you want to keep this account.</div>}
 </section><Footer/></main>;
}

function MyVeyro(){
 const location=useLocation();
 const navigate=useNavigate();
 const query=new URLSearchParams(location.search);
 const next=query.get("next")||"";
 const pendingId=query.get("pending")||"";
 const [session,setSession]=useState<Session|null>(null);
 const [authLoading,setAuthLoading]=useState(true);
 const [data,setData]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [liveOrganizations,setLiveOrganizations]=useState<any[]>([]);
 const [liveOrganizationsLoading,setLiveOrganizationsLoading]=useState(false);

 useEffect(()=>{
  let active=true;
  if(!supabase){setAuthLoading(false);setLoading(false);return}
  supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setAuthLoading(false)}});
  const {data:listener}=supabase.auth.onAuthStateChange((_event,nextSession)=>{if(active)setSession(nextSession)});
  return()=>{active=false;listener.subscription.unsubscribe()};
 },[]);

 const load=async()=>{
  if(!supabase||!session)return;
  setLoading(true);setError("");
  const {data:result,error:invokeError}=await invokeFunction(supabase,"my-portals");
  if(invokeError){
   let message=invokeError.message;
   if("context" in invokeError&&invokeError.context instanceof Response){try{message=(await invokeError.context.clone().json()).error||message}catch{}}
   setError(message);setLoading(false);return;
  }
  setData(result);setLoading(false);
 };
 useEffect(()=>{if(session)void load();else if(!authLoading)setLoading(false)},[session,authLoading]);
 useEffect(()=>{
  const message=query.get("connect_error");
  if(message)setError(message);
 },[location.search]);
 useEffect(()=>{
  if(!session||!pendingId||!supabase){setLiveOrganizations([]);return}
  let active=true;
  setLiveOrganizationsLoading(true);
  invokeFunction(supabase,"if-oauth-organizations",{body:{pendingId}})
   .then(({data:result,error:invokeError})=>{
    if(invokeError)throw invokeError;
    if(active)setLiveOrganizations(result?.organizations||[]);
   })
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load your Infinite Flight organizations. Reconnect and try again.")})
   .finally(()=>{if(active)setLiveOrganizationsLoading(false)});
  return()=>{active=false};
 },[session,pendingId]);

 const connect=async()=>{
  if(!supabase)return;
  setBusy("connect");setError("");
  const returnTo="/account"+(next?"?next="+encodeURIComponent(next):"");
  const {data:result,error:invokeError}=await invokeFunction(supabase,"if-oauth-start",{body:{returnTo}});
  if(invokeError||!result?.authorizationUrl){setError(invokeError?.message||"Could not start Infinite Flight authorization.");setBusy("");return}
  window.location.assign(result.authorizationUrl);
 };
 const openLivePortal=async(org:any)=>{
  if(!supabase||!pendingId||!session)return;
  if(!org.portal){if([1,2].includes(org.role)){navigate("/apply?pending="+encodeURIComponent(pendingId)+"&org="+encodeURIComponent(org.id));return}setError("This organization does not have a Veyro portal yet.");return}
  setBusy(org.id);setError("");
  try{
   const {data:result,error:invokeError}=await invokeFunction(supabase,"pilot-live-data",{body:{pendingId,organizationId:org.id,cacheScope:getPilotCacheScope()}});
   if(invokeError||!result?.organization||!result?.portal){
    let message=result?.error||invokeError?.message||"Could not open this organization.";
    if(invokeError&&"context" in invokeError&&invokeError.context instanceof Response){try{message=(await invokeError.context.clone().json()).error||message}catch{}}
    throw new Error(message);
   }
   const role=Number(result.organization.role);
   navigate(role===1||role===2?"/"+result.portal.slug+"/admin":"/"+result.portal.slug+"/pilot/"+session.user.id);
  }catch(e){setError(e instanceof Error?e.message:"Could not open this portal.");setBusy("")}
 };
 const join=async(invite:any)=>{
  if(!supabase)return;
  setBusy(invite.organization.id);setError("");
  const {data:result,error:invokeError}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:invite.organization.live_organization_id,cacheScope:getPilotCacheScope()}});
  if(invokeError||!result?.portal){
   let message=invokeError?.message||"Could not activate your pilot access.";
   if(invokeError&&"context" in invokeError&&invokeError.context instanceof Response){try{message=(await invokeError.context.clone().json()).error||message}catch{}}
   setError(message);setBusy("");return;
  }
  setNotice("You're now a member of "+invite.organization.display_name+".");
  await load();setBusy("");
 };
 const memberships=data?.memberships||[];
 const invitations=data?.invitations||[];
 const directory=data?.directory||[];
 const joinedIds=new Set(memberships.map((x:any)=>x.id));
 const invitedIds=new Set(invitations.map((x:any)=>x.organization.id));
 const livePortalOrgs=liveOrganizations.filter((org:any)=>org.portal).map((org:any)=>{
  const known=[...memberships,...directory].find((item:any)=>item.id===org.portal.id);
  return {...known,id:org.portal.id,slug:org.portal.slug,display_name:known?.display_name||org.portal.displayName||org.name,logo_url:known?.logo_url||null,tagline:known?.tagline||"Verified Infinite Flight organization",role:org.role===2?"owner":org.role===1?"admin":"pilot",liveOrganizationId:org.id,openFromLive:true,liveRole:org.role};
 });
 const livePortalIds=new Set(livePortalOrgs.map((org:any)=>org.id));
 const portalCards=[...livePortalOrgs,...memberships.filter((org:any)=>!livePortalIds.has(org.id))];

 if(authLoading)return <main className="shell"><Header/><section className="account-loading">Restoring your VEYRO session…</section></main>;
 if(!session)return <main className="shell"><Header/><section className="account-welcome"><div className="eyebrow">YOUR VEYRO ACCOUNT</div><h1>One identity.<br/><span>Every airline you fly with.</span></h1><p>Connect once to access your pilot portals, airline memberships and organization administration.</p><Link className="cosmic-cta account-primary" to="/login">Connect Infinite Flight <ArrowRight size={16}/></Link></section><Footer/></main>;

 return <main className="shell account-shell"><Header/>
  <section className="account-hero"><div><div className="eyebrow"><span className="pulse"/> PERSONAL OPERATIONS CENTRE</div><h1>Welcome back{data?.profile?.display_name?", "+data.profile.display_name:""}.</h1><p>Your airlines, your crew spaces and your Infinite Flight connection — together in one place.</p></div>
   <div className={"account-connection-card "+(data?.infiniteFlight?.connected?"is-connected":"")}><span className="connection-orb"/><div><strong>{data?.infiniteFlight?.connected?"Infinite Flight connected":"Connect Infinite Flight"}</strong><small>{data?.infiniteFlight?.connected?"Your account is ready across VEYRO":"One secure connection unlocks your airline workspaces"}</small></div><button className={data?.infiniteFlight?.connected?"button button-quiet":"button button-primary"} disabled={busy==="connect"} onClick={connect}>{busy==="connect"?"Opening Infinite Flight…":data?.infiniteFlight?.connected?"Reconnect Infinite Flight":"Connect account"}</button></div>
  </section>
  {error&&<div className="notice error">{error}</div>}{notice&&<div className="notice success">{notice}</div>}
  {pendingId&&<section className="account-section account-live-portals"><div className="account-section-heading"><div><div className="eyebrow">INFINITE FLIGHT CONNECTION</div><h2>Your available portals</h2><p>Choose an airline workspace. Veyro will verify your Live role and open the right dashboard.</p></div><span className="account-count">{livePortalOrgs.length} AVAILABLE</span></div>
   {liveOrganizationsLoading?<div className="account-card-grid"><div className="account-skeleton"/><div className="account-skeleton"/></div>:livePortalOrgs.length===0?<div className="account-empty"><Building2 size={22}/><strong>No connected Veyro portals were found.</strong><span>Your Infinite Flight account is connected. If your airline has a Veyro portal, refresh this page or contact its administrator to confirm your access.</span></div>:<div className="account-card-grid">{livePortalOrgs.map((org:any)=><article className="airline-account-card live-portal-card" key={org.id}><div className="airline-card-top"><div className="airline-card-logo">{org.logo_url?<img src={org.logo_url} alt=""/>:<span>{org.display_name?.slice(0,1)||"V"}</span>}</div><span className="membership-chip">{org.role==="owner"||org.role==="admin"?"ADMIN":"PILOT"}</span></div><h3>{org.display_name}</h3><p>{org.tagline}</p><div className="airline-card-actions"><button className="button button-primary" disabled={busy===org.liveOrganizationId} onClick={()=>void openLivePortal(liveOrganizations.find((item:any)=>item.id===org.liveOrganizationId))}>{busy===org.liveOrganizationId?"Verifying access…":org.role==="owner"||org.role==="admin"?"Open admin dashboard":"Open pilot dashboard"} <ArrowRight size={14}/></button><Link className="airline-text-link" to={"/"+org.slug}>View airline <ArrowUpRight size={13}/></Link></div></article>)}</div>}
   {liveOrganizations.some((org:any)=>!org.portal)&&<div className="account-unlinked-portals"><div><strong>Other Infinite Flight organisations</strong><span>These organisations do not have an active Veyro portal yet.</span></div>{liveOrganizations.filter((org:any)=>!org.portal).map((org:any)=><div className="account-unlinked-row" key={org.id}><span>{org.name} · {org.role===2?"Owner":org.role===1?"Admin":"Member"}</span>{[1,2].includes(org.role)?<Link className="airline-text-link" to={"/apply?pending="+encodeURIComponent(pendingId)+"&org="+encodeURIComponent(org.id)}>Apply for a portal <ArrowUpRight size={13}/></Link>:<small>No portal yet</small>}</div>)}</div>}
  </section>}
  <section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">YOUR ORGANISATIONS</div><h2>My airline portals</h2><p>Workspaces where your membership is active.</p></div><span className="account-count">{portalCards.length} PORTALS</span></div>
   {loading?<div className="account-card-grid"><div className="account-skeleton"/><div className="account-skeleton"/></div>:portalCards.length===0?<div className="account-empty"><Building2 size={22}/><strong>Your airline spaces will appear here.</strong><span>Connect Infinite Flight to discover every Veyro portal available to your account.</span></div>:<div className="account-card-grid">{portalCards.map((org:any)=><article className="airline-account-card" key={org.id}><div className="airline-card-top"><div className="airline-card-logo">{org.logo_url?<img src={org.logo_url} alt=""/>:<span>{org.display_name?.slice(0,1)||"V"}</span>}</div><span className="membership-chip">{org.role==="owner"||org.role==="admin"?"ADMIN":"PILOT"}</span></div><h3>{org.display_name}</h3><p>{org.tagline||"Your dedicated Infinite Flight workspace."}</p><div className="airline-card-actions">{org.openFromLive?<button className="button button-primary" onClick={()=>void openLivePortal(liveOrganizations.find((item:any)=>item.id===org.liveOrganizationId))} disabled={busy===org.liveOrganizationId}>{busy===org.liveOrganizationId?"Verifying access…":org.role==="owner"||org.role==="admin"?"Open admin dashboard":"Open pilot dashboard"} <ArrowRight size={14}/></button>:<>{(org.role==="owner"||org.role==="admin")&&<Link className="button button-primary" to={"/"+org.slug+"/admin"}>Admin dashboard <ArrowRight size={14}/></Link>}<Link className="button button-quiet" to={"/"+org.slug+"/pilot/"+session.user.id}>Pilot dashboard <ArrowRight size={14}/></Link></>}<Link className="airline-text-link" to={"/"+org.slug}>View airline <ArrowUpRight size={13}/></Link></div></article>)}</div>}
  </section>
  <section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">INVITATIONS</div><h2>Ready to join</h2><p>Airlines that have invited this VEYRO account.</p></div><span className="account-count">{invitations.length} INVITATIONS</span></div>{invitations.length===0?<div className="account-empty compact"><Users size={20}/><span>No pending invitations. Connect Infinite Flight and choose an organisation where you are a verified Live member.</span></div>:<div className="account-card-grid">{invitations.map((invite:any)=><article className="airline-account-card invite-card" key={invite.id}><div className="airline-card-top"><div className="airline-card-logo">{invite.organization.logo_url?<img src={invite.organization.logo_url} alt=""/>:<span>{invite.organization.display_name?.slice(0,1)||"V"}</span>}</div><span className="membership-chip invited">INVITED</span></div><h3>{invite.organization.display_name}</h3><p>Welcome, {invite.pilotName}. Your airline has invited you to join its pilot community.</p><button className="button button-primary" disabled={busy===invite.organization.id||!data?.infiniteFlight?.connected} onClick={()=>join(invite)}>{busy===invite.organization.id?"Verifying membership…":data?.infiniteFlight?.connected?"Join airline":"Connect Infinite Flight first"} <ArrowRight size={14}/></button></article>)}</div>}</section>
  <section className="account-section"><div className="account-section-heading"><div><div className="eyebrow">THE VEYRO NETWORK</div><h2>Explore airlines</h2><p>Discover public airline portals and learn about their operations.</p></div><span className="account-count">{directory.length} PUBLIC PORTALS</span></div>{loading?<div className="account-skeleton"/>:directory.length===0?<div className="account-empty">No public portals are available yet.</div>:<div className="account-directory-grid">{directory.map((org:any)=><article className="directory-account-card" key={org.id}><div className="airline-card-logo">{org.logo_url?<img src={org.logo_url} alt=""/>:<span>{org.display_name?.slice(0,1)||"V"}</span>}</div><div className="directory-account-copy"><h3>{org.display_name}</h3><p>{org.tagline||"Virtual airline on Infinite Flight Live."}</p><div className="airline-card-actions"><Link className="airline-text-link" to={"/"+org.slug}>Website info <ArrowUpRight size={13}/></Link>{joinedIds.has(org.id)?<span className="membership-chip">MEMBER</span>:invitedIds.has(org.id)?<span className="membership-chip invited">INVITED</span>:<Link className="button button-quiet" to={"/"+org.slug+"/pilot-sign-in"}>Join airline <ArrowRight size={13}/></Link>}</div></div></article>)}</div>}</section>
  {next==="/apply"&&pendingId&&<section className="account-section account-next-step"><div><div className="eyebrow">CONTINUE SETUP</div><h2>Creating a new organization portal?</h2><p>Continue your portal application from your verified Infinite Flight account.</p></div><Link className="button button-primary" to={"/apply?pending="+encodeURIComponent(pendingId)}>Continue application <ArrowRight size={14}/></Link></section>}
  <div className="account-bottom-actions"><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh my portals</button><Link className="button button-quiet" to="/docs">Platform documentation <ArrowUpRight size={14}/></Link></div><Footer/>
 </main>;
}

function Organization(){const {slug=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [sessionLoading,setSessionLoading]=useState(true);const [org,setOrg]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");
 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const [organizationResult,a,s]=await Promise.all([supabase.from("organizations").select("id,slug,display_name,live_organization_id").eq("slug",slug).eq("is_active",true).single(),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"aircraft"}}),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"schedules"}})]);const organization=organizationResult.data;if(organizationResult.error||!organization){setError("This organization is unavailable to your account.");setLoading(false);return}setOrg(organization);if(a.error||s.error){setError(a.error?.message||s.error?.message||"Live data could not be loaded.");setLoading(false);return}setAircraft(a.data?.result||[]);setSchedules(s.data?.result||[]);setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,slug]);
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to="/login" replace/>;
 const list=tab==="fleet"?aircraft:schedules;
 return <main className="shell"><Header/><section className="dashboard-heading"><div><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>{org?.display_name||slug}</h1><p>Live organization data · fetched on demand</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></section><div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organization aircraft</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current Live schedules</small></article><article className="stat-card"><span>Portal status</span><strong className="status-online">Connected</strong><small><ShieldCheck size={12}/> Membership verified</small></article><article className="stat-card"><span>Data source</span><strong>Live v3</strong><small>Not persisted by VEYRO</small></article></div><section className="panel dashboard-panel"><div className="section-heading"><div><h2>Operations</h2><p>Read-only Live view in this release</p></div><div className="tab-switch"><button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</button><button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</button></div></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="empty-state">Loading current Live data…</div>:list.length===0?<div className="empty-state">No {tab==="fleet"?"aircraft":"schedules"} were returned by Infinite Flight Live.</div>:<div className="data-list">{list.map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{tab==="fleet"?(item.registration||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</strong><small>{tab==="fleet"?"Fleet rank "+(item.fleetRank??"—")+" · "+(item.isFleetActiveSlot?"Active slot":"Storage"):((item.callsign||"Schedule")+" · "+(item.flightPlan||"No flight plan"))}</small></div><span className="row-status">{tab==="fleet"?(item.visibility===1?"Visible":"Hangared"):(item.status??"Scheduled")}</span></article>)}</div>}</section><Footer/></main>}
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
 if(position.state===4)return {label:"Stopped",tone:"stopped"};
 if(position.isOnGround){
  if(age>=12*60*60*1000)return {label:(age>=24*60*60*1000?"Parked 24h+ · ":"Parked 12h+ · ")+ageLabel(position.updatedAt).replace("Updated ",""),tone:"parked"};
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

 const load=async()=>{
  if(!supabase||!session||(!resolvedOrganizationId&&!slug))return;
  setLoading(true);setError("");
  const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{organizationId:resolvedOrganizationId||undefined,organizationSlug:!resolvedOrganizationId&&slug?slug:undefined,cacheScope}});
  if(error||!data?.organization){setError(data?.error||error?.message||"Could not load this Live organization.");setLoading(false);return}
  setResolvedOrganizationId(data.organization.id);setOrganization(data.organization);setPortalId(data.portal?.id||"");setAircraft(data.aircraft||[]);setSchedules(data.schedules||[]);setBookings(data.bookings||[]);setSchedulePagination(data.schedulesPagination||{page:1,pageSize:100,totalCount:(data.schedules||[]).length,totalPages:1});setMembers([]);if(data.rateLimit)setApiRateLimit(data.rateLimit);
  setLastUpdated(new Date());setLoading(false);
 };
 useEffect(()=>{if(session&&(resolvedOrganizationId||slug))void load();else if(!isSupabaseConfigured)setLoading(false)},[session,organizationId,slug]);

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
 if(sessionLoading)return <main className="shell narrow"><Header/><section className="panel login-panel"><p>Checking your VEYRO session…</p></section></main>;
 if(!session)return <Navigate to={slug?"/"+slug+"/pilot-sign-in":"/login"} replace/>;
 if(loading&&!organization)return <main className="shell pilot-shell"><Header/><section className="dashboard-loading-state"><div className="eyebrow">PILOT WORKSPACE</div><h1>Preparing your flight desk</h1><p>Verifying your Infinite Flight membership and loading your airline data…</p></section><Footer/></main>;
 if(!loading&&!organization)return <main className="shell pilot-shell"><Header/><section className="dashboard-error-state"><div className="eyebrow">PILOT WORKSPACE</div><h1>We couldn’t open this portal</h1><p>{error||"Your Infinite Flight organisation could not be loaded. Return to My Veyro and open the portal again."}</p><div className="dashboard-error-actions"><button className="button button-primary" onClick={()=>void load()}><RefreshCw size={14}/> Try again</button><Link className="button button-quiet" to="/account">Back to My Veyro</Link></div></section><Footer/></main>;
 const nav=[{id:"overview",label:"Overview"},{id:"schedules",label:"Schedules"},{id:"fleet",label:"Fleet"},{id:"members",label:"Crew"},{id:"bookings",label:"My bookings"},{id:"profile",label:"Pilot profile"}];
 const schedulesByAircraft=new Map<string,any[]>();
 schedules.forEach(item=>{const key=String(item.aircraftId||"");if(!schedulesByAircraft.has(key))schedulesByAircraft.set(key,[]);schedulesByAircraft.get(key)!.push(item)});
 schedulesByAircraft.forEach(items=>items.sort((a,b)=>(a.sequence??0)-(b.sequence??0)));
 const positionedCount=Object.keys(positions).length;

 return <main className="shell pilot-shell">
  <Header/>
  <div className="pilot-layout">
   <aside className="pilot-sidebar"><div className="pilot-sidebar-org"><span className="pilot-org-mark">{(organization?.name||"V").slice(0,1)}</span><div><strong>{organization?.name||"Live organisation"}</strong><small>PILOT WORKSPACE</small></div></div><SpotlightNavbar orientation="vertical" activeHref={location.pathname} items={nav.map(item=>({label:item.label,href:(slug?"/"+slug+"/pilot/"+pilotId:"/pilot/"+organizationId)+(item.id==="overview"?"":"/"+item.id)}))}/><div className="pilot-sidebar-foot">PILOT OPERATIONS<br/>Bookings synced to Live</div></aside>
   <section className="pilot-content">
    <div className="dashboard-heading"><div><div className="eyebrow">PILOT WORKSPACE · {page.toUpperCase()}</div><h1>{page==="overview"?(organization?.name||"Your Live organisation"):page==="schedules"?"Fleet & schedules":page==="fleet"?"Organisation fleet":page==="members"?"Organization crew":page==="bookings"?"My bookings":"Pilot profile"}</h1><p>Personal Infinite Flight access · {organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"} · Verified Live member</p></div><img className="dashboard-if-live-mark" src="/images/if-live.png" alt="Infinite Flight Live"/><button className="button button-quiet" onClick={()=>void refreshPage()} disabled={loading||positionLoading}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<div className="notice error">{error}</div>}
    {page==="overview" ? <>
      <div className="dashboard-stats"><article className="stat-card"><span>Fleet aircraft</span><strong>{aircraft.length}</strong><small><Plane size={12}/> Live organisation fleet</small></article><article className="stat-card"><span>Published schedules</span><strong>{schedules.length}</strong><small><CalendarDays size={12}/> Current schedules</small></article><article className="stat-card"><span>Your Live role</span><strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":organization?"Member":"—"}</strong><small><ShieldCheck size={12}/> Verified by Infinite Flight</small></article><article className="stat-card"><span>Last refreshed</span><strong className="stat-time">{lastUpdated?lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</strong><small>Live API v3</small></article></div>
      <section className="panel dashboard-panel aircraft-map-panel">
       <div className="section-heading"><div><h2>Live fleet map</h2><p>Airborne and ground aircraft, positioned live across your fleet</p></div><button className="button button-quiet" onClick={()=>void fetchFleetData(false)} disabled={positionLoading||aircraft.length===0}><RefreshCw size={13}/>{positionLoading?"Updating…":"Refresh positions"}</button></div>
       {positionError&&<div className="notice">{positionError}</div>}
       {aircraft.length===0?<div className="empty-state">No aircraft are attached to this organization.</div>:<Suspense fallback={<div className="aircraft-map-frame aircraft-map-loading">Preparing live map…</div>}><AircraftLiveMap aircraft={aircraft} positions={positions} dark={darkMap}/></Suspense>}
       <div className="aircraft-map-footer"><span>{positionLoading?"Fetching aircraft positions…":positionsUpdated?"Last position refresh "+positionsUpdated.toLocaleTimeString():"Waiting for first position update"}</span><span>{positionedCount} / {aircraft.length} positions available</span></div>
      </section>
      <section className="panel dashboard-panel pilot-data-panel"><div className="section-heading"><div><h2>Upcoming schedules</h2><p>Published by your organisation in Infinite Flight Live</p></div><Link className="top-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}>View all <ChevronRight size={13}/></Link></div>{loading?<div className="empty-state">Loading Live data…</div>:schedules.length===0?<div className="empty-state">No published schedules were returned.</div>:<div className="data-list">{schedules.slice(0,6).map((item:any,i:number)=><article className="data-row" key={item.id||i}><div><strong>{(item.originIcao||"—")+" → "+(item.destinationIcao||"—")}</strong><small>{[item.callsign||"Schedule",item.flightPlan||"No flight plan"].join(" · ")}</small></div><div className="admin-action-row"><span className="row-status">{scheduleStatusLabel(item.status??1)}</span><button className="button button-primary" disabled={requestBusy===item.id} onClick={()=>requestLeg(item)}>{requestBusy===item.id?"Requesting…":"Request this leg"}</button></div></article>)}</div>}</section>
      <section className="pilot-quick-access" aria-label="Quick access">
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}><span><CalendarDays size={16}/></span><span><strong>Browse schedules</strong><small>Find your next available leg</small></span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/fleet":"/pilot/"+organizationId+"/fleet"}><span><Plane size={16}/></span><span><strong>Explore fleet</strong><small>View your airline aircraft</small></span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/bookings":"/pilot/"+organizationId+"/bookings"}><span><ShieldCheck size={16}/></span><span><strong>My bookings</strong><small>Track your leg requests</small></span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/members":"/pilot/"+organizationId+"/members"}><span><Users size={16}/></span><span><strong>Meet the crew</strong><small>See your Live organisation</small></span></Link>
      </section>
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
