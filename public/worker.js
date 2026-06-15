/* ════════════════════════════════════════════════════════════════════════════
   LumenTrade analysis worker
   Runs the full parse → pair → settle → analyze pipeline off the main thread so
   even a very large tradebook never blocks the UI. Paths are relative to this
   worker's URL: SheetJS is vendored under vendor/, the engine under engine/
   (served from src/ in local dev, copied there by the Pages build).
   ════════════════════════════════════════════════════════════════════════════ */

importScripts(
  'vendor/xlsx.full.min.js',
  'engine/analytics.js',
  'engine/parseTradebook.js',
  'engine/parsePnL.js',
  'engine/pairTrades.js',
  'engine/settleExpired.js',
  'engine/pipeline.js'
);

self.onmessage = (e) => {
  try {
    // runAnalysis is attached to globalThis (=== self here) by pipeline.js.
    const data = self.runAnalysis(e.data);
    self.postMessage({ ok: true, data });
  } catch (err) {
    self.postMessage({ ok: false, error: (err && err.message) || 'Analysis failed.' });
  }
};
