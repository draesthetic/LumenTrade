const XLSX = require('xlsx');

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => String(c || '').trim().toLowerCase());
    if (cells.includes('symbol') && cells.includes('trade type')) return i;
  }
  throw new Error('Could not find header row (no row with both "Symbol" and "Trade Type"). Is this a Zerodha tradebook?');
}

function colIndex(headerRow, name) {
  const target = name.trim().toLowerCase();
  return headerRow.findIndex((c) => String(c || '').trim().toLowerCase() === target);
}

function parseExecTime(value, fallbackDate) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
  }
  if (typeof value === 'string' && value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (fallbackDate) {
    if (fallbackDate instanceof Date) return fallbackDate;
    const d = new Date(fallbackDate);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseTradebook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const headerIdx = findHeaderRow(rows);
  const header = rows[headerIdx];

  const idx = {
    symbol: colIndex(header, 'symbol'),
    tradeDate: colIndex(header, 'trade date'),
    side: colIndex(header, 'trade type'),
    qty: colIndex(header, 'quantity'),
    price: colIndex(header, 'price'),
    execTime: colIndex(header, 'order execution time'),
    segment: colIndex(header, 'segment'),
  };
  if (idx.symbol < 0 || idx.side < 0 || idx.qty < 0 || idx.price < 0) {
    throw new Error('Tradebook is missing required columns (symbol/trade type/quantity/price).');
  }

  const fills = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === null || c === '')) continue;
    const sideRaw = String(r[idx.side] || '').trim().toLowerCase();
    if (sideRaw !== 'buy' && sideRaw !== 'sell') continue;
    const qty = Number(r[idx.qty]);
    const price = Number(r[idx.price]);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) continue;
    const execTime = parseExecTime(r[idx.execTime], r[idx.tradeDate]);
    if (!execTime) continue;
    fills.push({
      symbol: String(r[idx.symbol]).trim(),
      segment: idx.segment >= 0 ? String(r[idx.segment] || '').trim() : '',
      side: sideRaw,
      qty,
      price,
      tradeDate: r[idx.tradeDate] instanceof Date ? r[idx.tradeDate] : new Date(r[idx.tradeDate]),
      execTime,
    });
  }

  fills.sort((a, b) => a.execTime - b.execTime);
  return fills;
}

module.exports = { parseTradebook };
