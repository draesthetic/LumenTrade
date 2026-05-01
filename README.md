# Trade Analytics

Self-hosted Node.js webapp that turns a Zerodha tradebook (.xlsx or .csv) into a NAV curve, drawdown chart, and a full set of profitability / risk / efficiency / behavior metrics.

## Run

```bash
npm install
npm start
```

Then open http://localhost:3000, upload a Zerodha tradebook (F&O or EQ export), enter starting capital, hit Analyze.

## Metrics

- **Profitability** — Net P&L, Gross Profit, Gross Loss, Profit Factor, Expectancy
- **Risk** — Max Drawdown (₹ / %), Avg Drawdown %, Risk:Reward, Ulcer Index
- **Performance** — Win Rate, Loss Rate, Avg Win, Avg Loss, Largest Win, Largest Loss
- **Efficiency** — Sharpe, Sortino, Calmar, Annualized Return (rf 6.5%, 252 trading days)
- **Behavior** — Total Trades, Avg Duration, Long vs Short P&L, Max Consecutive Wins / Losses

Trade pairing uses FIFO queues per symbol, supports partial closes, handles long and short round trips, and surfaces any positions still open at the end of the file.

## Stack

Express + multer + SheetJS on the backend, vanilla JS + Chart.js on the frontend. No database, no build step, all in-memory per request.
