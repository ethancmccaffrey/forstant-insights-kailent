
# Forstant Insights for Kailent

A Next.js dashboard for tracking Kailent's growth, engagement, and impact.

## Current functionality

- Responsive dashboard and metric cards
- Main score graph window and reporting-week navigation
- Metric breakdown selector and platform score views
- Blog post editor with Platform, Email List, and Downloads categories
- Weekly post organization and chronological display
- CSV dashboard export, JSON post export, and SVG graph export
- GitHub-backed post archive
- Server-side publishing endpoint
- Placeholder metrics until real data sources are connected

## Requirements

- Node.js 20.9 or later
- npm
- A GitHub repository
- A deployment environment that supports Next.js server routes

## Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## GitHub post storage

Published posts are stored in `data/posts.json`.

The publishing API reads that file from GitHub and commits updates to the configured branch. A connected deployment can then rebuild from the new commit.

The GitHub token needs repository Contents read/write permission for this repository.

Configure these environment variables privately in your server/deployment environment:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_TOKEN`

Do not commit the real token or put it in client-side JavaScript.

The authorization key `SOPHISTICATED` is intentionally included in the source as requested. Because this repository is public, the key is visible in the source and is not a strong security boundary.

## Metrics

Metric values remain unavailable until integrations are configured. Do not populate the dashboard with fabricated figures.

Planned sources include:

- PostHog for website analytics and download events
- Brevo for email-list signups
- YouTube Data API
- Bundle.social for supported social-platform metrics
- PostZen for Pinterest and Telegram
- Website visit and download event collection

## Scoring configuration

Overall score weights:

- Downloads: 28.75%
- Email signups: 28.75%
- Follows and website visits: 20%
- Likes and comments: 15%
- Views: 7.5%

Platform score weights:

- Follows: 50%
- Likes and comments: 35%
- Views: 15%

Discord and Telegram use member growth only.

The score calculation and historical snapshot collection must be implemented and verified against actual source data before the score is considered live.

## Deployment checklist

1. Configure the GitHub token privately.
2. Ensure the deployment is connected to the correct repository and branch.
3. Run `npm install`.
4. Run `npm run build`.
5. Deploy the Next.js project.
6. Test reading the archive.
7. Test publishing one temporary post and verify the GitHub commit.
8. Verify the new deployment displays the post.
9. Remove the temporary test post if it should not remain in the permanent archive.
10. Connect metric sources and begin collecting historical snapshots.
