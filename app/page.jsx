
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const POST_AUTH_KEY = "SOPHISTICATED";

const RANGES = [
  "Today",
  "This Week",
  "2 Weeks",
  "1 Month",
  "3 Months",
  "6 Months",
  "Y2D",
  "1 Year",
  "5 Years",
  "All Time",
];

const PLATFORMS = [
  "YouTube",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Threads",
  "X",
  "Pinterest",
  "Discord",
  "Telegram",
];

const BREAKDOWNS = [
  { id: "downloads", title: "Downloads", description: "Komic and asset downloads" },
  { id: "signups", title: "Email Signups", description: "New email subscribers" },
  { id: "followers", title: "Followers & Subscribers", description: "Social audiences and email list" },
  { id: "visits", title: "Website Visits", description: "Website traffic" },
  { id: "likes", title: "Likes", description: "Content likes and reactions" },
  { id: "comments", title: "Comments", description: "Audience conversation" },
  { id: "views", title: "Views", description: "Content views" },
];

const LIFETIME_METRICS = [
  ["downloads", "Downloads"],
  ["comments", "Comments"],
  ["likes", "Likes"],
  ["views", "Views"],
];

function mondayOf(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  return localDateString(date);
}

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonday() {
  return mondayOf(localDateString(new Date()));
}

function weekEnd(monday) {
  const date = new Date(`${monday}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return localDateString(date);
}

function readableDate(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function weekday(value) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 5-7" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  };

  return <svg {...common}>{paths[name] || paths.chart}</svg>;
}

function MetricCard({ label, value = null, delta = null, primary = false, compact = false }) {
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);

  return (
    <article className={`metric-card ${primary ? "primary" : ""} ${compact ? "compact" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${hasValue ? "" : "unavailable"}`}>
        {hasValue ? value.toLocaleString("en-US") : "—"}
      </div>
      <div className={`delta ${hasDelta ? delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral" : "neutral"}`}>
        {hasDelta
          ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US")} vs. comparison`
          : "Awaiting connected data"}
      </div>
    </article>
  );
}

function RangePicker({ value, onChange }) {
  return (
    <div className="range-row" role="group" aria-label="Graph time range">
      {RANGES.map((range) => (
        <button
          type="button"
          key={range}
          className={`range-btn ${value === range ? "active" : ""}`}
          onClick={() => onChange(range)}
          aria-pressed={value === range}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

function EmptyChart({ title }) {
  return (
    <div className="chart-stage">
      <svg viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
        {[60, 120, 180, 240, 300].map((y) => (
          <line key={y} x1="54" y1={y} x2="875" y2={y} stroke="#e9edf1" strokeDasharray="4 5" />
        ))}
        <line x1="54" y1="30" x2="54" y2="300" stroke="#dfe5ea" />
        <line x1="54" y1="300" x2="875" y2="300" stroke="#dfe5ea" />
      </svg>
      <div className="chart-empty">
        <div>
          <strong>{title}</strong>
          <br />
          No chart data yet. Connect the metric sources to populate this graph.
          <br />
          <span>Historical data collection will begin when integrations are configured.</span>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }) {
  return (
    <article className="post-item">
      <div className="post-meta">
        <span>{weekday(post.createdAt)}</span>
        <span>{new Date(post.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
        <span className="post-tag">
          {post.category === "platform" ? post.platform : post.category === "email" ? "Email List" : "Downloads"}
        </span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
    </article>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(currentMonday);
  const [range, setRange] = useState("6 Months");
  const [activeWindow, setActiveWindow] = useState(null);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authValue, setAuthValue] = useState("");
  const [authError, setAuthError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "platform",
    platform: "YouTube",
    week: currentMonday(),
  });

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const response = await fetch("/api/posts", { cache: "no-store" });
      if (!response.ok) throw new Error("Posts endpoint unavailable");
      const data = await response.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch {
      setPosts([]);
      showToast("Could not load published posts. Check the publishing API setup.");
    } finally {
      setPostsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const weekPosts = useMemo(
    () => posts
      .filter((post) => post.weekStart === selectedWeek)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [posts, selectedWeek]
  );

  const openAuth = () => {
    setForm({
      title: "",
      body: "",
      category: "platform",
      platform: "YouTube",
      week: selectedWeek,
    });
    setAuthValue("");
    setAuthError("");
    setAuthOpen(true);
  };

  const continueToPost = (event) => {
    event.preventDefault();
    if (authValue !== POST_AUTH_KEY) {
      setAuthError("That key does not match. Nothing has been published.");
      return;
    }
    setAuthOpen(false);
    setAddOpen(true);
  };

  const publishPost = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      showToast("Add a title and post content before publishing.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        platform: form.category === "platform" ? form.platform : null,
        weekStart: mondayOf(form.week),
      };

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, authorizationKey: authValue || POST_AUTH_KEY }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publishing failed.");

      setPosts((current) => [...current, result.post].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ));
      setSelectedWeek(result.post.weekStart);
      setAddOpen(false);
      setAuthValue("");
      showToast("Post published to the repository. Deployment may take a moment.");
    } catch (error) {
      showToast(error.message || "Could not publish the post.");
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (amount) => {
    const date = new Date(`${selectedWeek}T12:00:00`);
    date.setDate(date.getDate() + amount * 7);
    setSelectedWeek(localDateString(date));
  };

  const exportPosts = () => {
    downloadFile(
      `forstant-posts-${selectedWeek}.json`,
      JSON.stringify(posts, null, 2),
      "application/json"
    );
    setExportOpen(false);
  };

  const exportSummary = () => {
    const rows = [
      ["Section", "Metric", "Value", "Status"],
      ["Score", "Current score", "", "Not connected"],
      ["Score", "Last week's ending score", "", "Not connected"],
      ["Score", "Six months ago", "", "Not connected"],
      ["Score", "Y2D", "", "Not connected"],
      ["Audience", "Followers and subscribers", "", "Not connected"],
      ...LIFETIME_METRICS.map(([id, label]) => ["Lifetime", label, "", "Not connected"]),
    ];
    downloadFile(
      "forstant-dashboard-summary.csv",
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
    setExportOpen(false);
  };

  const exportGraph = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480"><rect width="1200" height="480" fill="#fff"/><text x="55" y="55" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#000">Forstant Insights for Kailent</text><text x="55" y="88" font-family="Arial,sans-serif" font-size="15" fill="#68717b">${(selectedBreakdown?.title || "Overall Score")} · ${range}</text>${[150,220,290,360,430].map(y=>`<line x1="55" y1="${y}" x2="1140" y2="${y}" stroke="#e5e9ed" stroke-dasharray="5 5"/>`).join("")}<text x="600" y="275" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#68717b">No connected data — chart intentionally blank</text></svg>`;
    downloadFile("forstant-graph.svg", svg, "image/svg+xml");
    setExportOpen(false);
  };

  const doExport = (kind) => {
    if (kind === "posts") exportPosts();
    else if (kind === "dashboard") exportSummary();
    else exportGraph();
  };

  const closeGraphWindow = () => {
    setActiveWindow(null);
    setSelectedBreakdown(null);
  };

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Forstant Insights for Kailent home">
          FORSTANT INSIGHTS <small><em>for</em> KAILENT</small>
        </a>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openAuth}>
            <Icon name="plus" size={16} /> Add Post
          </button>
          <div className="export-wrap">
            <button className="btn" onClick={() => setExportOpen((value) => !value)} aria-expanded={exportOpen}>
              Export <Icon name="chevron" size={14} />
            </button>
            <div className={`export-menu ${exportOpen ? "open" : ""}`}>
              <button onClick={() => doExport("dashboard")}>Dashboard summary (.csv)</button>
              <button onClick={() => doExport("posts")}>Published posts (.json)</button>
              <button onClick={() => doExport("graph")}>Selected graph (.svg)</button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">Kailent growth intelligence</div>
            <h1>Measure what<br />moves you forward.</h1>
            <p>A disciplined view of reach, engagement, and impact — built to show progress without confusing activity for outcomes.</p>
          </div>
          <div className="status-pill"><span className="status-dot" /> Metrics not connected</div>
        </section>

        <div className="section-head">
          <div><h2>Overall score</h2><p>Growth index · historical data will populate once integrations are active</p></div>
        </div>
        <section className="score-grid" aria-label="Overall score comparisons">
          <MetricCard label="Current score" primary />
          <MetricCard label="Last week's ending score" />
          <MetricCard label="Six months ago" />
          <MetricCard label="Y2D · Year to date" />
        </section>

        <div className="section-head">
          <div><h2>Followers & subscribers</h2><p>Audience size across connected platforms and the email list</p></div>
        </div>
        <section className="subgrid" aria-label="Audience metrics">
          <MetricCard label="Total followers & subscribers" compact />
          <MetricCard label="Email subscribers" compact />
        </section>
        <p className="note">Discord server members and Telegram channel members count toward followers. Email subscribers are shown separately as well.</p>

        <div className="section-head">
          <div><h2>Lifetime activity</h2><p>Cumulative totals from launch, where data is available</p></div>
        </div>
        <section className="lifetime-grid" aria-label="Lifetime metrics">
          {LIFETIME_METRICS.map(([id, label]) => <MetricCard key={id} label={label} compact />)}
        </section>

        <section className="dashboard-panels">
          <article className="panel">
            <div className="panel-head">
              <div><h2>Main growth graph</h2><p>Weekly overall score · select to inspect history and posts</p></div>
              <button className="btn btn-quiet" onClick={() => setActiveWindow("main")}>Open graph ↗</button>
            </div>
            <div className="panel-body">
              <button className="chart-placeholder" style={{ width: "100%" }} onClick={() => setActiveWindow("main")}>
                <span><strong>Overall score over time</strong>Historical scores will appear here after data collection begins.</span>
              </button>
              <div className="section-head">
                <div><h2>Selected reporting week</h2><p>Published blog breakdowns</p></div>
              </div>
              <div className="week-strip">
                <button className="week-chip" onClick={() => shiftWeek(-1)}>← Previous</button>
                <span className="week-chip active">{readableDate(selectedWeek)} – {readableDate(weekEnd(selectedWeek))}</span>
                <button className="week-chip" onClick={() => shiftWeek(1)}>Next →</button>
              </div>
              <div className="post-list">
                {postsLoading ? <div className="empty-posts">Loading published posts…</div> :
                  weekPosts.length ? weekPosts.map((post) => <PostCard key={post.id} post={post} />) :
                    <div className="empty-posts">No published posts for this week. Select another week or use Add Post to publish a breakdown.</div>}
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div><h2>Breakdown graphs</h2><p>Explore the drivers behind the overall score</p></div>
              <button className="btn btn-quiet" onClick={() => setActiveWindow("selector")}>View all ↗</button>
            </div>
            <div className="panel-body">
              <div className="preview-grid">
                {BREAKDOWNS.slice(0, 4).map((item) => (
                  <button className="preview-tile" key={item.id} onClick={() => { setSelectedBreakdown(item); setActiveWindow("detail"); }}>
                    <div className="preview-mark" aria-hidden="true">{[1,2,3,4,5,6].map((n) => <i key={n} />)}</div>
                    <strong>{item.title}</strong>
                    <span>Open graph ↗</span>
                  </button>
                ))}
              </div>
              <p className="note">Includes downloads, email signups, followers, website visits, likes, comments, views, and platform-level scores.</p>
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div><h2>Scoring methodology</h2><p>Weights are configured; calculations activate when real metric history is available.</p></div>
          </div>
          <div className="panel-body methodology">
            <div><strong>Overall score weights</strong><p>Downloads 28.75% · Email signups 28.75% · Follows and website visits 20% · Likes and comments 15% · Views 7.5%</p></div>
            <div><strong>Platform score weights</strong><p>Follows 50% · Likes and comments 35% · Views 15%. Discord and Telegram use member growth only.</p></div>
            <p className="note">Scores are intended to represent a weighted growth index, not a literal percentage change. No score is calculated until the metric definitions, baselines, and historical values are available. Changes occurring in the same week do not by themselves establish causation.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span><strong>FORSTANT INSIGHTS</strong> <em>for</em> KAILENT</span>
        <span>Innovation. Minimalism. Helping others.</span>
      </footer>

      {authOpen && (
        <div className="modal-backdrop open" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-head"><h2 id="auth-title">Authorize publishing</h2><button className="icon-btn" onClick={() => setAuthOpen(false)} aria-label="Close"><Icon name="close" /></button></div>
            <form className="modal-body" onSubmit={continueToPost}>
              <p className="notice">Enter your publishing key to open the post editor. Closing this window does not create a draft.</p>
              <div className="field"><label htmlFor="auth-key">Authorization key</label><input id="auth-key" type="password" autoComplete="off" value={authValue} onChange={(event) => setAuthValue(event.target.value)} required autoFocus /></div>
              <div className="inline-error" role="alert">{authError}</div>
              <div className="form-actions"><button type="button" className="btn" onClick={() => setAuthOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary">Continue</button></div>
            </form>
          </section>
        </div>
      )}

      {addOpen && (
        <div className="modal-backdrop open" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setAddOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="modal-head"><h2 id="post-title">Publish a breakdown post</h2><button className="icon-btn" onClick={() => !saving && setAddOpen(false)} aria-label="Close"><Icon name="close" /></button></div>
            <form className="modal-body" onSubmit={publishPost}>
              <p className="notice">Publishing commits this post to the repository and triggers a deployment. There are no drafts. If you close this window before publishing, your text is discarded.</p>
              <div className="field"><label htmlFor="post-heading">Post title</label><input id="post-heading" maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What changed this week?" required /></div>
              <div className="form-row">
                <div className="field"><label htmlFor="post-category">Category</label><select id="post-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="platform">Platform</option><option value="email">Email List</option><option value="downloads">Downloads</option></select></div>
                {form.category === "platform" && <div className="field"><label htmlFor="post-platform">Platform</label><select id="post-platform" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select></div>}
                <div className="field"><label htmlFor="post-week">Reporting week (any date in that week)</label><input id="post-week" type="date" value={form.week} onChange={(event) => setForm({ ...form, week: event.target.value })} required /></div>
              </div>
              <div className="field"><label htmlFor="post-body">Breakdown and analysis</label><textarea id="post-body" maxLength={20000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Describe the metrics, likely contributors, strategy, platform, and what you learned…" required /></div>
              <div className="form-actions"><button type="button" className="btn" disabled={saving} onClick={() => setAddOpen(false)}>Discard</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Publishing…" : "Publish post"}</button></div>
            </form>
          </section>
        </div>
      )}

      {activeWindow && (
        <div className="modal-backdrop open" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeGraphWindow(); }}>
          <section className="modal wide" role="dialog" aria-modal="true" aria-labelledby="graph-title">
            <div className="modal-head">
              <h2 id="graph-title">{activeWindow === "main" ? "Overall score" : activeWindow === "selector" ? "Breakdown graphs" : selectedBreakdown?.title || "Metric graph"}</h2>
              <button className="icon-btn" onClick={closeGraphWindow} aria-label="Close graph window"><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {activeWindow === "selector" ? (
                <>
                  <p className="notice">Choose a metric to inspect. Platform graphs show the platform growth score, not separate raw metrics.</p>
                  <div className="graph-selector">
                    {BREAKDOWNS.map((item) => <button className="selector-card" key={item.id} onClick={() => { setSelectedBreakdown(item); setActiveWindow("detail"); }}><strong>{item.title}</strong><span>{item.description}</span></button>)}
                    {PLATFORMS.map((platform) => <button className="selector-card" key={platform} onClick={() => { setSelectedBreakdown({ id: `platform-${platform}`, title: `${platform} Score`, description: `${platform} weighted growth score`, platform }); setActiveWindow("detail"); }}><strong>{platform} Score</strong><span>Platform growth index</span></button>)}
                  </div>
                </>
              ) : (
                <>
                  <div className="graph-toolbar">
                    <RangePicker value={range} onChange={setRange} />
                    {activeWindow === "main" && <div className="week-strip"><button className="week-chip" onClick={() => shiftWeek(-1)}>← Previous week</button><span className="week-chip active">{readableDate(selectedWeek)} – {readableDate(weekEnd(selectedWeek))}</span><button className="week-chip" onClick={() => shiftWeek(1)}>Next week →</button></div>}
                  </div>
                  <div style={{ marginTop: 18 }}><EmptyChart title={`${activeWindow === "main" ? "Overall Score" : selectedBreakdown?.title || "Metric"} · ${range}`} /></div>
                  {activeWindow === "main" && (
                    <div style={{ marginTop: 24 }}>
                      <div className="section-head"><div><h2>Posts for this reporting week</h2><p>Ordered by publication time</p></div></div>
                      <div className="post-list">{weekPosts.length ? weekPosts.map((post) => <PostCard key={post.id} post={post} />) : <div className="empty-posts">No posts for this week.</div>}</div>
                    </div>
                  )}
                  <p className="note">The chart currently displays axes only. No synthetic or invented data is used. The selected range becomes meaningful when historical metric snapshots are connected.</p>
                  <div className="form-actions"><button className="btn" onClick={() => doExport("graph")}><Icon name="download" size={15} /> Export graph (.svg)</button>{activeWindow === "detail" && <button className="btn" onClick={() => setActiveWindow("selector")}>Back to breakdowns</button>}</div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </>
  );
}
