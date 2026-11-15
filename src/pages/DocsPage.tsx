import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Code2, Copy, FileText, Menu, Search, Shield, X } from "lucide-react";

type DocModule = { default: string };
const modules = import.meta.glob("../../docs/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

const groups = [
  { name: "GETTING STARTED", items: ["DEVELOPER-SETUP.md", "ORGANISATIONS.md", "PILOTS.md"] },
  { name: "PLATFORM", items: ["ARCHITECTURE.md", "DISCORD-SETUP.md"] },
  { name: "SECURITY & COMPLIANCE", items: ["SECURITY.md", "API-COMPLIANCE.md", "INFINITE-FLIGHT-TESTING-COMPLIANCE.md"] },
  { name: "PROJECT", items: ["CONTRIBUTING.md"] },
];
const titles: Record<string, string> = {
  "DEVELOPER-SETUP.md": "Developer setup",
  "ORGANISATIONS.md": "Organisations",
  "PILOTS.md": "Pilot guide",
  "ARCHITECTURE.md": "Architecture",
  "DISCORD-SETUP.md": "Discord integration",
  "SECURITY.md": "Security",
  "API-COMPLIANCE.md": "API compliance",
  "INFINITE-FLIGHT-TESTING-COMPLIANCE.md": "Testing compliance",
  "CONTRIBUTING.md": "Contributing",
};
const descriptions: Record<string, string> = {
  "DEVELOPER-SETUP.md": "Set up your local environment, Supabase project and deployment.",
  "ORGANISATIONS.md": "Connect and manage a Virtual Airline workspace.",
  "PILOTS.md": "Learn how pilots connect and use their Live workspace.",
  "ARCHITECTURE.md": "Understand the platform, data flow and tenancy model.",
  "DISCORD-SETUP.md": "Configure Discord approvals and interactions.",
  "SECURITY.md": "Authentication, authorization, secrets and data protection.",
  "API-COMPLIANCE.md": "Infinite Flight API data-use requirements and scopes.",
  "INFINITE-FLIGHT-TESTING-COMPLIANCE.md": "Testing access limits and API request safeguards.",
  "CONTRIBUTING.md": "Project contribution rules and engineering conventions.",
};
const slug = (file: string) => file.replace(/\.md$/i, "").toLowerCase();
const fileFor = (value: string) => Object.keys(modules).find(path => path.endsWith("/" + value));
const allFiles = Object.keys(modules).map(path => path.split("/").pop()!).sort();
const orderedFiles = groups.flatMap(group => group.items.filter(file => allFiles.includes(file))).concat(allFiles.filter(file => !groups.some(group => group.items.includes(file))));
const humanize = (file: string) => titles[file] || file.replace(/\.md$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, s => s.toUpperCase());

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g).filter(Boolean);
  return <>{parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [_, label, href] = link;
      const isExternal = /^https?:\/\//i.test(href);
      const target = isExternal ? href : href.toLowerCase().endsWith(".md") ? "/docs/" + slug(href.split("/").pop()!) : href;
      return <a key={i} href={target} {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}>{label}{isExternal && <ArrowUpRight size={12}/>}</a>;
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
      blocks.push(<pre className="docs-code" key={blocks.length}><div className="docs-code-head"><span><Code2 size={13}/>{lang || "CODE"}</span><button onClick={() => navigator.clipboard?.writeText(code.join("\n"))} aria-label="Copy code"><Copy size={13}/> Copy</button></div><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length; const value = line.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
      const id = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const Tag = ("h" + Math.min(level + 1, 6)) as keyof JSX.IntrinsicElements;
      blocks.push(<Tag id={id} key={blocks.length}><Inline text={value}/><a className="docs-anchor" href={"#" + id}>#</a></Tag>);
      i++; continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (value: string) => value.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
      const headers = cells(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(<div className="docs-table-wrap" key={blocks.length}><table className="docs-table"><thead><tr>{headers.map((cell, n) => <th key={n}><Inline text={cell}/></th>)}</tr></thead><tbody>{rows.map((row, n) => <tr key={n}>{headers.map((_, j) => <td key={j}><Inline text={row[j] || ""}/></td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line); const items: string[] = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) items.push(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={blocks.length}>{items.map((item, n) => <li key={n}><Inline text={item}/></li>)}</List>);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={blocks.length}><Inline text={quote.join(" ")}/></blockquote>);
      continue;
    }
    if (line.trim() === "---" || line.trim() === "***") { blocks.push(<hr key={blocks.length}/>); i++; continue; }
    const paragraph = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s|^```|^~~~|^\s*[-*+]\s+|^\s*\d+\.\s+|^>|^\|.*\|$/.test(lines[i])) paragraph.push(lines[i++].trim());
    blocks.push(<p key={blocks.length}><Inline text={paragraph.join(" ")}/></p>);
  }
  return <div className="docs-markdown">{blocks}</div>;
}

export default function DocsPage() {
  const params = useParams();
  const doc = params["*"] || params.doc || "";
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentFile = orderedFiles.find(file => slug(file) === doc) || (doc ? "" : orderedFiles[0]);
  const currentPath = currentFile ? fileFor(currentFile) : undefined;
  const content = currentPath ? modules[currentPath] : "";
  const heading = content.match(/^#\s+(.+)$/m)?.[1] || humanize(currentFile);
  const filteredGroups = useMemo(() => groups.map(group => ({ ...group, items: group.items.filter(file => allFiles.includes(file) && (humanize(file) + " " + (descriptions[file] || "")).toLowerCase().includes(query.toLowerCase())) })).filter(group => group.items.length), [query]);
  const currentIndex = orderedFiles.indexOf(currentFile);
  const previous = orderedFiles[currentIndex - 1];
  const next = orderedFiles[currentIndex + 1];
  const toc = useMemo(() => [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map(match => ({ title: match[1], id: match[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })), [content]);
  return <div className="docs-app">
    <header className="docs-topbar">
      <Link to="/" className="docs-brand"><span className="brand-mark">V</span><span>VEYRO<span> LIVE</span></span></Link>
      <div className="docs-top-center"><span>DOCUMENTATION</span><span className="docs-version">GUIDES & REFERENCES</span></div>
      <div className="docs-top-actions"><a href="https://github.com/Gurnoor1-dev/Veyro-Live/tree/main/docs" target="_blank" rel="noreferrer">GitHub docs <ArrowUpRight size={13}/></a><button className="docs-mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle navigation">{mobileOpen ? <X/> : <Menu/>}</button></div>
    </header>
    <div className="docs-layout">
      <aside className={"docs-sidebar" + (mobileOpen ? " is-open" : "")}>
        <Link className="docs-back" to="/"><ArrowLeft size={14}/> Back to VEYRO Live</Link>
        <div className="docs-nav-title">DOCUMENTATION</div>
        <label className="docs-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documentation"/><kbd>⌘ K</kbd></label>
        <nav>
          <Link className={"docs-nav-item docs-overview" + (!doc ? " active" : "")} to="/docs"><BookOpen size={15}/> Overview</Link>
          {filteredGroups.map(group => <section className="docs-nav-group" key={group.name}><div>{group.name}</div>{group.items.map(file => <Link key={file} onClick={() => setMobileOpen(false)} className={"docs-nav-item" + (currentFile === file ? " active" : "")} to={"/docs/" + slug(file)}><FileText size={14}/><span>{humanize(file)}</span>{currentFile === file && <ChevronRight size={13}/>}</Link>)}</section>)}
          {orderedFiles.some(file => !groups.some(group => group.items.includes(file))) && <section className="docs-nav-group"><div>REFERENCE</div>{orderedFiles.filter(file => !groups.some(group => group.items.includes(file)) && (humanize(file) + " " + (descriptions[file] || "")).toLowerCase().includes(query.toLowerCase())).map(file => <Link key={file} onClick={() => setMobileOpen(false)} className={"docs-nav-item" + (currentFile === file ? " active" : "")} to={"/docs/" + slug(file)}><FileText size={14}/><span>{humanize(file)}</span>{currentFile === file && <ChevronRight size={13}/>}</Link>)}</section>}
          {query && !filteredGroups.length && <p className="docs-no-results">No guides match your search.</p>}
        </nav>
        <div className="docs-sidebar-foot"><span className="docs-status-dot"/> Documentation sourced from repository Markdown</div>
      </aside>
      <main className="docs-main">
        <div className="docs-breadcrumb"><Link to="/">VEYRO LIVE</Link><ChevronRight size={12}/><span>DOCUMENTATION</span>{doc && <><ChevronRight size={12}/><span>{humanize(currentFile)}</span></>}</div>
        {!doc ? <section className="docs-overview-page">
          <div className="docs-kicker"><BookOpen size={14}/> VEYRO LIVE DOCUMENTATION</div>
          <h1>Build with clarity.<br/><span>Operate with confidence.</span></h1>
          <p className="docs-lead">Everything you need to understand, integrate and operate VEYRO Live — from your first local setup to platform architecture, security and Infinite Flight API compliance.</p>
          <div className="docs-overview-meta"><span><FileText size={14}/>{allFiles.length} guides</span><span><Shield size={14}/> Maintained in GitHub</span><span><Code2 size={14}/> Markdown source</span></div>
          <div className="docs-card-grid">{groups.map(group => <section className="docs-category-card" key={group.name}><div className="docs-category-eyebrow">{group.name}</div><div className="docs-category-list">{group.items.filter(file => allFiles.includes(file)).map(file => <Link key={file} to={"/docs/" + slug(file)}><span className="docs-file-icon"><FileText size={15}/></span><span><strong>{humanize(file)}</strong><small>{descriptions[file] || "Reference guide and platform notes."}</small></span><ArrowUpRight size={15}/></Link>)}</div></section>)}</div>
          <div className="docs-source-callout"><div><strong>Docs stay close to the code.</strong><p>Pages are rendered from the Markdown files in <code>/docs</code>. Update a guide in GitHub and the documentation site updates with the next deployment.</p></div><a href="https://github.com/Gurnoor1-dev/Veyro-Live/tree/main/docs" target="_blank" rel="noreferrer">Browse source <ArrowUpRight size={14}/></a></div>
        </section> : content ? <div className="docs-article-layout">
          <article className="docs-article">
            <div className="docs-article-kicker">VEYRO LIVE / GUIDES</div>
            <h1>{heading}</h1>
            <p className="docs-article-description">{descriptions[currentFile] || "Documentation and reference for VEYRO Live."}</p>
            <div className="docs-article-rule"><span>MARKDOWN REFERENCE</span><a href={"https://github.com/Gurnoor1-dev/Veyro-Live/blob/main/docs/" + currentFile} target="_blank" rel="noreferrer">Edit on GitHub <ArrowUpRight size={13}/></a></div>
            <Markdown source={content.replace(/^#\s+.+\n?/, "")}/>
            <div className="docs-pagination">{previous ? <Link to={"/docs/" + slug(previous)}><small><ArrowLeft size={12}/> PREVIOUS</small><strong>{humanize(previous)}</strong></Link> : <span/>}{next ? <Link className="next" to={"/docs/" + slug(next)}><small>NEXT <ArrowUpRight size={12}/></small><strong>{humanize(next)}</strong></Link> : <span/>}</div>
          </article>
          <aside className="docs-toc"><div>ON THIS PAGE</div>{toc.map(item => <a key={item.id} href={"#" + item.id}>{item.title}</a>)}<a className="docs-github-link" href={"https://github.com/Gurnoor1-dev/Veyro-Live/blob/main/docs/" + currentFile} target="_blank" rel="noreferrer">View Markdown source <ArrowUpRight size={12}/></a></aside>
        </div> : <section className="docs-not-found"><h1>Guide not found</h1><p>This page may have been moved or is not present in the repository.</p><Link to="/docs">Return to documentation</Link></section>}
      </main>
    </div>
  </div>;
}
