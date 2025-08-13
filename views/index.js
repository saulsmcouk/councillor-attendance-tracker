import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const OUT_DIR = path.resolve('../scrapers/out');

app.use(express.static('public'));

// Get list of council data files
app.get('/api/councils', async (req, res) => {
  try {
    const files = await fs.readdir(OUT_DIR);
    const councilFiles = files.filter(f => f.endsWith('Data.json'));
    const councils = [];
    for (const file of councilFiles) {
      try {
        const data = await fs.readFile(path.join(OUT_DIR, file), 'utf-8');
        const json = JSON.parse(data);
        councils.push({ councilName: json.councilName, fileName: file });
      } catch (err) {
        // skip files that can't be read/parsed
      }
    }
    res.json(councils);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list councils.' });
  }
});

// Get data for a specific council
app.get('/api/council/:file', async (req, res) => {
  try {
    const filePath = path.join(OUT_DIR, req.params.file);
    const data = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(404).json({ error: 'Council not found.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
