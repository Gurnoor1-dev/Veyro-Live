import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Code2, Copy, FileText, Menu, Search, Shield, X } from "lucide-react";
import Brand from "../components/Brand";
import ThemeToggle from "../components/ThemeToggle";
import { chakra } from "@chakra-ui/react";
import { Button as ChakraButton, Input } from "@chakra-ui/react";

const modules = import.meta.glob("../../docs/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

const groups = [
  { name: "GETTING STARTED", items: ["DEVELOPER-SETUP.md", "ORGANISATIONS.md", "PILOTS.md", "ORG-APPLICATIONS.md"] },
  { name: "PLATFORM", items: ["ARCHITECTURE.md", "DISCORD-SETUP.md", "LIVE-AUTOMATION.md", "NOTIFICATIONS.md"] },
  { name: "SECURITY & COMPLIANCE", items: ["SECURITY.md", "API-COMPLIANCE.md", "INFINITE-FLIGHT-TESTING-COMPLIANCE.md"] },
  { name: "PROJECT & RELEASE", items: ["CONTRIBUTING.md", "RELEASE-CHECKLIST.md"] },
];
const titles: Record<string, string> = {
  "DEVELOPER-SETUP.md": "Developer setup",
  "ORGANISATIONS.md": "Organisations",
  "PILOTS.md": "Pilot guide",
  "ORG-APPLICATIONS.md": "Organisation applications",
  "ARCHITECTURE.md": "Architecture",
  "DISCORD-SETUP.md": "Discord integration",
  "LIVE-AUTOMATION.md": "Live automation",
  "NOTIFICATIONS.md": "Notification channels",
  "SECURITY.md": "Security",
  "API-COMPLIANCE.md": "API compliance",
  "INFINITE-FLIGHT-TESTING-COMPLIANCE.md": "Testing compliance",
  "CONTRIBUTING.md": "Contributing",
  "RELEASE-CHECKLIST.md": "Release checklist",
};
const descriptions: Record<string, string> = {
  "DEVELOPER-SETUP.md": "Set up your local environment, Supabase project and deployment.",
  "ORGANISATIONS.md": "Connect and manage a Virtual Airline workspace.",
  "PILOTS.md": "Learn how pilots connect and use their Live workspace.",
  "ORG-APPLICATIONS.md": "Application review, approval and first organisation setup.",
  "ARCHITECTURE.md": "Understand the platform, data flow and tenancy model.",
  "DISCORD-SETUP.md": "Configure Discord approvals and interactions.",
  "LIVE-AUTOMATION.md": "Understand the Infinite Flight Live data and automation workflow.",
  "NOTIFICATIONS.md": "Configure dedicated Discord channels for landing dispatch, unassigned legs, schedule revisor and activity logs.",
  "SECURITY.md": "Authentication, authorization, secrets and data protection.",
  "API-COMPLIANCE.md": "Infinite Flight API data-use requirements and scopes.",
  "INFINITE-FLIGHT-TESTING-COMPLIANCE.md": "Testing access limits and API request safeguards.",
  "CONTRIBUTING.md": "Project contribution rules and engineering conventions.",
  "RELEASE-CHECKLIST.md": "Route, responsive, security and integration checks required before release.",
};
const slug = (file: string) => file.replace(/\.md$/i, "").toLowerCase();
const fileFor = (value: string) => Object.keys(modules).find(path => path.endsWith("/" + value));
const allFiles = Object.keys(modules).map(path => path.split("/").pop()!).sort();
const orderedFiles = groups.flatMap(group => group.items.filter(file => allFiles.includes(file))).concat(allFiles.filter(file => !groups.some(group => group.items.includes(file))));
const humanize = (file: string) => titles[file] || file.replace(/\.md$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, s => s.toUpperCase());

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g).filter(Boolean);
  return <>{parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <chakra.strong key={i}>{part.slice(2, -2)}</chakra.strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <chakra.code key={i}>{part.slice(1, -1)}</chakra.code>;
    if (part.startsWith("*") && part.endsWith("*")) return <chakra.em key={i}>{part.slice(1, -1)}</chakra.em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [_, label, href] = link;
      const isExternal = /^https?:\/\//i.test(href);
      const target = isExternal ? href : href.toLowerCase().endsWith(".md") ? "/docs/" + slug(href.split("/").pop()!) : href;
      return <chakra.a key={i} href={target} {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}>{label}{isExternal && <ArrowUpRight size={12}/>}</chakra.a>;
    }
    return part;
  })}</>;
}

function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```") || line.startsWith("~~~")) {
      const marker = line.slice(0, 3); const lang = line.slice(3).trim(); i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].startsWith(marker)) code.push(lines[i++]);
      i++;
      blocks.push(<chakra.pre className="docs-code" key={blocks.length}><chakra.div className="docs-code-head"><chakra.span><Code2 size={13}/>{lang || "CODE"}</chakra.span><ChakraButton onClick={() => navigator.clipboard?.writeText(code.join("\n"))} aria-label="Copy code"><Copy size={13}/> Copy</ChakraButton></chakra.div><chakra.code>{code.join("\n")}</chakra.code></chakra.pre>);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length; const value = line.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
      const id = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const Tag = ("h" + Math.min(level + 1, 6)) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag id={id} key={blocks.length}><Inline text={value}/><chakra.a className="docs-anchor" href={"#" + id}>#</chakra.a></Tag>);
      i++; continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (value: string) => value.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
      const headers = cells(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(<chakra.div className="docs-table-wrap" key={blocks.length}><chakra.table className="docs-table"><chakra.thead><chakra.tr>{headers.map((cell, n) => <chakra.th key={n}><Inline text={cell}/></chakra.th>)}</chakra.tr></chakra.thead><chakra.tbody>{rows.map((row, n) => <chakra.tr key={n}>{headers.map((_, j) => <chakra.td key={j}><Inline text={row[j] || ""}/></chakra.td>)}</chakra.tr>)}</chakra.tbody></chakra.table></chakra.div>);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line); const items: string[] = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) items.push(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={blocks.length}>{items.map((item, n) => <chakra.li key={n}><Inline text={item}/></chakra.li>)}</List>);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<chakra.blockquote key={blocks.length}><Inline text={quote.join(" ")}/></chakra.blockquote>);
      continue;
    }
    if (line.trim() === "---" || line.trim() === "***") { blocks.push(<hr key={blocks.length}/>); i++; continue; }
    const paragraph = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s|^```|^~~~|^\s*[-*+]\s+|^\s*\d+\.\s+|^>|^\|.*\|$/.test(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push(<chakra.p key={blocks.length}><Inline text={paragraph.join(" ")}/></chakra.p>);
  }
  return <chakra.div className="docs-markdown">{blocks}</chakra.div>;
}

export default function DocsPage() {
  const params = useParams();
  const doc = params["*"] || params.doc || "";
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInputRef.current?.focus(); }
      if (event.key === "Escape") { setMobileOpen(false); if (document.activeElement === searchInputRef.current) { setQuery(""); searchInputRef.current?.blur(); } }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const currentFile = orderedFiles.find(file => slug(file) === doc) || (doc ? "" : orderedFiles[0]);
  const currentPath = currentFile ? fileFor(currentFile) : undefined;
  const content = currentPath ? modules[currentPath] : "";
  const heading = content.match(/^#\s+(.+)$/m)?.[1] || humanize(currentFile);
  const matchesQuery = (file: string) => (humanize(file) + " " + (descriptions[file] || "") + " " + (modules[fileFor(file) || ""] || "")).toLowerCase().includes(query.trim().toLowerCase());
  const filteredGroups = useMemo(() => groups.map(group => ({ ...group, items: group.items.filter(file => allFiles.includes(file) && matchesQuery(file)) })).filter(group => group.items.length), [query]);
  const currentIndex = orderedFiles.indexOf(currentFile);
  const previous = orderedFiles[currentIndex - 1];
  const next = orderedFiles[currentIndex + 1];
  const toc = useMemo(() => [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map(match => ({ title: match[1], id: match[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })), [content]);
  return <chakra.div className="docs-app">
    <chakra.header className="docs-topbar">
      <chakra.div className="docs-brand"><Brand/></chakra.div>
      <Link className="nav-account-link veyro-center-account" to="/account">My Veyro <ArrowUpRight size={13}/></Link>
      <chakra.div className="docs-top-actions"><ThemeToggle/><ChakraButton className="docs-mobile-toggle" type="button" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle documentation menu" aria-expanded={mobileOpen} aria-controls="docs-navigation">{mobileOpen ? <X/> : <Menu/>}</ChakraButton></chakra.div>
    </chakra.header>
    <chakra.div className="docs-layout">
      <chakra.aside id="docs-navigation" className={"docs-sidebar" + (mobileOpen ? " is-open" : "")}>
        <Link className="docs-back" to="/"><ArrowLeft size={14}/> Back to VEYRO Live</Link>
        <chakra.div className="docs-nav-title">DOCUMENTATION</chakra.div>
        <chakra.label className="docs-search"><Search size={15}/><Input ref={searchInputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documentation" aria-label="Search all documentation"/><kbd>⌘ K</kbd></chakra.label>
        <chakra.nav>
          <Link className={"docs-nav-item docs-overview" + (!doc ? " active" : "")} to="/docs"><BookOpen size={15}/> Overview</Link>
          {filteredGroups.map(group => <chakra.section className="docs-nav-group" key={group.name}><chakra.div>{group.name}</chakra.div>{group.items.map(file => <Link key={file} onClick={() => setMobileOpen(false)} className={"docs-nav-item" + (currentFile === file ? " active" : "")} to={"/docs/" + slug(file)}><FileText size={14}/><chakra.span>{humanize(file)}</chakra.span>{currentFile === file && <ChevronRight size={13}/>}</Link>)}</chakra.section>)}
          {orderedFiles.some(file => !groups.some(group => group.items.includes(file))) && <chakra.section className="docs-nav-group"><chakra.div>REFERENCE</chakra.div>{orderedFiles.filter(file => !groups.some(group => group.items.includes(file)) && matchesQuery(file)).map(file => <Link key={file} onClick={() => setMobileOpen(false)} className={"docs-nav-item" + (currentFile === file ? " active" : "")} to={"/docs/" + slug(file)}><FileText size={14}/><chakra.span>{humanize(file)}</chakra.span>{currentFile === file && <ChevronRight size={13}/>}</Link>)}</chakra.section>}
          {query && !orderedFiles.some(file => matchesQuery(file)) && <chakra.p className="docs-no-results" role="status">No guides match “{query}”. Search titles and guide content.</chakra.p>}
        </chakra.nav>
        <chakra.div className="docs-sidebar-foot"><chakra.span className="docs-status-dot"/> Documentation sourced from repository Markdown</chakra.div>
      </chakra.aside>
      <chakra.main className="docs-main">
        <chakra.div className="docs-breadcrumb"><Link to="/">VEYRO LIVE</Link><ChevronRight size={12}/><chakra.span>DOCUMENTATION</chakra.span>{doc && <><ChevronRight size={12}/><chakra.span>{humanize(currentFile)}</chakra.span></>}</chakra.div>
        {!doc ? <chakra.section className="docs-overview-page">
          <chakra.div className="docs-kicker"><BookOpen size={14}/> VEYRO LIVE DOCUMENTATION</chakra.div>
          <chakra.h1>Build with clarity.<chakra.br/><chakra.span>Operate with confidence.</chakra.span></chakra.h1>
          <chakra.p className="docs-lead">Everything you need to understand, integrate and operate VEYRO Live — from your first local setup to platform architecture, security and Infinite Flight API compliance.</chakra.p>
          <chakra.div className="docs-overview-meta"><chakra.span><FileText size={14}/>{allFiles.length} guides</chakra.span><chakra.span><Shield size={14}/> Maintained in GitHub</chakra.span><chakra.span><Code2 size={14}/> Markdown source</chakra.span></chakra.div>
          <chakra.div className="docs-card-grid">{groups.map(group => <chakra.section className="docs-category-card" key={group.name}><chakra.div className="docs-category-eyebrow">{group.name}</chakra.div><chakra.div className="docs-category-list">{group.items.filter(file => allFiles.includes(file)).map(file => <Link key={file} to={"/docs/" + slug(file)}><chakra.span className="docs-file-icon"><FileText size={15}/></chakra.span><chakra.span><chakra.strong>{humanize(file)}</chakra.strong><chakra.small>{descriptions[file] || "Reference guide and platform notes."}</chakra.small></chakra.span><ArrowUpRight size={15}/></Link>)}</chakra.div></chakra.section>)}</chakra.div>
          <chakra.div className="docs-source-callout"><chakra.div><chakra.strong>Docs stay close to the code.</chakra.strong><chakra.p>Pages are rendered from the Markdown files in <chakra.code>/docs</chakra.code>. Update a guide in GitHub and the documentation site updates with the next deployment.</chakra.p></chakra.div><chakra.a href="https://github.com/Gurnoor1-dev/Veyro-Live/tree/main/docs" target="_blank" rel="noreferrer">Browse source <ArrowUpRight size={14}/></chakra.a></chakra.div>
        </chakra.section> : content ? <chakra.div className="docs-article-layout">
          <chakra.article className="docs-article">
            <chakra.div className="docs-article-kicker">VEYRO LIVE / GUIDES</chakra.div>
            <chakra.h1>{heading}</chakra.h1>
            <chakra.p className="docs-article-description">{descriptions[currentFile] || "Documentation and reference for VEYRO Live."}</chakra.p>
            <chakra.div className="docs-article-rule"><chakra.span>MARKDOWN REFERENCE</chakra.span><chakra.a href={"https://github.com/Gurnoor1-dev/Veyro-Live/blob/main/docs/" + currentFile} target="_blank" rel="noreferrer">Edit on GitHub <ArrowUpRight size={13}/></chakra.a></chakra.div>
            <Markdown source={content.replace(/^#\s+.+\n?/, "")}/>
            <chakra.div className="docs-pagination">{previous ? <Link to={"/docs/" + slug(previous)}><chakra.small><ArrowLeft size={12}/> PREVIOUS</chakra.small><chakra.strong>{humanize(previous)}</chakra.strong></Link> : <chakra.span/>}{next ? <Link className="next" to={"/docs/" + slug(next)}><chakra.small>NEXT <ArrowUpRight size={12}/></chakra.small><chakra.strong>{humanize(next)}</chakra.strong></Link> : <chakra.span/>}</chakra.div>
          </chakra.article>
          <chakra.aside className="docs-toc"><chakra.div>ON THIS PAGE</chakra.div>{toc.map(item => <chakra.a key={item.id} href={"#" + item.id}>{item.title}</chakra.a>)}<chakra.a className="docs-github-link" href={"https://github.com/Gurnoor1-dev/Veyro-Live/blob/main/docs/" + currentFile} target="_blank" rel="noreferrer">View Markdown source <ArrowUpRight size={12}/></chakra.a></chakra.aside>
        </chakra.div> : <chakra.section className="docs-not-found"><chakra.h1>Guide not found</chakra.h1><chakra.p>This page may have been moved or is not present in the repository.</chakra.p><Link to="/docs">Return to documentation</Link></chakra.section>}
      </chakra.main>
    </chakra.div>
  </chakra.div>;
}
