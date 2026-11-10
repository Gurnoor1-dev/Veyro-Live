import { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronRight, Moon, Plane, ShieldCheck, Sun, Users, Workflow } from "lucide-react";
import { isSupabaseConfigured } from "./lib/supabase";

function Brand() { return <Link className="brand" to="/"><span className="brand-mark">V</span><span>VEYRO<span className="brand-light"> LIVE</span></span></Link>; }
function PoweredBy() { return <img className="powered-by" src="/powered-by-veyro.svg" alt="Powered by VEYRO" />; }
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <button className="theme-toggle" type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={15}/> : <Moon size={15}/>}</button>;
}
function Landing() {
  return <main className="shell landing">
    <header className="topbar"><Brand/><span className="topbar-note">LIVE OPERATIONS PLATFORM</span><div className="top-actions"><a className="top-link" href="https://infiniteflight.com/account/api-keys" target="_blank" rel="noreferrer">Infinite Flight OAuth <ArrowUpRight size={14}/></a><ThemeToggle/></div></header>
    <section className="hero"><div className="eyebrow"><span className="pulse"/> BUILT FOR INFINITE FLIGHT LIVE</div>
      <h1>Your airline.<br/><span>One connected operation.</span></h1>
      <p className="hero-copy">Fleet, schedules and crew reservations — brought together in one calm, focused workspace for your Virtual Airline.</p>
      <div className="hero-actions"><Link className="button button-primary" to="/login">Connect with Infinite Flight <ChevronRight size={16}/></Link><a className="button button-quiet" href="https://infiniteflight.com/guide/developer-reference/live-api-v3/overview" target="_blank" rel="noreferrer">API documentation <ArrowUpRight size={15}/></a></div>
      <div className="hero-footnote">A shared platform. Separate organization portals. Live remains the schedule source of truth.</div>
    </section>
    <section className="feature-grid">
      <article className="feature"><div className="feature-icon"><Plane size={18}/></div><h3>Fleet, in context</h3><p>See the organization's active fleet and aircraft assignments directly from Live.</p></article>
      <article className="feature"><div className="feature-icon"><CalendarDays size={18}/></div><h3>Published schedules</h3><p>Browse the schedules your administrators publish in Infinite Flight Live.</p></article>
      <article className="feature"><div className="feature-icon"><ShieldCheck size={18}/></div><h3>Approved reservations</h3><p>Request a leg, receive an administrator decision and synchronize approved crew assignments.</p></article>
    </section>
    <footer className="footer"><span>© {new Date().getFullYear()} VEYRO</span><PoweredBy/><span>Independent third-party software</span></footer>
  </main>;
}
function Login() {
  return <main className="shell narrow"><header className="topbar"><Brand/><div className="top-actions"><Link className="top-link" to="/">Back home</Link><ThemeToggle/></div></header><section className="panel login-panel"><div className="feature-icon"><ShieldCheck size={20}/></div><h1>Sign in to VEYRO Live</h1><p>Infinite Flight OAuth sign-in will be enabled after the OAuth client and callback URLs are configured.</p><div className="notice">{isSupabaseConfigured ? "Supabase project configured. OAuth Edge Function setup is still required." : "Add your Supabase URL and public key to .env.local to connect the backend."}</div><button className="button button-primary button-disabled" disabled>Continue with Infinite Flight <ChevronRight size={16}/></button><Link className="muted-link" to="/">Return to VEYRO Live</Link></section><footer className="footer"><span>Secure authentication</span><PoweredBy/></footer></main>;
}
function Organization() {
  const { slug = "" } = useParams();
  return <main className="shell"><header className="topbar"><Brand/><span className="topbar-note">ORGANIZATION PORTAL</span><div className="top-actions"><Link className="top-link" to="/">Exit portal</Link><ThemeToggle/></div></header><section className="panel portal-empty"><div className="feature-icon"><Workflow size={20}/></div><div className="eyebrow">ORGANIZATION WORKSPACE</div><h1>{slug}</h1><p>This portal will load the connected organization's Live fleet and published schedules after authentication and organization membership are verified.</p><div className="portal-links"><span><Users size={16}/> Pilot access</span><span><Plane size={16}/> Live fleet</span><span><CalendarDays size={16}/> Published schedules</span></div><div className="notice">No organization data is being displayed from a stored snapshot. Live data will be fetched through secured Edge Functions.</div></section><footer className="footer"><span>Organization data is isolated</span><PoweredBy/></footer></main>;
}
function NotFound() { return <main className="shell narrow"><header className="topbar"><Brand/></header><section className="panel"><h1>Page not found</h1><Link to="/">Return home</Link></section></main>; }
export default function App() { return <Routes><Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/org/:slug/*" element={<Organization/>}/><Route path="*" element={<NotFound/>}/></Routes>; }
