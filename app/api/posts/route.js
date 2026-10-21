import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER = process.env.GITHUB_OWNER || "ethancmccaffrey";
const REPO = process.env.GITHUB_REPO || "forstant-insights-kailent";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const POSTS_PATH = process.env.GITHUB_POSTS_PATH || "data/posts.json";

const PLATFORMS = [
  "YouTube",
  "Instagram",
  "Facebook",
  "Threads",
  "Discord",
  "Telegram",
];

function githubHeaders() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GitHub publishing is not configured.");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function contentsUrl() {
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${POSTS_PATH}`;
}

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readArchive() {
  const response = await fetch(
    `${contentsUrl()}?ref=${encodeURIComponent(BRANCH)}`,
    { headers: githubHeaders(), cache: "no-store" }
  );

  if (response.status === 404) return { posts: [], sha: null };

  if (!response.ok) {
    throw new Error(`GitHub archive read failed (${response.status}).`);
  }

  const file = await response.json();
  const posts = JSON.parse(
    Buffer.from(file.content || "", "base64").toString("utf8")
  );

  if (!Array.isArray(posts)) {
    throw new Error("The blog archive must contain a JSON array.");
  }

  return { posts, sha: file.sha };
}

export async function GET() {
  try {
    const { posts } = await readArchive();

    return NextResponse.json(
      {
        posts: posts
          .filter((post) => PLATFORMS.includes(post.platform) || !post.platform)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()
          ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Blog read failed:", error);
    return errorResponse("The published blog archive could not be loaded.", 502);
  }
}

export async function POST(request) {
  if (!process.env.POST_AUTH_KEY) {
    return errorResponse("POST_AUTH_KEY is not configured.", 503);
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return errorResponse("The request must contain valid JSON.");
  }

  if (
    typeof input?.authorizationKey !== "string" ||
    input.authorizationKey !== process.env.POST_AUTH_KEY
  ) {
    return errorResponse("Authorization failed.", 401);
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const { category, platform, weekStart } = input;

  if (title.length > 160) {
    return errorResponse("The optional title cannot exceed 160 characters.");
  }

  if (!body || body.length > 20000) {
    return errorResponse("The post must contain 1–20,000 characters.");
  }

  if (!["platform", "email", "downloads"].includes(category)) {
    return errorResponse("Choose a valid post category.");
  }

  if (category === "platform" && !PLATFORMS.includes(platform)) {
    return errorResponse("Choose a supported platform.");
  }

  if (
    typeof weekStart !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
  ) {
    return errorResponse("The reporting week must be a valid date.");
  }

  const date = new Date(`${weekStart}T12:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== weekStart ||
    date.getUTCDay() !== 1
  ) {
    return errorResponse("The reporting week must start on a Monday.");
  }

  const post = {
    id: randomUUID(),
    title,
    body,
    category,
    platform: category === "platform" ? platform : null,
    weekStart,
    createdAt: new Date().toISOString(),
  };

  try {
    const archive = await readArchive();
    const updatedPosts = [...archive.posts, post];

    const payload = {
      message: `Publish Insights post${title ? `: ${title}` : ""}`,
      content: Buffer.from(
        `${JSON.stringify(updatedPosts, null, 2)}\n`,
        "utf8"
      ).toString("base64"),
      branch: BRANCH,
      ...(archive.sha ? { sha: archive.sha } : {}),
    };

    const response = await fetch(contentsUrl(), {
      method: "PUT",
      headers: githubHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("GitHub blog commit failed:", response.status, details);

      return errorResponse(
        response.status === 409 || response.status === 422
          ? "GitHub rejected the archive update. Reload and try again."
          : "GitHub could not save the post. Check repository permissions.",
        response.status === 409 || response.status === 422 ? 409 : 502
      );
    }

    const result = await response.json();

    return NextResponse.json(
      {
        post,
        commit: result.commit?.sha || null,
        message: "Post saved to GitHub.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Blog publication failed:", error);
    return errorResponse("The post could not be published.", 502);
  }
}
