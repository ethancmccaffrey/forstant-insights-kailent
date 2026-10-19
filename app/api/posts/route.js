
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_AUTH_KEY = "SOPHISTICATED";
const POSTS_PATH = "data/posts.json";

const OWNER = process.env.GITHUB_OWNER || "ethancmccaffrey";
const REPO = process.env.GITHUB_REPO || "forstant-insights-kailent";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function contentsUrl() {
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${POSTS_PATH}`;
}

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readArchive() {
  const url = `${contentsUrl()}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return { posts: [], sha: null };
  }

  if (!response.ok) {
    throw new Error(`GitHub could not read the archive (${response.status}).`);
  }

  const file = await response.json();

  if (file.type !== "file" || !file.content) {
    throw new Error("The post archive was not returned as a file.");
  }

  const decoded = Buffer.from(file.content, "base64").toString("utf8");
  const posts = JSON.parse(decoded);

  if (!Array.isArray(posts)) {
    throw new Error("The post archive must contain a JSON array.");
  }

  return { posts, sha: file.sha };
}

export async function GET() {
  try {
    const { posts } = await readArchive();

    const ordered = [...posts].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    return NextResponse.json(
      { posts: ordered },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Post archive read failed:", error);

    return jsonError(
      "The published post archive could not be loaded. Check the GitHub repository and archive file.",
      502
    );
  }
}

export async function POST(request) {
  if (!process.env.GITHUB_TOKEN) {
    return jsonError(
      "Publishing is not configured yet. A private GITHUB_TOKEN must be set in the server environment.",
      503
    );
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return jsonError("The request body must be valid JSON.");
  }

  if (input?.authorizationKey !== POST_AUTH_KEY) {
    return jsonError("Authorization failed.", 401);
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const category = input.category;
  const platform = input.platform;
  const weekStart = input.weekStart;

  if (!title || title.length > 160) {
    return jsonError("The title must contain between 1 and 160 characters.");
  }

  if (!body || body.length > 20000) {
    return jsonError("The post body must contain between 1 and 20,000 characters.");
  }

  if (!["platform", "email", "downloads"].includes(category)) {
    return jsonError("Choose Platform, Email List, or Downloads.");
  }

  const platforms = [
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

  if (category === "platform" && !platforms.includes(platform)) {
    return jsonError("Choose a supported platform.");
  }

  if (
    typeof weekStart !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
  ) {
    return jsonError("Choose a valid reporting week.");
  }

  const date = new Date(`${weekStart}T12:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== weekStart
  ) {
    return jsonError("The reporting week is not a valid date.");
  }

  if (date.getUTCDay() !== 1) {
    return jsonError("The reporting week must start on a Monday.");
  }

  const post = {
    id: crypto.randomUUID(),
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

    const contents = Buffer.from(
      `${JSON.stringify(updatedPosts, null, 2)}\n`,
      "utf8"
    ).toString("base64");

    const commitPayload = {
      message: `Publish Insights post: ${title}`,
      content: contents,
      branch: BRANCH,
    };

    if (archive.sha) {
      commitPayload.sha = archive.sha;
    }

    const response = await fetch(contentsUrl(), {
      method: "PUT",
      headers: {
        ...githubHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitPayload),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("GitHub commit failed:", response.status, detail);

      if (response.status === 409 || response.status === 422) {
        return jsonError(
          "The archive changed or GitHub rejected the commit. Reload the site and try again.",
          409
        );
      }

      return jsonError(
        "GitHub could not save the post. Check repository permissions and branch settings.",
        502
      );
    }

    const result = await response.json();

    return NextResponse.json(
      {
        post,
        commit: result.commit?.sha || null,
        message: "Post committed to the repository.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Post publication failed:", error);

    return jsonError(
      "The post could not be published. Check the server logs and GitHub configuration.",
      502
    );
  }
}
