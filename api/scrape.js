import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import cheerio from 'cheerio';

function findBestNavigationLink($, baseUrl, type) {
    // This function is perfect and does not need to be changed
    const candidates = [];
    const keywords = type === 'next' ? ['下一章', 'next chapter', '다음', 'next'] : ['上一章', 'previous chapter', '이전', 'prev'];
    const allLinks = $('a[href]').toArray();
    allLinks.forEach((linkElement, index) => {
        const link = $(linkElement); let score = 0;
        const linkText = link.text().toLowerCase().trim(); const linkHref = link.attr('href');
        if (!linkHref || linkHref.startsWith('javascript:') || linkHref === '#') return;
        if (keywords.some(k => linkText.includes(k))) score += 20; else return;
        if (link.attr('rel') === type) score += 100;
        if ((link.attr('id') || '').toLowerCase().includes(type)) score += 50;
        if ((link.attr('class') || '').toLowerCase().includes(type)) score += 30;
        if (index > allLinks.length * 0.85) score += 10;
        try {
            const absoluteUrl = new URL(linkHref, baseUrl).href;
            if (!candidates.some(c => c.url === absoluteUrl)) candidates.push({ url: absoluteUrl, score: score });
        } catch (e) {}
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
}

export async function scrapeChapter(novelUrl, userCssSelector) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(novelUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        if (!response.ok) throw new Error(`Failed to fetch chapter. Status: ${response.status}`);
        const html = await response.text();
        
        let rawText = '';
        let chapterTitle = '';
        const $ = cheerio.load(html);

        // --- STAGE 1: Prioritize User-Provided Selector ---
        if (userCssSelector) {
            const userText = $(userCssSelector).text().trim();
            if (userText.length > 200) {
                console.log(`Scraping success with user selector: ${userCssSelector}`);
                rawText = userText;
                chapterTitle = $('h1, h2, .title, .chapter-title, .entry-title').first().text().trim() || 'Untitled Chapter';
            }
        }

        // --- STAGE 2: Attempt Intelligent Extraction (if Stage 1 failed) ---
        if (!rawText) {
            const doc = new JSDOM(html, { url: novelUrl });
            const reader = new Readability(doc.window.document);
            const article = reader.parse();
            if (article && article.textContent && article.textContent.trim().length > 200) {
                console.log("Scraping success with Readability engine.");
                const content$ = cheerio.load(article.content);
                rawText = content$.text().trim();
                chapterTitle = article.title || 'Untitled Chapter';
            }
        }
        
        // --- STAGE 3: Fallback to Generic Selectors (if Stages 1 & 2 failed) ---
        if (!rawText) {
            console.log("Falling back to generic selector engine.");
            const selectorsToTry = ['#content', '.entry-content', 'article', '.chapter-content', '#article-content', '.post-content', '.novel-content'];
            for (const selector of selectorsToTry) {
                const elementText = $(selector).text().trim();
                if (elementText.length > 200) {
                    rawText = elementText;
                    if (!chapterTitle) chapterTitle = $('h1, h2, .title, .chapter-title, .entry-title').first().text().trim() || 'Untitled Chapter';
                    break;
                }
            }
        }

        if (!rawText) throw new Error('Could not extract chapter text with any available method.');

        const nextUrl = findBestNavigationLink($, novelUrl, 'next');
        const prevUrl = findBestNavigationLink($, novelUrl, 'prev');
        
        return { rawText, chapterTitle, nextUrl, prevUrl };

    } catch (error) {
        if (error.name === 'AbortError') throw new Error('The target website took too long to respond.');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
