const OpenAI = require('openai');
const fs = require('fs');
const { getLanguageName } = require('../utils/languageName');

function getProvider() {
  const provider = process.env.AI_PROVIDER || 'openai';

  if (provider === 'openai') {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

const NOT_FOOD_MESSAGE = "This doesn't look like food. Try another photo.";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Normalize the model's JSON for a photo scan into totals + per-item rows.
 * Items are what the UI shows as editable rows; totals are recomputed from them when present.
 * Throws an error with code NOT_FOOD when the model says the photo is not food.
 */
function normalizeVisionResult(result) {
  if (result.is_food === false) {
    const err = new Error(NOT_FOOD_MESSAGE);
    err.code = 'NOT_FOOD';
    throw err;
  }
  if (!result.name && !result.calories && !(Array.isArray(result.items) && result.items.length)) {
    throw new Error('Could not recognize the meal. Try a clearer photo or describe what you ate.');
  }

  const items = (Array.isArray(result.items) ? result.items : [])
    .filter((it) => it && typeof it === 'object' && (it.name || it.calories))
    .slice(0, 12)
    .map((it) => ({
      name: String(it.name || 'Item').slice(0, 100),
      grams: Math.round(num(it.grams)),
      calories: Math.round(num(it.calories)),
      proteinG: Math.round(num(it.protein_g) * 10) / 10,
      carbsG: Math.round(num(it.carbs_g) * 10) / 10,
      fatG: Math.round(num(it.fat_g) * 10) / 10,
    }));

  const sum = (k) => items.reduce((acc, it) => acc + it[k], 0);
  const totals = items.length
    ? { calories: sum('calories'), proteinG: sum('proteinG'), carbsG: sum('carbsG'), fatG: sum('fatG') }
    : { calories: num(result.calories), proteinG: num(result.protein_g), carbsG: num(result.carbs_g), fatG: num(result.fat_g) };

  const name = result.name || items.map((it) => it.name).join(', ') || 'Unknown dish';
  const finalItems = items.length
    ? items
    : [{ name, grams: 0, calories: Math.round(totals.calories), proteinG: totals.proteinG, carbsG: totals.carbsG, fatG: totals.fatG }];

  return {
    name: String(name).slice(0, 200),
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
    items: finalItems,
  };
}

async function analyzePhoto(imagePath, weightKg, context, language = 'en') {
  const client = getProvider();
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' :
    imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

  const contextHint = context
    ? ` The user provided additional context: "${context}".`
    : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: `You are a nutrition estimator. Given a meal photo and the user's weight (${weightKg} kg), first decide whether the photo shows food or drink. If it does not, return {"is_food": false}. Otherwise list each distinct food item you can see with its estimated weight in grams, calories and protein/carbs/fat in grams, plus an overall dish name, totals and confidence (0-1). Account for portion size relative to typical plates.${contextHint} Respond with names in ${getLanguageName(language)}. Return ONLY valid JSON: {"is_food": true, "name", "calories", "protein_g", "carbs_g", "fat_g", "confidence", "items": [{"name", "grams", "calories", "protein_g", "carbs_g", "fat_g"}]}. No markdown, no code fences, no prose.`,
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  });

  const text = response.choices[0].message.content.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not analyze this photo. Please try again or add more context about the meal.');
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Could not analyze this photo. Please try again or add more context about the meal.');
  }

  return normalizeVisionResult(result);
}

async function transcribeAudio(filePath) {
  const client = getProvider();
  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file: fs.createReadStream(filePath),
  });
  return response.text;
}

async function getSuggestion({ goal, target, eaten, protein, carbs, fat, language = 'en' }) {
  const client = getProvider();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `User: ${goal}, target ${target} kcal, ate ${eaten} kcal, P/C/F: ${protein}/${carbs}/${fat}g. Give 1-sentence advice (max 25 words). Respond in ${getLanguageName(language)}.`,
      },
    ],
  });

  return response.choices[0].message.content.trim();
}

async function analyzeVoiceText(text, weightKg, language = 'en') {
  const client = getProvider();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You are a nutrition estimator. The user describes what they ate. Given the description and user's weight (${weightKg} kg), estimate: dish name, total calories, protein/carbs/fat in grams, and confidence (0-1). If the description is vague, use reasonable average portions. Respond with the dish name in ${getLanguageName(language)}. Return ONLY valid JSON: {"name","calories","protein_g","carbs_g","fat_g","confidence"}. No markdown, no code fences, no prose.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  const raw = response.choices[0].message.content.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not analyze this description. Please try again with more detail.');
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Could not analyze this description. Please try again with more detail.');
  }

  if (!result.name && !result.calories) {
    throw new Error('Could not recognize the meal. Try describing what you ate more clearly.');
  }

  return {
    name: result.name || 'Unknown dish',
    calories: Math.round(Number(result.calories) || 0),
    proteinG: Math.round(Number(result.protein_g) || 0),
    carbsG: Math.round(Number(result.carbs_g) || 0),
    fatG: Math.round(Number(result.fat_g) || 0),
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
  };
}

module.exports = { analyzePhoto, analyzeVoiceText, transcribeAudio, getSuggestion, normalizeVisionResult };
