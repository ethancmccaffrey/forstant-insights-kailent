
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
  "Threads",
  "X",
  "Pinterest",
  "Discord",
  "Telegram",
];

const BREAKDOWNS = [
  { id: "downloads", title: "Downloads" },
  { id: "signups", title: "Email Signups" },
  { id: "followers", title: "Followers & Subscribers" },
  { id: "visits", title: "Website Visits" },
  { id: "likes", title: "Likes" },
  { id: "comments", title: "Comments" },
  { id: "views", title: "Views" },
];

const LIFETIME_METRICS = [
  ["downloads", "Downloads"],
  ["comments", "Comments"],
  ["likes", "Likes"],
  ["views", "Views"],
];

function mondayOf(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
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

function weatherDescription(code) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Current conditions";
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
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
  };

  return <svg {...common}>{paths[name] || paths.chart}</svg>;
}

function MetricCard({ label, primary = false, compact = false }) {
  return (
    <article className={`metric-card ${primary ? "primary" : ""} ${compact ? "compact" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value unavailable">—</div>
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
    <div className="chart-stage" role="img" aria-label={`${title}; no metric history available yet`}>
      <svg viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
        {[60, 120, 180, 240, 300].map((y) => (
          <line key={y} x1="54" y1={y} x2="875" y2={y} stroke="#e9edf1" strokeDasharray="4 5" />
        ))}
        <line x1="54" y1="30" x2="54" y2="300" stroke="#dfe5ea" />
        <line x1="54" y1="300" x2="875" y2="300" stroke="#dfe5ea" />
      </svg>
    </div>
  );
}

function PostCard({ post }) {
  const category =
    post.category === "platform"
      ? post.platform
      : post.category === "email"
        ? "Email List"
        : "Downloads";

  return (
    <article className="post-item">
      <div className="post-meta">
        <span>{weekday(post.createdAt)}</span>
        <span>
          {new Date(post.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span className="post-tag">{category}</span>
      </div>
      {post.title ? <h3>{post.title}</h3> : null}
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
  const [weather, setWeather] = useState(null);
  const [form, setForm] = useState({
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
      showToast("Published posts could not be loaded.");
    } finally {
      setPostsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=34.0007&longitude=-81.0348&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York";

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Weather unavailable");

        const data = await response.json();
        const temperature = data.current?.temperature_2m;
        const code = data.current?.weather_code;

        if (typeof temperature === "number" && typeof code === "number") {
          setWeather({
            temperature: Math.round(temperature),
            condition: weatherDescription(code),
          });
        }
      } catch (error) {
        if (error.name !== "AbortError") setWeather(null);
      }
    }

    loadWeather();
    return () => controller.abort();
  }, []);

  const weekPosts = useMemo(
    () =>
      posts
        .filter((post) => post.weekStart === selectedWeek)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [posts, selectedWeek]
  );

  const openAuth = () => {
    setForm({
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
      setAuthError("That key does not match.");
      return;
    }

    setAuthOpen(false);
    setAddOpen(true);
  };

  const publishPost = async (event) => {
    event.preventDefault();

    if (!form.body.trim()) {
      showToast("Enter the post content before publishing.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        body: form.body.trim(),
        category: form.category,
        platform: form.category === "platform" ? form.platform : null,
        weekStart: mondayOf(form.week),
      };

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          authorizationKey: authValue || POST_AUTH_KEY,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publishing failed.");

      setPosts((current) =>
        [...current, result.post].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )
      );
      setSelectedWeek(result.post.weekStart);
      setAddOpen(false);
      setAuthValue("");
      showToast("Post published.");
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

  const closeGraphWindow = () => {
    setActiveWindow(null);
    setSelectedBreakdown(null);
  };

  const openBreakdown = (item) => {
    setSelectedBreakdown(item);
    setActiveWindow("detail");
  };

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Forstant Insights for Kailent home">
          FORSTANT INSIGHTS <small><em>for</em> KAILENT</small>
        </a>

        <div className="header-actions">
          <span className="version-label">v1.0.0</span>
          <button className="btn btn-primary add-post-btn" onClick={openAuth}>
            <Icon name="plus" size={17} />
            <span>Add Post</span>
          </button>
        </div>
      </header>

      <main>
        <section className="score-section">
          <div className="section-head">
            <h2>Overall score</h2>
          </div>
          <section className="score-grid" aria-label="Overall score comparisons">
            <MetricCard label="Current score" primary />
            <MetricCard label="Last week's ending score" />
            <MetricCard label="Six months ago" />
            <MetricCard label="Y2D" />
          </section>
        </section>

        <section>
          <div className="section-head">
            <h2>Followers &amp; subscribers</h2>
          </div>
          <section className="subgrid" aria-label="Audience metrics">
            <MetricCard label="Total followers & subscribers" compact />
            <MetricCard label="Email subscribers" compact />
          </section>
        </section>

        <section>
          <div className="section-head">
            <h2>Lifetime activity</h2>
          </div>
          <section className="lifetime-grid" aria-label="Lifetime metrics">
            {LIFETIME_METRICS.map(([id, label]) => (
              <MetricCard key={id} label={label} compact />
            ))}
          </section>
        </section>

        <section className="dashboard-panels">
          <article className="panel">
            <div className="panel-head">
              <div><h2>Main growth graph</h2></div>
              <button
                className="graph-open-btn"
                onClick={() => setActiveWindow("main")}
                aria-label="Open overall score graph"
                title="Open graph"
              >
                <Icon name="chart" size={19} />
                <Icon name="arrow" size={14} />
              </button>
            </div>
            <div className="panel-body">
              <button
                className="chart-placeholder"
                onClick={() => setActiveWindow("main")}
                aria-label="Open overall score graph"
              >
                <span><strong>Overall score over time</strong></span>
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div><h2>Breakdown graphs</h2></div>
              <button
                className="graph-open-btn"
                onClick={() => setActiveWindow("selector")}
                aria-label="View breakdown graphs"
                title="View breakdown graphs"
              >
                <Icon name="arrow" size={17} />
              </button>
            </div>
            <div className="panel-body">
              <div className="preview-grid">
                {BREAKDOWNS.slice(0, 4).map((item) => (
                  <button
                    className="preview-tile"
                    key={item.id}
                    onClick={() => openBreakdown(item)}
                  >
                    <div className="preview-mark" aria-hidden="true">
                      {[1, 2, 3, 4, 5, 6].map((n) => <i key={n} />)}
                    </div>
                    <strong>{item.title}</strong>
                    <span>View graph <Icon name="arrow" size={12} /></span>
                  </button>
                ))}
              </div>
            </div>
          </article>
        </section>
      </main>

      <footer className="footer">
        <span>Made in Forstant Labs by Ethan McCaffrey</span>
        <div className="footer-right">
          {weather && (
            <span className="weather" aria-label={`Columbia, South Carolina weather: ${weather.temperature} degrees Fahrenheit, ${weather.condition}`}>
              <span className="weather-city">Columbia, SC</span>
              <span>{weather.temperature}°F</span>
              <span>{weather.condition}</span>
            </span>
          )}
          <span>2026 Forstant Labs</span>
        </div>
      </footer>

      {authOpen && (
        <div
          className="modal-backdrop open"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-head">
              <h2 id="auth-title">Authorize publishing</h2>
              <button className="icon-btn" onClick={() => setAuthOpen(false)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <form className="modal-body" onSubmit={continueToPost}>
              <div className="field">
                <label htmlFor="auth-key">Authorization key</label>
                <input
                  id="auth-key"
                  type="password"
                  autoComplete="off"
                  value={authValue}
                  onChange={(event) => setAuthValue(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="inline-error" role="alert">{authError}</div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setAuthOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Continue</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {addOpen && (
        <div
          className="modal-backdrop open"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setAddOpen(false);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="modal-head">
              <h2 id="post-title">Add post</h2>
              <button
                className="icon-btn"
                onClick={() => !saving && setAddOpen(false)}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <form className="modal-body" onSubmit={publishPost}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="post-category">Category</label>
                  <select
                    id="post-category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    <option value="platform">Platform</option>
                    <option value="email">Email List</option>
                    <option value="downloads">Downloads</option>
                  </select>
                </div>

                {form.category === "platform" && (
                  <div className="field">
                    <label htmlFor="post-platform">Platform</label>
                    <select
                      id="post-platform"
                      value={form.platform}
                      onChange={(event) => setForm({ ...form, platform: event.target.value })}
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform}>{platform}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="post-week">Reporting week</label>
                  <input
                    id="post-week"
                    type="date"
                    value={form.week}
                    onChange={(event) => setForm({ ...form, week: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="post-body">Post</label>
                <textarea
                  id="post-body"
                  maxLength={20000}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  placeholder="Write your breakdown or analysis…"
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={saving}
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Publishing…" : "Publish"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeWindow && (
        <div
          className="modal-backdrop open"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGraphWindow();
          }}
        >
          <section className="modal wide" role="dialog" aria-modal="true" aria-labelledby="graph-title">
            <div className="modal-head">
              <h2 id="graph-title">
                {activeWindow === "main"
                  ? "Overall score"
                  : activeWindow === "selector"
                    ? "Breakdown graphs"
                    : selectedBreakdown?.title || "Metric graph"}
              </h2>
              <button className="icon-btn" onClick={closeGraphWindow} aria-label="Close graph window">
                <Icon name="close" />
              </button>
            </div>

            <div className="modal-body">
              {activeWindow === "selector" ? (
                <div className="graph-selector">
                  {BREAKDOWNS.map((item) => (
                    <button
                      className="selector-card"
                      key={item.id}
                      onClick={() => openBreakdown(item)}
                    >
                      <strong>{item.title}</strong>
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                  {PLATFORMS.map((platform) => (
                    <button
                      className="selector-card"
                      key={platform}
                      onClick={() => openBreakdown({
                        id: `platform-${platform}`,
                        title: `${platform} Score`,
                        platform,
                      })}
                    >
                      <strong>{platform} Score</strong>
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="graph-toolbar">
                    <RangePicker value={range} onChange={setRange} />
                    {activeWindow === "main" && (
                      <div className="week-strip">
                        <button className="week-chip" onClick={() => shiftWeek(-1)}>
                          ← Previous
                        </button>
                        <span className="week-chip active">
                          {readableDate(selectedWeek)} – {readableDate(weekEnd(selectedWeek))}
                        </span>
                        <button className="week-chip" onClick={() => shiftWeek(1)}>
                          Next →
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="graph-display">
                    <EmptyChart
                      title={`${activeWindow === "main" ? "Overall Score" : selectedBreakdown?.title || "Metric"} · ${range}`}
                    />
                  </div>

                  {activeWindow === "main" && (
                    <div className="reporting-posts">
                      <div className="section-head">
                        <h2>Published blog breakdowns</h2>
                      </div>
                      <div className="post-list">
                        {postsLoading ? (
                          <div className="empty-posts">Loading posts…</div>
                        ) : weekPosts.length ? (
                          weekPosts.map((post) => <PostCard key={post.id} post={post} />)
                        ) : (
                          <div className="empty-posts">No published posts for this week.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeWindow === "detail" && (
                    <div className="form-actions">
                      <button className="btn" onClick={() => setActiveWindow("selector")}>
                        Back to breakdowns
                      </button>
                    </div>
                  )}
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
