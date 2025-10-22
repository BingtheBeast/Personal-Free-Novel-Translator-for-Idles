import { scrapeChapter } from './scrape.js';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });

    try {
        const { novelUrl, promptData, userApiKey } = await req.json();
        const apiKey = (userApiKey && userApiKey.startsWith('gsk_')) ? userApiKey : process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('API key is not configured. Please add your own in Settings.');

        const { rawText, chapterTitle, nextUrl, prevUrl } = await scrapeChapter(novelUrl);
        const textToTranslate = `${chapterTitle}\n---\n${rawText}`;
        const finalPrompt = promptData.replace('{{TEXT}}', textToTranslate);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: finalPrompt }],
                stream: true, max_tokens: 8000,
            }),
        });

        if (!groqResponse.ok) throw new Error((await groqResponse.json()).error?.message || 'Groq API request failed');

        return new Response(groqResponse.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'X-Next-Url': nextUrl || '',
                'X-Prev-Url': prevUrl || '',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}