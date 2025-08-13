# GitHub Profile Analyzer & Reviewer (Vite + React)

A React-based GitHub Profile Analyzer & Reviewer with charts, detailed analysis, and profile improvement suggestions.

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
