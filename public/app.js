/* ── Theme toggle ────────────────────────────────────────────────────────── */
(function () {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    if (navChart || ddChart) updateChartTheme();
  });
})();

/* ── Globals ─────────────────────────────────────────────────────────────── */
let navChart, ddChart;
let allTrades      = [];
let filteredTrades = [];
let currentSort    = { key: 'exitTime', dir: 1 };
let currentSide    = 'all';
let currentSearch  = '';
let expandedRow    = null;
let fullNavData    = null; // { labels, values } for range slicing
let maxAbsPnl      = 0;

/* ── Formatters ──────────────────────────────────────────────────────────── */
const inr     = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const pct     = (v, d = 2) => (v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const num     = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v === Infinity ? '∞' : Number(v).toFixed(d));
const money   = v => (v == null || !isFinite(v) ? '—' : inr(v));
const ratio   = v => (v == null || !isFinite(v) ? '—' : v === Infinity ? '∞' : v.toFixed(2));
const signCls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';

function fmtDuration(ms) {
  if (!ms || !isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 60)  return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function fmtDate(d) {
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ── ① Drag-and-drop upload ─────────────────────────────────────────────── */
const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('file');
const dropInfo    = document.getElementById('drop-file-info');
const dropName    = document.getElementById('drop-filename');
const dropSize    = document.getElementById('drop-filesize');

function showFileInfo(file) {
  dropName.textContent = file.name;
  dropSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
  dropInfo.hidden = false;
  dropZone.classList.add('has-file');
  // show a "ready" span after filesize
  let ready = dropInfo.querySelector('.ready-span');
  if (!ready) {
    ready = document.createElement('span');
    ready.className = 'ready-span';
    ready.style.cssText = 'color:var(--green);font-size:12px;margin-top:2px;display:block;text-align:center';
    ready.textContent = 'ready to analyze';
    dropInfo.appendChild(ready);
  }
}

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) { fileInput.files = e.dataTransfer.files; showFileInfo(f); }
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) showFileInfo(fileInput.files[0]);
});

/* ── P&L file input ──────────────────────────────────────────────────────── */
const pnlFileInput = document.getElementById('pnlFile');
const pnlFileName  = document.getElementById('pnl-file-name');
pnlFileInput.addEventListener('change', () => {
  const f = pnlFileInput.files[0];
  if (f) {
    pnlFileName.textContent = `${f.name}  ·  ${(f.size / 1024).toFixed(1)} KB`;
    pnlFileName.classList.add('ready');
  } else {
    pnlFileName.textContent = 'No file chosen';
    pnlFileName.classList.remove('ready');
  }
});

/* ── ② Capital presets ───────────────────────────────────────────────────── */
const capitalInput = document.getElementById('startingCapital');
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    capitalInput.value = btn.dataset.value;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
// Highlight matching preset on load
function syncPreset() {
  document.querySelectorAll('.preset-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === capitalInput.value);
  });
}
capitalInput.addEventListener('input', syncPreset);
syncPreset();

/* ── Form submit ─────────────────────────────────────────────────────────── */
const form     = document.getElementById('upload-form');
const statusBar  = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const statusOpen = document.getElementById('status-open');
const statusDate = document.getElementById('status-date');
const statusError= document.getElementById('status-error');
const resultsEl  = document.getElementById('results');
const analyzeBtn = document.getElementById('analyze-btn');

form.addEventListener('submit', async e => {
  e.preventDefault();
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing…';
  statusBar.hidden  = true;
  statusError.hidden = true;

  const fd = new FormData(form);
  try {
    const res  = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    // ③ Rich status bar
    let trailingNote = '';
    if (data.pnlFileUsed && data.settledPositions?.length) {
      trailingNote = ` · <span style="color:var(--green)">+${data.settledPositions.length} settlement${data.settledPositions.length > 1 ? 's' : ''} resolved from P&amp;L file</span>`;
    } else if (data.expiredPositions?.length) {
      trailingNote = ` · <span style="color:var(--muted)">${data.expiredPositions.length} expired contract${data.expiredPositions.length > 1 ? 's' : ''} (upload P&amp;L file to include settlement P&amp;L)</span>`;
    }
    statusText.innerHTML = `Parsed <strong>${data.fillCount} fills</strong> → <strong>${data.trades.length} closed trades</strong>${trailingNote}`;
    if (data.openPositions.length) {
      statusOpen.textContent = `${data.openPositions.length} open`;
      statusOpen.hidden = false;
    } else {
      statusOpen.hidden = true;
    }
    // Date range from trades
    if (data.trades.length) {
      const first = new Date(data.trades[0].entryTime);
      const last  = new Date(data.trades[data.trades.length - 1].exitTime);
      statusDate.textContent = `${fmtDateShort(first)} – ${fmtDateShort(last)}`;
    }
    statusBar.hidden = false;

    render(data);
  } catch (err) {
    statusError.textContent = err.message;
    statusError.hidden = false;
  } finally {
    analyzeBtn.disabled  = false;
    analyzeBtn.textContent = 'Analyze →';
  }
});

/* ── Master render ───────────────────────────────────────────────────────── */
function render(data) {
  resultsEl.hidden = false;
  renderHeroStrip(data);
  renderCharts(data);
  renderMetrics(data.metrics, data.trades);
  allTrades = data.trades.slice();
  maxAbsPnl = Math.max(...allTrades.map(t => Math.abs(t.pnl)), 1);
  applyFilters();
  renderSymbolsTab(data.trades, data.metrics);
}

/* ── ② Hero KPI strip ────────────────────────────────────────────────────── */
function renderHeroStrip(data) {
  const m = data.metrics;
  const startCap = data.startingCapital;
  const lastEq   = data.equityCurve[data.equityCurve.length - 1]?.equity ?? startCap;
  const retPct   = (lastEq - startCap) / startCap;

  function setKpi(id, value, sub, colorCls) {
    const el = document.getElementById(id);
    el.querySelector('.hkpi-value').textContent = value;
    el.querySelector('.hkpi-value').className   = `hkpi-value ${colorCls || ''}`;
    el.querySelector('.hkpi-sub').textContent   = sub;
  }

  setKpi('hkpi-pnl',    money(m.profitability.netProfit),   `vs ${money(startCap)} starting`, m.profitability.netProfit >= 0 ? 'green' : 'red');
  setKpi('hkpi-return', pct(retPct),                        `ann. ${pct(m.efficiency.annualizedReturn)}`,  retPct >= 0 ? 'green' : 'red');
  setKpi('hkpi-winrate',pct(m.performance.winRate, 0),      `${data.trades.filter(t=>t.pnl>0).length} wins · ${data.trades.filter(t=>t.pnl<=0).length} losses`, 'green');
  setKpi('hkpi-sharpe', ratio(m.efficiency.sharpe),         `Sortino ${ratio(m.efficiency.sortino)}`, '');
  setKpi('hkpi-dd',     pct(m.risk.maxDrawdownPct, 1),      money(m.risk.maxDrawdown), 'red');
  setKpi('hkpi-open',   String(data.openPositions.length),  'positions still open', data.openPositions.length ? 'amber' : '');
}

/* ── ③ Charts ────────────────────────────────────────────────────────────── */
function renderCharts(data) {
  const navLabels = data.equityCurve.map(p => new Date(p.t));
  const navValues = data.equityCurve.map(p => p.equity);
  const ddValues  = data.drawdownCurve.map(p => p.drawdownPct * 100);

  // Store full data for range filtering
  fullNavData = { labels: navLabels, values: navValues, ddValues };

  buildNavChart(navLabels, navValues);
  buildDdChart(navLabels, ddValues);
  renderNavCurrent(navValues);
  renderDdStats(data.metrics);
  renderPnlDist(data.trades);
  setupRangeButtons();
}

function buildNavChart(labels, values) {
  if (navChart) navChart.destroy();
  navChart = new Chart(document.getElementById('nav-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'NAV',
        data: values,
        borderColor: 'oklch(67% 0.17 155)',
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0,   'oklch(67% 0.17 155 / 0.30)');
          g.addColorStop(1,   'oklch(67% 0.17 155 / 0.01)');
          return g;
        },
        fill: true, tension: 0.15, pointRadius: 0, borderWidth: 1.8,
      }],
    },
    options: navChartOpts(v => '₹' + Math.round(v).toLocaleString('en-IN')),
  });
}

function buildDdChart(labels, values) {
  if (ddChart) ddChart.destroy();
  ddChart = new Chart(document.getElementById('dd-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: values,
        borderColor: 'oklch(62% 0.20 18)',
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0,   'oklch(62% 0.20 18 / 0.35)');
          g.addColorStop(1,   'oklch(62% 0.20 18 / 0.02)');
          return g;
        },
        fill: true, tension: 0.1, pointRadius: 0, borderWidth: 1.6,
      }],
    },
    options: ddChartOpts(v => v.toFixed(1) + '%'),
  });
}

function chartTickColor() { return document.body.classList.contains('light') ? '#8a909e' : '#5e6573'; }
function chartGridColor() { return document.body.classList.contains('light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'; }

function navChartOpts(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: c => yFmt(c.parsed.y) } },
    },
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'PP HH:mm' }, ticks: { color: chartTickColor(), maxTicksLimit: 8 }, grid: { color: chartGridColor() } },
      y: { ticks: { color: chartTickColor(), callback: yFmt }, grid: { color: chartGridColor() } },
    },
  };
}

function ddChartOpts(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: c => yFmt(c.parsed.y) } },
    },
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'PP HH:mm' }, ticks: { color: chartTickColor(), maxTicksLimit: 5, display: false }, grid: { display: false } },
      y: { ticks: { color: chartTickColor(), maxTicksLimit: 4 }, grid: { color: chartGridColor() } },
    },
  };
}

function updateChartTheme() {
  const tc = chartTickColor();
  const gc = chartGridColor();
  for (const chart of [navChart, ddChart]) {
    if (!chart) continue;
    for (const scale of Object.values(chart.options.scales)) {
      if (scale.ticks) scale.ticks.color = tc;
      if (scale.grid && scale.grid.display !== false) scale.grid.color = gc;
    }
    chart.update('none');
  }
}

function renderNavCurrent(values) {
  const el   = document.getElementById('nav-current');
  const last = values[values.length - 1];
  const first = values[0];
  const chg  = first > 0 ? ((last - first) / first * 100) : 0;
  const sign = chg >= 0 ? '+' : '';
  el.innerHTML = `${money(last)}<span class="nav-change" style="color:${chg >= 0 ? 'var(--green)' : 'var(--red)'}">${sign}${chg.toFixed(1)}%</span>`;
}

function renderDdStats(metrics) {
  const el = document.getElementById('dd-stats');
  el.innerHTML = `
    <div class="dd-stat-item">Max <span>${pct(metrics.risk.maxDrawdownPct, 1)}</span></div>
    <div class="dd-stat-item">Avg <span>${pct(metrics.risk.avgDrawdownPct, 1)}</span></div>
    <div class="dd-stat-item">Ulcer <span style="color:var(--dim)">${num(metrics.risk.ulcerIndex)}</span></div>
  `;
}

/* ⑥ PnL per trade distribution bars */
function renderPnlDist(trades) {
  const container = document.getElementById('pnl-dist');
  if (!trades.length) { container.innerHTML = ''; return; }
  const maxAbs = Math.max(...trades.map(t => Math.abs(t.pnl)), 1);
  const minPnl = Math.min(...trades.map(t => t.pnl));
  const maxPnl = Math.max(...trades.map(t => t.pnl));

  const bars = trades.map(t => {
    const h = Math.max(4, Math.abs(t.pnl) / maxAbs * 64);
    const cls = t.pnl >= 0 ? 'pos' : 'neg';
    return `<div class="pnl-bar ${cls}" style="height:${h}px" title="${t.symbol}: ${money(t.pnl)}"></div>`;
  }).join('');

  container.innerHTML = `
    <div class="pnl-dist-bars">${bars}</div>
    <div class="pnl-dist-axis">
      <span style="color:var(--red)">${money(minPnl)}</span>
      <span style="color:var(--muted)">0</span>
      <span style="color:var(--green)">${money(maxPnl)}</span>
    </div>`;
}

/* ③ Range buttons */
function setupRangeButtons() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyRange(btn.dataset.range);
    });
  });
}

function applyRange(range) {
  if (!fullNavData) return;
  const { labels, values, ddValues } = fullNavData;
  let slicedLabels, slicedValues, slicedDd;

  if (range === 'ALL') {
    slicedLabels = labels; slicedValues = values; slicedDd = ddValues;
  } else {
    const months = range === '1M' ? 1 : 3;
    const cutoff = new Date(labels[labels.length - 1]);
    cutoff.setMonth(cutoff.getMonth() - months);
    const idx = labels.findIndex(d => d >= cutoff);
    const start = idx < 0 ? 0 : idx;
    slicedLabels = labels.slice(start);
    slicedValues = values.slice(start);
    slicedDd     = ddValues.slice(start);
  }

  navChart.data.labels   = slicedLabels;
  navChart.data.datasets[0].data = slicedValues;
  navChart.update();
  ddChart.data.labels    = slicedLabels;
  ddChart.data.datasets[0].data = slicedDd;
  ddChart.update();
  renderNavCurrent(slicedValues);
}

/* ── ④ Metrics cards ─────────────────────────────────────────────────────── */
function renderMetrics(m, trades) {
  const el = document.getElementById('metrics');

  const groups = [
    {
      title: 'Profitability', accentColor: 'var(--green)',
      hero: { label: 'Net Profit', val: money(m.profitability.netProfit), cls: m.profitability.netProfit >= 0 ? 'green' : 'red' },
      rows: [
        ['Gross Profit',    money(m.profitability.grossProfit),  'pos'],
        ['Gross Loss',      money(m.profitability.grossLoss),    'neg'],
        ['Profit Factor',   ratio(m.profitability.profitFactor), ''  ],
        ['Expectancy/Trade',money(m.profitability.expectancy),   m.profitability.expectancy >= 0 ? 'pos' : 'neg'],
      ],
    },
    {
      title: 'Risk', accentColor: 'var(--red)',
      hero: { label: 'Max Drawdown', val: pct(m.risk.maxDrawdownPct, 1), cls: 'red' },
      rows: [
        ['Max DD (₹)',   money(m.risk.maxDrawdown),        'neg'],
        ['Avg DD %',     pct(m.risk.avgDrawdownPct, 1),    'neg'],
        ['Risk:Reward',  ratio(m.risk.riskReward),         ''  ],
        ['Ulcer Index',  num(m.risk.ulcerIndex),           ''  ],
      ],
    },
    {
      title: 'Trade Performance', accentColor: 'var(--accent)',
      hero: { label: 'Win Rate', val: pct(m.performance.winRate, 0), cls: 'green' },
      rows: [
        ['Total Trades', m.performance.totalTrades,         ''  ],
        ['Avg Win',      money(m.performance.avgWin),       'pos'],
        ['Avg Loss',     money(m.performance.avgLoss),      'neg'],
        ['Largest Win',  money(m.performance.largestWin),   'pos'],
        ['Largest Loss', money(m.performance.largestLoss),  'neg'],
      ],
    },
    {
      title: 'Efficiency', accentColor: 'var(--dim)',
      hero: { label: 'Sharpe Ratio', val: ratio(m.efficiency.sharpe), cls: '' },
      rows: [
        ['Sortino',       ratio(m.efficiency.sortino),      ''],
        ['Calmar',        ratio(m.efficiency.calmar),       ''],
        ['Ann. Return',   pct(m.efficiency.annualizedReturn),m.efficiency.annualizedReturn >= 0 ? 'pos' : 'neg'],
        ['Total Return',  pct(m.efficiency.totalReturnPct), m.efficiency.totalReturnPct >= 0 ? 'pos' : 'neg'],
      ],
    },
    {
      title: 'Trade Behavior', accentColor: 'var(--amber)',
      hero: { label: 'Avg Duration', val: fmtDuration(m.behavior.avgDurationMs), cls: '' },
      rows: [
        ['Long P&L',      `${m.behavior.longCount}  ·  ${money(m.behavior.longPnL)}`,   m.behavior.longPnL  >= 0 ? 'pos' : 'neg'],
        ['Short P&L',     `${m.behavior.shortCount}  ·  ${money(m.behavior.shortPnL)}`, m.behavior.shortPnL >= 0 ? 'pos' : 'neg'],
        ['Max C. Wins',   m.behavior.maxConsecWins,   'pos'],
        ['Max C. Losses', m.behavior.maxConsecLosses, 'neg'],
      ],
    },
  ];

  el.innerHTML = groups.map(g => `
    <div class="metric-group">
      <div class="metric-group-accent" style="background:${g.accentColor}"></div>
      <div class="metric-group-body">
        <h3>${g.title}</h3>
        <div class="metric-hero-label">${g.hero.label}</div>
        <div class="metric-hero-value ${g.hero.cls}">${g.hero.val}</div>
        ${g.rows.map(r => `
          <div class="metric-row">
            <span class="k">${r[0]}</span>
            <span class="v ${r[2]}">${r[1]}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

/* ── ⑤ Trades table ──────────────────────────────────────────────────────── */

// ⑧ Sort — with visual arrow indicators
document.querySelectorAll('#trades-table thead th').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    const dir = currentSort.key === key ? -currentSort.dir : 1;
    currentSort = { key, dir };
    updateSortArrows();
    applyFilters();
  });
});

function updateSortArrows() {
  document.querySelectorAll('#trades-table thead th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.key === currentSort.key) {
      th.classList.add(currentSort.dir === 1 ? 'sort-asc' : 'sort-desc');
    }
  });
}
// Set initial arrow
updateSortArrows();

// ⑨ Search + side filter
document.getElementById('symbol-search').addEventListener('input', e => {
  currentSearch = e.target.value.trim().toLowerCase();
  applyFilters();
});

document.querySelectorAll('.side-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSide = btn.dataset.side;
    applyFilters();
  });
});

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

  if (!filteredTrades.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  tbody.innerHTML = filteredTrades.map((t, i) => {
    const pos     = t.pnl >= 0;
    const barW    = Math.min(Math.abs(t.pnl) / maxAbsPnl * 100, 100);
    const sideLbl = t.side === 'long' ? '▲ Long' : '▼ Short';
    const pctMove = t.entryPrice > 0 ? ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(2) : '—';
    const notional = money(t.entryPrice * t.qty);

    return `
      <tr class="trade-row" data-idx="${i}">
        <td>${t.symbol}</td>
        <td><span class="side-badge ${t.side}">${sideLbl}</span></td>
        <td>${t.qty}</td>
        <td>${num(t.entryPrice)}</td>
        <td>${num(t.exitPrice)}</td>
        <td style="color:var(--muted)">${fmtDuration(t.durationMs)}</td>
        <td>
          <div class="pnl-cell">
            <div class="pnl-bar-mini">
              <div class="pnl-bar-mini-fill" style="width:${barW}%;background:${pos ? 'var(--green)' : 'var(--red)'}"></div>
            </div>
            <span class="pnl-val ${pos ? 'pos' : 'neg'}">${money(t.pnl)}</span>
          </div>
        </td>
      </tr>
      <tr class="expanded-row" data-for="${i}" hidden>
        <td colspan="7" style="padding:10px 14px">
          <div class="expanded-detail">
            <div class="ed-item"><span>Entry</span><span>${fmtDate(t.entryTime)}</span></div>
            <div class="ed-item"><span>Exit</span><span>${fmtDate(t.exitTime)}</span></div>
            <div class="ed-item"><span>Price move</span><span class="${pos ? 'pos' : 'neg'}">${pctMove}%</span></div>
            <div class="ed-item"><span>Notional</span><span>${notional}</span></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  // ⑨ Expandable rows — click to reveal
  tbody.querySelectorAll('.trade-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx     = row.dataset.idx;
      const expRow  = tbody.querySelector(`.expanded-row[data-for="${idx}"]`);
      const isOpen  = !expRow.hidden;
      // Close all
      tbody.querySelectorAll('.expanded-row').forEach(r => { r.hidden = true; });
      tbody.querySelectorAll('.trade-row').forEach(r => r.classList.remove('expanded'));
      // Toggle
      if (!isOpen) {
        expRow.hidden = false;
        row.classList.add('expanded');
      }
    });
  });
}

/* ── ⑩ By Symbol tab ────────────────────────────────────────────────────── */
function renderSymbolsTab(trades, metrics) {
  const netProfit = Math.abs(metrics.profitability.netProfit) || 1;
  const bySymMap  = new Map();

  trades.forEach(t => {
    if (!bySymMap.has(t.symbol)) bySymMap.set(t.symbol, { count: 0, pnl: 0, wins: 0 });
    const s = bySymMap.get(t.symbol);
    s.count++;
    s.pnl += t.pnl;
    if (t.pnl > 0) s.wins++;
  });

  const rows = [...bySymMap.entries()]
    .map(([sym, s]) => ({ sym, ...s, wr: s.count ? s.wins / s.count : 0 }))
    .sort((a, b) => b.pnl - a.pnl);

  const maxAbs = Math.max(...rows.map(r => Math.abs(r.pnl)), 1);

  document.getElementById('symbols-tbody').innerHTML = rows.map(r => {
    const pos    = r.pnl >= 0;
    const contribW = Math.abs(r.pnl) / maxAbs * 100;
    const contribPct = (Math.abs(r.pnl) / netProfit * 100).toFixed(0);
    return `
      <tr>
        <td>${r.sym}</td>
        <td>${r.count}</td>
        <td class="${pos ? 'pos' : 'neg'}" style="font-family:var(--mono);font-size:11px;font-weight:500">${money(r.pnl)}</td>
        <td style="font-family:var(--mono);font-size:11px">${pct(r.wr, 0)}</td>
        <td>
          <div class="sym-contrib">
            <div class="sym-contrib-bar">
              <div class="sym-contrib-fill" style="width:${contribW}%;background:${pos ? 'var(--green)' : 'var(--red)'}"></div>
            </div>
            <span class="sym-contrib-pct">${contribPct}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Tab switching ───────────────────────────────────────────────────────── */
document.querySelectorAll('.trades-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.trades-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('tab-trades').hidden   = (which !== 'trades');
    document.getElementById('tab-symbols').hidden  = (which !== 'symbols');
    document.getElementById('trades-controls').style.visibility = which === 'trades' ? 'visible' : 'hidden';
  });
});
