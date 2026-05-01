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
  const m = symbol.match(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i);
  if (!m) return null;
  const year = 2000 + parseInt(m[1]);
  const month = MONTH_MAP[m[2].toUpperCase()];
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const dow = lastDay.getUTCDay();
  const offset = dow >= 4 ? dow - 4 : dow + 3;
  lastDay.setUTCDate(lastDay.getUTCDate() - offset);
  return lastDay;
}

function categorizeOpenPositions(openPositions) {
  const now = new Date();
  const active = [];
  const expired = [];
  for (const pos of openPositions) {
    const expiry = getContractExpiry(pos.symbol);
    if (expiry && expiry < now) {
      expired.push({ ...pos, expiredAt: expiry });
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

    const fills = parseTradebook(tradebookFile.buffer);
    if (!fills.length) return res.status(400).json({ error: 'No usable trade rows found in tradebook.' });

    const { closed, openPositions } = pairTrades(fills);
    const { active, expired } = categorizeOpenPositions(openPositions);

    // Optional: settle expired positions using the P&L file
    let settledTrades = [];
    let unresolvedExpired = expired;
    let pnlFileUsed = false;

    const pnlFileUpload = req.files?.pnlFile?.[0];
    if (pnlFileUpload) {
      const pnlEntries = parsePnL(pnlFileUpload.buffer);
      const { settled, unresolved } = settleExpiredPositions(expired, closed, fills, pnlEntries);
      settledTrades = settled;
      unresolvedExpired = unresolved;
      pnlFileUsed = true;
    }

    // Merge settled trades into closed trades and re-sort by exitTime
    const allClosed = [...closed, ...settledTrades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));

    const result = analyze(allClosed, startingCapital);

    res.json({
      startingCapital,
      fillCount: fills.length,
      openPositions: active,
      expiredPositions: unresolvedExpired,
      settledPositions: settledTrades,
      pnlFileUsed,
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to process file.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Trade analytics on http://localhost:${PORT}`);
});
