# LumenTrade

Turns a Zerodha tradebook (.xlsx or .csv) into a NAV curve, drawdown chart, and a full set of profitability / risk / efficiency / behaviour metrics. **Fully client-side** — your tradebook and P&L data are parsed and analysed entirely in your browser and never leave your machine, so it runs as a static site (GitHub Pages) with no backend.

## Use it

**Hosted:** <https://draesthetic.github.io/LumenTrade/> — drop a Zerodha tradebook (F&O or EQ export), enter starting capital and risk-free rate, optionally add the P&L statement, hit Analyze. Nothing is uploaded anywhere; all processing is local to the page.

**Local (optional dev server):**

```bash
npm install
npm start          # http://127.0.0.1:3000
```

`server.js` is now only a convenience for local development — it serves the same static files and exposes `/upload` for parity testing. The deployed app needs no server.

## Architecture

The analysis pipeline (`src/`) is a set of dual node/browser modules: `parseTradebook`, `pairTrades`, `parsePnL`, `settleExpired`, `analytics`, and `pipeline` (the orchestrator, `runAnalysis`). The browser loads them as `engine/*.js` and runs `window.runAnalysis(...)`; `server.js` `require()`s the exact same modules — one source of truth, no drift. GitHub Pages is built by `.github/workflows/pages.yml`, which copies `public/` to the site root and `src/*.js` into `engine/`.

## Metrics

- **Profitability** — Net P&L, Gross Profit, Gross Loss, Profit Factor, Expectancy
- **Risk** — Max Drawdown (₹ / %), Avg Drawdown %, Risk:Reward, Ulcer Index
- **Performance** — Win Rate, Loss Rate, Avg Win, Avg Loss, Largest Win, Largest Loss
- **Efficiency** — Sharpe, Sortino, Calmar, Annualized Return (rf 6.5%, 252 trading days)
- **Behavior** — Total Trades, Avg Duration, Long vs Short P&L, Max Consecutive Wins / Losses

Trade pairing uses FIFO queues per symbol, supports partial closes, handles long and short round trips, and surfaces any positions still open at the end of the file.

## Stack

Vanilla JS + Chart.js + SheetJS (browser build via CDN) on the frontend — no framework, no bundler, no build step. The optional local dev server is Express + multer + SheetJS. No database; all processing is in-memory in the browser.
