# Trade Analytics

Self-hosted Node.js webapp that turns a Zerodha tradebook (.xlsx or .csv) into a NAV curve, drawdown chart, and a full set of profitability / risk / efficiency / behavior metrics.

## Run

```bash
npm install
npm start
```

Then open <http://127.0.0.1:3000>, upload a Zerodha tradebook (F&O or EQ export), enter starting capital, hit Analyze.

The server binds to **`127.0.0.1` only** by default — there is no auth in front of it and the upload page exposes real P&L data. To reach it from another machine, either SSH-tunnel (`ssh -L 3000:localhost:3000 host`) or set `HOST=0.0.0.0` explicitly (only do this on a trusted LAN). Express is pinned to `^4.19.2` and resolved to ≥4.21 to pull in fixes for CVE-2024-43796 (`res.sendFile` path traversal) and CVE-2024-43800 (`res.redirect` XSS).

## Metrics

- **Profitability** — Net P&L, Gross Profit, Gross Loss, Profit Factor, Expectancy
- **Risk** — Max Drawdown (₹ / %), Avg Drawdown %, Risk:Reward, Ulcer Index
- **Performance** — Win Rate, Loss Rate, Avg Win, Avg Loss, Largest Win, Largest Loss
- **Efficiency** — Sharpe, Sortino, Calmar, Annualized Return (rf 6.5%, 252 trading days)
- **Behavior** — Total Trades, Avg Duration, Long vs Short P&L, Max Consecutive Wins / Losses

Trade pairing uses FIFO queues per symbol, supports partial closes, handles long and short round trips, and surfaces any positions still open at the end of the file.

## Stack

Express + multer + SheetJS on the backend, vanilla JS + Chart.js on the frontend. No database, no build step, all in-memory per request.
