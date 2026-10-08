/**
 * extract.js — Gemini Vision prescription OCR + fallback
 * POST /api/prescription/extract
 */

const path = require('path');
const sample = require('./sample-prescription.json');

// Valid instruction values
const VALID_INSTRUCTIONS = [
  'before_food', 'after_food', 'with_food',
  'empty_stomach', 'bedtime', 'none'
];

/**
 * Normalise a single medicine object from Gemini output.
 */
function normaliseMedicine(m) {
  return {
    name: String(m.name || 'Unknown').trim(),
    strength: String(m.strength || '').trim(),
    dose: String(m.dose || '1 tablet').trim(),
    frequency_per_day: Number(m.frequency_per_day) || 1,
    instruction: VALID_INSTRUCTIONS.includes(m.instruction) ? m.instruction : 'none',
    duration_days: Number(m.duration_days) || 30,
    notes: String(m.notes || '').trim(),
    confidence: Number(m.confidence) || 0.8,
  };
}

/**
 * Strip markdown code fences Gemini sometimes wraps around JSON.
 */
function stripFences(text) {
  return text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
}

/**
 * Call Gemini Vision with the uploaded image buffer.
 */
async function extractWithGemini(imageBuffer, mimeType) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = `You are a medical prescription parser. Analyse this prescription image carefully.
Return ONLY valid JSON — no markdown, no explanation, nothing else.
The JSON must follow this exact schema:
{
  "medicines": [
    {
      "name": "string",
      "strength": "string (e.g. 500 mg)",
      "dose": "string (e.g. 1 tablet)",
      "frequency_per_day": number,
      "instruction": "one of: before_food | after_food | with_food | empty_stomach | bedtime | none",
      "duration_days": number,
      "notes": "string",
      "confidence": number between 0 and 1
    }
  ]
}
If you cannot determine a field, use a sensible default. Do not include markdown fences.`;

  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.medicines)) {
    throw new Error('Response missing medicines array');
  }

  return { medicines: parsed.medicines.map(normaliseMedicine) };
}

/**
 * Express handler — mounted by index.js
 */
async function handleExtract(req, res) {
  try {
    // ?sample=1 or no API key → return bundled sample
    const useSample = req.query.sample === '1' || !process.env.GEMINI_API_KEY;

    if (useSample) {
      return res.json({
        source: 'sample',
        medicines: sample.medicines.map(normaliseMedicine),
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const result = await extractWithGemini(req.file.buffer, req.file.mimetype);
    return res.json({ source: 'gemini', ...result });
  } catch (err) {
    console.error('[extract] error:', err.message);

    // If Gemini fails mid-demo, fall back to sample silently
    if (err instanceof SyntaxError || err.message.includes('medicines array')) {
      return res.status(422).json({
        error: 'Could not parse Gemini response as valid JSON',
        detail: err.message,
      });
    }

    // Network / API errors → serve sample so demo never breaks
    console.warn('[extract] Gemini unavailable, using sample fallback');
    return res.json({
      source: 'fallback',
      medicines: sample.medicines.map(normaliseMedicine),
    });
  }
}

module.exports = { handleExtract };
