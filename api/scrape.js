// Vercel serverless function: fetches a URL and extracts chapter text + title.
// Uses cheerio (installed via package.json).
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });

    // Basic server-side fetch (Vercel runs Node 18+, so global fetch is available)
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return res.status(502).json({ error: `Failed to fetch URL (${response.status})` });
    const html = await response.text();

    const $ = cheerio.load(html);

    // Try a set of common selectors for novel chapter content
    const selectors = ['article', '.content', '#content', '.chapter-content', '.entry-content', '.read-content', '.novel-content'];
    let rawText = null;
    for (const s of selectors) {
      const el = $(s);
      if (el && el.text().trim().length > 200) {
        rawText = el.text().trim();
        break;
      }
    }

    // Fallback: try to pick the largest <div> by text length
    if (!rawText) {
      let best = { len: 0, text: '' };
      $('div').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > best.len) best = { len: t.length, text: t };
      });
      if (best.len > 200) rawText = best.text;
    }

    const title = $('h1').first().text().trim() || $('title').text().trim() || '';

    // Also attempt next/prev links (by rel or common text)
    let next = null, prev = null;
    $('a[href]').each((i, el) => {
      const a = $(el);
      const txt = (a.text() || '').replace(/\s+/g, '').toLowerCase();
      const rel = (a.attr('rel') || '').toLowerCase();
      const href = a.attr('href');
      if (!next && (rel === 'next' || txt.includes('下一章') || txt.includes('next') || txt.includes('다음'))) {
        try { next = new URL(href, url).href; } catch (e) {}
      }
      if (!prev && (rel === 'prev' || txt.includes('上一章') || txt.includes('previous') || txt.includes('이전'))) {
        try { prev = new URL(href, url).href; } catch (e) {}
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ rawText: rawText || null, title: title || null, next, prev });
  } catch (err) {
    console.error('scrape error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Server scrape error' });
  }
};