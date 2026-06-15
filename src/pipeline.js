/* ════════════════════════════════════════════════════════════════════════════
   LumenTrade — analysis pipeline (single source of truth)
   Runs identically in Node (server.js) and the browser (static build). Takes raw
   tradebook/P&L bytes and returns the `data` object the frontend renders.
   ════════════════════════════════════════════════════════════════════════════ */

// Resolve dependencies from Node (require) or the browser (globals set by the
// engine <script> tags loaded before this one).
(function () {
const _dep = (p, name) => (typeof require !== 'undefined' ? require(p)[name] : window[name]);
const parseTradebook        = _dep('./parseTradebook', 'parseTradebook');
const pairTrades            = _dep('./pairTrades', 'pairTrades');
const parsePnL              = _dep('./parsePnL', 'parsePnL');
const settleExpiredPositions = _dep('./settleExpired', 'settleExpiredPositions');
const analyze               = _dep('./analytics', 'analyze');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, mirrors the old multer limit

const MONTH_MAP = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };

function getContractExpiry(symbol) {
  // Match both monthly (NIFTY25JANFUT) and weekly (NIFTY25JAN18FUT) contracts
  const m = symbol.match(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})?FUT$/i);
  if (!m) return null;

  const year = 2000 + parseInt(m[1]);
  const month = MONTH_MAP[m[2].toUpperCase()];
  let day = 1; // Default to 1st of month for monthly contracts

  // If we have a day captured (weekly contract), use it
  if (m[3]) {
    day = parseInt(m[3]);
  }

  const targetDate = new Date(Date.UTC(year, month, day));

  // For weekly contracts, the expiry is the specified day (usually Thursday)
  // For monthly contracts, we need to find the last Thursday
  if (!m[3]) {
    // Monthly contract: find last Thursday of the month
    const lastDay = new Date(Date.UTC(year, month + 1, 0)); // Last day of month
    const dow = lastDay.getUTCDay();
    const offset = dow >= 4 ? dow - 4 : dow + 3; // Days to backtrack to last Thursday
    targetDate.setUTCDate(lastDay.getUTCDate() - offset);
  }
  // For weekly contracts, targetDate is already set to the specified day

  return targetDate;
}

function categorizeOpenPositions(openPositions) {
  const now = new Date();
  const active = [];
  const expired = [];
  for (const pos of openPositions) {
    const expiry = getContractExpiry(pos.symbol);
    if (expiry) {
      // Compare against 15:30 IST (= 10:00:00 UTC) not midnight UTC, so a
      // contract doesn't appear expired before market opens on expiry day.
      const expiryClose = new Date(expiry);
      expiryClose.setUTCHours(10, 0, 0, 0);
      if (expiryClose < now) {
        expired.push({ ...pos, expiredAt: expiryClose });
      } else {
        active.push(pos);
      }
    } else {
      active.push(pos);
    }
  }
  return { active, expired };
}

// runAnalysis — the whole pipeline. `tradebookBytes` is required; `pnlBytes` is
// optional. Bytes are Uint8Array (browser) or Buffer (Node). Throws Error with a
// user-facing message on bad input; callers decide how to surface it.
function runAnalysis({ tradebookBytes, pnlBytes, startingCapital, riskFreeRate, charges } = {}) {
  if (!tradebookBytes || !tradebookBytes.length) throw new Error('No tradebook file provided.');
  if (tradebookBytes.length > MAX_BYTES) throw new Error('Tradebook exceeds the 10 MB limit.');
  if (pnlBytes && pnlBytes.length > MAX_BYTES) throw new Error('P&L file exceeds the 10 MB limit.');

  const capital = Number(startingCapital);
  if (!Number.isFinite(capital) || capital <= 0) {
    throw new Error('Starting capital must be a positive number.');
  }

  const rf = Number(riskFreeRate);
  const effectiveRiskFreeRate = Number.isFinite(rf) && rf >= 0 ? rf : 0.065;

  // Total charges (brokerage + STT + GST + duties) distributed across trades.
  const chargeTotal = Math.max(0, Number(charges) || 0);

  const { fills, warnings: tbWarnings } = parseTradebook(tradebookBytes);
  if (!fills.length) throw new Error('No usable trade rows found in tradebook.');

  const { closed, openPositions } = pairTrades(fills);
  const { active, expired } = categorizeOpenPositions(openPositions);

  // Optional: settle expired positions using the P&L file
  let settledTrades = [];
  let unresolvedExpired = expired;
  let pnlFileUsed = false;
  let pnlReconciliation = null;

  if (pnlBytes && pnlBytes.length) {
    const pnlEntries = parsePnL(pnlBytes);
    const { settled, unresolved } = settleExpiredPositions(expired, closed, fills, pnlEntries);
    settledTrades = settled;
    unresolvedExpired = unresolved;
    pnlFileUsed = true;

    // Cross-validate gross P&L from the tradebook against realizedPnl from the
    // P&L statement; flag any significant discrepancy (likely charges/taxes).
    const tradebookGross = [...closed, ...settledTrades].reduce((s, t) => s + t.pnl, 0);
    const pnlFileTotal   = pnlEntries.reduce((s, e) => s + e.realizedPnl, 0);
    const diff = tradebookGross - pnlFileTotal;
    pnlReconciliation = {
      tradebookGross: Math.round(tradebookGross * 100) / 100,
      pnlFileNet:     Math.round(pnlFileTotal  * 100) / 100,
      difference:     Math.round(diff          * 100) / 100,
      note: Math.abs(diff) > 100
        ? `Gross P&L mismatch of ₹${Math.abs(Math.round(diff))} between tradebook and P&L file — difference likely represents charges/taxes.`
        : 'Tradebook and P&L file reconcile within ₹100.',
    };
  }

  // Merge settled trades into closed trades and re-sort by exitTime
  const allClosed = [...closed, ...settledTrades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));

  const result = analyze(allClosed, capital, effectiveRiskFreeRate, chargeTotal);

  return {
    startingCapital: capital,
    chargesDeducted: chargeTotal,
    fillCount: fills.length,
    openPositions: active,
    expiredPositions: unresolvedExpired,
    settledPositions: settledTrades,
    pnlFileUsed,
    pnlReconciliation,
    warnings: tbWarnings,
    ...result,
  };
}

const __pipelineExports = { runAnalysis, getContractExpiry, categorizeOpenPositions };
if (typeof module !== 'undefined' && module.exports) module.exports = __pipelineExports;
if (typeof window !== 'undefined') {
  window.runAnalysis = runAnalysis;
  window.getContractExpiry = getContractExpiry;
  window.categorizeOpenPositions = categorizeOpenPositions;
}
})();
