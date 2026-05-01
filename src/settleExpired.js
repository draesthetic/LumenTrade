// Derives settlement prices for expired positions using the P&L statement.
//
// The P&L statement (script-wise) records total Buy Value and Sell Value across
// ALL fills for a symbol, including exchange settlement at expiry. The tradebook
// only has explicit fill rows — settlement closures are absent. By subtracting
// the tradebook fill values from the P&L file totals, we recover the settlement
// transaction and can synthesize a proper closed-trade record.

function settleExpiredPositions(expiredPositions, closedTrades, fills, pnlEntries) {
  const pnlMap = new Map(pnlEntries.map(e => [e.symbol.toUpperCase(), e]));
  const settled = [];
  const unresolved = [];

  for (const pos of expiredPositions) {
    const sym = pos.symbol.toUpperCase();
    const pnl = pnlMap.get(sym);
    if (!pnl) {
      unresolved.push(pos);
      continue;
    }

    // Sum buy-side and sell-side fill values for this symbol from the tradebook.
    const symFills = fills.filter(f => f.symbol.toUpperCase() === sym);
    let fillBuyValue  = 0;
    let fillSellValue = 0;
    for (const f of symFills) {
      if (f.side === 'buy')  fillBuyValue  += f.price * f.qty;
      else                   fillSellValue += f.price * f.qty;
    }

    // Settlement value = P&L file total − tradebook fills
    const settleBuyValue  = pnl.buyValue  - fillBuyValue;
    const settleSellValue = pnl.sellValue - fillSellValue;

    let settlementPrice;
    let settlementPnl;

    if (pos.side === 'short') {
      // Short was opened with a sell fill (already in tradebook).
      // Settlement closes it with a buy at the exchange settlement price.
      if (pos.qty <= 0 || settleBuyValue <= 0) {
        unresolved.push(pos);
        continue;
      }
      settlementPrice = settleBuyValue / pos.qty;
      settlementPnl   = (pos.price - settlementPrice) * pos.qty;
    } else {
      // Long was opened with a buy fill (already in tradebook).
      // Settlement closes it with a sell at the exchange settlement price.
      if (pos.qty <= 0 || settleSellValue <= 0) {
        unresolved.push(pos);
        continue;
      }
      settlementPrice = settleSellValue / pos.qty;
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

  return { settled, unresolved };
}

module.exports = { settleExpiredPositions };
