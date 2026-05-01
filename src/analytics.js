const RISK_FREE_RATE = 0.065;
const PERIODS_PER_YEAR = 252;

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const std = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((x) => (x - m) ** 2)) / (arr.length - 1));
};
const safeDiv = (a, b) => (b === 0 ? null : a / b);
const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

function buildEquityCurve(trades, startingCapital) {
  const points = [{ t: trades.length ? trades[0].entryTime : new Date(), equity: startingCapital, label: 'Start' }];
  let equity = startingCapital;
  let peak = startingCapital;
  const peaks = [startingCapital];
  const drawdownAbs = [0];
  const drawdownPct = [0];
  for (const tr of trades) {
    equity += tr.pnl;
    points.push({ t: tr.exitTime, equity, label: `${tr.symbol} ${tr.side}` });
    if (equity > peak) peak = equity;
    peaks.push(peak);
    drawdownAbs.push(equity - peak);
    drawdownPct.push(peak > 0 ? (equity - peak) / peak : 0);
  }
  return { points, peaks, drawdownAbs, drawdownPct };
}

function dailyReturns(trades, startingCapital) {
  if (!trades.length) return [];
  const byDay = new Map();
  for (const t of trades) {
    const k = dateKey(t.exitTime);
    byDay.set(k, (byDay.get(k) || 0) + t.pnl);
  }
  const days = [...byDay.keys()].sort();
  const out = [];
  let equity = startingCapital;
  for (const d of days) {
    const pnl = byDay.get(d);
    const r = equity > 0 ? pnl / equity : 0;
    out.push(r);
    equity += pnl;
  }
  return out;
}

function drawdownEpisodes(equityPoints) {
  const episodes = [];
  let peak = equityPoints[0]?.equity ?? 0;
  let trough = peak;
  let inDD = false;
  for (let i = 1; i < equityPoints.length; i++) {
    const e = equityPoints[i].equity;
    if (e >= peak) {
      if (inDD) {
        episodes.push(peak === 0 ? 0 : (trough - peak) / peak);
        inDD = false;
      }
      peak = e;
      trough = e;
    } else {
      inDD = true;
      if (e < trough) trough = e;
    }
  }
  if (inDD) episodes.push(peak === 0 ? 0 : (trough - peak) / peak);
  return episodes;
}

function streaks(trades) {
  let maxW = 0, maxL = 0, curW = 0, curL = 0;
  for (const t of trades) {
    if (t.pnl > 0) {
      curW++; curL = 0;
      if (curW > maxW) maxW = curW;
    } else if (t.pnl < 0) {
      curL++; curW = 0;
      if (curL > maxL) maxL = curL;
    } else {
      curW = 0; curL = 0;
    }
  }
  return { maxConsecWins: maxW, maxConsecLosses: maxL };
}

function analyze(trades, startingCapital) {
  const n = trades.length;
  const empty = !n;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);

  const netProfit = sum(trades.map((t) => t.pnl));
  const grossProfit = sum(wins.map((t) => t.pnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));

  const equity = buildEquityCurve(trades, startingCapital);
  const maxDD = empty ? 0 : Math.min(...equity.drawdownAbs);
  const maxDDPct = empty ? 0 : Math.min(...equity.drawdownPct);
  const ddEpisodes = drawdownEpisodes(equity.points);
  const avgDDPct = ddEpisodes.length ? mean(ddEpisodes) : 0;
  const ulcer = empty ? 0 : Math.sqrt(mean(equity.drawdownPct.map((d) => d * d))) * 100;

  const dr = dailyReturns(trades, startingCapital);
  const drMean = mean(dr);
  const drStd = std(dr);
  const downside = dr.filter((r) => r < 0);
  const drDownStd = std(downside);
  const sharpe = safeDiv((drMean - RISK_FREE_RATE / PERIODS_PER_YEAR), drStd);
  const sortino = safeDiv((drMean - RISK_FREE_RATE / PERIODS_PER_YEAR), drDownStd);

  const lastEquity = equity.points[equity.points.length - 1]?.equity ?? startingCapital;
  const totalReturnPct = startingCapital > 0 ? (lastEquity - startingCapital) / startingCapital : 0;
  const firstDate = trades[0]?.entryTime;
  const lastDate = trades[n - 1]?.exitTime;
  const yearsElapsed = firstDate && lastDate ? Math.max((lastDate - firstDate) / (365.25 * 24 * 3600 * 1000), 1 / 365.25) : 1 / 365.25;
  const annualizedReturn = empty ? 0 : Math.pow(1 + totalReturnPct, 1 / yearsElapsed) - 1;
  const calmar = safeDiv(annualizedReturn, Math.abs(maxDDPct));

  const longs = trades.filter((t) => t.side === 'long');
  const shorts = trades.filter((t) => t.side === 'short');
  const { maxConsecWins, maxConsecLosses } = streaks(trades);

  const annualizedSharpe = sharpe == null ? null : sharpe * Math.sqrt(PERIODS_PER_YEAR);
  const annualizedSortino = sortino == null ? null : sortino * Math.sqrt(PERIODS_PER_YEAR);

  const metrics = {
    profitability: {
      netProfit,
      grossProfit,
      grossLoss,
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss,
      expectancy: empty ? 0 : netProfit / n,
    },
    risk: {
      maxDrawdown: maxDD,
      maxDrawdownPct: maxDDPct,
      avgDrawdownPct: avgDDPct,
      riskReward: losses.length === 0 ? null : (mean(wins.map((t) => t.pnl)) / Math.abs(mean(losses.map((t) => t.pnl)))),
      ulcerIndex: ulcer,
    },
    performance: {
      totalTrades: n,
      winRate: empty ? 0 : wins.length / n,
      lossRate: empty ? 0 : losses.length / n,
      avgWin: wins.length ? mean(wins.map((t) => t.pnl)) : 0,
      avgLoss: losses.length ? mean(losses.map((t) => t.pnl)) : 0,
      largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0,
      largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0,
    },
    efficiency: {
      sharpe: annualizedSharpe,
      sortino: annualizedSortino,
      calmar,
      annualizedReturn,
      totalReturnPct,
      riskFreeRate: RISK_FREE_RATE,
      periodsPerYear: PERIODS_PER_YEAR,
    },
    behavior: {
      totalTrades: n,
      avgDurationMs: n ? mean(trades.map((t) => t.durationMs)) : 0,
      longCount: longs.length,
      longPnL: sum(longs.map((t) => t.pnl)),
      shortCount: shorts.length,
      shortPnL: sum(shorts.map((t) => t.pnl)),
      maxConsecWins,
      maxConsecLosses,
    },
  };

  return {
    metrics,
    equityCurve: equity.points.map((p) => ({ t: p.t, equity: p.equity, label: p.label })),
    drawdownCurve: equity.points.map((p, i) => ({
      t: p.t,
      drawdown: equity.drawdownAbs[i],
      drawdownPct: equity.drawdownPct[i],
    })),
    trades,
  };
}

module.exports = { analyze, RISK_FREE_RATE, PERIODS_PER_YEAR };
