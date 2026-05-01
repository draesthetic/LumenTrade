const path = require('path');
const express = require('express');
const multer = require('multer');
const { parseTradebook } = require('./src/parseTradebook');
const { pairTrades } = require('./src/pairTrades');
const { analyze } = require('./src/analytics');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const startingCapital = Number(req.body.startingCapital);
    if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
      return res.status(400).json({ error: 'Starting capital must be a positive number.' });
    }
    const fills = parseTradebook(req.file.buffer);
    if (!fills.length) return res.status(400).json({ error: 'No usable trade rows found in file.' });
    const { closed, openPositions } = pairTrades(fills);
    const result = analyze(closed, startingCapital);
    res.json({
      startingCapital,
      fillCount: fills.length,
      openPositions,
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
