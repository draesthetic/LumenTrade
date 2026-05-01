function pairTrades(fills) {
  const books = new Map();
  const closed = [];

  for (const fill of fills) {
    if (!books.has(fill.symbol)) books.set(fill.symbol, { longs: [], shorts: [] });
    const book = books.get(fill.symbol);

    if (fill.side === 'buy') {
      let remaining = fill.qty;
      while (remaining > 0 && book.shorts.length > 0) {
        const open = book.shorts[0];
        const closeQty = Math.min(remaining, open.qty);
        closed.push({
          symbol: fill.symbol,
          side: 'short',
          qty: closeQty,
          entryPrice: open.price,
          exitPrice: fill.price,
          entryTime: open.execTime,
          exitTime: fill.execTime,
          pnl: (open.price - fill.price) * closeQty,
          durationMs: fill.execTime - open.execTime,
        });
        open.qty -= closeQty;
        remaining -= closeQty;
        if (open.qty <= 0) book.shorts.shift();
      }
      if (remaining > 0) {
        book.longs.push({ price: fill.price, qty: remaining, execTime: fill.execTime });
      }
    } else {
      let remaining = fill.qty;
      while (remaining > 0 && book.longs.length > 0) {
        const open = book.longs[0];
        const closeQty = Math.min(remaining, open.qty);
        closed.push({
          symbol: fill.symbol,
          side: 'long',
          qty: closeQty,
          entryPrice: open.price,
          exitPrice: fill.price,
          entryTime: open.execTime,
          exitTime: fill.execTime,
          pnl: (fill.price - open.price) * closeQty,
          durationMs: fill.execTime - open.execTime,
        });
        open.qty -= closeQty;
        remaining -= closeQty;
        if (open.qty <= 0) book.longs.shift();
      }
      if (remaining > 0) {
        book.shorts.push({ price: fill.price, qty: remaining, execTime: fill.execTime });
      }
    }
  }

  closed.sort((a, b) => a.exitTime - b.exitTime);

  const openPositions = [];
  for (const [symbol, book] of books.entries()) {
    for (const lot of book.longs) openPositions.push({ symbol, side: 'long', ...lot });
    for (const lot of book.shorts) openPositions.push({ symbol, side: 'short', ...lot });
  }

  return { closed, openPositions };
}

module.exports = { pairTrades };
