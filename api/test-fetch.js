// This is a special debugging file. Its only purpose is to test if Vercel can fetch a URL.
export default async function handler(req, res) {
    // Get the URL from the query parameter, like /api/test-fetch?url=https://...
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const novelUrl = searchParams.get('url');

    if (!novelUrl) {
        return res.status(400).json({ error: "Please provide a URL to test, e.g., /api/test-fetch?url=https://example.com" });
    }

    console.log(`[TEST-FETCH] Attempting to fetch: ${novelUrl}`);

    try {
        const response = await fetch(novelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const status = response.status;
        const headers = Object.fromEntries(response.headers.entries());
        const body = await response.text();

        console.log(`[TEST-FETCH] Success. Status: ${status}`);
        
        // Return a JSON response to the browser with all the info
        return res.status(200).json({
            status: "SUCCESS",
            statusCode: status,
            headers: headers,
            bodySnippet: body.substring(0, 500) + "..." // Show the first 500 characters
        });

    } catch (error) {
        console.error(`[TEST-FETCH] FAILED. Error: ${error.message}`);
        
        // Return a JSON error to the browser
        return res.status(500).json({
            status: "FAILED",
            error: error.message,
            errorStack: error.stack
        });
    }
}