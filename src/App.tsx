import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Plane, RefreshCw, ShieldCheck, Users, Building2 } from "lucide-react";
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
import ToastNotice from "./components/ToastNotice";
import { chakra } from "@chakra-ui/react";
const AircraftLiveMap = lazy(() => import("./components/AircraftLiveMap"));

function Header(){return <chakra.header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro <ArrowUpRight size={13}/></Link><chakra.div className="top-actions"><ThemeToggle/></chakra.div></chakra.header>}
function Footer(){return <chakra.footer className="footer"><chakra.span>© {new Date().getFullYear()} VEYRO</chakra.span><chakra.span>Independent third-party software</chakra.span></chakra.footer>}
function Landing(){
 return <chakra.main className="shell landing landing-reimagined">
  <chakra.section className="launch-hero">
   <chakra.header className="launch-header">
    <Brand/>
    <chakra.nav className="launch-nav" aria-label="Main navigation">
     <chakra.a href="#platform">Platform</chakra.a><chakra.a href="#workflow">How it works</chakra.a><Link to="/docs">Documentation</Link>
    </chakra.nav>
    <chakra.div className="launch-header-actions"><Link className="launch-account" to="/account">My Veyro <ArrowUpRight size={14}/></Link><ThemeToggle/></chakra.div>
   </chakra.header>
   <chakra.div className="launch-hero-grid">
    <chakra.div className="launch-copy">
     <chakra.div className="launch-kicker"><chakra.span className="launch-live-dot"/> THE OPERATING SYSTEM FOR VIRTUAL AIRLINES</chakra.div>
     <chakra.h1>Run your airline.<chakra.br/><chakra.span>Own every moment.</chakra.span></chakra.h1>
     <chakra.p className="launch-lede">Your fleet, schedules and pilots — finally working as one. Veyro Live connects your organization to Infinite Flight Live and gives every pilot a place to belong.</chakra.p>
     <chakra.div className="launch-cta-row"><Link className="launch-primary" to="/login">Enter Veyro Live <ArrowRight size={16}/></Link><Link className="launch-text-link" to="/apply">Create an organization <ArrowUpRight size={15}/></Link></chakra.div>
     <chakra.div className="launch-proof"><chakra.span><ShieldCheck size={15}/> Infinite Flight OAuth</chakra.span><chakra.span><Users size={15}/> Built for crews</chakra.span><chakra.span><Building2 size={15}/> Multi-VA ready</chakra.span></chakra.div>
    </chakra.div>
    <chakra.div className="launch-console" aria-label="Illustrative Veyro Live operations dashboard">
     <chakra.div className="launch-console-top"><chakra.div><chakra.span className="launch-console-mark"><Plane size={16}/></chakra.span><chakra.div><chakra.strong>OPERATIONS CONTROL</chakra.strong><chakra.small>YOUR AIRLINE AT A GLANCE</chakra.small></chakra.div></chakra.div><chakra.span className="launch-online"><chakra.i/> PRODUCT PREVIEW</chakra.span></chakra.div>
     <chakra.div className="launch-console-title"><chakra.div><chakra.span className="launch-label">TODAY'S OPERATIONS</chakra.span><chakra.h2>Flight overview</chakra.h2></chakra.div><chakra.span className="launch-date">LIVE · UTC</chakra.span></chakra.div>
     <chakra.div className="launch-metrics"><chakra.div><chakra.small>ACTIVE FLEET</chakra.small><chakra.strong>01</chakra.strong><chakra.span>Connected aircraft</chakra.span></chakra.div><chakra.div><chakra.small>FLIGHT SCHEDULES</chakra.small><chakra.strong>24</chakra.strong><chakra.span>Ready to request</chakra.span></chakra.div><chakra.div><chakra.small>CREW REQUESTS</chakra.small><chakra.strong>03</chakra.strong><chakra.span>Awaiting review</chakra.span></chakra.div></chakra.div>
     <chakra.div className="launch-route-card"><chakra.div className="launch-route-head"><chakra.span className="launch-label">FEATURED FLIGHT</chakra.span><chakra.span className="launch-route-status">SCHEDULED</chakra.span></chakra.div><chakra.div className="launch-route"><chakra.div><chakra.strong>EGLL</chakra.strong><chakra.small>LONDON</chakra.small></chakra.div><chakra.div className="launch-route-line"><Plane size={17}/><chakra.span/></chakra.div><chakra.div><chakra.strong>EDDF</chakra.strong><chakra.small>FRANKFURT</chakra.small></chakra.div></chakra.div><chakra.div className="launch-route-foot"><chakra.span>VYR 204</chakra.span><chakra.span>AIRBUS A320</chakra.span><chakra.span>01H 25M</chakra.span></chakra.div></chakra.div>
     <chakra.div className="launch-queue"><chakra.div><chakra.strong>Approval queue</chakra.strong><chakra.span>Illustrative preview</chakra.span></chakra.div><chakra.div className="launch-queue-row"><chakra.span className="launch-queue-avatar">P</chakra.span><chakra.div><chakra.strong>Pilot leg request</chakra.strong><chakra.small>EGLL → EDDF · VYR 204</chakra.small></chakra.div><chakra.span className="launch-review">REVIEW</chakra.span></chakra.div><chakra.div className="launch-queue-row"><chakra.span className="launch-queue-avatar alt">C</chakra.span><chakra.div><chakra.strong>Crew assignment</chakra.strong><chakra.small>Live schedule synchronization</chakra.small></chakra.div><chakra.span className="launch-synced">READY</chakra.span></chakra.div></chakra.div>
     <chakra.div className="launch-console-foot"><chakra.span><chakra.i/> DESIGNED FOR INFINITE FLIGHT LIVE</chakra.span><chakra.span>VEYRO / CONTROL</chakra.span></chakra.div>
    </chakra.div>
   </chakra.div>
   <chakra.div className="launch-hero-bottom"><chakra.span>DESIGNED FOR VIRTUAL AVIATION</chakra.span><chakra.span>FLEET <chakra.b>·</chakra.b> SCHEDULES <chakra.b>·</chakra.b> CREW <chakra.b>·</chakra.b> OPERATIONS</chakra.span><chakra.span>01 — THE PLATFORM</chakra.span></chakra.div>
  </chakra.section>
  <chakra.section className="launch-intro" id="platform"><chakra.div><chakra.span className="launch-section-kicker">ONE CONNECTED WORKSPACE</chakra.span><chakra.h2>Less admin.<chakra.br/><chakra.em>More aviation.</chakra.em></chakra.h2></chakra.div><chakra.p>Veyro brings the moving parts of your virtual airline into one calm, connected workspace — from organization setup to a pilot's next booked leg.</chakra.p></chakra.section>
  <chakra.section className="launch-feature-grid">
   <chakra.article className="launch-feature"><chakra.span className="launch-feature-number">01 / FLEET</chakra.span><chakra.div className="launch-feature-icon"><Plane size={20}/></chakra.div><chakra.h3>Your fleet, in sync.</chakra.h3><chakra.p>Connect your Infinite Flight Live organization and work with its aircraft, members and schedules from one place.</chakra.p><Link to="/docs">Explore fleet tools <ChevronRight size={14}/></Link></chakra.article>
   <chakra.article className="launch-feature"><chakra.span className="launch-feature-number">02 / SCHEDULING</chakra.span><chakra.div className="launch-feature-icon"><CalendarDays size={20}/></chakra.div><chakra.h3>Every leg has a place.</chakra.h3><chakra.p>Explore published schedules, understand available legs and keep your organisation’s flight information in one place.</chakra.p><Link to="/docs">Explore scheduling <ChevronRight size={14}/></Link></chakra.article>
   <chakra.article className="launch-feature"><chakra.span className="launch-feature-number">03 / APPROVALS</chakra.span><chakra.div className="launch-feature-icon"><ShieldCheck size={20}/></chakra.div><chakra.h3>Decisions that travel.</chakra.h3><chakra.p>Keep the approval workflow connected to Discord, with administrator checks and Infinite Flight Live integration.</chakra.p><Link to="/docs">Explore approvals <ChevronRight size={14}/></Link></chakra.article>
  </chakra.section>
  <chakra.section className="launch-workflow" id="workflow"><chakra.div className="launch-workflow-heading"><chakra.span className="launch-section-kicker">FROM SIGN-IN TO TAKE-OFF</chakra.span><chakra.h2>A simpler way<chakra.br/><chakra.em>to operate.</chakra.em></chakra.h2></chakra.div><chakra.div className="launch-steps"><chakra.article><chakra.span>01</chakra.span><chakra.h3>Connect</chakra.h3><chakra.p>Sign in with Infinite Flight and securely connect your organization.</chakra.p></chakra.article><chakra.article><chakra.span>02</chakra.span><chakra.h3>Coordinate</chakra.h3><chakra.p>Publish aircraft schedules and let your pilots request the legs they want.</chakra.p></chakra.article><chakra.article><chakra.span>03</chakra.span><chakra.h3>Confirm</chakra.h3><chakra.p>Review requests in Discord and assign approved pilots to Live schedules.</chakra.p></chakra.article></chakra.div></chakra.section>
  <chakra.section className="launch-directory"><chakra.div className="launch-directory-heading"><chakra.div><chakra.span className="launch-section-kicker">FIND YOUR CREW</chakra.span><chakra.h2>Airlines on Veyro.</chakra.h2></chakra.div><chakra.p>Discover organizations with a Veyro Live home and find where your next flight begins.</chakra.p></chakra.div><OrganizationDirectory/></chakra.section>
  <chakra.section className="launch-final"><chakra.div><chakra.span className="launch-section-kicker">YOUR NEXT FLIGHT STARTS HERE</chakra.span><chakra.h2>Bring your airline<chakra.br/><chakra.em>into focus.</chakra.em></chakra.h2></chakra.div><chakra.div><chakra.p>Build a connected home for your organization and give your pilots a better way to fly together.</chakra.p><Link className="launch-primary" to="/apply">Get started with Veyro <ArrowRight size={16}/></Link></chakra.div></chakra.section>
  <Footer/>
 </chakra.main>
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
 if(!isSupabaseConfigured)return <chakra.main className="shell narrow"><Header/><chakra.section className="panel login-panel"><chakra.h1>Backend not configured</chakra.h1><chakra.p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project environment, then redeploy.</chakra.p></chakra.section><Footer/></chakra.main>;
 return <chakra.main className="shell narrow"><Header/><chakra.section className="panel login-panel login-panel-if">
  <chakra.div className="login-brand-stack"><chakra.img className="if-live-logo" src="/images/if-live.png" alt="Infinite Flight Live"/><chakra.span>ONE CONNECTION. YOUR ENTIRE VEYRO NETWORK.</chakra.span></chakra.div>
  <chakra.h1>Take off with Veyro.</chakra.h1>
  <chakra.p>Sign in securely with Infinite Flight. Once connected, you’ll land directly in My Veyro, where all your available airline portals are gathered in one place.</chakra.p>
  <chakra.button className="button button-primary full if-oauth-button" onClick={connect} disabled={busy||sessionLoading}>
   <chakra.img src="/images/if-logo.png" alt="" className="if-login-icon"/>
   {busy?"Connecting to Infinite Flight…":"Continue with Infinite Flight"}<ArrowRight size={16}/>
  </chakra.button>
  {session&&<Link className="button button-quiet full login-account-link" to="/account">Open My Veyro <ArrowUpRight size={14}/></Link>}
  <chakra.div className="login-security-note"><ShieldCheck size={14}/> Your Infinite Flight tokens are encrypted and never exposed to the browser.</chakra.div>
  {error&&<ToastNotice message={error} onDismiss={()=>setError("")}/>}
  {session?.user.is_anonymous&&<chakra.div className="login-session-note">Your Veyro session is saved on this device. Avoid signing out or clearing browser data if you want to keep this account.</chakra.div>}
 </chakra.section><Footer/></chakra.main>;
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
 const openLivePortal=async(org:any,mode:"admin"|"pilot"="admin")=>{
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
   if(mode==="admin"&&role!==1&&role!==2)throw new Error("Administrator access is required for this dashboard.");
   navigate(mode==="pilot"?"/"+result.portal.slug+"/pilot/"+session.user.id:role===1||role===2?"/"+result.portal.slug+"/admin":"/"+result.portal.slug+"/pilot/"+session.user.id);
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

 if(authLoading)return <chakra.main className="shell"><Header/><chakra.section className="account-loading">Restoring your VEYRO session…</chakra.section></chakra.main>;
 if(!session)return <chakra.main className="shell"><Header/><chakra.section className="account-welcome"><chakra.div className="eyebrow">YOUR VEYRO ACCOUNT</chakra.div><chakra.h1>One identity.<chakra.br/><chakra.span>Every airline you fly with.</chakra.span></chakra.h1><chakra.p>Connect once to access your pilot portals, airline memberships and organization administration.</chakra.p><Link className="cosmic-cta account-primary" to="/login">Connect Infinite Flight <ArrowRight size={16}/></Link></chakra.section><Footer/></chakra.main>;

 return <chakra.main className="shell account-shell"><Header/>
  <chakra.section className="account-hero"><chakra.div><chakra.div className="eyebrow"><chakra.span className="pulse"/> PERSONAL OPERATIONS CENTRE</chakra.div><chakra.h1>Welcome back{data?.profile?.display_name?", "+data.profile.display_name:""}.</chakra.h1><chakra.p>Your airlines, your crew spaces and your Infinite Flight connection — together in one place.</chakra.p></chakra.div>
   <chakra.div className={"account-connection-card "+(data?.infiniteFlight?.connected?"is-connected":"")}><chakra.span className="connection-orb"/><chakra.div><chakra.strong>{data?.infiniteFlight?.connected?"Infinite Flight connected":"Connect Infinite Flight"}</chakra.strong><chakra.small>{data?.infiniteFlight?.connected?"Your account is ready across VEYRO":"One secure connection unlocks your airline workspaces"}</chakra.small></chakra.div><chakra.button className={data?.infiniteFlight?.connected?"button button-quiet":"button button-primary"} disabled={busy==="connect"} onClick={connect}>{busy==="connect"?"Opening Infinite Flight…":data?.infiniteFlight?.connected?"Reconnect Infinite Flight":"Connect account"}</chakra.button></chakra.div>
  </chakra.section>
  {error&&<ToastNotice message={error} onDismiss={()=>setError("")}/>}{notice&&<chakra.div className="notice success">{notice}</chakra.div>}
  <chakra.section className="account-section"><chakra.div className="account-section-heading"><chakra.div><chakra.div className="eyebrow">YOUR ORGANISATIONS</chakra.div><chakra.h2>{pendingId?"Your available portals":"My airline portals"}</chakra.h2><chakra.p>{pendingId?"All Veyro workspaces matched to your Infinite Flight account.":"Workspaces where your membership is active."}</chakra.p></chakra.div><chakra.span className="account-count">{portalCards.length} PORTALS</chakra.span></chakra.div>
   {loading||(pendingId&&liveOrganizationsLoading)?<chakra.div className="account-card-grid"><chakra.div className="account-skeleton"/><chakra.div className="account-skeleton"/></chakra.div>:portalCards.length===0?<chakra.div className="account-empty"><Building2 size={22}/><chakra.strong>Your airline spaces will appear here.</chakra.strong><chakra.span>Connect Infinite Flight to discover every Veyro portal available to your account.</chakra.span></chakra.div>:<chakra.div className="account-card-grid">{portalCards.map((org:any)=><chakra.article className="airline-account-card" key={org.id}><chakra.div className="airline-card-top"><chakra.div className="airline-card-logo">{org.logo_url?<chakra.img src={org.logo_url} alt=""/>:<chakra.span>{org.display_name?.slice(0,1)||"V"}</chakra.span>}</chakra.div><chakra.span className="membership-chip">{org.role==="owner"||org.role==="admin"?"ADMIN":"PILOT"}</chakra.span></chakra.div><chakra.h3>{org.display_name}</chakra.h3><chakra.p>{org.tagline||"Your dedicated Infinite Flight workspace."}</chakra.p><chakra.div className="airline-card-actions">{org.openFromLive?<>{(org.role==="owner"||org.role==="admin")&&<chakra.button className="button button-primary" onClick={()=>void openLivePortal(liveOrganizations.find((item:any)=>item.id===org.liveOrganizationId),"admin")} disabled={busy===org.liveOrganizationId}>Admin dashboard <ArrowRight size={14}/></chakra.button>}<chakra.button className="button button-quiet" onClick={()=>void openLivePortal(liveOrganizations.find((item:any)=>item.id===org.liveOrganizationId),"pilot")} disabled={busy===org.liveOrganizationId}>Pilot dashboard <ArrowRight size={14}/></chakra.button></>:<>{(org.role==="owner"||org.role==="admin")&&<Link className="button button-primary" to={"/"+org.slug+"/admin"}>Admin dashboard <ArrowRight size={14}/></Link>}<Link className="button button-quiet" to={"/"+org.slug+"/pilot/"+session.user.id}>Pilot dashboard <ArrowRight size={14}/></Link></>}<Link className="airline-text-link" to={"/"+org.slug}>View airline <ArrowUpRight size={13}/></Link></chakra.div></chakra.article>)}</chakra.div>}
  </chakra.section>
  {pendingId&&liveOrganizations.some((org:any)=>!org.portal)&&<chakra.div className="account-unlinked-portals"><chakra.div><chakra.strong>Other Infinite Flight organisations</chakra.strong><chakra.span>These organisations do not have an active Veyro portal yet.</chakra.span></chakra.div>{liveOrganizations.filter((org:any)=>!org.portal).map((org:any)=><chakra.div className="account-unlinked-row" key={org.id}><chakra.span>{org.name} · {org.role===2?"Owner":org.role===1?"Admin":"Member"}</chakra.span>{[1,2].includes(org.role)?<Link className="airline-text-link" to={"/apply?pending="+encodeURIComponent(pendingId)+"&org="+encodeURIComponent(org.id)}>Apply for a portal <ArrowUpRight size={13}/></Link>:<chakra.small>No portal yet</chakra.small>}</chakra.div>)}</chakra.div>}
  <chakra.section className="account-section"><chakra.div className="account-section-heading"><chakra.div><chakra.div className="eyebrow">INVITATIONS</chakra.div><chakra.h2>Ready to join</chakra.h2><chakra.p>Airlines that have invited this VEYRO account.</chakra.p></chakra.div><chakra.span className="account-count">{invitations.length} INVITATIONS</chakra.span></chakra.div>{invitations.length===0?<chakra.div className="account-empty compact"><Users size={20}/><chakra.span>No pending invitations. Connect Infinite Flight and choose an organisation where you are a verified Live member.</chakra.span></chakra.div>:<chakra.div className="account-card-grid">{invitations.map((invite:any)=><chakra.article className="airline-account-card invite-card" key={invite.id}><chakra.div className="airline-card-top"><chakra.div className="airline-card-logo">{invite.organization.logo_url?<chakra.img src={invite.organization.logo_url} alt=""/>:<chakra.span>{invite.organization.display_name?.slice(0,1)||"V"}</chakra.span>}</chakra.div><chakra.span className="membership-chip invited">INVITED</chakra.span></chakra.div><chakra.h3>{invite.organization.display_name}</chakra.h3><chakra.p>Welcome, {invite.pilotName}. Your airline has invited you to join its pilot community.</chakra.p><chakra.button className="button button-primary" disabled={busy===invite.organization.id||!data?.infiniteFlight?.connected} onClick={()=>join(invite)}>{busy===invite.organization.id?"Verifying membership…":data?.infiniteFlight?.connected?"Join airline":"Connect Infinite Flight first"} <ArrowRight size={14}/></chakra.button></chakra.article>)}</chakra.div>}</chakra.section>
  <chakra.section className="account-section"><chakra.div className="account-section-heading"><chakra.div><chakra.div className="eyebrow">THE VEYRO NETWORK</chakra.div><chakra.h2>Explore airlines</chakra.h2><chakra.p>Discover public airline portals and learn about their operations.</chakra.p></chakra.div><chakra.span className="account-count">{directory.length} PUBLIC PORTALS</chakra.span></chakra.div>{loading?<chakra.div className="account-skeleton"/>:directory.length===0?<chakra.div className="account-empty">No public portals are available yet.</chakra.div>:<chakra.div className="account-directory-grid">{directory.map((org:any)=><chakra.article className="directory-account-card" key={org.id}><chakra.div className="airline-card-logo">{org.logo_url?<chakra.img src={org.logo_url} alt=""/>:<chakra.span>{org.display_name?.slice(0,1)||"V"}</chakra.span>}</chakra.div><chakra.div className="directory-account-copy"><chakra.h3>{org.display_name}</chakra.h3><chakra.p>{org.tagline||"Virtual airline on Infinite Flight Live."}</chakra.p><chakra.div className="airline-card-actions"><Link className="airline-text-link" to={"/"+org.slug}>Website info <ArrowUpRight size={13}/></Link>{joinedIds.has(org.id)?<chakra.span className="membership-chip">MEMBER</chakra.span>:invitedIds.has(org.id)?<chakra.span className="membership-chip invited">INVITED</chakra.span>:<Link className="button button-quiet" to={"/"+org.slug+"/pilot-sign-in"}>Join airline <ArrowRight size={13}/></Link>}</chakra.div></chakra.div></chakra.article>)}</chakra.div>}</chakra.section>
  {next==="/apply"&&pendingId&&<chakra.section className="account-section account-next-step"><chakra.div><chakra.div className="eyebrow">CONTINUE SETUP</chakra.div><chakra.h2>Creating a new organization portal?</chakra.h2><chakra.p>Continue your portal application from your verified Infinite Flight account.</chakra.p></chakra.div><Link className="button button-primary" to={"/apply?pending="+encodeURIComponent(pendingId)}>Continue application <ArrowRight size={14}/></Link></chakra.section>}
  <chakra.div className="account-bottom-actions"><chakra.button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh my portals</chakra.button><Link className="button button-quiet" to="/docs">Platform documentation <ArrowUpRight size={14}/></Link></chakra.div><Footer/>
 </chakra.main>;
}

function Organization(){const {slug=""}=useParams();const [session,setSession]=useState<Session|null>(null);const [sessionLoading,setSessionLoading]=useState(true);const [org,setOrg]=useState<any>(null);const [aircraft,setAircraft]=useState<any[]>([]);const [schedules,setSchedules]=useState<any[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [tab,setTab]=useState<"schedules"|"fleet">("schedules");
 useEffect(()=>{let active=true;supabase?.auth.getSession().then(({data})=>{if(active)setSession(data.session)}).finally(()=>{if(active)setSessionLoading(false)});return()=>{active=false}},[]);
 const load=async()=>{if(!supabase||!session)return;setLoading(true);setError("");const [organizationResult,a,s]=await Promise.all([supabase.from("organizations").select("id,slug,display_name,live_organization_id").eq("slug",slug).eq("is_active",true).single(),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"aircraft"}}),invokeFunction(supabase,"if-api",{body:{organizationSlug:slug,action:"schedules"}})]);const organization=organizationResult.data;if(organizationResult.error||!organization){setError("This organization is unavailable to your account.");setLoading(false);return}setOrg(organization);if(a.error||s.error){setError(a.error?.message||s.error?.message||"Live data could not be loaded.");setLoading(false);return}setAircraft(a.data?.result||[]);setSchedules(s.data?.result||[]);setLoading(false)};
 useEffect(()=>{if(session)load();else if(!isSupabaseConfigured)setLoading(false)},[session,slug]);
 if(sessionLoading)return <chakra.main className="shell narrow"><Header/><chakra.section className="panel login-panel"><chakra.p>Checking your VEYRO session…</chakra.p></chakra.section></chakra.main>;
 if(!session)return <Navigate to="/login" replace/>;
 const list=tab==="fleet"?aircraft:schedules;
 return <chakra.main className="shell"><Header/><chakra.section className="dashboard-heading"><chakra.div><chakra.div className="eyebrow">ORGANIZATION WORKSPACE</chakra.div><chakra.h1>{org?.display_name||slug}</chakra.h1><chakra.p>Live organization data · fetched on demand</chakra.p></chakra.div><chakra.button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</chakra.button></chakra.section><chakra.div className="dashboard-stats"><chakra.article className="stat-card"><chakra.span>Fleet aircraft</chakra.span><chakra.strong>{aircraft.length}</chakra.strong><chakra.small><Plane size={12}/> Live organization aircraft</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Published schedules</chakra.span><chakra.strong>{schedules.length}</chakra.strong><chakra.small><CalendarDays size={12}/> Current Live schedules</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Portal status</chakra.span><chakra.strong className="status-online">Connected</chakra.strong><chakra.small><ShieldCheck size={12}/> Membership verified</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Data source</chakra.span><chakra.strong>Live v3</chakra.strong><chakra.small>Not persisted by VEYRO</chakra.small></chakra.article></chakra.div><chakra.section className="panel dashboard-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Operations</chakra.h2><chakra.p>Read-only Live view in this release</chakra.p></chakra.div><chakra.div className="tab-switch"><chakra.button className={tab==="schedules"?"active":""} onClick={()=>setTab("schedules")}>Schedules</chakra.button><chakra.button className={tab==="fleet"?"active":""} onClick={()=>setTab("fleet")}>Fleet</chakra.button></chakra.div></chakra.div>{error&&<ToastNotice message={error} onDismiss={()=>setError("")}/>}{loading?<chakra.div className="empty-state">Loading current Live data…</chakra.div>:list.length===0?<chakra.div className="empty-state">No {tab==="fleet"?"aircraft":"schedules"} were returned by Infinite Flight Live.</chakra.div>:<chakra.div className="data-list">{list.map((item:any,i:number)=><chakra.article className="data-row" key={item.id||i}><chakra.div><chakra.strong>{tab==="fleet"?(item.registration||"Aircraft"):((item.originIcao||"—")+" → "+(item.destinationIcao||"—"))}</chakra.strong><chakra.small>{tab==="fleet"?"Fleet rank "+(item.fleetRank??"—")+" · "+(item.isFleetActiveSlot?"Active slot":"Storage"):((item.callsign||"Schedule")+" · "+(item.flightPlan||"No flight plan"))}</chakra.small></chakra.div><chakra.span className="row-status">{tab==="fleet"?(item.visibility===1?"Visible":"Hangared"):(item.status??"Scheduled")}</chakra.span></chakra.article>)}</chakra.div>}</chakra.section><Footer/></chakra.main>}
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
function aircraftPositionLabel(position?:AircraftPosition):string{
 if(!position)return "Position unavailable";
 if(position.state===5)return "Maintenance";
 if(position.state===3)return "Cancelled";
 if(position.state===4)return "Stopped";
 if(position.isOnGround)return "On ground";
 if(position.state===2||position.isOnGround===false)return "In flight";
 return "Status unknown";
}
function airportCode(value:any):string{
 if(typeof value==="string")return value;
 return String(value?.icao||value?.icaoCode||value?.code||"—");
}
function scheduleStatusLabel(status:number){
 return ({0:"Unknown",1:"Scheduled",2:"Boarding",3:"Boarded",4:"Taxiing to runway",6:"In flight",7:"Diverted",8:"Delayed",9:"Cancelled",10:"Taxiing to parking",11:"Arrived"} as Record<number,string>)[status]||"Scheduled";
}
function FleetAircraftCard({aircraft}:{aircraft:any}){
 const [imageFailed,setImageFailed]=useState(false);
 const registration=String(aircraft.registration||"UNREGISTERED");
 return <chakra.article className="fleet-aircraft-card">
  <chakra.div className="fleet-aircraft-visual">
   {!imageFailed?<chakra.img src={"/aircrafts/"+encodeURIComponent(registration)+"/aircraft.png"} alt={registration+" aircraft"} onError={()=>setImageFailed(true)}/>:<chakra.div className="fleet-aircraft-fallback"><Plane size={76} strokeWidth={1}/><chakra.span>VEYRO FLEET</chakra.span></chakra.div>}
   <chakra.span className="fleet-rank">FLEET {aircraft.fleetRank??"—"}</chakra.span>
  </chakra.div>
  <chakra.div className="fleet-aircraft-copy"><chakra.div><chakra.span className="eyebrow">AIRCRAFT REGISTRATION</chakra.span><chakra.h3>{registration}</chakra.h3></chakra.div><chakra.span className={"aircraft-status-chip "+(aircraft.isFleetActiveSlot?"tone-air":"tone-muted")}>{aircraft.isFleetActiveSlot?"Active fleet slot":"Reserve / storage"}</chakra.span></chakra.div>
  <chakra.div className="fleet-aircraft-meta"><chakra.span>{aircraft.visibility===2?"Hangared":"Visible in fleet"}</chakra.span><chakra.span>{aircraft.status===0?"Active record":"Inactive record"}</chakra.span></chakra.div>
 </chakra.article>;
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
 const [selectedSeatSchedule,setSelectedSeatSchedule]=useState<any>(null);
 const [seatChoice,setSeatChoice]=useState<0|1>(0);
 const [selectedMapAircraft,setSelectedMapAircraft]=useState<{aircraft:any;position:AircraftPosition}|null>(null);
 const [collapsedAircraftIds,setCollapsedAircraftIds]=useState<string[]>([]);
 const [scheduleSort,setScheduleSort]=useState("ready");
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
 const [requestNotice,setRequestNotice]=useState<{message:string;url?:string}|null>(null);
 const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const [darkMap,setDarkMap]=useState(()=>document.documentElement.classList.contains("dark"));
 const lastUserActivity=useRef(Date.now());
 const tail=location.pathname.split("/").filter(Boolean).at(-1)||"overview";
 const page=["overview","schedules","fleet","members","bookings","profile"].includes(tail)?tail:"overview";
 const selectedMapFlight=selectedMapAircraft?latestFlights[selectedMapAircraft.aircraft.id]:null;

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

 const openAircraftDetails=async(item:any,position:AircraftPosition)=>{
  setSelectedMapAircraft({aircraft:item,position});
  if(!supabase||!resolvedOrganizationId||!session)return;
  try{
   const {data,error}=await invokeFunction(supabase,"pilot-live-data",{body:{
    organizationId:resolvedOrganizationId,cacheScope,action:"aircraft_operations",aircraftIds:[item.id],
    apiRateRemaining:currentRateBudget(apiRateLimit),apiRateResetAt:apiRateLimit?.resetAt,isPro:apiRateLimit?.isPro??false
   }});
   if(error)throw error;
   if(data?.positions?.[item.id]){
    setPositions(previous=>({...previous,[item.id]:data.positions[item.id]}));
    setSelectedMapAircraft({aircraft:item,position:data.positions[item.id]});
   }
   if(data?.latestFlights)setLatestFlights(previous=>({...previous,...data.latestFlights}));
   if(data?.rateLimit)setApiRateLimit(data.rateLimit);
   if(data?.rateLimited)setPositionError("Live flight details are temporarily limited by your Infinite Flight API allowance.");
  }catch(e){setPositionError(e instanceof Error?e.message:"Could not load the latest aircraft flight details.");}
 };
 useEffect(()=>{
  if(!["overview","schedules"].includes(page)||!session||aircraft.length===0)return;
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
 const refreshPage=async()=>{await load();if(page==="overview")await fetchFleetData(false);if(page==="schedules")await fetchFleetData(false)};
 const requestLeg=async(item:any,seatRole:0|1=0)=>{
  if(!supabase||!portalId)return;
  setRequestBusy(item.id);setError("");setRequestNotice(null);
  try{
   const {data,error}=await invokeFunction(supabase,"booking-request",{body:{organizationId:portalId,scheduleId:item.id,aircraftId:item.aircraftId,seatRole}});
   if(error)throw error;
   if(data?.booking){
    const message=data.discordPostRepaired
     ?"Your existing request was found and its missing Discord approval post has been restored."
     :data.alreadyExists&&data.booking.status==="pending_approval"
      ?"You already have an active request for this leg. Its Discord approval post is available below."
      :data.alreadyExists&&data.booking.status==="approved"
       ?"This leg is already approved and assigned in Infinite Flight Live."
       :data.booking.status==="approved"
        ?"Your leg request was approved and synchronized with Infinite Flight Live."
        :"Your leg request was sent to your organisation’s Discord approval channel.";
    setRequestNotice({message,url:data.discordMessageUrl||undefined});
   }
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not request this schedule leg.")}
  finally{setRequestBusy("")}
 };
 if(sessionLoading)return <chakra.main className="shell narrow"><Header/><chakra.section className="panel login-panel"><chakra.p>Checking your VEYRO session…</chakra.p></chakra.section></chakra.main>;
 if(!session)return <Navigate to={slug?"/"+slug+"/pilot-sign-in":"/login"} replace/>;
 if(loading&&!organization)return <chakra.main className="shell pilot-shell"><Header/><chakra.section className="dashboard-loading-state"><chakra.div className="eyebrow">PILOT WORKSPACE</chakra.div><chakra.h1>Preparing your flight desk</chakra.h1><chakra.p>Verifying your Infinite Flight membership and loading your airline data…</chakra.p></chakra.section><Footer/></chakra.main>;
 if(!loading&&!organization)return <chakra.main className="shell pilot-shell"><Header/><chakra.section className="dashboard-error-state"><chakra.div className="eyebrow">PILOT WORKSPACE</chakra.div><chakra.h1>We couldn’t open this portal</chakra.h1><chakra.p>{error||"Your Infinite Flight organisation could not be loaded. Return to My Veyro and open the portal again."}</chakra.p><chakra.div className="dashboard-error-actions"><chakra.button className="button button-primary" onClick={()=>void load()}><RefreshCw size={14}/> Try again</chakra.button><Link className="button button-quiet" to="/account">Back to My Veyro</Link></chakra.div></chakra.section><Footer/></chakra.main>;
 const nav=[{id:"overview",label:"Overview"},{id:"schedules",label:"Schedules"},{id:"fleet",label:"Fleet"},{id:"members",label:"Crew"},{id:"bookings",label:"My bookings"},{id:"profile",label:"Pilot profile"}];
 const schedulesByAircraft=new Map<string,any[]>();
 schedules.forEach(item=>{const key=String(item.aircraftId||"");if(!schedulesByAircraft.has(key))schedulesByAircraft.set(key,[]);schedulesByAircraft.get(key)!.push(item)});
 schedulesByAircraft.forEach(items=>items.sort((a,b)=>(a.sequence??0)-(b.sequence??0)));
 const positionedCount=Object.keys(positions).length;
 const nextPilotSchedule=[...schedules].filter(item=>item.scheduledDepartureUtc&&new Date(item.scheduledDepartureUtc).getTime()>=Date.now()).sort((a,b)=>new Date(a.scheduledDepartureUtc).getTime()-new Date(b.scheduledDepartureUtc).getTime())[0]||schedules[0]||null;

 return <chakra.main className="shell pilot-shell">
  <Header/>
  <chakra.div className="pilot-layout">
   <chakra.aside className="pilot-sidebar"><chakra.div className="pilot-sidebar-org"><chakra.span className="pilot-org-mark">{(organization?.name||"V").slice(0,1)}</chakra.span><chakra.div><chakra.strong>{organization?.name||"Live organisation"}</chakra.strong><chakra.small>PILOT WORKSPACE</chakra.small></chakra.div></chakra.div><SpotlightNavbar orientation="vertical" activeHref={location.pathname} items={nav.map(item=>({label:item.label,href:(slug?"/"+slug+"/pilot/"+pilotId:"/pilot/"+organizationId)+(item.id==="overview"?"":"/"+item.id)}))}/><chakra.div className="pilot-sidebar-foot">PILOT OPERATIONS<chakra.br/>Bookings synced to Live</chakra.div></chakra.aside>
   <chakra.section className="pilot-content">
    <chakra.div className="dashboard-heading"><chakra.div><chakra.div className="eyebrow">PILOT WORKSPACE · {page.toUpperCase()}</chakra.div><chakra.h1>{page==="overview"?(organization?.name||"Your Live organisation"):page==="schedules"?"Fleet & schedules":page==="fleet"?"Organisation fleet":page==="members"?"Organization crew":page==="bookings"?"My bookings":"Pilot profile"}</chakra.h1><chakra.p>Personal Infinite Flight access · {organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"} · Verified Live member</chakra.p></chakra.div><chakra.img className="dashboard-if-live-mark" src="/images/if-live.png" alt="Infinite Flight Live"/><chakra.button className="button button-quiet" onClick={()=>void refreshPage()} disabled={loading||positionLoading}><RefreshCw size={14}/> Refresh</chakra.button></chakra.div>
    {requestNotice&&<chakra.div className="notice success"><chakra.span>{requestNotice.message}</chakra.span>{requestNotice.url&&<chakra.a href={requestNotice.url} target="_blank" rel="noreferrer">Open Discord approval <ArrowUpRight size={13}/></chakra.a>}</chakra.div>}
    {error&&<ToastNotice message={error} onDismiss={()=>setError("")}/>}
    {page==="overview" ? <>
      <chakra.section className="pilot-flight-hero">
       <chakra.div className="pilot-flight-hero-copy">
        <chakra.span className="pilot-flight-kicker"><chakra.span className="pilot-flight-live-dot"/> YOUR FLIGHT DESK</chakra.span>
        <chakra.h2>{nextPilotSchedule?"Your next leg is in sight.":"Your next flight starts here."}</chakra.h2>
        <chakra.p>{nextPilotSchedule?"Explore the published schedule and request the seat that works for you.":"Browse your organisation’s published schedules to find an available leg."}</chakra.p>
        <chakra.div className="pilot-flight-actions">
         <Link className="button button-primary" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}>Browse schedules <ArrowRight size={14}/></Link>
         <Link className="button button-quiet" to={slug?"/"+slug+"/pilot/"+pilotId+"/bookings":"/pilot/"+organizationId+"/bookings"}>View my bookings</Link>
        </chakra.div>
       </chakra.div>
       <chakra.div className="pilot-next-leg">
        <chakra.span className="pilot-next-leg-label">{nextPilotSchedule?"NEXT PUBLISHED LEG":"SCHEDULE STATUS"}</chakra.span>
        {nextPilotSchedule?<><chakra.strong className="pilot-next-route">{nextPilotSchedule.originIcao||"—"} <chakra.span>→</chakra.span> {nextPilotSchedule.destinationIcao||"—"}</chakra.strong><chakra.span className="pilot-next-callsign">{nextPilotSchedule.callsign||"Scheduled flight"} · {nextPilotSchedule.isTimeless?"Flexible date":nextPilotSchedule.scheduledDepartureUtc?new Date(nextPilotSchedule.scheduledDepartureUtc).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"Date to be confirmed"}</chakra.span><chakra.span className="pilot-next-status">{scheduleStatusLabel(nextPilotSchedule.status??1)}</chakra.span></>:<chakra.strong className="pilot-next-empty">No published legs yet</chakra.strong>}
       </chakra.div>
      </chakra.section>
      <chakra.div className="dashboard-stats"><chakra.article className="stat-card"><chakra.span>Fleet aircraft</chakra.span><chakra.strong>{aircraft.length}</chakra.strong><chakra.small><Plane size={12}/> Live organisation fleet</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Published schedules</chakra.span><chakra.strong>{schedules.length}</chakra.strong><chakra.small><CalendarDays size={12}/> Current schedules</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Your Live role</chakra.span><chakra.strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":organization?"Member":"—"}</chakra.strong><chakra.small><ShieldCheck size={12}/> Verified by Infinite Flight</chakra.small></chakra.article><chakra.article className="stat-card"><chakra.span>Last refreshed</chakra.span><chakra.strong className="stat-time">{lastUpdated?lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</chakra.strong><chakra.small>Live API v3</chakra.small></chakra.article></chakra.div>
      <chakra.section className="panel dashboard-panel aircraft-map-panel">
       <chakra.div className="section-heading"><chakra.div><chakra.h2>Live fleet map</chakra.h2><chakra.p>Airborne and ground aircraft, positioned live across your fleet</chakra.p></chakra.div><chakra.button className="button button-quiet" onClick={()=>void fetchFleetData(false)} disabled={positionLoading||aircraft.length===0}><RefreshCw size={13}/>{positionLoading?"Updating…":"Refresh positions"}</chakra.button></chakra.div>
       {positionError&&<ToastNotice message={positionError} onDismiss={()=>setPositionError("")}/>}
       {aircraft.length===0?<chakra.div className="empty-state">No aircraft are attached to this organization.</chakra.div>:<Suspense fallback={<chakra.div className="aircraft-map-frame aircraft-map-loading">Preparing live map…</chakra.div>}><AircraftLiveMap aircraft={aircraft} positions={positions} dark={darkMap}/></Suspense>}
       <chakra.div className="aircraft-map-footer"><chakra.span>{positionLoading?"Fetching aircraft positions…":positionsUpdated?"Last position refresh "+positionsUpdated.toLocaleTimeString():"Waiting for first position update"}</chakra.span><chakra.span>{positionedCount} / {aircraft.length} positions available</chakra.span></chakra.div>
      </chakra.section>
      <chakra.section className="panel dashboard-panel pilot-data-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Upcoming schedules</chakra.h2><chakra.p>Published by your organisation in Infinite Flight Live</chakra.p></chakra.div><Link className="top-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}>View all <ChevronRight size={13}/></Link></chakra.div>{loading?<chakra.div className="empty-state">Loading Live data…</chakra.div>:schedules.length===0?<chakra.div className="empty-state">No published schedules were returned.</chakra.div>:<chakra.div className="data-list">{schedules.slice(0,6).map((item:any,i:number)=><chakra.article className="data-row" key={item.id||i}><chakra.div><chakra.strong>{(item.originIcao||"—")+" → "+(item.destinationIcao||"—")}</chakra.strong><chakra.small>{[item.callsign||"Schedule",item.flightPlan||"No flight plan"].join(" · ")}</chakra.small></chakra.div><chakra.div className="admin-action-row"><chakra.span className="row-status">{scheduleStatusLabel(item.status??1)}</chakra.span><chakra.button className="button button-primary" disabled={requestBusy===item.id} onClick={()=>setSelectedSeatSchedule(item)}>Request this leg</chakra.button></chakra.div></chakra.article>)}</chakra.div>}</chakra.section>
      <chakra.section className="pilot-quick-access" aria-label="Quick access">
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/schedules":"/pilot/"+organizationId+"/schedules"}><chakra.span><CalendarDays size={16}/></chakra.span><chakra.span><chakra.strong>Browse schedules</chakra.strong><chakra.small>Find your next available leg</chakra.small></chakra.span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/fleet":"/pilot/"+organizationId+"/fleet"}><chakra.span><Plane size={16}/></chakra.span><chakra.span><chakra.strong>Explore fleet</chakra.strong><chakra.small>View your airline aircraft</chakra.small></chakra.span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/bookings":"/pilot/"+organizationId+"/bookings"}><chakra.span><ShieldCheck size={16}/></chakra.span><chakra.span><chakra.strong>My bookings</chakra.strong><chakra.small>Track your leg requests</chakra.small></chakra.span></Link>
       <Link className="pilot-quick-link" to={slug?"/"+slug+"/pilot/"+pilotId+"/members":"/pilot/"+organizationId+"/members"}><chakra.span><Users size={16}/></chakra.span><chakra.span><chakra.strong>Meet the crew</chakra.strong><chakra.small>See your Live organisation</chakra.small></chakra.span></Link>
      </chakra.section>
    </> : page==="members" ? <chakra.section className="panel dashboard-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Organization crew</chakra.h2><chakra.p>Current Live members and their active lift counts.</chakra.p></chakra.div></chakra.div>{membersError&&<ToastNotice message={membersError} onDismiss={()=>setMembersError("")}/>}{membersLoading?<chakra.div className="empty-state">Loading current Infinite Flight crew…</chakra.div>:members.length===0?<chakra.div className="empty-state">No member data is available.</chakra.div>:<chakra.div className="data-list">{members.map((m:any)=><chakra.article className="data-row" key={m.userId}><chakra.div><chakra.strong>{m.username||"Infinite Flight pilot"}</chakra.strong><chakra.small>{m.role===2?"Owner":m.role===1?"Admin":"Member"} · Joined {m.joinedAt?new Date(m.joinedAt).toLocaleDateString():"—"}</chakra.small></chakra.div><chakra.span className="row-status">{m.activeLifts??0} active lifts</chakra.span></chakra.article>)}</chakra.div>}</chakra.section> : page==="bookings" ? <chakra.section className="panel dashboard-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Your leg requests</chakra.h2><chakra.p>Requests and Live crew assignment status for this organization.</chakra.p></chakra.div></chakra.div>{bookings.length===0?<chakra.div className="empty-state">You have not requested any legs yet.</chakra.div>:<chakra.div className="data-list">{bookings.map((b:any)=><chakra.article className="data-row" key={b.id}><chakra.div><chakra.strong>{schedules.find((s:any)=>s.id===b.live_schedule_id)?.callsign||"Flight leg"}</chakra.strong><chakra.small>{b.request_note||"No request note"} · {new Date(b.created_at).toLocaleString()}</chakra.small></chakra.div><chakra.span className="row-status">{b.status.replaceAll("_"," ")}</chakra.span></chakra.article>)}</chakra.div>}</chakra.section> : page==="profile" ? <chakra.section className="panel dashboard-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Live membership</chakra.h2><chakra.p>Your access is verified directly by Infinite Flight</chakra.p></chakra.div><ShieldCheck size={17}/></chakra.div><chakra.div className="profile-detail"><chakra.span>Organisation</chakra.span><chakra.strong>{organization?.name||"—"}</chakra.strong></chakra.div><chakra.div className="profile-detail"><chakra.span>Infinite Flight role</chakra.span><chakra.strong>{organization?.role===2?"Owner":organization?.role===1?"Admin":"Member"}</chakra.strong></chakra.div><chakra.div className="profile-detail"><chakra.span>Access type</chakra.span><chakra.strong>Personal OAuth · Encrypted server-side</chakra.strong></chakra.div><chakra.div className="profile-detail"><chakra.span>Data source</chakra.span><chakra.strong>Infinite Flight Public API v3</chakra.strong></chakra.div></chakra.section>
    : page==="fleet" ? <chakra.section className="panel dashboard-panel"><chakra.div className="section-heading"><chakra.div><chakra.h2>Aircraft fleet</chakra.h2><chakra.p>Every active organization aircraft · images shown only in the fleet view</chakra.p></chakra.div><chakra.span className="fleet-total">{aircraft.length} AIRCRAFT</chakra.span></chakra.div>{loading?<chakra.div className="empty-state">Loading fleet…</chakra.div>:aircraft.length===0?<chakra.div className="empty-state">No active aircraft were returned by Infinite Flight.</chakra.div>:<chakra.div className="fleet-aircraft-grid">{aircraft.map(item=><FleetAircraftCard key={item.id} aircraft={item}/>)}</chakra.div>}</chakra.section>
    : page==="schedules" ? <>
      <chakra.section className="panel dashboard-panel pilot-schedules-map-panel">
       <chakra.div className="section-heading"><chakra.div><chakra.div className="eyebrow">LIVE FLEET TRACKING</chakra.div><chakra.h2>Aircraft map</chakra.h2><chakra.p>Tap any aircraft on the map or in the roster to open its live flight details.</chakra.p></chakra.div><chakra.span className="fleet-total">{Object.keys(positions).length} TRACKED</chakra.span></chakra.div>
       {positionError&&<chakra.div className="notice">{positionError}</chakra.div>}
       {aircraft.length===0?<chakra.div className="empty-state">No aircraft are attached to this organisation.</chakra.div>:<Suspense fallback={<chakra.div className="aircraft-map-frame aircraft-map-loading">Preparing live map…</chakra.div>}><AircraftLiveMap aircraft={aircraft} positions={positions} dark={darkMap} onAircraftSelect={openAircraftDetails}/></Suspense>}
       <chakra.div className="aircraft-map-footer"><chakra.span>{positionLoading?"Fetching aircraft positions…":positionsUpdated?"Last position refresh "+positionsUpdated.toLocaleTimeString():"Waiting for first position update"}</chakra.span><chakra.span>{Object.keys(positions).length} / {aircraft.length} positions available</chakra.span></chakra.div>
      </chakra.section>
      <chakra.section className="panel dashboard-panel pilot-booking-board pilot-schedules-board">
       <chakra.div className="section-heading"><chakra.div><chakra.div className="eyebrow">FLIGHT OPERATIONS</chakra.div><chakra.h2>Published schedules</chakra.h2><chakra.p>Choose an aircraft, review its legs and request your preferred crew seat.</chakra.p></chakra.div><chakra.span className="fleet-total">{schedules.length} LEGS</chakra.span></chakra.div>
       <chakra.div className="pilot-schedule-toolbar">
        <chakra.label className="pilot-schedule-sort"><chakra.span>Sort</chakra.span><chakra.select className="text-field" value={scheduleSort} onChange={e=>setScheduleSort(e.target.value)}><chakra.option value="ready">Ready to fly</chakra.option><chakra.option value="route">Route</chakra.option><chakra.option value="flight">Flight number</chakra.option><chakra.option value="departure">Departure time</chakra.option></chakra.select></chakra.label>
        <chakra.button type="button" className="button button-quiet" onClick={()=>setCollapsedAircraftIds(collapsedAircraftIds.length?[]:aircraft.map(item=>item.id))}>{collapsedAircraftIds.length?"Expand all":"Collapse all"}</chakra.button>
       </chakra.div>
       {loading?<chakra.div className="empty-state">Loading published schedules…</chakra.div>:aircraft.length===0?<chakra.div className="empty-state">No aircraft are attached to this organisation.</chakra.div>:<chakra.div className="pilot-schedule-aircraft-list">
        {aircraft.map((plane:any)=>{
          const planeSchedules=schedules.filter(item=>item.aircraftId===plane.id).slice().sort((a:any,b:any)=>{
            if(scheduleSort==="route")return String(a.originIcao||"").localeCompare(String(b.originIcao||""));
            if(scheduleSort==="flight")return String(a.callsign||"").localeCompare(String(b.callsign||""));
            if(scheduleSort==="departure")return (a.scheduledDepartureUtc?Date.parse(a.scheduledDepartureUtc):Infinity)-(b.scheduledDepartureUtc?Date.parse(b.scheduledDepartureUtc):Infinity);
            const rank=(x:any)=>x.status===1||x.status===8?0:x.status===2||x.status===3?1:x.status===9?3:2;
            return rank(a)-rank(b)||(a.sequence??0)-(b.sequence??0);
          });
          const position=positions[plane.id];
          const state=aircraftPositionLabel(position);
          const isCollapsed=collapsedAircraftIds.includes(plane.id);
          return <chakra.article className={"pilot-schedule-aircraft "+(isCollapsed?"is-collapsed":"")} key={plane.id}>
            <chakra.button type="button" className="pilot-schedule-aircraft-heading" onClick={()=>setCollapsedAircraftIds(current=>current.includes(plane.id)?current.filter(id=>id!==plane.id):[...current,plane.id])} aria-expanded={!isCollapsed}>
              <ChevronDown size={17}/><chakra.span className={"aircraft-status-dot "+(position?.isOnGround?"tone-ground":position?"tone-air":"tone-muted")}/><chakra.strong>{plane.registration||"Aircraft"}</chakra.strong><chakra.small>{plane.name||plane.aircraftName||"Aircraft"}</chakra.small><chakra.span className="pilot-schedule-aircraft-status">{state}</chakra.span><chakra.span className="pilot-schedule-aircraft-count">{planeSchedules.length} legs · <chakra.b>{planeSchedules.length} open</chakra.b></chakra.span>
            </chakra.button>
            {!isCollapsed&&<chakra.div className="pilot-schedule-leg-list">
              {planeSchedules.length===0?<chakra.div className="empty-state">No published legs for this aircraft.</chakra.div>:planeSchedules.map((item:any)=>{
                const departure=item.isTimeless?"Anytime":item.scheduledDepartureUtc?new Date(item.scheduledDepartureUtc).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"—";
                const arrival=item.isTimeless?"—":item.scheduledArrivalUtc?new Date(item.scheduledArrivalUtc).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—";
                const status=scheduleStatusLabel(item.status??1);
                return <chakra.article className="pilot-schedule-leg" key={item.id}>
                  <chakra.div className="pilot-schedule-leg-top"><chakra.strong>{item.callsign||"Scheduled flight"}</chakra.strong><chakra.span className={"row-status "+(item.status===9?"tone-muted":"")}>{status}</chakra.span></chakra.div>
                  <chakra.span className="pilot-schedule-leg-kind">Passenger flight</chakra.span>
                  <chakra.div className="pilot-schedule-route"><chakra.div><chakra.strong>{item.originIcao||"—"}</chakra.strong><chakra.small>{item.originName||item.originCity||""}</chakra.small></chakra.div><chakra.span className="pilot-schedule-route-line"/><chakra.div><chakra.strong>{item.destinationIcao||"—"}</chakra.strong><chakra.small>{item.destinationName||item.destinationCity||""}</chakra.small></chakra.div></chakra.div>
                  <chakra.div className="pilot-schedule-availability">Open · Captain &amp; First Officer seats</chakra.div>
                  <chakra.div className="pilot-schedule-times"><chakra.div><chakra.span>Date</chakra.span><chakra.strong>{departure}</chakra.strong></chakra.div><chakra.div><chakra.span>Departs</chakra.span><chakra.strong>{item.isTimeless?"—":item.scheduledDepartureUtc?new Date(item.scheduledDepartureUtc).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}</chakra.strong></chakra.div><chakra.div><chakra.span>Arrives</chakra.span><chakra.strong>{arrival}</chakra.strong></chakra.div><chakra.div><chakra.span>Block</chakra.span><chakra.strong>{item.blockTime||item.estimatedBlockTime||"—"}</chakra.strong></chakra.div></chakra.div>
                  <chakra.button className="button button-primary pilot-schedule-request" disabled={requestBusy===item.id||item.status===9} onClick={()=>setSelectedSeatSchedule(item)}>{requestBusy===item.id?"Requesting…":"Request this leg"}</chakra.button>
                </chakra.article>;
              })}
            </chakra.div>}
          </chakra.article>;
        })}
       </chakra.div>}
       {schedulePagination.page<schedulePagination.totalPages&&<chakra.div className="schedule-pagination"><chakra.span>Showing {schedules.length.toLocaleString()} of {schedulePagination.totalCount.toLocaleString()} scheduled legs</chakra.span><chakra.button className="button button-quiet" onClick={()=>void loadMoreSchedules()} disabled={scheduleLoadingMore}>{scheduleLoadingMore?"Loading…":"Load more schedules"}</chakra.button></chakra.div>}
      </chakra.section>
      {selectedMapAircraft&&<chakra.div className="aircraft-detail-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedMapAircraft(null)}}>
       <chakra.section className="aircraft-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="aircraft-detail-title">
        <chakra.div className="aircraft-detail-grabber"/><chakra.div className="aircraft-detail-header"><chakra.span>Aircraft</chakra.span><chakra.button type="button" aria-label="Close aircraft details" onClick={()=>setSelectedMapAircraft(null)}><chakra.span>×</chakra.span></chakra.button></chakra.div>
        <chakra.div className="aircraft-detail-content">
         <chakra.div className="aircraft-detail-identity"><chakra.div><chakra.h2 id="aircraft-detail-title">{selectedMapAircraft.aircraft.registration||"Aircraft"}</chakra.h2><chakra.span className="aircraft-detail-type">{selectedMapAircraft.aircraft.name||selectedMapAircraft.aircraft.aircraftName||"Infinite Flight aircraft"} · {selectedMapAircraft.aircraft.fleetRank?"Fleet #"+selectedMapAircraft.aircraft.fleetRank:"Fleet aircraft"}</chakra.span></chakra.div><chakra.span className={"aircraft-detail-live "+(selectedMapAircraft.position.isOnGround||selectedMapAircraft.position.state===4||selectedMapAircraft.position.state===5?"is-ground":"") }><chakra.i/>{aircraftPositionLabel(selectedMapAircraft.position)}</chakra.span></chakra.div>
         <chakra.img className="aircraft-detail-photo" src={"/aircrafts/"+encodeURIComponent(String(selectedMapAircraft.aircraft.registration||""))+"/aircraft.png"} alt={(selectedMapAircraft.aircraft.registration||"Aircraft")+" aircraft"} onError={e=>{e.currentTarget.style.display="none"}}/>
         <chakra.div className="aircraft-detail-flight">
          <chakra.div className="aircraft-detail-flight-top"><chakra.span>{selectedMapAircraft.position.isOnGround?"On the ground":"In the air now"} · Live position</chakra.span><chakra.strong>{selectedMapAircraft.position.lastPilotUsername||"Pilot unknown"}</chakra.strong></chakra.div>
          <chakra.div className="aircraft-detail-route"><chakra.div><chakra.strong>{airportCode(selectedMapFlight?.departureAirport||selectedMapFlight?.originIcao||selectedMapFlight?.departureAirportIcao)}</chakra.strong><chakra.small>Departure</chakra.small></chakra.div><chakra.div><chakra.strong>{airportCode(selectedMapFlight?.arrivalAirport||selectedMapFlight?.destinationIcao||selectedMapFlight?.arrivalAirportIcao)}</chakra.strong><chakra.small>Arrival</chakra.small></chakra.div></chakra.div>
          <chakra.div className="aircraft-detail-flight-meta"><chakra.span>{selectedMapFlight?.departureTime?"Departed "+new Date(selectedMapFlight.departureTime).toLocaleTimeString():"Position updated"} <chakra.b>{selectedMapAircraft.position.updatedAt?new Date(selectedMapAircraft.position.updatedAt).toLocaleTimeString():"Unknown"}</chakra.b></chakra.span><chakra.span>Heading <chakra.b>{Math.round(selectedMapAircraft.position.heading||0)}°</chakra.b></chakra.span></chakra.div>
         </chakra.div>
         <chakra.div className="aircraft-detail-stats">
          <chakra.div><chakra.span>Altitude</chakra.span><chakra.strong>{Math.round(selectedMapAircraft.position.altitude||0).toLocaleString()} ft</chakra.strong></chakra.div>
          <chakra.div><chakra.span>Ground speed</chakra.span><chakra.strong>{Math.round(selectedMapAircraft.position.speed||0)} kt</chakra.strong></chakra.div>
          <chakra.div><chakra.span>Vertical</chakra.span><chakra.strong>{(selectedMapAircraft.position.verticalSpeed||0)>=0?"Climbing ":"Descending "}{Math.abs(Math.round(selectedMapAircraft.position.verticalSpeed||0)).toLocaleString()} fpm</chakra.strong></chakra.div>
          <chakra.div><chakra.span>Heading</chakra.span><chakra.strong>{Math.round(selectedMapAircraft.position.heading||0)}°</chakra.strong></chakra.div>
          <chakra.div><chakra.span>Flown by</chakra.span><chakra.strong>{selectedMapAircraft.position.lastPilotUsername||"Unknown"}</chakra.strong></chakra.div>
          <chakra.div><chakra.span>Last update</chakra.span><chakra.strong>{selectedMapAircraft.position.updatedAt?new Date(selectedMapAircraft.position.updatedAt).toLocaleString():"Unknown"}</chakra.strong></chakra.div>
         </chakra.div>
        </chakra.div>
       </chakra.section>
      </chakra.div>}
      </> : null}
    {scheduleLoadError&&<ToastNotice message={scheduleLoadError} onDismiss={()=>setScheduleLoadError("")}/>}
    {selectedSeatSchedule&&<chakra.div className="seat-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedSeatSchedule(null)}}><chakra.section className="seat-modal" role="dialog" aria-modal="true" aria-labelledby="seat-modal-title"><chakra.div className="eyebrow">CREW REQUEST</chakra.div><chakra.h2 id="seat-modal-title">Choose your seat</chakra.h2><chakra.p>{selectedSeatSchedule.callsign||"Flight"} · {selectedSeatSchedule.originIcao||"—"} → {selectedSeatSchedule.destinationIcao||"—"}</chakra.p><chakra.div className="seat-choice-grid"><chakra.button type="button" className={seatChoice===0?"is-selected":""} onClick={()=>setSeatChoice(0)}><chakra.strong>Captain</chakra.strong><chakra.small>Captain seat</chakra.small></chakra.button><chakra.button type="button" className={seatChoice===1?"is-selected":""} onClick={()=>setSeatChoice(1)}><chakra.strong>First Officer</chakra.strong><chakra.small>First Officer seat</chakra.small></chakra.button></chakra.div><chakra.div className="seat-modal-actions"><chakra.button className="button button-quiet" onClick={()=>setSelectedSeatSchedule(null)}>Cancel</chakra.button><chakra.button className="button button-primary" disabled={!!requestBusy} onClick={()=>{const chosen=selectedSeatSchedule;setSelectedSeatSchedule(null);void requestLeg(chosen,seatChoice)}}>Confirm request</chakra.button></chakra.div></chakra.section></chakra.div>}<chakra.div className="hero-footnote">Your booking requests follow the organization approval policy. Infinite Flight Live remains the source of truth.</chakra.div>
   </chakra.section>
  </chakra.div><Footer/></chakra.main>;
}
function NotFound(){return <chakra.main className="shell narrow"><Header/><chakra.section className="panel not-found-panel"><chakra.div className="eyebrow">404 · ROUTE NOT FOUND</chakra.div><chakra.h1>This flight plan ends here.</chakra.h1><chakra.p>The page may have moved, or the address may be incomplete. Choose a destination below to continue.</chakra.p><chakra.div className="not-found-actions"><Link className="button button-primary" to="/">Back to VEYRO</Link><Link className="button button-quiet" to="/docs">Documentation</Link><Link className="button button-quiet" to="/login">Sign in</Link></chakra.div></chakra.section><Footer/></chakra.main>}
function RouteMetadata(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const parts=pathname.split("/").filter(Boolean);
  const slug=parts[0]||"";
  let title="VEYRO Live — Virtual Airline Operations";
  if(slug==="docs")title=(parts[1]?parts[1].replace(/-/g," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())+" · ":"")+"Documentation | VEYRO Live";
  else if(slug==="login")title="Connect Infinite Flight | VEYRO Live";
  else if(slug==="account")title="My Veyro | VEYRO Live";
  else if(slug==="apply")title="Create an Organisation Portal | VEYRO Live";
  else if(slug==="application-status")title="Application Status | VEYRO Live";
  else if(parts[1]==="admin")title="Organisation Admin | VEYRO Live";
  else if(parts[1]==="pilot-sign-in")title="Pilot Sign In | VEYRO Live";
  else if(parts[1]==="pilot")title="Pilot Workspace | VEYRO Live";
  else if(slug)title=slug.replace(/-/g," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())+" | VEYRO Live";
  document.title=title;
  const description=document.querySelector('meta[name="description"]');
  if(description)description.setAttribute("content","VEYRO Live connects Infinite Flight virtual airlines with public organisation portals, pilot workspaces, fleet information and documentation.");
 },[pathname]);
 return null;
}
export default function App(){return <><RouteMetadata/><Routes><Route path="/" element={<Landing/>}/><Route path="/docs/*" element={<DocsPage/>}/><Route path="/login" element={<Login/>}/><Route path="/account" element={<MyVeyro/>}/><Route path="/org/:slug/*" element={<Organization/>}/><Route path="/pilot/:organizationId/*" element={<PilotDashboard/>}/><Route path="/:slug/admin/*" element={<AdminPortal/>}/><Route path="/:slug/pilot-sign-in" element={<PilotSignIn/>}/><Route path="/:slug/pilot/:pilotId/*" element={<PilotDashboard/>}/><Route path="/apply" element={<OrganizationApplicationPage/>}/><Route path="/application-status/:trackingCode" element={<ApplicationStatusPage/>}/><Route path="/:slug" element={<PublicOrganizationPage/>}/><Route path="*" element={<NotFound/>}/></Routes></>}