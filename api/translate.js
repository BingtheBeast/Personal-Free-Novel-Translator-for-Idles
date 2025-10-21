export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const { prompt, model = "llama-3.3-70b-versatile", max_tokens = 8000 } = req.body || {};
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not set in environment variables." });
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true, // Enable streaming!
        max_tokens,
      }),
    });

    if (!groqRes.ok) {
      const errorData = await groqRes.json();
      return res.status(groqRes.status).json({ error: errorData.error?.message || "Groq API error" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of groqRes.body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
