const path = require('path');
const express = require('express');
const multer = require('multer');
const { runAnalysis } = require('./src/pipeline');

// NOTE: As of the client-side conversion, the app is a static site (GitHub Pages)
// that runs the whole pipeline in the browser. This Express server is kept only
// as an optional local dev convenience — it serves the same static files and
// engine scripts, and exposes /upload for parity testing against the browser path.

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));

// Serve the engine modules so the browser loads them at the same relative path
// the Pages build uses (engine/*.js). src/ is the single source of truth.
app.use('/engine', express.static(path.join(__dirname, 'src')));

app.post('/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'pnlFile', maxCount: 1 }]), (req, res) => {
  try {
    const tradebookFile = req.files?.file?.[0];
    if (!tradebookFile) return res.status(400).json({ error: 'No tradebook file uploaded.' });

    const data = runAnalysis({
      tradebookBytes: tradebookFile.buffer,
      pnlBytes: req.files?.pnlFile?.[0]?.buffer,
      startingCapital: req.body.startingCapital,
      riskFreeRate: req.body.riskFreeRate,
      charges: req.body.charges,
    });
    res.json(data);
  } catch (err) {
    // Log the real error server-side; never echo err.message to the client
    // (can leak file paths, library internals, stack-trace fragments).
    console.error(err);
    const isServerError = err instanceof TypeError || err instanceof ReferenceError;
    res.status(isServerError ? 500 : 400).json({
      error: isServerError ? 'Internal server error.' : 'Failed to process file.',
    });
  }
});

const PORT = process.env.PORT || 3000;
// Bind to loopback only — this dev server has no auth in front of it.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`LumenTrade (local dev) on http://${HOST}:${PORT}`);
});
