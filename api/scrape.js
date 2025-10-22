import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import cheerio from 'cheerio';

function findBestNavigationLink($, baseUrl, type) {
    const candidates = [];
    const keywords = type === 'next' 
        ? ['下一章', 'next chapter', '다음', 'next']
        : ['上一章', 'previous chapter', '이전', 'prev'];
    
    const allLinks = $('a[href]').toArray();

    allLinks.forEach((linkElement, index) => {
        const link = $(linkElement);
        let score = 0;
        const linkText = link.text().toLowerCase().trim();
        const linkHref = link.attr('href');

        if (!linkHref || linkHref.startsWith('javascript:') || linkHref === '#') return;
        if (keywords.some(k => linkText.includes(k))) score += 20; else return;
        if (link.attr('rel') === type) score += 100;
        if ((link.attr('id') || '').toLowerCase().includes(type)) score += 50;
        if ((link.attr('class') || '').toLowerCase().includes(type)) score += 30;
        if (index > allLinks.length * 0.85) score += 10;
        
        try {
            const absoluteUrl = new URL(linkHref, baseUrl).href;
            if (!candidates.some(c => c.url === absoluteUrl)) {
                 candidates.push({ url: absoluteUrl, score: score });
            }
        } catch (e) { /* Invalid URL */ }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
}

export async function scrapeChapter(novelUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds

    try {
        const response = await fetch(novelUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            }
        });

        if (!response.ok) throw new Error(`Failed to fetch chapter. The site returned status: ${response.status}`);
        const html = await response.text();

        const doc = new JSDOM(html, { url: novelUrl });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (!article || !article.textContent) throw new Error('Could not automatically extract the chapter text.');
        
        const content$ = cheerio.load(article.content);
        const rawText = content$.text().trim();
        const chapterTitle = article.title || 'Untitled Chapter';

        const original$ = cheerio.load(html);
        const nextUrl = findBestNavigationLink(original$, novelUrl, 'next');
        const prevUrl = findBestNavigationLink(original$, novelUrl, 'prev');
        
        return { rawText, chapterTitle, nextUrl, prevUrl };
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('The target website took too long to respond.');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
