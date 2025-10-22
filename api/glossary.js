export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const { prompt, language, userApiKey } = await req.json();
        const apiKey = (userApiKey && userApiKey.startsWith('gsk_')) ? userApiKey : process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('Server API key not configured.');

        // --- NEW: High-Quality, Ultra-Specific System Prompt ---
        const scriptName = language === 'chinese' ? 'Chinese Hanzi characters' : 'Korean Hangul characters';
        const example = language === 'chinese' 
            ? "'修炼' = 'Cultivation'\n'金丹' = 'Golden Core'" 
            : "'헌터' = 'Hunter'\n'게이트' = 'Gate'";

        const systemPrompt = `You are an expert glossary generator for web novels.
        
        **CRITICAL RULES:**
        1.  Your primary task is to generate a list of 8-12 key terms related to the user's prompt.
        2.  The 'Original' term MUST be in the original script (${scriptName}), NOT in Pinyin or Romanization.
        3.  Output EXACTLY in the format 'Original' = 'Translation', with one term per line.
        4.  Do NOT include any other text, numbering, introductions, explanations, or markdown. Your entire response must be only the glossary terms.

        **EXAMPLE OUTPUT FORMAT:**
        ${example}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2, // Lower temperature for stricter f
