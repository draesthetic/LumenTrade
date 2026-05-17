const path = require('path');
const express = require('express');
const multer = require('multer');
const { parseTradebook } = require('./src/parseTradebook');
const { pairTrades } = require('./src/pairTrades');
const { analyze } = require('./src/analytics');
const { parsePnL } = require('./src/parsePnL');
const { settleExpiredPositions } = require('./src/settleExpired');

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
      // Finding 3 — compare against 15:30 IST (= 10:00:00 UTC) not midnight UTC,
      // so a contract doesn't appear expired before market opens on expiry day.
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

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'pnlFile', maxCount: 1 }]), (req, res) => {
  try {
    const tradebookFile = req.files?.file?.[0];
    if (!tradebookFile) return res.status(400).json({ error: 'No tradebook file uploaded.' });

    const startingCapital = Number(req.body.startingCapital);
    if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
      return res.status(400).json({ error: 'Starting capital must be a positive number.' });
    }

    const riskFreeRate = Number(req.body.riskFreeRate);
    const effectiveRiskFreeRate = Number.isFinite(riskFreeRate) && riskFreeRate >= 0 ? riskFreeRate : 0.065;

    // Finding 2 — accept total charges (brokerage + STT + GST + duties) so
    // analytics can distribute them across trades and report net P&L.
    const charges = Math.max(0, Number(req.body.charges) || 0);

    const { fills, warnings: tbWarnings } = parseTradebook(tradebookFile.buffer);
    if (!fills.length) return res.status(400).json({ error: 'No usable trade rows found in tradebook.' });

    const { closed, openPositions } = pairTrades(fills);
    const { active, expired } = categorizeOpenPositions(openPositions);

    // Optional: settle expired positions using the P&L file
    let settledTrades = [];
    let unresolvedExpired = expired;
    let pnlFileUsed = false;

    let pnlReconciliation = null;
    const pnlFileUpload = req.files?.pnlFile?.[0];
    if (pnlFileUpload) {
      const pnlEntries = parsePnL(pnlFileUpload.buffer);
      const { settled, unresolved } = settleExpiredPositions(expired, closed, fills, pnlEntries);
      settledTrades = settled;
      unresolvedExpired = unresolved;
      pnlFileUsed = true;

      // Finding 2 — cross-validate gross P&L from the tradebook against
      // realizedPnl from the P&L statement; flag any significant discrepancy.
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

    const result = analyze(allClosed, startingCapital, effectiveRiskFreeRate, charges);

    res.json({
      startingCapital,
      chargesDeducted: charges,
      fillCount: fills.length,
      openPositions: active,
      expiredPositions: unresolvedExpired,
      settledPositions: settledTrades,
      pnlFileUsed,
      pnlReconciliation,
      warnings: tbWarnings,
      ...result,
    });
  } catch (err) {
    console.error(err);
    const isServerError = err instanceof TypeError || err instanceof ReferenceError;
    res.status(isServerError ? 500 : 400).json({ error: err.message || 'Failed to process file.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Trade analytics on http://localhost:${PORT}`);
});

// Export helper functions for testing
module.exports = { getContractExpiry, categorizeOpenPositions };
