# LumenTrade — Project State

> Snapshot for continuation in a fresh session. Last updated 2026-06-16.

## What it is

A **fully client-side** web app that turns a **Zerodha tradebook** (`.xlsx`/`.csv`) into a NAV/equity
curve, drawdown chart, and a full panel of profitability / risk / efficiency / behaviour trade
statistics. As of 2026-06-16 all parsing and analysis run **in the browser** — data never leaves the
machine — so it deploys as a static site on **GitHub Pages**. `server.js` remains only as an optional
local dev server. No database, no build step.

- Folder name: `LumenTrade`
- `package.json` name: `lumentrade` (v1.0.0)
- UI title / README title: **LumenTrade**
- (Renamed to LumenTrade everywhere on 2026-06-15 — folder, package.json, package-lock.json,
  index.html `<title>` + `<h1>`, README heading, and the server startup log all agree now.)

## Current architecture

```
src/pipeline.js           runAnalysis() — orchestrator (validate → parse → pair → categorize
                          → settle → analyze); + getContractExpiry/categorizeOpenPositions
src/parseTradebook.js     Parse Zerodha tradebook → normalized fills[]   (SheetJS)
src/pairTrades.js         FIFO long/short round-trip pairing → closed[] + openPositions[]
src/parsePnL.js           Parse Zerodha P&L statement (script-wise) → entries[]   (SheetJS)
src/settleExpired.js      Derive settlement prices for expired contracts from P&L file
src/analytics.js          analyze() → all metrics, equity curve, drawdown curve
public/index.html         Single-page dashboard; loads engine/*.js + app.js
public/app.js             Vanilla-JS frontend; calls window.runAnalysis() locally
public/styles.css         Neo-brutalist "premium paper" styling
server.js                 OPTIONAL local dev server (serves public/ + /engine, /upload parity)
.github/workflows/pages.yml  Builds the static site (public/ + src→engine/) and deploys to Pages
```

**Stack:** vanilla JS + Chart.js 4 + SheetJS (browser build via CDN) on the frontend — no framework,
no bundler, no build step. Every `src/` module is a **dual node/browser** file (IIFE-wrapped so the
classic `<script>` tags don't collide in the shared global scope; each exposes one `window.*`). The
browser loads them as `engine/*.js` and runs `window.runAnalysis(...)`; the optional `server.js`
`require()`s the same modules — one source of truth. Range filtering re-runs `window.analyze` on the
sliced window. Data is processed entirely in-browser and never uploaded.

**UI (redesigned 2026-06-15 — neo-brutalist "premium paper"):** Implemented from a Claude Design
handoff bundle. Warm cream paper + warm ink, **monochromatic** with green/red reserved strictly for
P&L (no accent colour). Bricolage Grotesque 800 headings/numbers, Hanken Grotesk UI, JetBrains Mono
data. Float-pill sticky nav with hard offset shadow + scrollspy; Paper↔Ink theme toggle
(`localStorage` `lt-theme`). No card containers — sections divided by hairline + 3px rules; KPI strip,
line-divided metric columns, borderless hairline trades table. `src/analytics.js` is now a **dual
node/browser module** served to the client at `/analytics.js`, so range filtering (1M/3M/ALL)
re-runs the *exact* server engine on the sliced window (replaces the old partial client recompute).
Real backend features preserved: `/upload`, optional P&L statement, risk-free-rate input,
settlement/reconciliation/warnings in the status bar, session restore.

**Request flow (`POST /upload`):**
1. Accept `file` (tradebook, required), `pnlFile` (P&L statement, optional), `startingCapital`,
   `riskFreeRate` (default 0.065), `charges` (default 0).
2. `parseTradebook` → fills, sorted by execution time.
3. `pairTrades` → FIFO-paired closed trades + leftover open positions.
4. `categorizeOpenPositions` → split open positions into **active** vs **expired** by parsing the
   contract symbol (monthly `NIFTY25JANFUT` last-Thursday, weekly `NIFTY25JAN18FUT` explicit day),
   comparing expiry close (15:30 IST = 10:00 UTC) against now.
5. If a P&L file is supplied, `settleExpiredPositions` recovers synthetic settlement closes by
   subtracting tradebook fill values from P&L-file Buy/Sell totals; also produces a reconciliation
   note (gross tradebook vs P&L-file net, flags mismatch > ₹100 as likely charges/taxes).
6. `analyze` distributes total `charges` evenly across trades (keeps `grossPnl` for display),
   then computes every metric on net P&L.
7. Returns metrics, equity curve, drawdown curve, trades, open/expired/settled positions, warnings.

**Frontend features:** drag-and-drop upload, capital presets, light/dark toggle (persisted to
`localStorage`), session restore of last analysis (`sessionStorage`), NAV range filtering
(1M/3M/ALL) with metric recompute on subset, synced horizontal scroll across charts, CSV export,
trades table with tabs (Closed / By Symbol / Extended), search, side filter, sortable columns.

## Metrics computed (`src/analytics.js`)

- **Profitability:** Net/Gross Profit, Gross Loss, Profit Factor, Expectancy, charges deducted.
- **Risk:** Max Drawdown (₹ / %), Avg Drawdown % (per-episode), Risk:Reward, Ulcer Index.
- **Performance:** Win/Loss rate, Avg/Largest Win & Loss.
- **Efficiency:** Sharpe & Sortino (annualized ×√252), Calmar, Annualized & Total Return
  (rf 6.5% default, 252 trading days).
- **Behavior:** trade count, avg/median/std duration, long vs short P&L, max consecutive
  wins/losses, trade frequency, time-in-market % (merged intervals, capped 100%).
- **Extended:** day-of-week, position sizing, symbol breakdown, rolling expectancy (20/50),
  overnight vs day trades, recovery factor, avg R-multiple.

## Completed work

Per git history, the app went through several rounds of correctness and hardening fixes:

- Initial trade-analytics webapp (NAV, drawdown, stats).
- UI redesign + P&L settlement resolution; light/dark toggle; +20% font sizes.
- Landing page integration + analytics UI refresh.
- **Multiple backend calculation bug fixes** (analytics audit): settlement logic
  (multi-tranche, zero-value), PnL parsing (`raw:true`), tradebook parsing, drawdown chart
  peak-order bug, four further analytics calc bugs, four more backend parsing bugs + stale-config
  cleanup.
- Frontend overhaul: range filtering, session restore, CSV export, scroll-sync fix.
- **Security hardening:** bind to `127.0.0.1` only, generic client-facing errors, gitignore P&L files.
- Removed stray Next.js build artifacts.

Working tree is **clean**, on `main`, up to date with `origin/main`.

## Modified / key files

All source is committed; no uncommitted changes. Files most central to behavior:
`server.js`, `src/analytics.js`, `src/settleExpired.js`, `src/pairTrades.js`,
`src/parseTradebook.js`, `src/parsePnL.js`, `public/app.js`.

## Important decisions

- **In-memory only**, per request — no persistence, no DB. Uploaded files live only in the
  request buffer (multer memory storage, 10 MB cap).
- **Loopback-only bind by default** (`127.0.0.1`) because the dashboard exposes real P&L data and
  there is **no auth**. Remote access is expected via SSH tunnel or explicit `HOST=0.0.0.0` on a
  trusted LAN only.
- **Charges are distributed evenly** across all trades (not per-trade actual), since the tradebook
  has no per-fill charge column; `grossPnl` preserved for display.
- **Expired-contract settlement** is reconstructed from the P&L statement deltas rather than
  fabricated prices; positions that can't be resolved are surfaced as `unresolvedExpired`.
- **Expiry comparison uses 15:30 IST**, not midnight UTC, so a contract isn't flagged expired
  before market open on expiry day.
- Express pinned `^4.19.2` resolving ≥4.21 to pull CVE-2024-43796 / CVE-2024-43800 fixes.

## Constraints

- **No authentication** of any kind — must not be exposed publicly as-is.
- Tradebook must be a genuine Zerodha export: header row needs both `Symbol` and `Trade Type`;
  required cols Symbol / Trade Type / Quantity / Price. P&L file needs Symbol + Buy/Sell Value.
- Expiry inference is **NSE-derivative-specific** (last-Thursday monthly, explicit-day weekly);
  non-FUT symbols are always treated as active.
- Fills with missing Order Execution Time fall back to trade-date ordering → intraday sequence may
  be inaccurate (surfaced as a warning).
- Chart.js + date-fns adapter loaded from **jsDelivr CDN** → requires internet for the UI to render.
- Node/Express server must be reachable; frontend talks only to its own `/upload`.

## Known gaps / pending items

- **No automated tests** despite `server.js` exporting `getContractExpiry` /
  `categorizeOpenPositions` "for testing" — there is no test runner or test file.
- Expiry-day rule assumes **Thursday** expiries; NSE has shifted some contracts to other weekdays,
  so monthly last-Thursday inference may be wrong for newer contracts.
- No per-trade actual charges (even distribution is an approximation).
- No persistence — refreshing relies on `sessionStorage`; clearing it loses the analysis.
- Options (CE/PE) open positions are never expiry-settled — `getContractExpiry` only matches
  `…FUT` symbols, so expired option legs show as perpetually open. Fine while the app is
  futures-only, but a gap if options are ever loaded.

### Calculation audit (2026-06-15)

Fixed:
- **`annualizedReturn`/Calmar returned `NaN`** when final equity ≤ 0 (loss ≥ 100% of capital —
  reachable with leveraged F&O): `Math.pow` on a non-positive base. Now floored at -100%.
  (`src/analytics.js`)
- **Range-filtered Max Drawdown was wrong.** 1M/3M view sliced the global-peak drawdown series
  and computed ₹ as `firstEq × globalPct`. Now recomputed from the window's own running peak.
  (`public/app.js`, `computeRangeMetrics`)

Superseded by the redesign:
- The old `computeRangeMetrics` (and its windowed-drawdown fix) is gone. Range filtering now calls
  the shared `window.analyze` on the sliced window, which computes drawdown — and every other metric,
  including Sharpe/Sortino/Calmar/Ulcer that the old partial recompute left blank — correctly from
  first principles. Client passes Date objects (normalized from JSON ISO strings) so the engine's
  date arithmetic matches the server path.

Noted, not changed (by design / low priority):
- Sharpe/Sortino count NSE market holidays as zero-return weekdays (no holiday calendar) →
  slightly deflated ratios.
- Profit Factor is `Infinity` when there are zero losing trades; `JSON.stringify` turns that into
  `null`, so the ALL view shows "—" while the range view (in-JS) shows "∞" — cosmetic inconsistency.
- Annualizing very short samples (e.g. one strong day) inflates Annualized Return by formula.
- Range view intentionally leaves Sharpe/Sortino/Calmar/Ulcer/Avg-DD blank (shows "—"/0).
- Mixed timezone handling in date parsing (numeric Excel serials → UTC, string dates → local);
  safe on an IST machine, can mis-bucket near midnight on a non-IST server.

## How to run

```bash
npm install
npm start            # node server.js
# open http://127.0.0.1:3000
```

Optional env: `PORT` (default 3000), `HOST` (default 127.0.0.1).

## Next steps (suggested)

1. Add a test suite (Node's built-in `node:test`) covering `getContractExpiry`, `pairTrades`
   FIFO/partial closes, `settleExpiredPositions`, and key `analyze` metrics with fixture files.
2. Reconcile the project name across folder / package.json / UI.
3. Revisit expiry-day logic for non-Thursday NSE contracts.
4. Consider optional lightweight auth (or document the SSH-tunnel workflow more prominently) before
   any non-localhost deployment.
5. Optionally support per-trade charges if a charges column becomes available in exports.
