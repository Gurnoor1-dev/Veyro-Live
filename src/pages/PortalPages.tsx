import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Clock3, ExternalLink, FileText, ImagePlus, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { invokeFunction } from "../lib/functions";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";
import { chakra } from "@chakra-ui/react";

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
  return <chakra.section className="directory-section">
    <chakra.div className="directory-heading"><chakra.div><chakra.div className="eyebrow">THE VEYRO NETWORK</chakra.div><chakra.h2>Explore virtual airlines</chakra.h2><chakra.p>Public portals from organisations connected to Infinite Flight Live.</chakra.p></chakra.div><Link className="button button-quiet" to="/apply">Apply for a portal <ArrowUpRight size={14}/></Link></chakra.div>
    {!loading && organizations.length > 0 && <chakra.div className="directory-tools"><chakra.label className="directory-search"><chakra.span className="sr-only">Search organisations</chakra.span><chakra.input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search airlines and organisations…"/><chakra.span>{filteredOrganizations.length} of {organizations.length}</chakra.span></chakra.label></chakra.div>}
    {loading ? <chakra.div className="directory-empty" role="status" aria-live="polite">Loading registered organisations…</chakra.div> : organizations.length === 0 ? <chakra.div className="directory-empty">The directory is getting ready. Approved organisation portals will appear here.</chakra.div> :
      filteredOrganizations.length === 0 ? <chakra.div className="directory-empty" role="status">No organisations match “{query}”. Try another name.</chakra.div> :
      <chakra.div className="org-directory-grid" aria-live="polite">{filteredOrganizations.map((org) => <Link className="org-directory-card" key={org.id} to={"/" + org.slug}>
        <chakra.div className="org-directory-logo">{org.logo_url ? <chakra.img src={org.logo_url} alt={org.display_name + " logo"}/> : <chakra.span aria-hidden="true">{org.display_name.slice(0, 1).toUpperCase()}</chakra.span>}</chakra.div>
        <chakra.div className="org-directory-copy"><chakra.strong>{org.display_name}</chakra.strong><chakra.span>{org.tagline || "Infinite Flight Live organisation"}</chakra.span><chakra.small>Open portal <ArrowUpRight size={12}/></chakra.small></chakra.div>
      </Link>)}</chakra.div>}
  </chakra.section>;
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

  return <chakra.main className="shell"><chakra.header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><chakra.div className="top-actions"><ThemeToggle/></chakra.div></chakra.header>
    <chakra.section className="application-intro"><chakra.div className="eyebrow">ORGANISATION ONBOARDING</chakra.div><chakra.h1>Bring your airline<chakra.br/><chakra.span>into the Veyro network.</chakra.span></chakra.h1><chakra.p>Submit your organisation for review. Once approved, your public portal will be created and listed on the VEYRO homepage.</chakra.p></chakra.section>
    {trackingCode ? <chakra.section className="panel application-success"><CheckCircle2 size={28}/><chakra.h2>Application submitted</chakra.h2><chakra.p>Your application has been sent to the VEYRO review team in Discord. Save this tracking code to follow its progress.</chakra.p><chakra.div className="tracking-code">{trackingCode}</chakra.div><Link className="button button-primary full" to={"/application-status/" + trackingCode}>Track application <ArrowUpRight size={15}/></Link></chakra.section>
    : authLoading ? <chakra.section className="panel"><chakra.p>Checking your VEYRO sign-in…</chakra.p></chakra.section>
    : !session ? <chakra.section className="panel application-panel"><ShieldCheck size={24}/><chakra.h2>Sign in before applying</chakra.h2><chakra.p>We verify your Infinite Flight organisation role after you sign in. Only Owners and Admins can submit a portal application.</chakra.p><Link className="button button-primary full" to={"/login?next=" + encodeURIComponent("/apply")}>Sign in to continue <ArrowUpRight size={15}/></Link></chakra.section>
    : !pendingId ? <chakra.section className="panel application-panel"><ShieldCheck size={24}/><chakra.h2>Connect Infinite Flight</chakra.h2><chakra.p>Your email sign-in is complete. Now connect the Infinite Flight account that owns or administers the organisation. We will return you here automatically and load your eligible organisations.</chakra.p>{error && <chakra.div className="notice error">{error}</chakra.div>}<chakra.button className="button button-primary full" type="button" onClick={connectInfiniteFlight} disabled={connectingIF}>{connectingIF ? "Redirecting to Infinite Flight…" : "Connect Infinite Flight"} <ArrowUpRight size={15}/></chakra.button></chakra.section>
    : <chakra.form className="panel application-panel" onSubmit={submit}>
      <chakra.div className="application-step"><chakra.span>01</chakra.span><chakra.div><chakra.h2>Verify your organisation</chakra.h2><chakra.p>Choose an organisation where your Infinite Flight role is Owner or Admin.</chakra.p></chakra.div></chakra.div>
      {loadingOrgs ? <chakra.div className="directory-empty">Loading your Live organisations…</chakra.div> : organizations.length === 0 ? <chakra.div className="notice">No eligible Owner/Admin organisations were returned. Check that you authorized the correct Infinite Flight account and granted organisation access, then reconnect.</chakra.div> : <><chakra.label className="field-label">Infinite Flight organisation</chakra.label><chakra.select className="text-field" required value={selected} onChange={(e) => setSelected(e.target.value)}><chakra.option value="">Select an organisation</chakra.option>{organizations.map((org) => <chakra.option key={org.id} value={org.id} disabled={org.alreadyConnected}>{org.name} · {org.role === 2 ? "Owner" : "Admin"}{org.alreadyConnected ? " · Already connected/applied" : ""}</chakra.option>)}</chakra.select></>}
      {chosen && <chakra.div className="notice success">Verified from Infinite Flight Live: {chosen.role === 2 ? "Owner" : "Admin"} access for {chosen.name}. Portal creation still requires VEYRO approval.</chakra.div>}
      <chakra.div className="application-step"><chakra.span>02</chakra.span><chakra.div><chakra.h2>Public portal details</chakra.h2><chakra.p>This information will appear on your organisation's public VEYRO page.</chakra.p></chakra.div></chakra.div>
      <chakra.label className="field-label">Portal display name *</chakra.label><chakra.input className="text-field" required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)}/>
      <chakra.label className="field-label">Preferred portal URL *</chakra.label><chakra.div className="slug-field"><chakra.span>veyro.live/</chakra.span><chakra.input className="text-field" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={requestedSlug} onChange={(e) => setRequestedSlug(slugify(e.target.value))}/></chakra.div>
      <chakra.label className="field-label">Tagline *</chakra.label><chakra.input className="text-field" required minLength={8} maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short introduction to your airline"/>
      <chakra.label className="field-label">About your organisation *</chakra.label><chakra.textarea className="text-field application-textarea" required minLength={40} maxLength={1200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell pilots about your airline, its operations and what makes it different."/>
      <chakra.div className="application-two-col"><chakra.div><chakra.label className="field-label">Official website</chakra.label><chakra.input className="text-field" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com"/></chakra.div><chakra.div><chakra.label className="field-label">Discord invite</chakra.label><chakra.input className="text-field" type="url" value={discordInviteUrl} onChange={(e) => setDiscordInviteUrl(e.target.value)} placeholder="https://discord.gg/…"/></chakra.div></chakra.div>
      <chakra.div className="application-step"><chakra.span>03</chakra.span><chakra.div><chakra.h2>Organisation branding</chakra.h2><chakra.p>Upload the logo to display in the directory and your portal.</chakra.p></chakra.div></chakra.div>
      <chakra.label className="logo-upload"><chakra.input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void chooseLogo(e.target.files?.[0])}/>{logoPreview ? <chakra.img src={logoPreview} alt="Logo preview"/> : <ImagePlus size={24}/>}<chakra.span><chakra.strong>{logo?.name || "Upload organisation logo"}</chakra.strong><chakra.small>PNG, JPG or WebP · Maximum 2 MB</chakra.small></chakra.span></chakra.label>
      <chakra.div className="notice">Your Infinite Flight organisation name and role are verified automatically. Your logo and public information will be published only after approval.</chakra.div>
      {error && <><chakra.div className="notice error">{error}</chakra.div><Link className="button button-quiet full" to="/login">Connect Infinite Flight / return to sign in <ArrowUpRight size={14}/></Link></>}
      <chakra.button className="button button-primary full" type="submit" disabled={busy || loadingOrgs || !chosen || chosen.alreadyConnected}>{busy ? "Submitting application…" : "Submit for review"} <ArrowUpRight size={15}/></chakra.button>
    </chakra.form>}
    <chakra.footer className="footer"><chakra.span>© {new Date().getFullYear()} VEYRO LIVE</chakra.span><chakra.span>Organisation applications</chakra.span></chakra.footer>
  </chakra.main>;
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
  return <chakra.main className="shell narrow"><chakra.header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><chakra.div className="top-actions"><ThemeToggle/></chakra.div></chakra.header>
    <chakra.section className="application-intro compact"><chakra.div className="eyebrow">APPLICATION TRACKER</chakra.div><chakra.h1>Application<chakra.br/><chakra.span>status.</chakra.span></chakra.h1><chakra.p>Updates and notes from the VEYRO review team will appear here.</chakra.p></chakra.section>
    {loading ? <chakra.section className="panel"><chakra.p>Loading application…</chakra.p></chakra.section> : error ? <chakra.section className="panel"><chakra.div className="notice error">{error}</chakra.div><Link className="button button-quiet full" to="/apply">Back to applications</Link></chakra.section> : app ? <chakra.section className="panel status-panel">
      <chakra.div className={"status-pill " + app.status}>{app.status === "pending" ? <Clock3 size={14}/> : <CheckCircle2 size={14}/>} {app.status === "pending" ? "Under review" : app.status === "approved" ? "Approved" : "Not approved"}</chakra.div>
      <chakra.h2>{app.display_name}</chakra.h2><chakra.p>{app.live_organization_name} · Submitted {new Date(app.created_at).toLocaleDateString()}</chakra.p>
      <chakra.div className="status-details"><chakra.div><chakra.span>Requested portal</chakra.span><chakra.strong>/{app.requested_slug}</chakra.strong></chakra.div><chakra.div><chakra.span>Application status</chakra.span><chakra.strong>{app.status[0].toUpperCase()+app.status.slice(1)}</chakra.strong></chakra.div></chakra.div>
      {data.portal && <Link className="button button-primary full" to={"/" + data.portal.slug}>Open your new portal <ArrowUpRight size={15}/></Link>}
      <chakra.div className="status-notes"><chakra.div className="section-heading"><chakra.div><chakra.h3>Review notes</chakra.h3><chakra.p>Messages from the VEYRO review team</chakra.p></chakra.div><FileText size={16}/></chakra.div>
        {data.notes?.length ? data.notes.map((note: any) => <chakra.article className="review-note" key={note.id}><chakra.div><chakra.strong>{note.author_display_name}</chakra.strong><chakra.small>{new Date(note.created_at).toLocaleString()}</chakra.small></chakra.div><chakra.p>{note.note}</chakra.p></chakra.article>) : <chakra.div className="directory-empty">No review notes have been added yet.</chakra.div>}
      </chakra.div>
    </chakra.section> : null}
    <chakra.footer className="footer"><chakra.span>© {new Date().getFullYear()} VEYRO LIVE</chakra.span><chakra.span>Private tracking code required</chakra.span></chakra.footer>
  </chakra.main>;
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
  return <chakra.main className="shell"><chakra.header className="topbar veyro-minimal-topbar"><Brand/><Link className="nav-account-link veyro-center-account" to="/account">My Veyro</Link><chakra.div className="top-actions"><ThemeToggle/></chakra.div></chakra.header>
    {loading ? <chakra.div className="directory-empty">Loading organisation portal…</chakra.div> : !org ? <chakra.section className="panel portal-empty"><chakra.h1>Portal not found</chakra.h1><chakra.p>This organisation is not listed in the public VEYRO directory.</chakra.p><Link className="button button-primary" to="/">Explore organisations</Link></chakra.section> :
      <chakra.section className="public-org-hero"><chakra.div className="public-org-brand">{org.logo_url ? <chakra.img src={org.logo_url} alt={org.display_name + " logo"}/> : <chakra.span>{org.display_name.slice(0,1)}</chakra.span>}</chakra.div><chakra.div className="eyebrow">INFINITE FLIGHT LIVE ORGANISATION</chakra.div><chakra.h1>{org.display_name}</chakra.h1><chakra.p className="public-org-tagline">{org.tagline}</chakra.p><chakra.p className="public-org-description">{org.description}</chakra.p><chakra.div className="hero-actions">{org.website_url && <chakra.a className="button button-quiet" href={org.website_url} target="_blank" rel="noreferrer">Official website <ExternalLink size={14}/></chakra.a>}{org.discord_invite_url && <chakra.a className="button button-quiet" href={org.discord_invite_url} target="_blank" rel="noreferrer">Join Discord <ExternalLink size={14}/></chakra.a>}<Link className="button button-primary" to={"/"+slug+"/pilot-sign-in"}>Join as a pilot <ArrowUpRight size={15}/></Link></chakra.div><chakra.div className="hero-footnote">Schedules and fleet are provided by Infinite Flight Live. VEYRO is an independent third-party platform.</chakra.div></chakra.section>}
    <chakra.footer className="footer"><chakra.span>© {new Date().getFullYear()} VEYRO LIVE</chakra.span><chakra.span>Organisation portal</chakra.span></chakra.footer>
  </chakra.main>;
}
