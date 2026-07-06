#!/usr/bin/env node
/**
 * fetch-eod.js
 * ─────────────────────────────────────────────────────────────
 * Fetches end-of-day prices for ^GSPC (S&P 500) and ^TNX (10yr
 * Treasury yield x10) from Yahoo Finance and appends/updates a
 * dated entry in data/eod-history.json.
 *
 * Designed to run unattended via GitHub Actions on a daily cron
 * schedule. Safe to run multiple times per day -- it overwrites
 * today's entry rather than duplicating it.
 *
 * Exit code 0 = success (even if markets closed / no new data).
 * Exit code 1 = hard failure (network error, bad response shape).
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'eod-history.json');
const SYMBOLS = ['^GSPC', '^TNX'];

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${symbol}`);
  }
  const data = await res.json();
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) {
    throw new Error(`No chart result for ${symbol} -- response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const meta = result.meta;
  const price = meta.regularMarketPrice != null ? meta.regularMarketPrice : meta.previousClose;
  const ts = meta.regularMarketTime;
  if (price == null) {
    throw new Error(`No price field for ${symbol}`);
  }
  const date = new Date(ts * 1000).toISOString().split('T')[0];
  return { symbol, price, date };
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // File doesn't exist yet or is corrupt -- start fresh.
    return { spx: {}, tnx: {}, lastUpdated: null };
  }
}

function saveHistory(history) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2) + '\n', 'utf8');
}

async function main() {
  const history = loadHistory();
  let anySuccess = false;
  const errors = [];

  for (const symbol of SYMBOLS) {
    try {
      const quote = await fetchQuote(symbol);
      if (symbol === '^GSPC') {
        history.spx[quote.date] = Math.round(quote.price * 100) / 100;
      } else if (symbol === '^TNX') {
        // ^TNX quotes the yield x10 (e.g. 42.50 means 4.25%). Store as a
        // decimal rate (0.0425) to match what the dashboard expects.
        // price=42.85 -> yield%=4.285 -> decimal=0.04285
        history.tnx[quote.date] = Math.round((yieldPct / 100) * 1000000) / 1000000;
      }
      anySuccess = true;
      console.log(`✓ ${symbol}: ${quote.price} on ${quote.date}`);
    } catch (e) {
      errors.push(`${symbol}: ${e.message}`);
      console.error(`✗ ${symbol}: ${e.message}`);
    }
  }

  if (anySuccess) {
    history.lastUpdated = new Date().toISOString();
    saveHistory(history);
    console.log(`\nSaved to ${DATA_FILE}`);
  }

  if (errors.length === SYMBOLS.length) {
    // Every symbol failed -- treat as a hard failure so the Action shows red.
    console.error('\nAll fetches failed:\n' + errors.join('\n'));
    process.exit(1);
  }

  if (errors.length > 0) {
    console.warn('\nSome fetches failed (non-fatal):\n' + errors.join('\n'));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
