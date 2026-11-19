import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Clock3, ExternalLink, FileText, ImagePlus, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { invokeFunction } from "../lib/functions";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";

type LiveOrg = { id: string; name: string; role: number; alreadyConnected: boolean };
type PublicOrg = { id: string; slug: string; display_name: string; logo_url: string | null; tagline: string | null; description: string | null; website_url: string | null; discord_invite_url: string | null };

let oauthStartRequest: Promise<any> | null = null;
function prepareInfiniteFlightOAuth() {
  if (!supabase) return Promise.resolve({ data: null, error: new Error("Supabase is not configured.") });
  if (!oauthStartRequest) oauthStartRequest = invokeFunction(supabase,"if-oauth-start", { body: { returnTo: "/apply" } }).then((result) => { if (result.error) oauthStartRequest = null; return result; });
  return oauthStartRequest;
}

const slugify = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
let publicDirectoryCache: { organizations: PublicOrg[]; expiresAt: number } | null = null;
let publicDirectoryRequest: Promise<PublicOrg[]> | null = null;
async function getPublicDirectory(force = false): Promise<PublicOrg[]> {
  if (!supabase) return [];
  if (!force && publicDirectoryCache && publicDirectoryCache.expiresAt > Date.now()) return publicDirectoryCache.organizations;
  if (!force && publicDirectoryRequest) return publicDirectoryRequest;
  publicDirectoryRequest = invokeFunction(supabase,"organization-application", { body: { action: "directory" } })
    .then(({ data, error }) => { if (error) throw error; const organizations = (data?.organizations ?? []) as PublicOrg[]; publicDirectoryCache = { organizations, expiresAt: Date.now() + 60_000 }; return organizations; })
    .finally(() => { publicDirectoryRequest = null; });
  return publicDirectoryRequest;
}

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Could not read the logo file."));
  reader.readAsDataURL(file);
});

export function OrganizationDirectory() {
  const [organizations, setOrganizations] = useState<PublicOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const filteredOrganizations = useMemo(() => organizations.filter((org) => [org.display_name, org.tagline, org.description].some((value) => String(value || "").toLowerCase().includes(query.trim().toLowerCase()))), [organizations, query]);
  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    getPublicDirectory().then((organizations) => { if (active) setOrganizations(organizations); }).catch(() => { if (active) setOrganizations([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <section className="directory-section">
    <div className="directory-heading"><div><div className="eyebrow">THE VEYRO NETWORK</div><h2>Explore virtual airlines</h2><p>Public portals from organisations connected to Infinite Flight Live.</p></div><Link className="button button-quiet" to="/apply">Apply for a portal <ArrowUpRight size={14}/></Link></div>
    {!loading && organizations.length > 0 && <div className="directory-tools"><label className="directory-search"><span className="sr-only">Search organisations</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search airlines and organisations…"/><span>{filteredOrganizations.length} of {organizations.length}</span></label></div>}
    {loading ? <div className="directory-empty" role="status" aria-live="polite">Loading registered organisations…</div> : organizations.length === 0 ? <div className="directory-empty">The directory is getting ready. Approved organisation portals will appear here.</div> :
      filteredOrganizations.length === 0 ? <div className="directory-empty" role="status">No organisations match “{query}”. Try another name.</div> :
      <div className="org-directory-grid" aria-live="polite">{filteredOrganizations.map((org) => <Link className="org-directory-card" key={org.id} to={"/" + org.slug}>
        <div className="org-directory-logo">{org.logo_url ? <img src={org.logo_url} alt={org.display_name + " logo"}/> : <span aria-hidden="true">{org.display_name.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="org-directory-copy"><strong>{org.display_name}</strong><span>{org.tagline || "Infinite Flight Live organisation"}</span><small>Open portal <ArrowUpRight size={12}/></small></div>
      </Link>)}</div>}
  </section>;
}

export function OrganizationApplicationPage() {
  const [params] = useSearchParams();
  const pendingId = params.get("pending") || undefined;
  const preselected = params.get("org") || "";
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [organizations, setOrganizations] = useState<LiveOrg[]>([]);
  const [selected, setSelected] = useState(preselected);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [connectingIF, setConnectingIF] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [requestedSlug, setRequestedSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [discordInviteUrl, setDiscordInviteUrl] = useState("");

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); }).finally(() => { if (active) setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (session && !pendingId) void prepareInfiniteFlightOAuth(); }, [session, pendingId]);

  useEffect(() => {
    if (!session || !supabase) return;
    let active = true;
    setLoadingOrgs(true);
    invokeFunction(supabase,"organization-application", { body: { action: "eligible-organizations", pendingId } })
      .then(({ data, error: invokeError }) => {
        if (!active) return;
        if (invokeError) throw invokeError;
        const list = (data?.organizations ?? []) as LiveOrg[];
        setOrganizations(list);
        if (preselected && list.some((o) => o.id === preselected)) setSelected(preselected);
        else if (list.length === 1) setSelected(list[0].id);
      })
      .catch((e) => setError(e.message || "Could not load your Infinite Flight organisations."))
      .finally(() => { if (active) setLoadingOrgs(false); });
    return () => { active = false; };
  }, [session, pendingId, preselected]);

  const chosen = useMemo(() => organizations.find((o) => o.id === selected), [organizations, selected]);

  const connectInfiniteFlight = async () => {
    if (!supabase) return;
    setConnectingIF(true); setError("");
    try {
      const { data, error: invokeError } = await prepareInfiniteFlightOAuth();
      if (invokeError) throw invokeError;
      if (!data?.authorizationUrl) throw new Error(data?.error || "Could not start Infinite Flight authorization.");
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Infinite Flight.");
      setConnectingIF(false);
    }
  };
  useEffect(() => {
    if (!chosen) return;
    setDisplayName(chosen.name);
    setRequestedSlug(slugify(chosen.name));
  }, [chosen?.id]);

  const chooseLogo = async (file?: File) => {
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Choose a PNG, JPG or WebP logo smaller than 2 MB.");
      return;
    }
    setLogo(file);
    setLogoPreview(await readFile(file));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !chosen) return;
    setBusy(true); setError("");
    try {
      const { data, error: invokeError } = await invokeFunction(supabase,"organization-application", { body: {
        action: "submit", pendingId, liveOrganizationId: chosen.id, displayName, requestedSlug,
        tagline, description, websiteUrl, discordInviteUrl, logoDataUrl: logoPreview || undefined,
      } });
      if (invokeError) throw invokeError;
      if (!data?.trackingCode) throw new Error(data?.error || "The application could not be submitted.");
      setTrackingCode(data.trackingCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The application could not be submitted.");
    } finally { setBusy(false); }
  };

  return <main className="shell"><header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><div className="top-actions"><ThemeToggle/></div></header>
    <section className="application-intro"><div className="eyebrow">ORGANISATION ONBOARDING</div><h1>Bring your airline<br/><span>into the Veyro network.</span></h1><p>Submit your organisation for review. Once approved, your public portal will be created and listed on the VEYRO homepage.</p></section>
    {trackingCode ? <section className="panel application-success"><CheckCircle2 size={28}/><h2>Application submitted</h2><p>Your application has been sent to the VEYRO review team in Discord. Save this tracking code to follow its progress.</p><div className="tracking-code">{trackingCode}</div><Link className="button button-primary full" to={"/application-status/" + trackingCode}>Track application <ArrowUpRight size={15}/></Link></section>
    : authLoading ? <section className="panel"><p>Checking your VEYRO sign-in…</p></section>
    : !session ? <section className="panel application-panel"><ShieldCheck size={24}/><h2>Sign in before applying</h2><p>We verify your Infinite Flight organisation role after you sign in. Only Owners and Admins can submit a portal application.</p><Link className="button button-primary full" to={"/login?next=" + encodeURIComponent("/apply")}>Sign in to continue <ArrowUpRight size={15}/></Link></section>
    : !pendingId ? <section className="panel application-panel"><ShieldCheck size={24}/><h2>Connect Infinite Flight</h2><p>Your email sign-in is complete. Now connect the Infinite Flight account that owns or administers the organisation. We will return you here automatically and load your eligible organisations.</p>{error && <div className="notice error">{error}</div>}<button className="button button-primary full" type="button" onClick={connectInfiniteFlight} disabled={connectingIF}>{connectingIF ? "Redirecting to Infinite Flight…" : "Connect Infinite Flight"} <ArrowUpRight size={15}/></button></section>
    : <form className="panel application-panel" onSubmit={submit}>
      <div className="application-step"><span>01</span><div><h2>Verify your organisation</h2><p>Choose an organisation where your Infinite Flight role is Owner or Admin.</p></div></div>
      {loadingOrgs ? <div className="directory-empty">Loading your Live organisations…</div> : organizations.length === 0 ? <div className="notice">No eligible Owner/Admin organisations were returned. Check that you authorized the correct Infinite Flight account and granted organisation access, then reconnect.</div> : <><label className="field-label">Infinite Flight organisation</label><select className="text-field" required value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select an organisation</option>{organizations.map((org) => <option key={org.id} value={org.id} disabled={org.alreadyConnected}>{org.name} · {org.role === 2 ? "Owner" : "Admin"}{org.alreadyConnected ? " · Already connected/applied" : ""}</option>)}</select></>}
      {chosen && <div className="notice success">Verified from Infinite Flight Live: {chosen.role === 2 ? "Owner" : "Admin"} access for {chosen.name}. Portal creation still requires VEYRO approval.</div>}
      <div className="application-step"><span>02</span><div><h2>Public portal details</h2><p>This information will appear on your organisation's public VEYRO page.</p></div></div>
      <label className="field-label">Portal display name *</label><input className="text-field" required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)}/>
      <label className="field-label">Preferred portal URL *</label><div className="slug-field"><span>veyro.live/</span><input className="text-field" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={requestedSlug} onChange={(e) => setRequestedSlug(slugify(e.target.value))}/></div>
      <label className="field-label">Tagline *</label><input className="text-field" required minLength={8} maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short introduction to your airline"/>
      <label className="field-label">About your organisation *</label><textarea className="text-field application-textarea" required minLength={40} maxLength={1200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell pilots about your airline, its operations and what makes it different."/>
      <div className="application-two-col"><div><label className="field-label">Official website</label><input className="text-field" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com"/></div><div><label className="field-label">Discord invite</label><input className="text-field" type="url" value={discordInviteUrl} onChange={(e) => setDiscordInviteUrl(e.target.value)} placeholder="https://discord.gg/…"/></div></div>
      <div className="application-step"><span>03</span><div><h2>Organisation branding</h2><p>Upload the logo to display in the directory and your portal.</p></div></div>
      <label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void chooseLogo(e.target.files?.[0])}/>{logoPreview ? <img src={logoPreview} alt="Logo preview"/> : <ImagePlus size={24}/>}<span><strong>{logo?.name || "Upload organisation logo"}</strong><small>PNG, JPG or WebP · Maximum 2 MB</small></span></label>
      <div className="notice">Your Infinite Flight organisation name and role are verified automatically. Your logo and public information will be published only after approval.</div>
      {error && <><div className="notice error">{error}</div><Link className="button button-quiet full" to="/login">Connect Infinite Flight / return to sign in <ArrowUpRight size={14}/></Link></>}
      <button className="button button-primary full" type="submit" disabled={busy || loadingOrgs || !chosen || chosen.alreadyConnected}>{busy ? "Submitting application…" : "Submit for review"} <ArrowUpRight size={15}/></button>
    </form>}
    <footer className="footer"><span>© {new Date().getFullYear()} VEYRO LIVE</span><span>Organisation applications</span></footer>
  </main>;
}

export function ApplicationStatusPage() {
  const { trackingCode = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase?.functions.invoke("organization-application", { body: { action: "status", trackingCode } })
      .then(({ data: result, error: invokeError }) => { if (invokeError) throw invokeError; if (active) setData(result); })
      .catch((e) => { if (active) setError(e.message || "Could not load application status."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [trackingCode]);
  const app = data?.application;
  return <main className="shell narrow"><header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><div className="top-actions"><ThemeToggle/></div></header>
    <section className="application-intro compact"><div className="eyebrow">APPLICATION TRACKER</div><h1>Application<br/><span>status.</span></h1><p>Updates and notes from the VEYRO review team will appear here.</p></section>
    {loading ? <section className="panel"><p>Loading application…</p></section> : error ? <section className="panel"><div className="notice error">{error}</div><Link className="button button-quiet full" to="/apply">Back to applications</Link></section> : app ? <section className="panel status-panel">
      <div className={"status-pill " + app.status}>{app.status === "pending" ? <Clock3 size={14}/> : <CheckCircle2 size={14}/>} {app.status === "pending" ? "Under review" : app.status === "approved" ? "Approved" : "Not approved"}</div>
      <h2>{app.display_name}</h2><p>{app.live_organization_name} · Submitted {new Date(app.created_at).toLocaleDateString()}</p>
      <div className="status-details"><div><span>Requested portal</span><strong>/{app.requested_slug}</strong></div><div><span>Application status</span><strong>{app.status[0].toUpperCase()+app.status.slice(1)}</strong></div></div>
      {data.portal && <Link className="button button-primary full" to={"/" + data.portal.slug}>Open your new portal <ArrowUpRight size={15}/></Link>}
      <div className="status-notes"><div className="section-heading"><div><h3>Review notes</h3><p>Messages from the VEYRO review team</p></div><FileText size={16}/></div>
        {data.notes?.length ? data.notes.map((note: any) => <article className="review-note" key={note.id}><div><strong>{note.author_display_name}</strong><small>{new Date(note.created_at).toLocaleString()}</small></div><p>{note.note}</p></article>) : <div className="directory-empty">No review notes have been added yet.</div>}
      </div>
    </section> : null}
    <footer className="footer"><span>© {new Date().getFullYear()} VEYRO LIVE</span><span>Private tracking code required</span></footer>
  </main>;
}

export function PublicOrganizationPage() {
  const { slug = "" } = useParams();
  const [org, setOrg] = useState<PublicOrg | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    getPublicDirectory().then((organizations) => { if (active) setOrg(organizations.find((o) => o.slug === slug) ?? null); }).catch(() => { if (active) setOrg(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  return <main className="shell"><header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><div className="top-actions"><ThemeToggle/></div></header>
    {loading ? <div className="directory-empty">Loading organisation portal…</div> : !org ? <section className="panel portal-empty"><h1>Portal not found</h1><p>This organisation is not listed in the public VEYRO directory.</p><Link className="button button-primary" to="/">Explore organisations</Link></section> :
      <section className="public-org-hero"><div className="public-org-brand">{org.logo_url ? <img src={org.logo_url} alt={org.display_name + " logo"}/> : <span>{org.display_name.slice(0,1)}</span>}</div><div className="eyebrow">INFINITE FLIGHT LIVE ORGANISATION</div><h1>{org.display_name}</h1><p className="public-org-tagline">{org.tagline}</p><p className="public-org-description">{org.description}</p><div className="hero-actions">{org.website_url && <a className="button button-quiet" href={org.website_url} target="_blank" rel="noreferrer">Official website <ExternalLink size={14}/></a>}{org.discord_invite_url && <a className="button button-quiet" href={org.discord_invite_url} target="_blank" rel="noreferrer">Join Discord <ExternalLink size={14}/></a>}<Link className="button button-primary" to={"/"+slug+"/pilot-sign-in"}>Join as a pilot <ArrowUpRight size={15}/></Link></div><div className="hero-footnote">Schedules and fleet are provided by Infinite Flight Live. VEYRO is an independent third-party platform.</div></section>}
    <footer className="footer"><span>© {new Date().getFullYear()} VEYRO LIVE</span><span>Organisation portal</span></footer>
  </main>;
}
