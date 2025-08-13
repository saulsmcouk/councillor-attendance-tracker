import * as cheerio from 'cheerio';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const OUT_DIR = path.resolve('../scrapers/out');

app.use(express.static('public'));

// API endpoint to get councillor headshot
app.get('/api/headshot', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch details page');
    const html = await response.text();
    const $ = cheerio.load(html);
  // Try to find the first image inside a div with class 'mgBigPhoto'
  let img = $('.mgBigPhoto img').first().attr('src');
  // Fallback: try to find the image at the given XPath
  if (!img) img = $('body > div:nth-child(1) > div:nth-child(5) > div > div > div:nth-child(2) > div:nth-child(1) > img').attr('src');
  // Fallback: try to find the first img in the main content
  if (!img) img = $('img').first().attr('src');
  if (!img) return res.status(404).json({ error: 'No headshot found' });
  // If the src is relative, resolve it against the base url
  const base = new URL(url);
  if (img.startsWith('/')) img = base.origin + img;
  else if (!img.startsWith('http')) img = base.origin + '/' + img;
  res.json({ img });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch headshot' });
  }
});
// Get list of council data files
app.get('/api/councils', async (req, res) => {
  try {
    // Read councils.json to get baseUrl mapping
    const councilsJsonPath = path.resolve('../scrapers/councils.json');
    const councilsJson = await fs.readFile(councilsJsonPath, 'utf-8');
    const councilMeta = JSON.parse(councilsJson);

    const files = await fs.readdir(OUT_DIR);
    const councilFiles = files.filter(f => f.endsWith('Data.json'));
    const councils = [];
    for (const file of councilFiles) {
      try {
        const data = await fs.readFile(path.join(OUT_DIR, file), 'utf-8');
        const json = JSON.parse(data);
        // Try to match by councilName (case-insensitive, trimmed)
        let meta = councilMeta.find(c => c.councilName.trim().toLowerCase() === json.councilName.trim().toLowerCase());
        // If not found, try matching by fileName (ignoring Data.json suffix)
        if (!meta) {
          const fileBase = file.replace(/Data\.json$/i, '').toLowerCase();
          meta = councilMeta.find(c => c.fileName.trim().toLowerCase() === fileBase);
        }
        councils.push({ councilName: json.councilName, fileName: file, baseUrl: meta ? meta.baseUrl : '' });
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
