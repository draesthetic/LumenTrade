/* ════════════════════════════════════════════════════════════════════════════
   LumenTrade — app logic
   Neo-brutalist "premium paper" UI, wired to the real /upload backend.
   Range filtering re-runs the shared analytics engine (window.analyze, served
   from src/analytics.js) on the sliced window for exact windowed metrics.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Formatters ──────────────────────────────────────────────────────────── */
const inr   = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const pct   = (v, d = 2) => (v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const num   = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v === Infinity ? '∞' : Number(v).toFixed(d));
const money = v => (v == null || !isFinite(v) ? '—' : inr(v));
const moneyK = v => {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a/1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a/1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a/1e3).toFixed(1)}k`;
  return `${s}₹${a.toFixed(0)}`;
};
const ratio = v => (v == null || !isFinite(v) ? '—' : v === Infinity ? '∞' : v.toFixed(2));
function fmtDuration(ms) {
  if (!ms || !isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${(h / 24).toFixed(1)}d`;
}
const fmtDate = d => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDateShort = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

/* ── Theme-aware chart colours ───────────────────────────────────────────── */
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function palette() {
  return {
    ink: css('--ink'), sub: css('--sub'), line: css('--line'), paper: css('--paper'),
    green: css('--green'), red: css('--red'),
    greenSoft: css('--green-soft'), redSoft: css('--red-soft'), inkSoft: css('--ink-soft'),
  };
}

/* ── State ───────────────────────────────────────────────────────────────── */
let navChart, ddChart, dowChart, rollingChart;
let currentData = null;
let currentRange = 'ALL';
let allTrades = [], filteredTrades = [], originalTrades = [];
let currentSort = { key: 'exitTime', dir: 1 };
let currentSide = 'all', currentSearch = '';
let maxAbsPnl = 1, fullNavData = null;
let isSyncingScroll = false, scrollAbort = null;

const resultsEl = document.getElementById('results');

/* Normalize trades coming from JSON (ISO strings) → Date objects so the shared
   analytics engine's date arithmetic works identically to the server path. */
function normalizeTrades(trades) {
  return trades.map(t => ({ ...t, entryTime: new Date(t.entryTime), exitTime: new Date(t.exitTime) }));
}

/* ── Master render ───────────────────────────────────────────────────────── */
function render(data) {
  data = { ...data, trades: normalizeTrades(data.trades) };
  currentData = data;
  originalTrades = data.trades.slice();
  allTrades = data.trades.slice();
  maxAbsPnl = allTrades.reduce((a, t) => Math.max(a, Math.abs(t.pnl)), 1);

  resultsEl.hidden = false;
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));

  renderMasthead(data);
  renderKpis(data);
  renderCharts(data);
  renderMetrics(data.metrics);
  applyFilters();
  renderSymbolsTab(data.trades, data.metrics);
  renderExtendedTab(data.metrics);
  currentRange = 'ALL';
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b.dataset.range === 'ALL'));
}

/* ── Masthead meta ───────────────────────────────────────────────────────── */
function renderMasthead(data) {
  const t = data.trades;
  if (t.length) {
    const first = t.reduce((m, x) => new Date(x.entryTime) < new Date(m.entryTime) ? x : m).entryTime;
    const last  = t.reduce((m, x) => new Date(x.exitTime) > new Date(m.exitTime) ? x : m).exitTime;
    document.getElementById('mm-period').textContent = `${fmtDateShort(first)} – ${fmtDateShort(last)}`;
  }
  document.getElementById('mm-fills').textContent = `${data.fillCount} → ${t.length}`;
  document.getElementById('mm-capital').textContent = money(data.startingCapital);
  const syms = new Set(t.map(x => x.symbol)).size;
  document.getElementById('mm-symbols').textContent = `${syms} symbols`;
  document.getElementById('overview-note').textContent = `${t.length} closed trades`;
}

/* ── KPI strip ───────────────────────────────────────────────────────────── */
function renderKpis(data) {
  const m = data.metrics;
  const start = data.startingCapital;
  const lastEq = data.equityCurve[data.equityCurve.length - 1]?.equity ?? start;
  const retPct = start > 0 ? (lastEq - start) / start : 0;
  const set = (id, val, sub, cls) => {
    const el = document.getElementById(id);
    el.querySelector('.kpi-value').textContent = val;
    el.querySelector('.kpi-value').className = `kpi-value ${cls || ''}`;
    el.querySelector('.kpi-sub').textContent = sub;
  };
  const wins = data.trades.filter(t => t.pnl > 0).length;
  const losses = data.trades.filter(t => t.pnl < 0).length;
  set('hkpi-pnl', moneyK(m.profitability.netProfit), `from ${moneyK(start)}`, m.profitability.netProfit >= 0 ? 'green' : 'red');
  set('hkpi-return', pct(retPct, 1), `ann. ${pct(m.efficiency.annualizedReturn, 1)}`, retPct >= 0 ? 'green' : 'red');
  set('hkpi-winrate', pct(m.performance.winRate, 0), `${wins}W · ${losses}L`, '');
  set('hkpi-sharpe', ratio(m.efficiency.sharpe), `Sortino ${ratio(m.efficiency.sortino)}`, '');
  set('hkpi-dd', pct(m.risk.maxDrawdownPct, 1), moneyK(m.risk.maxDrawdown), 'red');
  const open = data.openPositions?.length || 0;
  set('hkpi-open', String(open), open ? 'still open' : 'flat / all closed', '');
}

/* ── Charts ──────────────────────────────────────────────────────────────── */
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 11;

function renderCharts(data) {
  const navLabels = data.equityCurve.map(p => new Date(p.t));
  const navValues = data.equityCurve.map(p => p.equity);
  const ddValues  = data.drawdownCurve.map(p => p.drawdownPct * 100);
  fullNavData = { labels: navLabels, values: navValues, ddValues };

  const pxp = navLabels.length > 600 ? 2.4 : 1.5;
  const minW = Math.max(navLabels.length * pxp, vpW('nav-scroll'));
  innerW('nav-scroll-inner', minW);
  innerW('dd-scroll-inner', minW);
  innerW('pnl-scroll-inner', Math.max(navLabels.length * 7, vpW('pnl-scroll')));

  buildNav(navLabels, navValues);
  buildDd(navLabels, ddValues);
  renderNavCurrent(navValues);
  renderDdStats(data.metrics);
  renderPnlDist(data.trades);
  buildDow(data.metrics);
  buildRolling(data.metrics, data.trades);
  renderOvernight(data.metrics);

  if (scrollAbort) scrollAbort.abort();
  scrollAbort = new AbortController();
  syncScroll();
}

function vpW(id) { const el = document.getElementById(id); return el ? el.clientWidth : 0; }
function innerW(id, w) { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.floor(w))}px`; }

function syncScroll() {
  const sc = Array.from(document.querySelectorAll('.chart-scroll[data-sync="charts"]'));
  sc.forEach(s => {
    s.addEventListener('scroll', () => {
      if (isSyncingScroll) return; isSyncingScroll = true;
      sc.forEach(o => { if (o !== s) o.scrollLeft = s.scrollLeft; });
      requestAnimationFrame(() => { isSyncingScroll = false; });
    }, { signal: scrollAbort.signal });
    s.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      s.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false, signal: scrollAbort.signal });
  });
}

function baseScales(p, opts = {}) {
  return {
    x: { type: 'time', time: { tooltipFormat: 'PP HH:mm' },
         ticks: { color: p.sub, maxTicksLimit: opts.xTicks ?? 7, display: opts.xDisplay !== false },
         grid: { display: false }, border: { color: p.line } },
    y: { ticks: { color: p.sub, maxTicksLimit: opts.yTicks ?? 5, callback: opts.yFmt },
         grid: { color: p.line }, border: { display: false } },
  };
}
function tip(p) {
  return { backgroundColor: p.ink, titleColor: p.paper, bodyColor: p.paper, borderWidth: 0,
           cornerRadius: 0, padding: 10, titleFont: { family: "'JetBrains Mono'", weight: '700' },
           bodyFont: { family: "'JetBrains Mono'" } };
}

function buildNav(labels, values) {
  const p = palette();
  if (navChart) navChart.destroy();
  navChart = new Chart(document.getElementById('nav-chart'), {
    type: 'line',
    data: { labels, datasets: [{
      data: values, borderColor: p.ink, borderWidth: 2.4, fill: true,
      backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
        g.addColorStop(0, p.inkSoft); g.addColorStop(1, 'transparent'); return g;
      },
      tension: 0.12, pointRadius: 0, pointHoverRadius: 5,
      pointHoverBackgroundColor: p.paper, pointHoverBorderColor: p.ink, pointHoverBorderWidth: 2,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tip(p), callbacks: { label: c => '₹' + Math.round(c.parsed.y).toLocaleString('en-IN') } } },
      scales: baseScales(p, { yFmt: v => '₹' + (v/1e5).toFixed(1) + 'L' }),
    },
  });
}

function buildDd(labels, values) {
  const p = palette();
  if (ddChart) ddChart.destroy();
  ddChart = new Chart(document.getElementById('dd-chart'), {
    type: 'line',
    data: { labels, datasets: [{
      data: values, borderColor: p.red, borderWidth: 2, fill: true,
      backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
        g.addColorStop(0, p.redSoft); g.addColorStop(1, 'transparent'); return g;
      },
      tension: 0.12, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: p.red,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tip(p), callbacks: { label: c => c.parsed.y.toFixed(2) + '%' } } },
      scales: baseScales(p, { xDisplay: false, yTicks: 4, yFmt: v => v.toFixed(0) + '%' }),
    },
  });
}

function renderNavCurrent(values) {
  const last = values[values.length - 1], first = values[0];
  const chg = first > 0 ? (last - first) / first * 100 : 0;
  const sign = chg >= 0 ? '+' : '';
  const col = chg >= 0 ? 'var(--green)' : 'var(--red)';
  const el = document.getElementById('nav-current');
  el.style.color = col;
  el.innerHTML = `${money(last)}<span class="chg" style="color:${col}">${sign}${chg.toFixed(1)}%</span>`;
}

function renderDdStats(m) {
  document.getElementById('dd-stats').innerHTML = `
    <div class="dd-stat">Max DD<b>${pct(m.risk.maxDrawdownPct, 1)}</b></div>
    <div class="dd-stat">Avg DD<b>${pct(m.risk.avgDrawdownPct, 1)}</b></div>
    <div class="dd-stat neutral">Ulcer<b>${num(m.risk.ulcerIndex)}</b></div>`;
}

function buildDow(m) {
  const p = palette();
  const d = m.extended?.dayOfWeekPnL || [];
  const days = d.filter(x => !['Sunday', 'Saturday'].includes(x.day));
  if (dowChart) dowChart.destroy();
  dowChart = new Chart(document.getElementById('dow-chart'), {
    type: 'bar',
    data: { labels: days.map(x => x.day.slice(0, 3)), datasets: [{
      data: days.map(x => x.pnl),
      backgroundColor: days.map(x => x.pnl >= 0 ? p.green : p.red),
      borderRadius: 0, borderSkipped: false, barPercentage: 0.66,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tip(p), callbacks: { label: c => '₹' + Math.round(c.parsed.y).toLocaleString('en-IN') } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: p.sub }, border: { color: p.line } },
        y: { grid: { color: p.line }, ticks: { color: p.sub, maxTicksLimit: 4, callback: v => '₹' + (v/1000).toFixed(0) + 'k' }, border: { display: false } },
      },
    },
  });
}

function buildRolling(m, trades) {
  const p = palette();
  const r20 = m.extended?.rollingExpectancy20 || [];
  const r50 = m.extended?.rollingExpectancy50 || [];
  const tmap = new Map(trades.map((t, i) => [i, t]));
  const xs = s => s.map(r => tmap.get(r.index) ? new Date(tmap.get(r.index).exitTime) : null);
  if (rollingChart) rollingChart.destroy();
  rollingChart = new Chart(document.getElementById('rolling-chart'), {
    type: 'line',
    data: {
      labels: (r20.length ? xs(r20) : xs(r50)),
      datasets: [
        { label: 'EXP·20', data: r20.map(r => r.expectancy), borderColor: p.ink, borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0 },
        { label: 'EXP·50', data: r50.map(r => r.expectancy), borderColor: p.sub, borderWidth: 2, borderDash: [4, 3], fill: false, tension: 0.3, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: p.sub, boxWidth: 12, boxHeight: 2, font: { family: "'JetBrains Mono'", size: 10 } } }, tooltip: tip(p) },
      scales: baseScales(p, { xTicks: 5, yTicks: 4, yFmt: v => '₹' + (v/1000).toFixed(0) + 'k' }),
    },
  });
}

function renderOvernight(m) {
  const o = m.extended?.overnightVsDayTrades || {};
  document.getElementById('overnight-stats').innerHTML = `
    <div class="ov-col">
      <div class="ov-label">Overnight</div>
      <div class="ov-count">${o.overnightCount || 0}</div>
      <div class="ov-pnl ${o.overnightPnL >= 0 ? 'pos' : 'neg'}">${moneyK(o.overnightPnL || 0)}</div>
      <div class="ov-wr">WR ${pct(o.overnightWinRate, 0)}</div>
    </div>
    <div class="ov-col">
      <div class="ov-label">Day Trades</div>
      <div class="ov-count">${o.dayTradeCount || 0}</div>
      <div class="ov-pnl ${o.dayTradePnL >= 0 ? 'pos' : 'neg'}">${moneyK(o.dayTradePnL || 0)}</div>
      <div class="ov-wr">WR ${pct(o.dayTradeWinRate, 0)}</div>
    </div>`;
}

function renderPnlDist(trades) {
  const c = document.getElementById('pnl-dist');
  if (!trades.length) { c.innerHTML = ''; return; }
  const maxAbs = trades.reduce((a, t) => Math.max(a, Math.abs(t.pnl)), 1);
  const minPnl = Math.min(...trades.map(t => t.pnl));
  const maxPnl = Math.max(...trades.map(t => t.pnl));
  const bars = trades.map(t => {
    const h = Math.max(3, Math.abs(t.pnl) / maxAbs * 116);
    return `<div class="pnl-bar ${t.pnl >= 0 ? 'pos' : 'neg'}" style="height:${h}px" title="${t.symbol}: ${money(t.pnl)}"></div>`;
  }).join('');
  c.innerHTML = `<div class="pnl-bars">${bars}</div>
    <div class="pnl-axis"><span class="lo">${moneyK(minPnl)}</span><span class="mid">0</span><span class="hi">${moneyK(maxPnl)}</span></div>`;
}

/* ── Metrics ─────────────────────────────────────────────────────────────── */
function renderMetrics(m) {
  const freq = m.behavior.tradeFrequency || {};
  const sizing = m.extended.positionSizing || {};
  const groups = [
    { title: 'Profitability', tick: 'green',
      hero: { label: 'Net Profit', val: moneyK(m.profitability.netProfit), cls: m.profitability.netProfit >= 0 ? 'green' : 'red' },
      rows: [['Gross Profit', moneyK(m.profitability.grossProfit), 'pos'], ['Gross Loss', moneyK(m.profitability.grossLoss), 'neg'],
             ['Profit Factor', ratio(m.profitability.profitFactor), ''], ['Expectancy / Trade', moneyK(m.profitability.expectancy), m.profitability.expectancy >= 0 ? 'pos' : 'neg']] },
    { title: 'Risk', tick: 'red',
      hero: { label: 'Max Drawdown', val: pct(m.risk.maxDrawdownPct, 1), cls: 'red' },
      rows: [['Max DD (₹)', moneyK(m.risk.maxDrawdown), 'neg'], ['Avg DD %', pct(m.risk.avgDrawdownPct, 1), 'neg'],
             ['Risk : Reward', ratio(m.risk.riskReward), ''], ['Ulcer Index', num(m.risk.ulcerIndex), ''], ['Recovery', ratio(m.extended.recoveryFactor), '']] },
    { title: 'Performance', tick: 'ink',
      hero: { label: 'Win Rate', val: pct(m.performance.winRate, 0), cls: 'green' },
      rows: [['Total Trades', m.performance.totalTrades, ''], ['Avg Win', moneyK(m.performance.avgWin), 'pos'], ['Avg Loss', moneyK(m.performance.avgLoss), 'neg'],
             ['Largest Win', moneyK(m.performance.largestWin), 'pos'], ['Largest Loss', moneyK(m.performance.largestLoss), 'neg'], ['Breakeven', m.extended.breakevenCount || 0, '']] },
    { title: 'Efficiency', tick: 'ink',
      hero: { label: 'Sharpe Ratio', val: ratio(m.efficiency.sharpe), cls: '' },
      rows: [['Sortino', ratio(m.efficiency.sortino), ''], ['Calmar', ratio(m.efficiency.calmar), ''],
             ['Ann. Return', pct(m.efficiency.annualizedReturn, 1), m.efficiency.annualizedReturn >= 0 ? 'pos' : 'neg'],
             ['Total Return', pct(m.efficiency.totalReturnPct, 1), m.efficiency.totalReturnPct >= 0 ? 'pos' : 'neg'],
             ['Profit / Trade', moneyK(m.extended.profitPerTrade), m.extended.profitPerTrade >= 0 ? 'pos' : 'neg']] },
    { title: 'Behaviour', tick: 'hollow',
      hero: { label: 'Avg Duration', val: fmtDuration(m.behavior.avgDurationMs), cls: '' },
      rows: [['Long P&L', `${m.behavior.longCount} · ${moneyK(m.behavior.longPnL)}`, m.behavior.longPnL >= 0 ? 'pos' : 'neg'],
             ['Short P&L', `${m.behavior.shortCount} · ${moneyK(m.behavior.shortPnL)}`, m.behavior.shortPnL >= 0 ? 'pos' : 'neg'],
             ['Max Consec. Wins', m.behavior.maxConsecWins, 'pos'], ['Max Consec. Losses', m.behavior.maxConsecLosses, 'neg'],
             ['Median Duration', fmtDuration(m.behavior.medianDurationMs), ''], ['Time in Market', pct(m.behavior.timeInMarketPct / 100, 0), '']] },
    { title: 'Frequency & Sizing', tick: 'hollow',
      hero: { label: 'Trades / Day', val: num(freq.perDay, 1), cls: '' },
      rows: [['Per Week', num(freq.perWeek, 1), ''], ['Per Month', num(freq.perMonth, 1), ''],
             ['Avg Qty', num(sizing.avg, 0), ''], ['Median Qty', num(sizing.median, 0), ''], ['R-Multiple', num(m.extended.avgRiskRewardMultiple, 2), '']] },
  ];
  document.getElementById('metrics').innerHTML = groups.map(g => `
    <div class="mgroup">
      <div class="mgroup-head"><span class="mgroup-tick ${g.tick}"></span><h3>${g.title}</h3></div>
      <div class="mhero-label">${g.hero.label}</div>
      <div class="mhero-value ${g.hero.cls}">${g.hero.val}</div>
      ${g.rows.map(r => `<div class="mrow"><span class="k">${r[0]}</span><span class="v ${r[2]}">${r[1]}</span></div>`).join('')}
    </div>`).join('');
}

/* ── Trades table ────────────────────────────────────────────────────────── */
function applyFilters() {
  filteredTrades = allTrades
    .filter(t => currentSide === 'all' || t.side === currentSide)
    .filter(t => !currentSearch || t.symbol.toLowerCase().includes(currentSearch))
    .slice()
    .sort((a, b) => {
      const av = a[currentSort.key], bv = b[currentSort.key];
      if (av instanceof Date || typeof av === 'string') return (new Date(av) - new Date(bv)) * currentSort.dir;
      return (av - bv) * currentSort.dir;
    });
  renderTradeRows();
}

function renderTradeRows() {
  const tbody = document.getElementById('trades-tbody');
  const empty = document.getElementById('trades-empty');
  if (!filteredTrades.length) { tbody.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  tbody.innerHTML = filteredTrades.map((t, i) => {
    const pos = t.pnl >= 0;
    const barW = Math.min(Math.abs(t.pnl) / maxAbsPnl * 100, 100);
    const pctMove = t.entryPrice > 0 ? ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(2) : '—';
    return `
      <tr class="trade-row ${pos ? 'row-pos' : 'row-neg'}" data-idx="${i}">
        <td>${t.symbol}</td>
        <td><span class="side-badge ${t.side}">${t.side === 'long' ? '▲ Long' : '▼ Short'}</span></td>
        <td>${t.qty}</td>
        <td>${num(t.entryPrice)}</td>
        <td>${num(t.exitPrice)}</td>
        <td style="color:var(--sub)">${fmtDuration(t.durationMs)}</td>
        <td><div class="pnl-cell"><div class="pnl-mini"><div class="pnl-mini-fill" style="width:${barW}%;background:${pos ? 'var(--green)' : 'var(--red)'}"></div></div><span class="pnl-val ${pos ? 'pos' : 'neg'}">${money(t.pnl)}</span></div></td>
      </tr>
      <tr class="expanded-row" data-for="${i}" hidden>
        <td colspan="7" style="padding:16px">
          <div class="expanded-detail">
            <div class="ed-item"><span class="ed-k">Entry</span><span class="ed-v">${fmtDate(t.entryTime)}</span></div>
            <div class="ed-item"><span class="ed-k">Exit</span><span class="ed-v">${fmtDate(t.exitTime)}</span></div>
            <div class="ed-item"><span class="ed-k">Price Move</span><span class="ed-v ${pos ? 'pos' : 'neg'}">${pctMove}%</span></div>
            <div class="ed-item"><span class="ed-k">Notional</span><span class="ed-v">${money(t.entryPrice * t.qty)}</span></div>
            <div class="ed-item"><span class="ed-k">P&amp;L</span><span class="ed-v ${pos ? 'pos' : 'neg'}">${money(t.pnl)}</span></div>
          </div>
        </td>
      </tr>`;
  }).join('');
  tbody.querySelectorAll('.trade-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.dataset.idx;
      const exp = tbody.querySelector(`.expanded-row[data-for="${idx}"]`);
      const open = !exp.hidden;
      tbody.querySelectorAll('.expanded-row').forEach(r => r.hidden = true);
      tbody.querySelectorAll('.trade-row').forEach(r => r.classList.remove('expanded'));
      if (!open) { exp.hidden = false; row.classList.add('expanded'); }
    });
  });
}

/* ── By Symbol ───────────────────────────────────────────────────────────── */
function renderSymbolsTab(trades, metrics) {
  const net = Math.abs(metrics.profitability.netProfit) || 1;
  const map = new Map();
  trades.forEach(t => {
    if (!map.has(t.symbol)) map.set(t.symbol, { count: 0, pnl: 0, wins: 0 });
    const s = map.get(t.symbol); s.count++; s.pnl += t.pnl; if (t.pnl > 0) s.wins++;
  });
  const rows = [...map.entries()].map(([sym, s]) => ({ sym, ...s, wr: s.count ? s.wins / s.count : 0 })).sort((a, b) => b.pnl - a.pnl);
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.pnl)), 1);
  document.getElementById('symbols-tbody').innerHTML = rows.map(r => {
    const pos = r.pnl >= 0;
    return `<tr>
      <td>${r.sym}</td>
      <td>${r.count}</td>
      <td class="${pos ? 'pos' : 'neg'}" style="color:${pos ? 'var(--green)' : 'var(--red)'}">${money(r.pnl)}</td>
      <td>${pct(r.wr, 0)}</td>
      <td><div class="sym-contrib"><div class="sym-bar"><div class="sym-bar-fill" style="width:${Math.abs(r.pnl)/maxAbs*100}%;background:${pos ? 'var(--green)' : 'var(--red)'}"></div></div><span class="sym-pct">${(Math.abs(r.pnl)/net*100).toFixed(0)}%</span></div></td>
    </tr>`;
  }).join('');
}

/* ── Extended ────────────────────────────────────────────────────────────── */
function renderExtendedTab(metrics) {
  const symbols = metrics.extended?.symbolBreakdown || [];
  const maxAbs = Math.max(...symbols.map(s => Math.abs(s.pnl)), 1);
  const net = Math.abs(metrics.profitability.netProfit) || 1;
  document.getElementById('ext-symbols').innerHTML = symbols.slice(0, 14).map(s => {
    const pos = s.pnl >= 0;
    return `<div class="ext-row sym">
      <span class="ext-name">${s.symbol}</span>
      <div class="ext-bar-wrap"><div class="ext-bar" style="width:${Math.abs(s.pnl)/maxAbs*100}%;background:${pos ? 'var(--green)' : 'var(--red)'}"></div></div>
      <span class="ext-pnl ${pos ? 'pos' : 'neg'}">${moneyK(s.pnl)}</span>
      <span class="ext-dim">${pct(s.winRate, 0)}</span>
    </div>`;
  }).join('');
  const dow = (metrics.extended?.dayOfWeekPnL || []).filter(d => !['Sunday', 'Saturday'].includes(d.day));
  document.getElementById('ext-dow').innerHTML = dow.map(d => {
    const pos = d.pnl >= 0;
    return `<div class="ext-row dow">
      <span class="ext-name">${d.day}</span>
      <span class="ext-dim">${d.trades} trades</span>
      <span class="ext-pnl ${pos ? 'pos' : 'neg'}">${moneyK(d.pnl)}</span>
      <span class="ext-dim">${pct(d.winRate, 0)}</span>
    </div>`;
  }).join('');
}

/* ── Range buttons (re-analyse the sliced window with the shared engine) ──── */
function applyRange(range) {
  if (!fullNavData || !currentData) return;
  currentRange = range;
  const { labels, values, ddValues } = fullNavData;
  let sl, sv, sd;
  if (range === 'ALL') { sl = labels; sv = values; sd = ddValues; }
  else {
    const months = range === '1M' ? 1 : 3;
    const cutoff = new Date(labels[labels.length - 1]); cutoff.setMonth(cutoff.getMonth() - months);
    const idx = labels.findIndex(d => d >= cutoff); const start = idx < 0 ? 0 : idx;
    sl = labels.slice(start); sv = values.slice(start); sd = ddValues.slice(start);
  }
  const pxp = sl.length > 600 ? 2.4 : 1.5;
  const minW = Math.max(sl.length * pxp, vpW('nav-scroll'));
  innerW('nav-scroll-inner', minW); innerW('dd-scroll-inner', minW);

  const rangeTrades = range === 'ALL'
    ? originalTrades.slice()
    : originalTrades.filter(t => new Date(t.exitTime) >= new Date(sl[0]));

  // Re-run the real analytics engine on the sliced window for exact metrics.
  const rf = currentData.metrics?.efficiency?.riskFreeRate ?? 0.065;
  const sub = window.analyze(rangeTrades.map(t => ({ ...t, entryTime: new Date(t.entryTime), exitTime: new Date(t.exitTime) })), currentData.startingCapital, rf);
  const subData = { ...currentData, trades: sub.trades, metrics: sub.metrics, equityCurve: sub.equityCurve, drawdownCurve: sub.drawdownCurve };

  navChart.data.labels = sl; navChart.data.datasets[0].data = sv; navChart.update();
  ddChart.data.labels = sl; ddChart.data.datasets[0].data = sd; ddChart.update();
  renderNavCurrent(sv);

  allTrades = rangeTrades; maxAbsPnl = allTrades.reduce((a, t) => Math.max(a, Math.abs(t.pnl)), 1);
  renderPnlDist(allTrades); applyFilters();
  renderKpis(subData); renderDdStats(sub.metrics); renderMetrics(sub.metrics);
  buildDow(sub.metrics); buildRolling(sub.metrics, rangeTrades); renderOvernight(sub.metrics);
  renderSymbolsTab(rangeTrades, sub.metrics); renderExtendedTab(sub.metrics);
  document.getElementById('overview-note').textContent = range === 'ALL' ? `${rangeTrades.length} closed trades` : `last ${range} · ${rangeTrades.length} trades`;
}

/* ── CSV export ──────────────────────────────────────────────────────────── */
function downloadCSV(trades) {
  if (!trades.length) return;
  const headers = ['Symbol', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'Entry Time', 'Exit Time', 'Duration (min)', 'P&L'];
  const rows = trades.map(t => [t.symbol, t.side, t.qty, t.entryPrice, t.exitPrice, new Date(t.entryTime).toISOString(), new Date(t.exitTime).toISOString(), Math.round((t.durationMs || 0) / 60000), t.pnl]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'lumentrade-trades.csv'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

/* ════════════════════════════════════════════════════════════════════════════
   Wiring
   ════════════════════════════════════════════════════════════════════════════ */

/* Theme (Paper ↔ Ink) */
(function () {
  if (localStorage.getItem('lt-theme') === 'ink') document.body.classList.add('ink');
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const ink = document.body.classList.toggle('ink');
    localStorage.setItem('lt-theme', ink ? 'ink' : 'paper');
    if (currentData) applyRange(currentRange); // rebuild charts with new palette
  });
})();

/* Sort */
document.querySelectorAll('#trades-table thead th').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    currentSort = { key, dir: currentSort.key === key ? -currentSort.dir : 1 };
    document.querySelectorAll('#trades-table thead th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(currentSort.dir === 1 ? 'sort-asc' : 'sort-desc');
    applyFilters();
  });
});

/* Search + side filter */
document.getElementById('symbol-search').addEventListener('input', e => { currentSearch = e.target.value.trim().toLowerCase(); applyFilters(); });
document.querySelectorAll('.side-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.side-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
  currentSide = b.dataset.side; applyFilters();
}));

/* Range */
document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.range-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
  applyRange(b.dataset.range);
}));

/* Tabs */
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
  const which = tab.dataset.tab;
  document.getElementById('tab-trades').hidden = which !== 'trades';
  document.getElementById('tab-symbols').hidden = which !== 'symbols';
  document.getElementById('tab-extended').hidden = which !== 'extended';
  document.getElementById('tab-tools').style.visibility = which === 'trades' ? 'visible' : 'hidden';
}));

/* CSV */
document.getElementById('export-csv').addEventListener('click', () => downloadCSV(filteredTrades.length ? filteredTrades : allTrades));

/* Presets + capital */
const capInput = document.getElementById('startingCapital');
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => {
  capInput.value = b.dataset.value;
  document.querySelectorAll('.preset').forEach(x => x.classList.remove('active')); b.classList.add('active');
}));
capInput.addEventListener('input', () => {
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', b.dataset.value === capInput.value));
});

/* Drop zone */
const drop = document.getElementById('drop'), fileInput = document.getElementById('file');
function showFile(f) {
  document.getElementById('df-name').textContent = f.name;
  document.getElementById('df-size').textContent = (f.size / 1024).toFixed(1) + ' KB · ready';
  drop.classList.add('has-file');
}
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); const f = e.dataTransfer.files[0]; if (f) { fileInput.files = e.dataTransfer.files; showFile(f); } });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) showFile(fileInput.files[0]); });

/* Optional P&L file name display */
const pnlFileInput = document.getElementById('pnlFile');
const pnlFileName = document.getElementById('pnl-file-name');
pnlFileInput.addEventListener('change', () => {
  const f = pnlFileInput.files[0];
  if (f) { pnlFileName.textContent = `${f.name} · ${(f.size / 1024).toFixed(1)} KB`; pnlFileName.classList.add('ready'); }
  else { pnlFileName.textContent = 'No file chosen'; pnlFileName.classList.remove('ready'); }
});

/* ── Form submit → run the whole pipeline in-browser ─────────────────────── */
const form = document.getElementById('upload-form');
const analyzeBtn = document.getElementById('analyze-btn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const statusTag = document.getElementById('status-open');
const statusError = document.getElementById('status-error');

const MAX_BYTES = 10 * 1024 * 1024;
const fileBytes = async f => new Uint8Array(await f.arrayBuffer());

/* Analysis runs in a Web Worker so a large tradebook never blocks the UI.
   A reused singleton worker; falls back to a synchronous main-thread run if
   Workers are unavailable (e.g. file://) or the worker fails to load. */
let analysisWorker = null;
function getWorker() {
  if (analysisWorker === null && typeof Worker !== 'undefined') {
    try { analysisWorker = new Worker('worker.js'); }
    catch (_) { analysisWorker = false; } // construction blocked → mark unavailable
  }
  return analysisWorker || null;
}
function analyzeOffThread(payload) {
  const w = getWorker();
  if (!w) {
    // Fallback: run on the main thread (engine + SheetJS are loaded here too).
    return Promise.resolve(window.runAnalysis(payload));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); };
    const onMsg = e => { cleanup(); e.data && e.data.ok ? resolve(e.data.data) : reject(new Error((e.data && e.data.error) || 'Analysis failed.')); };
    const onErr = () => {
      cleanup();
      // Worker couldn't load/run — drop it and fall back to the main thread once.
      try { w.terminate(); } catch (_) {}
      analysisWorker = false;
      try { resolve(window.runAnalysis(payload)); } catch (err) { reject(err); }
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage(payload);
  });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!fileInput.files.length) { showError('Choose a Zerodha tradebook first.'); return; }
  const tbFile = fileInput.files[0];
  const pnlFile = pnlFileInput.files[0];
  if (tbFile.size > MAX_BYTES) { showError('Tradebook exceeds the 10 MB limit.'); return; }
  if (pnlFile && pnlFile.size > MAX_BYTES) { showError('P&L file exceeds the 10 MB limit.'); return; }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing…';
  statusEl.classList.remove('show');
  statusError.hidden = true;
  // Yield so the "Analyzing…" state paints before the synchronous parse/analyze.
  await new Promise(r => setTimeout(r));

  try {
    const tradebookBytes = await fileBytes(tbFile);
    const pnlBytes = pnlFile ? await fileBytes(pnlFile) : undefined;
    // Everything runs locally (in a Worker) — no network call, data never leaves
    // the browser.
    const data = await analyzeOffThread({
      tradebookBytes,
      pnlBytes,
      startingCapital: capInput.value,
      riskFreeRate: document.getElementById('riskFreeRate').value,
      charges: 0,
    });

    render(data);

    // Status line: settlement / expired / warnings / reconciliation
    let trailing = '';
    if (data.pnlFileUsed && data.settledPositions?.length) {
      trailing = ` · <span style="color:var(--green)">+${data.settledPositions.length} settlement${data.settledPositions.length > 1 ? 's' : ''} resolved</span>`;
    } else if (data.expiredPositions?.length) {
      trailing = ` · <span style="color:var(--sub)">${data.expiredPositions.length} expired contract${data.expiredPositions.length > 1 ? 's' : ''} (add P&amp;L file)</span>`;
    }
    if (data.pnlReconciliation && Math.abs(data.pnlReconciliation.difference) > 100) {
      trailing += ` · <span style="color:var(--sub)" title="${data.pnlReconciliation.note}">⚖ ₹${Math.abs(Math.round(data.pnlReconciliation.difference))} charges/taxes</span>`;
    }
    if (data.warnings?.length) {
      trailing += ` <span style="color:var(--red);cursor:help" title="${data.warnings.join('\n')}">⚠ ${data.warnings.length}</span>`;
    }
    statusText.innerHTML = `Parsed <b>${data.fillCount} fills</b> → <b>${data.trades.length} closed trades</b>${trailing}`;
    if (data.openPositions?.length) { statusTag.textContent = `${data.openPositions.length} open`; statusTag.hidden = false; }
    else statusTag.hidden = true;
    statusEl.classList.add('show');

    try { sessionStorage.setItem('lastAnalysis', JSON.stringify(data)); } catch (_) {}
  } catch (err) {
    showError(err.message || 'Failed to process file.');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Tradebook →';
  }
});
function showError(msg) { statusError.textContent = msg; statusError.hidden = false; statusEl.classList.remove('show'); }

document.getElementById('nav-analyze').addEventListener('click', () => document.getElementById('upload-sec').scrollIntoView({ behavior: 'smooth' }));

/* Scrollspy for pill nav */
const navLinks = Array.from(document.querySelectorAll('.pill-links a'));
const spy = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) {
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }});
}, { rootMargin: '-45% 0px -50% 0px' });
['overview', 'charts', 'metrics-sec', 'trades'].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

/* Reveal */
const revealObs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── Session restore ─────────────────────────────────────────────────────── */
(function restoreSession() {
  try {
    const cached = sessionStorage.getItem('lastAnalysis');
    if (!cached) return;
    const data = JSON.parse(cached);
    requestAnimationFrame(() => {
      render(data);
      statusText.innerHTML = `Restored <b>${data.trades.length} closed trades</b> from this session`;
      if (data.openPositions?.length) { statusTag.textContent = `${data.openPositions.length} open`; statusTag.hidden = false; }
      statusEl.classList.add('show');
    });
  } catch (_) {}
})();
