# Market Pulse — Free, Auto-Updating Sentiment Dashboard

Everything here is free: no paid API keys, no paid hosting.

## What it does
- `fetch_sentiment.py` pulls free RSS headlines (India: Economic Times, Moneycontrol,
  Business Standard; World: CNBC, BBC Business, Investing.com), scores each headline
  with VADER sentiment, and writes `docs/sentiment.json`.
- `.github/workflows/daily-sentiment.yml` runs that script automatically every day
  via GitHub Actions, and commits the updated JSON.
- `docs/index.html` is the dashboard — it fetches `sentiment.json` on load and
  renders the gauges + headline lists.

## Setup (10 minutes, all free)
1. Create a new **public** GitHub repository and push these files to it
   (public repos get free Actions minutes; private repos have a smaller free quota).
2. In the repo settings → **Pages**, set source to "Deploy from branch",
   branch `main`, folder `/docs`. Save — GitHub gives you a live URL like
   `https://<username>.github.io/<repo>/`.
3. In the repo settings → **Actions → General**, make sure "Read and write
   permissions" is enabled for the `GITHUB_TOKEN` (needed so the workflow can commit).
4. That's it. The workflow runs daily at 06:00 UTC (~11:30 AM IST, before Indian
   markets open) and also has a manual "Run workflow" button under the Actions tab
   if you want to trigger an update immediately.

## Customizing
- Add/remove RSS feeds in the `FEEDS` dict in `fetch_sentiment.py`.
- Change the schedule by editing the `cron` line in the workflow file
  (cron time is in UTC).
- Adjust sentiment thresholds (currently ±0.15) in `summarize()` to make the
  positive/negative buckets stricter or looser.

## Costs
- GitHub Actions: free for public repos (2,000 min/month free even on private repos).
- GitHub Pages: free.
- RSS feeds + VADER: free, no signup.
