const RISK_FREE_RATE = 0.065;
const PERIODS_PER_YEAR = 252;

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
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
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    peaks.push(peak);
    drawdownAbs.push(equity - peak);
    drawdownPct.push(peak > 0 ? (equity - peak) / peak : 0);
    if (equity > peak) peak = equity;
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

function tradeFrequency(trades) {
  if (!trades.length) return { perDay: 0, perWeek: 0, perMonth: 0 };
  const firstDate = new Date(trades[0].entryTime);
  const lastDate = new Date(trades[trades.length - 1].exitTime);
  const totalDays = Math.max((lastDate - firstDate) / (24 * 3600 * 1000), 1);
  const totalWeeks = totalDays / 7;
  const totalMonths = totalDays / 30.4375;
  return {
    perDay: trades.length / totalDays,
    perWeek: trades.length / totalWeeks,
    perMonth: trades.length / totalMonths,
  };
}

function dayOfWeekAnalysis(trades) {
  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const t of trades) {
    const dow = new Date(t.entryTime).getDay();
    byDay[dow].push(t.pnl);
  }
  return Object.entries(byDay).map(([dow, pnls]) => ({
    day: DAY_NAMES[dow],
    trades: pnls.length,
    pnl: sum(pnls),
    avgPnl: pnls.length ? mean(pnls) : 0,
    winRate: pnls.length ? pnls.filter(p => p > 0).length / pnls.length : 0,
  }));
}

function positionSizing(trades) {
  if (!trades.length) return { avg: 0, median: 0, std: 0, min: 0, max: 0 };
  const qtys = trades.map(t => t.qty);
  return {
    avg: mean(qtys),
    median: median(qtys),
    std: std(qtys),
    min: Math.min(...qtys),
    max: Math.max(...qtys),
  };
}

function symbolBreakdown(trades) {
  const bySymbol = {};
  for (const t of trades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, pnl: 0, wins: 0, losses: 0 };
    bySymbol[t.symbol].trades++;
    bySymbol[t.symbol].pnl += t.pnl;
    if (t.pnl > 0) bySymbol[t.symbol].wins++;
    else if (t.pnl < 0) bySymbol[t.symbol].losses++;
  }
  return Object.entries(bySymbol)
    .map(([symbol, data]) => ({ symbol, ...data, winRate: data.trades ? data.wins / data.trades : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

function rollingWinRate(trades, windowSize = 10) {
  if (trades.length < windowSize) return [];
  const results = [];
  for (let i = windowSize - 1; i < trades.length; i++) {
    const window = trades.slice(i - windowSize + 1, i + 1);
    const wins = window.filter(t => t.pnl > 0).length;
    results.push({ index: i, winRate: wins / windowSize });
  }
  return results;
}

function overnightAnalysis(trades) {
  const held = trades.filter(t => {
    const entry = new Date(t.entryTime);
    const exit = new Date(t.exitTime);
    return entry.toDateString() !== exit.toDateString();
  });
  const dayTrades = trades.filter(t => !held.includes(t));
  return {
    overnightCount: held.length,
    overnightPnL: sum(held.map(t => t.pnl)),
    dayTradeCount: dayTrades.length,
    dayTradePnL: sum(dayTrades.map(t => t.pnl)),
    overnightWinRate: held.length ? held.filter(t => t.pnl > 0).length / held.length : 0,
    dayTradeWinRate: dayTrades.length ? dayTrades.filter(t => t.pnl > 0).length / dayTrades.length : 0,
  };
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

  const freq = tradeFrequency(trades);
  const dayOfWeek = dayOfWeekAnalysis(trades);
  const sizing = positionSizing(trades);
  const symbols = symbolBreakdown(trades);
  const rollingWR = rollingWinRate(trades, 10);
  const overnight = overnightAnalysis(trades);
  const breakeven = trades.filter(t => t.pnl === 0).length;
  const durations = trades.map(t => t.durationMs);
  const recoveryFactor = maxDD !== 0 ? safeDiv(netProfit, Math.abs(maxDD)) : null;

  const avgWinLoss = wins.length && losses.length ? mean(wins.map(t => t.pnl)) / Math.abs(mean(losses.map(t => t.pnl))) : null;
  const avgWinRMultiple = avgWinLoss !== null && avgWinLoss > 0 ? avgWinLoss : null;

  const avgDurationMs = n ? mean(durations) : 0;
  const medianDurationMs = n ? median(durations) : 0;
  const stdDurationMs = n > 1 ? std(durations) : 0;

  const lastTradeDate = trades[n - 1]?.exitTime;
  const totalTimeMs = firstDate && lastTradeDate ? lastTradeDate - firstDate : 0;
  const totalPositionTimeMs = sum(durations);
  const timeInMarketPct = totalTimeMs > 0 ? (totalPositionTimeMs / totalTimeMs) * 100 : 0;

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
      riskReward: losses.length === 0 ? null : (wins.length === 0 ? null : mean(wins.map((t) => t.pnl)) / Math.abs(mean(losses.map((t) => t.pnl)))),
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
      avgDurationMs,
      medianDurationMs,
      stdDurationMs,
      longCount: longs.length,
      longPnL: sum(longs.map((t) => t.pnl)),
      shortCount: shorts.length,
      shortPnL: sum(shorts.map((t) => t.pnl)),
      maxConsecWins,
      maxConsecLosses,
      tradeFrequency: freq,
      timeInMarketPct,
    },
    extended: {
      dayOfWeekPnL: dayOfWeek,
      positionSizing: sizing,
      symbolBreakdown: symbols,
      rollingWinRate: rollingWR,
      overnightVsDayTrades: overnight,
      breakevenCount: breakeven,
      profitPerTrade: empty ? 0 : netProfit / n,
      recoveryFactor,
      avgRiskRewardMultiple: avgWinRMultiple,
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
