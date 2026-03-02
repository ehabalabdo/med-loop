/**
 * Vercel Serverless Function — TTS Proxy
 * 
 * GET /api/tts?text=...&lang=ar
 * 
 * Fetches audio from Google Translate TTS and streams it back.
 * This avoids CORS issues since the request is same-origin.
 */
export default async function handler(req, res) {
  const { text, lang = 'ar' } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'text parameter required' });
  }

  // CORS headers (allow frontend origins)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      console.error('Google TTS error:', response.status, response.statusText);
      return res.status(502).json({ error: 'TTS upstream error', status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('TTS proxy error:', err);
    res.status(500).json({ error: 'TTS proxy error' });
  }
}
