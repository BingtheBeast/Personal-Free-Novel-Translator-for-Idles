// Vercel serverless function: forwards translation request to Groq using GROQ_API_KEY in env.
module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration: GROQ_API_KEY not set' });

    const body = req.body || {};
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: body.model || 'llama-3.3-70b-versatile',
        messages: body.messages,
        max_tokens: body.max_tokens || 8000,
        stream: false
      })
    });

    const data = await groqResp.json().catch(() => null);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!groqResp.ok) {
      return res.status(502).json({ error: data?.error?.message || `Groq returned ${groqResp.status}` });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('translate proxy error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Internal server error' });
  }
};