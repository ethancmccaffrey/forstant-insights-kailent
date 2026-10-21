import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNER = process.env.GITHUB_OWNER || "ethancmccaffrey";
const REPO = process.env.GITHUB_REPO || "forstant-insights-kailent";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const SNAPSHOT_PATH = "data/snapshots.json";

const WEIGHTS = {
  downloads: 0.2875,
  signups: 0.2875,
  audience: 0.20,
  engagement: 0.15,
  views: 0.075,
};

const PLATFORM_WEIGHTS = {
  followers: 0.5,
  engagement: 0.35,
  views: 0.15,
};

const PLATFORMS = [
  "YouTube",
  "Instagram",
  "Facebook",
  "Threads",
  "Discord",
  "Telegram",
];

const emptyMetric = () => ({
  value: null,
  available: false,
  source: null,
  note: "Not available",
});

const numberOrNull = (value) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" &&
    Number.isFinite(number)
    ? number
    : null;
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }

  return response.json();
}

async function safeProvider(name, fn) {
  try {
    return { name, ok: true, data: await fn(), error: null };
  } catch (error) {
    console.error(`[metrics:${name}]`, error.message);
    return { name, ok: false, data: null, error: error.message };
  }
}

function metric(value, source, note = null) {
  const parsed = numberOrNull(value);
  return {
    value: parsed,
    available: parsed !== null,
    source,
    note: note || null,
  };
}

function githubHeaders() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured.");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function githubContentsUrl(path) {
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${path}`;
}

async function readSnapshots() {
  const response = await fetch(
    `${githubContentsUrl(SNAPSHOT_PATH)}?ref=${encodeURIComponent(BRANCH)}`,
    { headers: githubHeaders(), cache: "no-store" }
  );

  if (response.status === 404) return { snapshots: [], sha: null };

  if (!response.ok) {
    throw new Error(`Snapshot archive read failed (${response.status}).`);
  }

  const file = await response.json();
  const snapshots = JSON.parse(
    Buffer.from(file.content || "", "base64").toString("utf8")
  );

  if (!Array.isArray(snapshots)) {
    throw new Error("Snapshot archive must be a JSON array.");
  }

  return { snapshots, sha: file.sha };
}

async function writeSnapshots(snapshots, sha, message) {
  const payload = {
    message,
    branch: BRANCH,
    content: Buffer.from(
      `${JSON.stringify(snapshots, null, 2)}\n`,
      "utf8"
    ).toString("base64"),
    ...(sha ? { sha } : {}),
  };

  const response = await fetch(githubContentsUrl(SNAPSHOT_PATH), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Snapshot archive write failed (${response.status}).`);
  }

  return response.json();
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function mondayKey(date = new Date()) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - ((copy.getUTCDay() + 6) % 7));
  return dateKey(copy);
}

function safeSum(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) : null;
}

function getNestedNumber(object, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], object);
    const number = numberOrNull(value);
    if (number !== null) return number;
  }
  return null;
}

function deepObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) deepObjects(item, output);
  } else if (value && typeof value === "object") {
    output.push(value);
    for (const item of Object.values(value)) deepObjects(item, output);
  }
  return output;
}

function extractPostZenAccounts(data) {
  const objects = deepObjects(data);
  const results = [];

  for (const platform of ["instagram", "threads"]) {
    const relevant = objects.filter((item) => {
      const label = [
        item.platform,
        item.network,
        item.provider,
        item.type,
        item.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return label.includes(platform);
    });

    const pick = (keys) => {
      for (const item of relevant) {
        for (const key of keys) {
          const value = numberOrNull(item[key]);
          if (value !== null) return value;
        }
      }
      return null;
    };

    results.push({
      platform: platform === "instagram" ? "Instagram" : "Threads",
      followers: pick([
        "followers",
        "followersCount",
        "followerCount",
        "followers_count",
        "subscribers",
      ]),
      likes: pick(["likes", "likeCount", "likesCount"]),
      comments: pick(["comments", "commentCount", "commentsCount"]),
      views: pick(["views", "viewCount", "viewsCount", "impressions"]),
    });
  }

  return results;
}

async function fetchYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !channelId) throw new Error("YouTube credentials are missing.");

  const base = "https://www.googleapis.com/youtube/v3";
  const params = new URLSearchParams({
    part: "statistics,contentDetails",
    id: channelId,
    key,
  });

  const channelResponse = await requestJson(`${base}/channels?${params}`);
  const channel = channelResponse.items?.[0];
  if (!channel) throw new Error("YouTube channel was not found.");

  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  let likes = 0;
  let comments = 0;
  let views = 0;
  let hasVideos = false;
  let pageToken = "";

  if (uploads) {
    for (let page = 0; page < 5; page++) {
      const playlistParams = new URLSearchParams({
        part: "contentDetails",
        playlistId: uploads,
        maxResults: "50",
        key,
      });
      if (pageToken) playlistParams.set("pageToken", pageToken);

      const playlist = await requestJson(
        `${base}/playlistItems?${playlistParams}`
      );
      const ids = (playlist.items || [])
        .map((item) => item.contentDetails?.videoId)
        .filter(Boolean);

      if (ids.length) {
        const videoParams = new URLSearchParams({
          part: "statistics",
          id: ids.join(","),
          key,
        });
        const videos = await requestJson(`${base}/videos?${videoParams}`);

        for (const video of videos.items || []) {
          const stats = video.statistics || {};
          views += Number(stats.viewCount || 0);
          likes += Number(stats.likeCount || 0);
          comments += Number(stats.commentCount || 0);
          hasVideos = true;
        }
      }

      pageToken = playlist.nextPageToken || "";
      if (!pageToken) break;
    }
  }

  return {
    subscribers: numberOrNull(channel.statistics?.subscriberCount),
    channelViews: numberOrNull(channel.statistics?.viewCount),
    views: hasVideos ? views : null,
    likes: hasVideos ? likes : null,
    comments: hasVideos ? comments : null,
  };
}

async function fetchFacebook() {
  const token = process.env.META_FACEBOOK_TOKEN;
  if (!token) throw new Error("Facebook Page token is missing.");

  const url = new URL("https://graph.facebook.com/v26.0/me");
  url.searchParams.set(
    "fields",
    "id,name,fan_count,followers_count"
  );
  url.searchParams.set("access_token", token);

  const data = await requestJson(url.toString());

  return {
    followers: numberOrNull(data.followers_count ?? data.fan_count),
    pageId: data.id || null,
    pageName: data.name || null,
  };
}

async function fetchPostZen() {
  const token = process.env.POSTZEN_API_KEY;
  if (!token) throw new Error("PostZen API key is missing.");

  const headers = { Authorization: `Bearer ${token}` };
  const profilesResponse = await requestJson(
    "https://api.postzen.dev/v1/profiles",
    { headers }
  );

  const profiles = profilesResponse.profiles ||
    profilesResponse.data?.profiles ||
    profilesResponse.data ||
    [];

  if (!Array.isArray(profiles)) {
    throw new Error("PostZen returned an unexpected profiles response.");
  }

  const accounts = [];
  const failures = [];

  for (const profile of profiles) {
    const profileId = profile.id || profile._id;
    if (!profileId) continue;

    const [followersResult, analyticsResult] = await Promise.all([
      safeProvider(`postzen-followers-${profileId}`, () =>
        requestJson(
          `https://api.postzen.dev/v1/accounts/follower-stats?profileId=${encodeURIComponent(profileId)}`,
          { headers }
        )
      ),
      safeProvider(`postzen-analytics-${profileId}`, () =>
        requestJson(
          `https://api.postzen.dev/v1/analytics?profileId=${encodeURIComponent(profileId)}`,
          { headers }
        )
      ),
    ]);

    if (!followersResult.ok) failures.push(followersResult.error);
    if (!analyticsResult.ok) failures.push(analyticsResult.error);

    const platform = String(
      profile.platform || profile.network || profile.name || ""
    ).toLowerCase();

    const followerObjects = followersResult.data
      ? deepObjects(followersResult.data)
      : [];
    const analyticsObjects = analyticsResult.data
      ? deepObjects(analyticsResult.data)
      : [];

    const findValue = (objects, keys) => {
      for (const item of objects) {
        for (const key of keys) {
          const value = numberOrNull(item[key]);
          if (value !== null) return value;
        }
      }
      return null;
    };

    const targetPlatform = platform.includes("instagram")
      ? "Instagram"
      : platform.includes("threads")
        ? "Threads"
        : null;

    if (!targetPlatform) continue;

    accounts.push({
      platform: targetPlatform,
      followers: findValue(followerObjects, [
        "followers",
        "followerCount",
        "followersCount",
        "followers_count",
        "currentFollowers",
      ]),
      likes: findValue(analyticsObjects, ["likes", "likeCount", "likesCount"]),
      comments: findValue(analyticsObjects, [
        "comments",
        "commentCount",
        "commentsCount",
      ]),
      views: findValue(analyticsObjects, [
        "views",
        "viewCount",
        "viewsCount",
        "impressions",
      ]),
    });
  }

  return {
    accounts,
    warning: failures.length
      ? "Some PostZen endpoints failed. Check server logs."
      : null,
  };
}

async function fetchDiscord() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) throw new Error("Discord credentials are missing.");

  const data = await requestJson(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}?with_counts=true`,
    { headers: { Authorization: `Bot ${token}` } }
  );

  return {
    members: numberOrNull(data.approximate_member_count),
    approximate: true,
  };
}

async function fetchBrevo() {
  const key = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID || "2";
  if (!key) throw new Error("Brevo API key is missing.");

  const data = await requestJson(
    `https://api.brevo.com/v3/contacts/lists/${encodeURIComponent(listId)}`,
    { headers: { "api-key": key } }
  );

  return {
    subscribers: numberOrNull(data.totalSubscribers ?? data.uniqueSubscribers),
  };
}

async function fetchPostHogDownloads() {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) throw new Error("PostHog credentials are missing.");

  const host = process.env.POSTHOG_HOST || "https://us.posthog.com";
  const url = `${host.replace(/\/$/, "")}/api/projects/${encodeURIComponent(projectId)}/query/`;

  const body = {
    query: {
      kind: "HogQLQuery",
      query: "SELECT count() AS downloads FROM events WHERE event = 'download_requested'",
    },
  };

  const data = await requestJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const count = data.results?.[0]?.[0] ??
    data.results?.[0]?.downloads ??
    data.columns?.[0];

  return { downloads: numberOrNull(count) };
}

async function fetchVercelVisitors() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  if (!token || !projectId) throw new Error("Vercel Analytics credentials are missing.");

  const url = new URL("https://api.vercel.com/v1/query/web-analytics/visits/count");
  url.searchParams.set("projectId", projectId);

  if (process.env.VERCEL_ANALYTICS_TEAM_ID) {
    url.searchParams.set("teamId", process.env.VERCEL_ANALYTICS_TEAM_ID);
  }

  const data = await requestJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    visitors: getNestedNumber(data, [
      "data.count",
      "count",
      "data.visitors",
      "visitors",
      "result.count",
    ]),
    pageviews: getNestedNumber(data, [
      "data.pageViews",
      "pageViews",
      "data.pageviews",
      "pageviews",
    ]),
  };
}

async function fetchDubClicks() {
  const token = process.env.DUB_API_KEY;
  const domain = process.env.DUB_DOMAIN;
  const key = process.env.DUB_KEY;
  if (!token || !domain || !key) {
    throw new Error("Set DUB_API_KEY, DUB_DOMAIN and DUB_KEY for the Telegram link.");
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const url = new URL("https://api.dub.co/analytics");
  url.searchParams.set("start", start.toISOString().slice(0, 10));
  url.searchParams.set("end", new Date().toISOString().slice(0, 10));
  url.searchParams.set("event", "clicks");
  url.searchParams.set("domain", domain);
  url.searchParams.set("key", key);

  const data = await requestJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    clicks: getNestedNumber(data, [
      "clicks",
      "total",
      "data.clicks",
      "data.total",
      "results.0.clicks",
      "results.0.count",
    ]),
  };
}

async function fetchAllProviders() {
  const providerJobs = [
    safeProvider("youtube", fetchYouTube),
    safeProvider("facebook", fetchFacebook),
    safeProvider("postzen", fetchPostZen),
    safeProvider("discord", fetchDiscord),
    safeProvider("brevo", fetchBrevo),
    safeProvider("posthog", fetchPostHogDownloads),
    safeProvider("vercel", fetchVercelVisitors),
    safeProvider("dub", fetchDubClicks),
  ];

  const results = await Promise.all(providerJobs);
  const byName = Object.fromEntries(results.map((result) => [result.name, result]));

  const youtube = byName.youtube.data;
  const facebook = byName.facebook.data;
  const postzen = byName.postzen.data;
  const discord = byName.discord.data;
  const brevo = byName.brevo.data;
  const posthog = byName.posthog.data;
  const vercel = byName.vercel.data;
  const dub = byName.dub.data;

  const igThreads = postzen?.accounts || [];
  const instagram = igThreads.find((account) => account.platform === "Instagram");
  const threads = igThreads.find((account) => account.platform === "Threads");

  const metrics = {
    downloads: metric(posthog?.downloads, "PostHog"),
    signups: metric(brevo?.subscribers, "Brevo"),
    websiteVisitors: metric(vercel?.visitors, "Vercel Web Analytics"),
    pageviews: metric(vercel?.pageviews, "Vercel Web Analytics"),
    telegramClicks: metric(
      dub?.clicks,
      "Dub",
      "Clicks are a proxy for Telegram member acquisition, not confirmed joins."
    ),
    youtubeSubscribers: metric(youtube?.subscribers, "YouTube Data API"),
    instagramFollowers: metric(instagram?.followers, "PostZen"),
    facebookFollowers: metric(facebook?.followers, "Meta Graph API"),
    threadsFollowers: metric(threads?.followers, "PostZen"),
    discordMembers: metric(
      discord?.members,
      "Discord API",
      discord?.approximate ? "Discord-provided approximate member count." : null
    ),
    likes: metric(
      safeSum([
        youtube?.likes,
        instagram?.likes,
        threads?.likes,
      ]),
      "YouTube + PostZen"
    ),
    comments: metric(
      safeSum([
        youtube?.comments,
        instagram?.comments,
        threads?.comments,
      ]),
      "YouTube + PostZen"
    ),
    views: metric(
      safeSum([
        youtube?.views,
        instagram?.views,
        threads?.views,
      ]),
      "YouTube + PostZen"
    ),
  };

  // Facebook follower count is available separately. Facebook post engagement
  // is not inferred from a follower count.
  const statuses = Object.fromEntries(
    results.map(({ name, ok, error }) => [
      name,
      { ok, error: ok ? null : error },
    ])
  );

  return { metrics, statuses };
}

function metricValue(snapshot, key) {
  const value = snapshot?.metrics?.[key]?.value;
  return numberOrNull(value);
}

function growthScore(current, previous) {
  if (current === null || previous === null) return null;

  if (previous === 0) {
    if (current === 0) return 50;
    return 100;
  }

  const percentageChange = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round((50 + 50 * Math.tanh(percentageChange / 100)) * 100) / 100;
}

function averageAvailable(values) {
  const available = values.filter((value) => value !== null);
  if (!available.length) return null;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function calculateScores(current, previous) {
  const raw = Object.fromEntries(
    Object.keys(current).map((key) => [
      key,
      growthScore(metricValue(current, key), metricValue(previous, key)),
    ])
  );

  const audience = averageAvailable([
    raw.youtubeSubscribers,
    raw.instagramFollowers,
    raw.facebookFollowers,
    raw.threadsFollowers,
    raw.discordMembers,
    raw.telegramClicks,
    raw.websiteVisitors,
  ]);

  const engagement = averageAvailable([raw.likes, raw.comments]);
  const views = raw.views;

  const categories = {
    downloads: raw.downloads,
    signups: raw.signups,
    audience,
    engagement,
    views,
  };

  const availableWeights = Object.entries(WEIGHTS).filter(
    ([key]) => categories[key] !== null
  );

  const totalWeight = availableWeights.reduce(
    (sum, [, weight]) => sum + weight,
    0
  );

  const score =
    totalWeight > 0
      ? availableWeights.reduce(
          (sum, [key, weight]) => sum + categories[key] * weight,
          0
        ) / totalWeight
      : null;

  const platformScores = {
    YouTube: averageAvailable([
      raw.youtubeSubscribers === null ? null : raw.youtubeSubscribers,
      raw.likes,
      raw.views,
    ]),
    Instagram: averageAvailable([
      raw.instagramFollowers,
      raw.likes,
      raw.views,
    ]),
    Facebook: averageAvailable([raw.facebookFollowers]),
    Threads: averageAvailable([
      raw.threadsFollowers,
      raw.likes,
      raw.views,
    ]),
    Discord: raw.discordMembers,
    Telegram: raw.telegramClicks,
  };

  return {
    score: score === null ? null : Math.round(score * 100) / 100,
    categories,
    platformScores,
    coverage: Math.round(totalWeight * 100),
    method: "Bounded percentage-growth score: 50 + 50 × tanh(percent change / 100).",
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("task") === "snapshot") {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const { metrics, statuses } = await fetchAllProviders();
      const archive = await readSnapshots();
      const day = dateKey();
      const snapshot = {
        date: day,
        weekStart: mondayKey(),
        capturedAt: new Date().toISOString(),
        metrics,
      };

      const existing = archive.snapshots.filter((item) => item.date !== day);
      existing.push(snapshot);
      existing.sort((a, b) => a.date.localeCompare(b.date));

      await writeSnapshots(
        existing,
        archive.sha,
        `Capture Forstant metrics ${day}`
      );

      return NextResponse.json({
        saved: true,
        date: day,
        statuses,
      });
    } catch (error) {
      console.error("Snapshot job failed:", error);
      return NextResponse.json(
        { error: "Snapshot failed. Check server logs." },
        { status: 502 }
      );
    }
  }

  try {
    const [live, archive] = await Promise.all([
      fetchAllProviders(),
      readSnapshots(),
    ]);

    const latest = {
      date: dateKey(),
      weekStart: mondayKey(),
      capturedAt: new Date().toISOString(),
      metrics: live.metrics,
    };

    const snapshots = [...archive.snapshots].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const lastWeek = new Date();
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
    const lastWeekKey = dateKey(lastWeek);

    const previous = [...snapshots]
      .reverse()
      .find((snapshot) => snapshot.date <= lastWeekKey);

    const scores = calculateScores(live.metrics, previous?.metrics || null);

    const previousWeek = previous
      ? calculateScores(previous.metrics, null)
      : null;

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        current: latest,
        previous,
        scores,
        previousScore: previousWeek?.score ?? null,
        history: snapshots,
        statuses: live.statuses,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Metrics request failed:", error);
    return NextResponse.json(
      {
        error: "Metrics could not be loaded. Check server configuration.",
      },
      { status: 502 }
    );
  }
}
