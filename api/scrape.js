import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio'; // CORRECTED IMPORT

function findBestNavigationLink($, baseUrl, type) {
    // ... (rest of the function is identical)
    const candidates = [];
    const keywords = type === 'next' ? ['下一章', 'next chapter', '다음', 'next'] : ['上一章', 'previous chapter', '이전', 'prev'];
    const allLinks = $('a[href]').toArray();
    allLinks.forEach((linkElement) => {
        const link = $(linkElement); let score = 0;
        const linkText = link.text().toLowerCase().trim(); const linkHref = link.attr('href');
        if (!linkHref || linkHref.startsWith('javascript:') || linkHref === '#') return;
        if (keywords.some(k => linkText.includes(k))) score += 20; else return;
        if (link.attr('rel') === type) score += 100;
        if ((link.attr('id') || '').toLowerCase().includes(type)) score += 50;
        if ((link.attr('class') || '').toLowerCase().includes(type)) score += 30;
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
    const timeout = setTimeout(() => controller.abort(), 9000);

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

        if (userCssSelector) {
            const userText = $(userCssSelector).text().trim();
            if (userText.length > 200) {
                rawText = userText;
                chapterTitle = $('h1, h2, .title, .chapter-title, .entry-title').first().text().trim() || 'Untitled Chapter';
            }
        }

        if (!rawText) {
            const doc = new JSDOM(html, { url: novelUrl });
            const reader = new Readability(doc.window.document);
            const article = reader.parse();
            if (article && article.textContent && article.textContent.trim().length > 200) {
                const content$ = cheerio.load(article.content);
                rawText = content$.text().trim();
                chapterTitle = article.title || 'Untitled Chapter';
            }
        }
        
        if (!rawText) {
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
