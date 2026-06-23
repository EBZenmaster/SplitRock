# AlphaLedger — Daily EOD Fetch Automation

This is a tiny, self-contained automation that runs **independently of your
laptop being on**. Every weekday after market close, GitHub's servers run a
script that fetches:

- **^GSPC** — S&P 500 index close
- **^TNX** — 10-year Treasury yield close

...and commits the result into `data/eod-history.json` in this repo. Your
AlphaLedger dashboard then reads that file over the network whenever you
open it, so the data is always there waiting for you — no clicking required.

## How it works (plain English)

1. GitHub Actions wakes up on a schedule (Mon–Fri, after the market closes)
   on GitHub's own servers — your computer doesn't need to be on.
2. It runs `scripts/fetch-eod.js`, which calls Yahoo Finance directly.
3. It writes the result into `data/eod-history.json` and commits/pushes
   that change back to this repo automatically.
4. Your dashboard fetches the **raw GitHub URL** of that JSON file on load
   and merges any new dates into its own `tnxHistory` / SPX price store.

## One-time setup (15 minutes)

### 1. Create a GitHub account (if you don't have one)
Free at [github.com](https://github.com).

### 2. Create a new repository
- Click **New repository**
- Name it something like `alphaledger-eod` (the name doesn't matter)
- Set it to **Public** (simplest — lets the dashboard fetch the JSON
  without authentication) or **Private** if you'd rather — see the note
  at the bottom for private repo handling.
- Don't initialize with a README (we're uploading files directly).

### 3. Upload these files
Upload this entire folder structure to the repo, preserving paths:
```
.github/workflows/daily-eod-fetch.yml
scripts/fetch-eod.js
data/eod-history.json
```
Easiest way: on the repo's GitHub page, click **Add file → Upload files**,
drag the whole folder in, and commit.

### 4. Enable Actions (usually on by default)
Go to the **Actions** tab of your repo. If prompted, click to enable
workflows. You should see "Daily EOD Fetch (SPX + 10yr Treasury)" listed.

### 5. Test it manually once
In the **Actions** tab, click the workflow name, then **Run workflow**
(top right) → **Run workflow** again to confirm. Wait ~30 seconds and
refresh — you should see a green checkmark, and `data/eod-history.json`
in your repo should now have today's date with real numbers.

### 6. Get the raw file URL
Click into `data/eod-history.json` in your repo, then click the **Raw**
button. The URL will look like:
```
https://raw.githubusercontent.com/<your-username>/<repo-name>/main/data/eod-history.json
```
Copy that — you'll paste it into the dashboard once (Settings tab).

### 7. Point the dashboard at it
Open AlphaLedger → Performance → Settings → paste the raw URL into the
"EOD Data Source URL" field → Save. From then on, every time you open the
dashboard it will silently pull the latest committed data on load.

## Verifying it's running on its own

After setup, you don't need to do anything else. To check it's alive:
- GitHub repo → **Actions** tab → you'll see a new green run appear each
  weekday evening.
- `data/eod-history.json` will show a growing list of dates.

If a run ever fails (red X), click into it to see the log — the most
common cause is Yahoo briefly rate-limiting or changing response shape,
which usually self-resolves the next day.

## Private repo note

If you set the repo to Private, the raw URL above will return a 404/403
to anonymous requests (including from the dashboard, which fetches without
credentials). To keep it private, you'd need a GitHub Personal Access
Token passed in the request, which means embedding a secret in client-side
code saved on your machine — generally not worth the complexity for
non-sensitive data like SPX/Treasury closes. Public repo is the simplest
correct choice here.
