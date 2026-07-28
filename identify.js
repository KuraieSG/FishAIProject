// Calls the Google Gemini API (free tier) to identify a fish from image bytes.

const PROMPT = `You are helping an angler identify a fish from a photo of their catch.
Look closely at body shape, fins, coloration, and markings.

Give your top 3 best-guess species, ranked most to least likely, with a confidence
percentage for each (they don't need to add up to 100 — each is your independent
confidence that this specific guess is correct).

Respond with ONLY a raw JSON object (no markdown fences, no preamble) with exactly this shape:
{"candidates": [
  {"common_name": string, "scientific_name": string, "confidence_percent": number (0-100),
   "habitat": short string, "typical_size": short string, "diet": short string,
   "fun_fact": one sentence, "caution": string or null (fill this ONLY if THIS species is
   venomous, has spines that can injure handlers, is commonly inedible/toxic to eat, or is a
   protected/invasive species with special handling rules where relevant — otherwise null)}
], ...exactly 3 objects total, ranked highest confidence first}.

If the image doesn't clearly show a fish, return exactly one candidate with common_name
"Not identifiable", confidence_percent 0, and explain briefly in fun_fact.`;

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

async function identifyFish(base64Image, mediaType) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set on the server.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mediaType, data: base64Image } },
            { text: PROMPT }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : 'Gemini API request failed.';
    throw new Error(msg);
  }

  const candidate = data.candidates && data.candidates[0];
  const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = part && part.text;
  if (!text) throw new Error('No text returned from the model.');

  const clean = text.trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("Couldn't parse the identification. Try a clearer photo.");
  }
}

module.exports = { identifyFish };
