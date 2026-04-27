const OpenAI = require('openai');
const fs = require('fs');

function getProvider() {
  const provider = process.env.AI_PROVIDER || 'openai';

  if (provider === 'openai') {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

async function analyzePhoto(imagePath, weightKg) {
  const client = getProvider();
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' :
    imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You are a nutrition estimator. Given a meal photo and the user's weight (${weightKg} kg), estimate: dish name, total calories, protein/carbs/fat in grams, and confidence (0-1). Account for portion size relative to typical plates. Return ONLY JSON: {"name","calories","protein_g","carbs_g","fat_g","confidence"}. No prose.`,
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
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const result = JSON.parse(jsonMatch[0]);
  return {
    name: result.name || 'Unknown dish',
    calories: Math.round(Number(result.calories) || 0),
    proteinG: Math.round(Number(result.protein_g) || 0),
    carbsG: Math.round(Number(result.carbs_g) || 0),
    fatG: Math.round(Number(result.fat_g) || 0),
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
  };
}

async function getSuggestion({ goal, target, eaten, protein, carbs, fat }) {
  const client = getProvider();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `User: ${goal}, target ${target} kcal, ate ${eaten} kcal, P/C/F: ${protein}/${carbs}/${fat}g. Give 1-sentence advice (max 25 words).`,
      },
    ],
  });

  return response.choices[0].message.content.trim();
}

module.exports = { analyzePhoto, getSuggestion };
