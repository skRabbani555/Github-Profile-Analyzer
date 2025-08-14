# GitHub Profile Analyzer & Reviewer (Vite + React)

Analyze any GitHub profile with charts, repo insights, recent activity, and an **automated written review**.

## Features
- Search any GitHub username
- Profile stats (followers, public repos, totals for stars/forks)
- **Top languages** (aggregated from `languages_url` across up to 30 largest repos)
- **Top repos by stars** (bar chart)
- **Automated profile review** (detailed paragraph with actionable suggestions)
- Robust loading/error states
- Optional GitHub token support via `.env` to avoid rate limits

## Quick Start
```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Avoid Rate Limits (Recommended)
1. Create a **fine-grained personal access token** (no extra scopes needed for public data).
2. Create a `.env` file at the project root with:
```
VITE_GITHUB_TOKEN=ghp_********************************
```
3. Restart `npm run dev`.

> Do **not** commit your token.

## Build
```bash
npm run build
npm run preview
```

## Notes
- Some GitHub endpoints (like repo stats) may return cached `202 Accepted`. This app focuses on lightweight endpoints for responsiveness.
- Language aggregation is limited to the 30 largest repos to keep the experience snappy and API‑limit friendly.
- Recent activity is estimated using the public Events API (PushEvents in the last 30 days).

## License
MIT
