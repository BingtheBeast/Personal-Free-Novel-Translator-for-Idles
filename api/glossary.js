export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const { prompt, language, userApiKey } = await req.json();
        const apiKey = (userApiKey && userApiKey.startsWith('gsk_')) ? userApiKey : process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('Server API key not configured.');

        const systemPrompt = `You are a glossary generator. Generate a list of 8-12 key terms related to the user's prompt for a ${language} web novel. Output EXACTLY in this format one per line: 'Original' = 'Translation'. Do not include any other text, numbering, intro or outro.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
                temperature: 0.3, max_tokens: 1000,
            }),
        });

        if (!response.ok) throw new Error((await response.json()).error?.message || 'Groq API failed');

        const data = await response.json();
        return new Response(JSON.stringify({ glossary: data.choices[0].message.content.trim() }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}