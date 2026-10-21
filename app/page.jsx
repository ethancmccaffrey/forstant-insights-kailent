"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const RANGES = [
  "Today", "This Week", "2 Weeks", "1 Month", "3 Months",
  "6 Months", "Y2D", "1 Year", "5 Years", "All Time",
];

const PLATFORMS = [
  "YouTube", "Instagram", "Facebook", "Threads", "Discord", "Telegram",
];

const BREAKDOWNS = [
  { id: "downloads", title: "Downloads" },
  { id: "signups", title: "Email Signups" },
  { id: "audience", title: "Audience Growth" },
  { id: "likes", title: "Likes" },
  { id: "comments", title: "Comments" },
  { id: "views", title: "Views" },
];

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mondayOf(value) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDateString(date);
}

function currentMonday() {
  return mondayOf(localDateString(new Date()));
}

function weekEnd(value) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return localDateString(date);
}

function readableDate(value) {
  return value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "—";
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function metricValue(data, key) {
  return data?.current?.metrics?.[key]?.available
    ? data.current.metrics[key].value
    : null;
}

function scoreValue(data) {
  return data?.scores?.score ?? null;
}

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 5-7" /></>,
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  };
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true"
    >
      {paths[name] || paths.chart}
    </svg>
  );
}

function MetricCard({ label, value, primary = false, compact = false }) {
  return (
    <article className={`metric-card${primary ? " primary" : ""}${compact ? " compact" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${value === null ? " unavailable" : ""}`}>
        {value === null ? "—" : value}
      </div>
    </article>
  );
}

function RangePicker({ value, onChange }) {
  return (
    <div className="range-row" role="group" aria-label="Graph time range">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={`range-btn${value === range ? " active" : ""}`}
          onClick={() => onChange(range)}
          aria-pressed={value === range}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

function HistoryChart({ history, metricKey, range }) {
  const cutoff = useMemo(() => {
    const date = new Date();
    const days = {
      Today: 1, "This Week": 7, "2 Weeks": 14, "1 Month": 30,
      "3 Months": 90, "6 Months": 183, Y2D: null,
      "1 Year": 365, "5 Years": 1826, "All Time": null,
    }[range];

    if (range === "Y2D") {
      return `${date.getUTCFullYear()}-01-01`;
    }
    if (days === null) return "0000-01-01";
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }, [range]);

  const points = history
    .filter((item) => item.date >= cutoff)
    .map((item) => ({
      date: item.date,
      value: metricKey === "score"
        ? item.score ?? null
        : item.metrics?.[metricKey]?.available
          ? item.metrics[metricKey].value
          : null,
    }))
    .filter((item) => item.value !== null && Number.isFinite(item.value));

  if (points.length < 2) {
    return (
      <div className="chart-empty">
        Historical data will appear here as automated snapshots accumulate.
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const pad = 36;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => ({
    x: pad + (index / (points.length - 1)) * (width - pad * 2),
    y: height - pad - ((point.value - min) / span) * (height - pad * 2),
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="chart-stage">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricKey} historical values`}>
        {[0, 1, 2, 3, 4].map((step) => {
          const y = pad + (step / 4) * (height - pad * 2);
          return <line key={step} x1={pad} x2={width - pad} y1={y} y2={y} className="gridline" />;
        })}
        <polyline points={line} className="chart-line" />
        {coords.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="3.5" className="chart-dot" />
        ))}
      </svg>
      <div className="chart-caption">
        {points[0].date} <span>{points.length} snapshots</span> {points.at(-1).date}
      </div>
    </div>
  );
}

function PostCard({ post }) {
  return (
    <article className="post-item">
      <div className="post-meta">
        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        <span className="post-tag">
          {post.category === "platform" ? post.platform : post.category === "email" ? "Email List" : "Downloads"}
        </span>
      </div>
      {post.title ? <h3>{post.title}</h3> : null}
      <p>{post.body}</p>
    </article>
  );
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [posts, setPosts] = useState([]);
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
  const [weather, setWeather] = useState(null);
  const [form, setForm] = useState({
    body: "", category: "platform", platform: "YouTube", week: currentMonday(),
  });

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [metricsResponse, postsResponse] = await Promise.all([
        fetch("/api/metrics", { cache: "no-store" }),
        fetch("/api/posts", { cache: "no-store" }),
      ]);
      if (metricsResponse.ok) setData(await metricsResponse.json());
      else showToast("Metrics could not be loaded.");
      if (postsResponse.ok) {
        const result = await postsResponse.json();
        setPosts(Array.isArray(result.posts) ? result.posts : []);
      }
    } catch {
      showToast("The dashboard could not reach its API routes.");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=34.0007&longitude=-81.0348&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York",
      { signal: controller.signal }
    )
      .then((response) => {
        if (!response.ok) throw new Error("Weather unavailable");
        return response.json();
      })
      .then((result) => {
        const current = result.current;
        if (typeof current?.temperature_2m === "number") {
          const code = current.weather_code;
          const conditions = code === 0 ? "Clear"
            : [1, 2].includes(code) ? "Partly cloudy"
            : code === 3 ? "Cloudy"
            : [45, 48].includes(code) ? "Fog"
            : [51, 53, 55, 56, 57].includes(code) ? "Drizzle"
            : [61, 63, 65, 66, 67, 80, 81, 82].includes(code) ? "Rain"
            : [71, 73, 75, 77, 85, 86].includes(code) ? "Snow"
            : [95, 96, 99].includes(code) ? "Thunderstorms"
            : "Current conditions";
          setWeather(`${Math.round(current.temperature_2m)}°F · ${conditions}`);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const weekPosts = useMemo(
    () => posts
      .filter((post) => post.weekStart === selectedWeek)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [posts, selectedWeek]
  );

  const history = useMemo(() => {
    const snapshots = data?.history || [];
    return snapshots.map((item) => {
      const previous = snapshots.find((candidate) => {
        const delta = (new Date(item.date) - new Date(candidate.date)) / 86400000;
        return delta >= 6.5 && delta <= 7.5;
      });

      if (!previous) return { ...item, score: null };

      const changeScore = (key) => {
        const current = item.metrics?.[key]?.value;
        const before = previous.metrics?.[key]?.value;
        if (current == null || before == null) return null;
        if (before === 0) return current === 0 ? 50 : 100;
        return 50 + 50 * Math.tanh((((current - before) / Math.abs(before)) * 100) / 100);
      };

      const categoryValues = {
        downloads: changeScore("downloads"),
        signups: changeScore("signups"),
        audience: [
          "youtubeSubscribers", "instagramFollowers", "facebookFollowers",
          "threadsFollowers", "discordMembers", "telegramClicks", "websiteVisitors",
        ].map(changeScore).filter((value) => value !== null),
        engagement: ["likes", "comments"].map(changeScore).filter((value) => value !== null),
        views: changeScore("views"),
      };

      if (categoryValues.audience.length) {
        categoryValues.audience = categoryValues.audience.reduce((a, b) => a + b, 0) / categoryValues.audience.length;
      } else categoryValues.audience = null;

      if (categoryValues.engagement.length) {
        categoryValues.engagement = categoryValues.engagement.reduce((a, b) => a + b, 0) / categoryValues.engagement.length;
      } else categoryValues.engagement = null;

      const weights = { downloads: .2875, signups: .2875, audience: .2, engagement: .15, views: .075 };
      const available = Object.keys(weights).filter((key) => categoryValues[key] !== null);
      const totalWeight = available.reduce((sum, key) => sum + weights[key], 0);
      const score = totalWeight
        ? available.reduce((sum, key) => sum + categoryValues[key] * weights[key], 0) / totalWeight
        : null;
      return { ...item, score };
    });
  }, [data]);

  const closeGraph = () => {
    setActiveWindow(null);
    setSelectedBreakdown(null);
  };

  const openAuth = () => {
    setForm({ body: "", category: "platform", platform: "YouTube", week: selectedWeek });
    setAuthValue("");
    setAuthError("");
    setAuthOpen(true);
  };

  const continueToPost = (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthOpen(false);
    setAddOpen(true);
  };

  const publishPost = async (event) => {
    event.preventDefault();
    if (!form.body.trim()) return showToast("Enter the post content first.");

    setSaving(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: "",
          weekStart: mondayOf(form.week),
          authorizationKey: authValue,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publishing failed.");
      setPosts((items) => [...items, result.post]);
      setSelectedWeek(result.post.weekStart);
      setAddOpen(false);
      showToast("Post published.");
    } catch (error) {
      showToast(error.message || "Publishing failed.");
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (amount) => {
    const date = new Date(`${selectedWeek}T12:00:00`);
    date.setDate(date.getDate() + amount * 7);
    setSelectedWeek(localDateString(date));
  };

  const currentScore = scoreValue(data);
  const lastScore = data?.previousScore ?? null;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Forstant Insights for Kailent home">
          FORSTANT INSIGHTS <small><em>for</em> KAILENT</small>
        </a>
        <div className="header-actions">
          <span className="version-label">v1.0.0</span>
          <button className="btn btn-primary add-post-btn" onClick={openAuth}>
            <Icon name="plus" size={17} /> Add Post
          </button>
        </div>
      </header>

      <main>
        <section className="score-section">
          <div className="section-head"><h2>Overall score</h2></div>
          <section className="score-grid">
            <MetricCard label="Current score" value={currentScore === null ? null : formatNumber(currentScore, 1)} primary />
            <MetricCard label="Last week's ending score" value={lastScore === null ? null : formatNumber(lastScore, 1)} />
            <MetricCard label="Six months ago" value={null} />
            <MetricCard label="Y2D" value={null} />
          </section>
        </section>

        <section>
          <div className="section-head"><h2>Audience</h2></div>
          <section className="subgrid">
            <MetricCard
              label="Followers & subscribers"
              value={formatNumber([
                "youtubeSubscribers", "instagramFollowers", "facebookFollowers",
                "threadsFollowers", "discordMembers",
              ].map((key) => metricValue(data, key)).filter((value) => value !== null)
                .reduce((sum, value) => sum + value, 0) || null)}
              compact
            />
            <MetricCard label="Email subscribers" value={formatNumber(metricValue(data, "signups"))} compact />
          </section>
        </section>

        <section>
          <div className="section-head"><h2>Lifetime activity</h2></div>
          <section className="lifetime-grid">
            <MetricCard label="Downloads" value={formatNumber(metricValue(data, "downloads"))} compact />
            <MetricCard label="Comments" value={formatNumber(metricValue(data, "comments"))} compact />
            <MetricCard label="Likes" value={formatNumber(metricValue(data, "likes"))} compact />
            <MetricCard label="Views" value={formatNumber(metricValue(data, "views"))} compact />
          </section>
        </section>

        <section className="dashboard-panels">
          <article className="panel">
            <div className="panel-head">
              <h2>Main growth graph</h2>
              <button className="graph-open-btn" onClick={() => setActiveWindow("main")} aria-label="Open overall score graph">
                <Icon name="chart" /><Icon name="arrow" size={14} />
              </button>
            </div>
            <div className="panel-body">
              <button className="chart-placeholder" onClick={() => setActiveWindow("main")}>
                <strong>Overall score over time</strong>
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Breakdown graphs</h2>
              <button className="graph-open-btn" onClick={() => setActiveWindow("selector")} aria-label="Open breakdown graphs">
                <Icon name="arrow" />
              </button>
            </div>
            <div className="panel-body preview-grid">
              {BREAKDOWNS.slice(0, 4).map((item) => (
                <button className="preview-tile" key={item.id} onClick={() => { setSelectedBreakdown(item); setActiveWindow("detail"); }}>
                  <strong>{item.title}</strong>
                  <span>View graph <Icon name="arrow" size={12} /></span>
                </button>
              ))}
            </div>
          </article>
        </section>
      </main>

      <footer className="footer">
        <span>Made in Forstant Labs by Ethan McCaffrey</span>
        <div className="footer-right">
          {weather && <span className="weather"><span className="weather-city">Columbia, SC</span>{weather}</span>}
          <span>2026 Forstant Labs</span>
        </div>
      </footer>

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-head">
              <h2 id="auth-title">Authorize publishing</h2>
              <button className="icon-btn" onClick={() => setAuthOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <form className="modal-body" onSubmit={continueToPost}>
              <div className="field">
                <label htmlFor="auth-key">Authorization key</label>
                <input id="auth-key" type="password" autoComplete="off" value={authValue} onChange={(event) => setAuthValue(event.target.value)} required />
              </div>
              {authError && <div className="inline-error">{authError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setAuthOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Continue</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {addOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setAddOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="modal-head">
              <h2 id="post-title">Add post</h2>
              <button className="icon-btn" onClick={() => !saving && setAddOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <form className="modal-body" onSubmit={publishPost}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="post-category">Category</label>
                  <select id="post-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    <option value="platform">Platform</option>
                    <option value="email">Email List</option>
                    <option value="downloads">Downloads</option>
                  </select>
                </div>
                {form.category === "platform" && (
                  <div className="field">
                    <label htmlFor="post-platform">Platform</label>
                    <select id="post-platform" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>
                      {PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="post-week">Reporting week</label>
                  <input id="post-week" type="date" value={form.week} onChange={(event) => setForm({ ...form, week: event.target.value })} required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="post-body">Post</label>
                <textarea id="post-body" maxLength={20000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write your breakdown or analysis…" required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" disabled={saving} onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Publishing…" : "Publish"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeWindow && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeGraph()}>
          <section className="modal wide" role="dialog" aria-modal="true" aria-labelledby="graph-title">
            <div className="modal-head">
              <h2 id="graph-title">
                {activeWindow === "main" ? "Overall score" : activeWindow === "selector" ? "Breakdown graphs" : selectedBreakdown?.title}
              </h2>
              <button className="icon-btn" onClick={closeGraph} aria-label="Close graph"><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {activeWindow === "selector" ? (
                <div className="graph-selector">
                  {BREAKDOWNS.map((item) => (
                    <button className="selector-card" key={item.id} onClick={() => { setSelectedBreakdown(item); setActiveWindow("detail"); }}>
                      <strong>{item.title}</strong><Icon name="arrow" size={15} />
                    </button>
                  ))}
                  {PLATFORMS.map((platform) => (
                    <button className="selector-card" key={platform} onClick={() => { setSelectedBreakdown({ id: `platform-${platform}`, title: `${platform} Score`, platform }); setActiveWindow("detail"); }}>
                      <strong>{platform} Score</strong><Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <RangePicker value={range} onChange={setRange} />
                  {activeWindow === "main" && (
                    <div className="week-strip">
                      <button className="week-chip" onClick={() => { const date = new Date(`${selectedWeek}T12:00:00`); date.setDate(date.getDate() - 7); setSelectedWeek(localDateString(date)); }}>← Previous</button>
                      <span className="week-chip active">{readableDate(selectedWeek)} – {readableDate(weekEnd(selectedWeek))}</span>
                      <button className="week-chip" onClick={() => { const date = new Date(`${selectedWeek}T12:00:00`); date.setDate(date.getDate() + 7); setSelectedWeek(localDateString(date)); }}>Next →</button>
                    </div>
                  )}
                  <div className="graph-display">
                    <HistoryChart history={history} metricKey={activeWindow === "main" ? "score" : selectedBreakdown?.id} range={range} />
                  </div>
                  {activeWindow === "main" && (
                    <div className="reporting-posts">
                      <div className="section-head"><h2>Published blog breakdowns</h2></div>
                      <div className="post-list">
                        {weekPosts.length ? weekPosts.map((post) => <PostCard key={post.id} post={post} />) : <div className="empty-posts">No published posts for this week.</div>}
                      </div>
                    </div>
                  )}
                  {activeWindow === "detail" && (
                    <div className="form-actions"><button className="btn" onClick={() => setActiveWindow("selector")}>Back to breakdowns</button></div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status">{toast}</div>
    </>
  );
}
