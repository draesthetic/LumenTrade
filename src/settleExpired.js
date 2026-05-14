// Derives settlement prices for expired positions using the P&L statement.
//
// The P&L statement (script-wise) records total Buy Value and Sell Value across
// ALL fills for a symbol, including exchange settlement at expiry. The tradebook
// only has explicit fill rows — settlement closures are absent. By subtracting
// the tradebook fill values from the P&L file totals, we recover the settlement
// transaction and can synthesize a proper closed-trade record.

function settleExpiredPositions(expiredPositions, closedTrades, fills, pnlEntries) {
  const pnlMap = new Map(pnlEntries.map(e => [e.symbol.toUpperCase(), e]));
  const fillTotals = new Map();
  for (const f of fills) {
    const sym = String(f.symbol || '').toUpperCase();
    if (!sym) continue;
    const totals = fillTotals.get(sym) || { buyValue: 0, sellValue: 0 };
    const value = f.price * f.qty;
    if (f.side === 'buy') totals.buyValue += value;
    else totals.sellValue += value;
    fillTotals.set(sym, totals);
  }

  const expiredBySymbol = new Map();
  for (const pos of expiredPositions) {
    const sym = String(pos.symbol || '').toUpperCase();
    if (!sym) continue;
    if (!expiredBySymbol.has(sym)) {
      expiredBySymbol.set(sym, { positions: [], longQty: 0, shortQty: 0 });
    }
    const group = expiredBySymbol.get(sym);
    group.positions.push(pos);
    if (pos.side === 'short') group.shortQty += pos.qty;
    else group.longQty += pos.qty;
  }

  const settled = [];
  const unresolved = [];

  for (const [sym, group] of expiredBySymbol.entries()) {
    const pnl = pnlMap.get(sym);
    if (!pnl) {
      unresolved.push(...group.positions);
      continue;
    }

    const totals = fillTotals.get(sym) || { buyValue: 0, sellValue: 0 };
    const settleBuyValue  = pnl.buyValue  - totals.buyValue;
    const settleSellValue = pnl.sellValue - totals.sellValue;

    const shortPrice = group.shortQty > 0 ? settleBuyValue / group.shortQty : null;
    const longPrice  = group.longQty > 0 ? settleSellValue / group.longQty : null;

    for (const pos of group.positions) {
      if (pos.qty <= 0) {
        unresolved.push(pos);
        continue;
      }

      let settlementPrice;
      let settlementPnl;

      if (pos.side === 'short') {
        if (settleBuyValue < 0 || !Number.isFinite(shortPrice)) {
          unresolved.push(pos);
          continue;
        }
        settlementPrice = shortPrice;
        settlementPnl   = (pos.price - settlementPrice) * pos.qty;
      } else {
        if (settleSellValue < 0 || !Number.isFinite(longPrice)) {
          unresolved.push(pos);
          continue;
        }
        settlementPrice = longPrice;
        settlementPnl   = (settlementPrice - pos.price) * pos.qty;
      }

      const expiry = pos.expiredAt ? new Date(pos.expiredAt) : new Date(pos.execTime);

      settled.push({
        symbol:      pos.symbol,
        side:        pos.side,
        qty:         pos.qty,
        entryPrice:  pos.price,
        exitPrice:   Math.round(settlementPrice * 100) / 100,
        entryTime:   pos.execTime,
        exitTime:    expiry,
        pnl:         settlementPnl,
        durationMs:  expiry - new Date(pos.execTime),
        isSettlement: true,
      });
    }
  }

  return { settled, unresolved };
}

module.exports = { settleExpiredPositions };
