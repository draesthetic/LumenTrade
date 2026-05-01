const form = document.getElementById('upload-form');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const metricsEl = document.getElementById('metrics');
const tbody = document.querySelector('#trades-table tbody');

let navChart, ddChart;
let currentTrades = [];
let currentSort = { key: 'exitTime', dir: 1 };

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const pct = (x) => (x == null || !isFinite(x) ? '—' : `${(x * 100).toFixed(2)}%`);
const num = (x, d = 2) => (x == null || !isFinite(x) ? '—' : Number(x).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const money = (x) => (x == null || !isFinite(x) ? '—' : inr.format(x));
const ratio = (x) => (x == null || !isFinite(x) ? '—' : x === Infinity ? '∞' : x.toFixed(2));

function fmtDuration(ms) {
  if (!ms || !isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = (h / 24).toFixed(1);
  return `${d}d`;
}
function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.className = 'muted';
  statusEl.textContent = 'Analyzing…';
  const fd = new FormData(form);
  try {
    const res = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    statusEl.textContent = `Parsed ${data.fillCount} fills → ${data.trades.length} closed trades. ${data.openPositions.length} position(s) still open.`;
    render(data);
  } catch (err) {
    statusEl.className = 'muted error';
    statusEl.textContent = err.message;
  }
});

function render(data) {
  resultsEl.hidden = false;
  renderCharts(data);
  renderMetrics(data.metrics);
  currentTrades = data.trades.slice();
  sortTrades('exitTime', 1);
}

function renderCharts(data) {
  const navLabels = data.equityCurve.map((p) => new Date(p.t));
  const navValues = data.equityCurve.map((p) => p.equity);
  const ddValues = data.drawdownCurve.map((p) => p.drawdownPct * 100);

  if (navChart) navChart.destroy();
  if (ddChart) ddChart.destroy();

  navChart = new Chart(document.getElementById('nav-chart'), {
    type: 'line',
    data: {
      labels: navLabels,
      datasets: [{
        label: 'NAV',
        data: navValues,
        borderColor: '#4ea1ff',
        backgroundColor: 'rgba(78,161,255,0.12)',
        fill: true,
        tension: 0.15,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: chartOpts((v) => '₹' + Math.round(v).toLocaleString('en-IN')),
  });

  ddChart = new Chart(document.getElementById('dd-chart'), {
    type: 'line',
    data: {
      labels: navLabels,
      datasets: [{
        label: 'Drawdown %',
        data: ddValues,
        borderColor: '#ff5d6c',
        backgroundColor: 'rgba(255,93,108,0.18)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: chartOpts((v) => v.toFixed(1) + '%'),
  });
}

function chartOpts(yFmt) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => yFmt(c.parsed.y) } } },
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'PP HH:mm' }, ticks: { color: '#8b94a3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#8b94a3', callback: yFmt }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };
}

function renderMetrics(m) {
  const row = (k, v, cls = '') => `<div class="metric-row"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`;
  const sign = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

  const groups = [
    {
      title: 'Profitability',
      rows: [
        ['Net Profit', money(m.profitability.netProfit), sign(m.profitability.netProfit)],
        ['Gross Profit', money(m.profitability.grossProfit), 'pos'],
        ['Gross Loss', money(-m.profitability.grossLoss), 'neg'],
        ['Profit Factor', ratio(m.profitability.profitFactor), ''],
        ['Expectancy / Trade', money(m.profitability.expectancy), sign(m.profitability.expectancy)],
      ],
    },
    {
      title: 'Risk',
      rows: [
        ['Max Drawdown', money(m.risk.maxDrawdown), 'neg'],
        ['Max Drawdown %', pct(m.risk.maxDrawdownPct), 'neg'],
        ['Avg Drawdown %', pct(m.risk.avgDrawdownPct), 'neg'],
        ['Risk:Reward', ratio(m.risk.riskReward), ''],
        ['Ulcer Index', num(m.risk.ulcerIndex, 2), ''],
      ],
    },
    {
      title: 'Trade Performance',
      rows: [
        ['Total Trades', m.performance.totalTrades, ''],
        ['Win Rate', pct(m.performance.winRate), 'pos'],
        ['Loss Rate', pct(m.performance.lossRate), 'neg'],
        ['Avg Win', money(m.performance.avgWin), 'pos'],
        ['Avg Loss', money(m.performance.avgLoss), 'neg'],
        ['Largest Win', money(m.performance.largestWin), 'pos'],
        ['Largest Loss', money(m.performance.largestLoss), 'neg'],
      ],
    },
    {
      title: `Efficiency  ·  rf ${(m.efficiency.riskFreeRate * 100).toFixed(1)}% / ${m.efficiency.periodsPerYear}d`,
      rows: [
        ['Sharpe Ratio', ratio(m.efficiency.sharpe), ''],
        ['Sortino Ratio', ratio(m.efficiency.sortino), ''],
        ['Calmar Ratio', ratio(m.efficiency.calmar), ''],
        ['Annualized Return', pct(m.efficiency.annualizedReturn), sign(m.efficiency.annualizedReturn)],
        ['Total Return', pct(m.efficiency.totalReturnPct), sign(m.efficiency.totalReturnPct)],
      ],
    },
    {
      title: 'Trade Behavior',
      rows: [
        ['Total Trades', m.behavior.totalTrades, ''],
        ['Avg Duration', fmtDuration(m.behavior.avgDurationMs), ''],
        ['Long Trades', `${m.behavior.longCount}  ·  ${money(m.behavior.longPnL)}`, sign(m.behavior.longPnL)],
        ['Short Trades', `${m.behavior.shortCount}  ·  ${money(m.behavior.shortPnL)}`, sign(m.behavior.shortPnL)],
        ['Max Consec. Wins', m.behavior.maxConsecWins, 'pos'],
        ['Max Consec. Losses', m.behavior.maxConsecLosses, 'neg'],
      ],
    },
  ];

  metricsEl.innerHTML = groups
    .map((g) => `<div class="metric-group"><h3>${g.title}</h3>${g.rows.map((r) => row(r[0], r[1], r[2])).join('')}</div>`)
    .join('');
}

function sortTrades(key, dir) {
  currentSort = { key, dir };
  const sorted = currentTrades.slice().sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av instanceof Date || typeof av === 'string') return (new Date(av) - new Date(bv)) * dir;
    return (av - bv) * dir;
  });
  tbody.innerHTML = sorted.map((t) => {
    const pnlCls = t.pnl >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td>${t.symbol}</td>
      <td>${t.side}</td>
      <td>${t.qty}</td>
      <td>${num(t.entryPrice)}</td>
      <td>${num(t.exitPrice)}</td>
      <td>${fmtDate(t.entryTime)}</td>
      <td>${fmtDate(t.exitTime)}</td>
      <td>${fmtDuration(t.durationMs)}</td>
      <td class="${pnlCls}">${money(t.pnl)}</td>
    </tr>`;
  }).join('');
}

document.querySelectorAll('#trades-table th').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    const dir = currentSort.key === key ? -currentSort.dir : 1;
    sortTrades(key, dir);
  });
});
