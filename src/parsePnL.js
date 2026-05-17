const XLSX = require('xlsx');

// Parses the Zerodha P&L statement (script-wise summary).
// Detects the data table by looking for a header row containing "Symbol" and "Buy Value".
// Returns an array of { symbol, buyValue, sellValue, realizedPnl, openQty, openType, openValue }
function parsePnL(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map(c => String(c || '').trim().toLowerCase());
    if (cells.includes('symbol') && cells.some(c => c.includes('buy value') || c.includes('buy amount'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      'Could not find the data table in this P&L file. ' +
      'Please upload the Zerodha P&L Statement (script-wise) that has columns: Symbol, Buy Value, Sell Value, Realized P&L.'
    );
  }

  const header = (rows[headerIdx] || []).map(c => String(c || '').trim().toLowerCase());
  const col = name => header.findIndex(h => h.includes(name));

  const idx = {
    symbol:     col('symbol'),
    buyValue:   col('buy value'),
    sellValue:  col('sell value'),
    realizedPnl: header.findIndex(h => /\brealized\s+(p&l|pnl)\b/.test(h)),
    openQty:    col('open quantity'),
    openType:   col('open quantity type'),
    openValue:  col('open value'),
  };

  if (idx.symbol < 0 || idx.buyValue < 0 || idx.sellValue < 0) {
    throw new Error('P&L file is missing required columns (Symbol, Buy Value, Sell Value).');
  }

  const toNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  };

  const entries = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const symbol = String(r[idx.symbol] || '').trim();
    if (!symbol) continue;
    const buyValue    = toNumber(r[idx.buyValue]);
    const sellValue   = toNumber(r[idx.sellValue]);
    const realizedPnl = idx.realizedPnl >= 0 ? toNumber(r[idx.realizedPnl]) : sellValue - buyValue;
    const openQty     = idx.openQty   >= 0 ? toNumber(r[idx.openQty]) : 0;
    const openType    = idx.openType  >= 0 ? String(r[idx.openType] || '').trim().toLowerCase() : '';
    const openValue   = idx.openValue >= 0 ? toNumber(r[idx.openValue]) : 0;
    entries.push({ symbol, buyValue, sellValue, realizedPnl, openQty, openType, openValue });
  }

  if (!entries.length) {
    throw new Error('P&L file parsed successfully but contained no data rows.');
  }

  return entries;
}

module.exports = { parsePnL };
