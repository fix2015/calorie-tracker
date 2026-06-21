const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { upload, uploadAudio } = require('../middleware/upload');
const { manualMealSchema } = require('../utils/validation');
const { analyzePhoto, analyzeVoiceText, transcribeAudio } = require('../services/vision');
const { uploadImage } = require('../services/s3');
const { refreshDailyStat } = require('../utils/dailyStats');

function autoTags(meal) {
  const tags = [];
  if (meal.proteinG >= 25) tags.push('High protein');
  if (meal.carbsG <= 20) tags.push('Low carb');
  if (meal.fatG <= 10) tags.push('Low fat');
  if (meal.calories <= 300) tags.push('Light');
  if (meal.calories <= 500 && meal.proteinG >= 20) tags.push('Healthy');
  if (meal.fatG >= 30) tags.push('High fat');
  if (meal.carbsG >= 60) tags.push('High carb');
  return tags.slice(0, 4);
}

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit reached, try again later' },
  keyGenerator: (req) => req.userId,
});

router.post('/manual', authenticate, async (req, res, next) => {
  try {
    const data = manualMealSchema.parse(req.body);
    const tags = autoTags(data);
    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name: data.name,
        calories: data.calories,
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        tags,
        source: 'manual',
        consumedAt: data.consumedAt ? new Date(data.consumedAt) : new Date(),
      },
    });
    refreshDailyStat(req.userId, meal.consumedAt).catch(() => {});
    res.status(201).json(meal);
  } catch (err) {
    next(err);
  }
});

router.post('/photo', authenticate, aiLimiter, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });

    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Accept weight from form body to update profile
    const bodyWeight = req.body.weight ? parseFloat(req.body.weight) : null;
    if (bodyWeight && bodyWeight >= 20 && bodyWeight <= 500) {
      user = await prisma.user.update({
        where: { id: req.userId },
        data: { weightKg: bodyWeight, weightUpdatedAt: new Date() },
      });
    }

    // Check if weight is available (either from profile or just submitted)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (!user.weightKg || !user.weightUpdatedAt || user.weightUpdatedAt < sevenDaysAgo) {
      const s3Url = await uploadImage(req.file.path);
      return res.status(200).json({
        needs_weight: true,
        message: 'Please update your weight for accurate portion estimation',
        photoUrl: s3Url || `/uploads/${req.file.filename}`,
      });
    }

    // Analyze photo with AI first (needs original file)
    const context = req.body.context || '';
    let result;
    try {
      const language = req.headers['x-language'] || 'en';
      result = await analyzePhoto(req.file.path, user.weightKg, context, language);
    } catch (aiErr) {
      // Still upload the photo to S3 even if AI fails
      const s3Url = await uploadImage(req.file.path);
      return res.status(422).json({
        error: aiErr.message || 'Could not analyze this photo. Please try again.',
        photoUrl: s3Url || `/uploads/${req.file.filename}`,
      });
    }
    const lowConfidence = result.confidence < 0.4;

    // Then resize + upload to S3 (deletes local file if S3 configured)
    const s3Url = await uploadImage(req.file.path);
    const photoUrl = s3Url || `/uploads/${req.file.filename}`;

    const mealTags = autoTags(result);
    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name: result.name,
        calories: result.calories,
        proteinG: result.proteinG,
        carbsG: result.carbsG,
        fatG: result.fatG,
        tags: mealTags,
        source: 'photo_ai',
        photoUrl,
        aiConfidence: result.confidence,
        consumedAt: new Date(),
      },
    });

    refreshDailyStat(req.userId, meal.consumedAt).catch(() => {});
    res.status(201).json({
      meal,
      low_confidence: lowConfidence,
    });
  } catch (err) {
    next(err);
  }
});

const VOICE_DAILY_LIMIT_SECONDS = 180; // 3 minutes per day

async function getVoiceSecondsRemaining(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { voiceSecondsUsed: true, voiceSecondsResetAt: true } });
  const today = new Date().toDateString();
  const resetDay = user.voiceSecondsResetAt ? user.voiceSecondsResetAt.toDateString() : null;
  if (resetDay !== today) return VOICE_DAILY_LIMIT_SECONDS;
  return Math.max(0, VOICE_DAILY_LIMIT_SECONDS - user.voiceSecondsUsed);
}

router.get('/voice/limit', authenticate, async (req, res, next) => {
  try {
    const remaining = await getVoiceSecondsRemaining(req.userId);
    res.json({ remainingSeconds: remaining, dailyLimitSeconds: VOICE_DAILY_LIMIT_SECONDS });
  } catch (err) {
    next(err);
  }
});

router.post('/voice', authenticate, aiLimiter, uploadAudio.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Parse duration from client (seconds)
    const duration = Math.ceil(parseFloat(req.body.duration) || 0);

    // Check daily voice limit
    const today = new Date().toDateString();
    const resetDay = user.voiceSecondsResetAt ? user.voiceSecondsResetAt.toDateString() : null;
    const usedToday = resetDay === today ? user.voiceSecondsUsed : 0;

    if (usedToday + duration > VOICE_DAILY_LIMIT_SECONDS) {
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
      return res.status(429).json({
        error: 'Daily voice limit reached (3 min/day)',
        remainingSeconds: Math.max(0, VOICE_DAILY_LIMIT_SECONDS - usedToday),
      });
    }

    // Transcribe with Whisper
    let transcript;
    try {
      transcript = await transcribeAudio(req.file.path);
    } catch (err) {
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({ error: 'Could not transcribe audio. Please try again.' });
    }

    // Clean up audio file
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});

    if (!transcript || !transcript.trim()) {
      return res.status(422).json({ error: 'No speech detected. Please try again.' });
    }

    // Update voice usage
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        voiceSecondsUsed: usedToday + duration,
        voiceSecondsResetAt: new Date(),
      },
    });

    // Analyze text with GPT
    const weightKg = user.weightKg || 70;
    const language = req.headers['x-language'] || 'en';

    let result;
    try {
      result = await analyzeVoiceText(transcript.trim(), weightKg, language);
    } catch (aiErr) {
      return res.status(422).json({
        error: aiErr.message || 'Could not analyze this description. Please try again.',
        transcript,
      });
    }

    const lowConfidence = result.confidence < 0.4;
    const mealTags = autoTags(result);
    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name: result.name,
        calories: result.calories,
        proteinG: result.proteinG,
        carbsG: result.carbsG,
        fatG: result.fatG,
        tags: mealTags,
        source: 'voice_ai',
        aiConfidence: result.confidence,
        consumedAt: new Date(),
      },
    });

    refreshDailyStat(req.userId, meal.consumedAt).catch(() => {});
    res.status(201).json({
      meal,
      transcript,
      low_confidence: lowConfidence,
      remainingSeconds: Math.max(0, VOICE_DAILY_LIMIT_SECONDS - usedToday - duration),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/barcode', authenticate, async (req, res, next) => {
  try {
    const { barcode, servings } = req.body;
    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Look up product on Open Food Facts
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    const data = await response.json();

    if (!data || data.status !== 1 || !data.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = data.product;
    const nutriments = product.nutriments || {};
    const servingCount = Math.max(0.1, parseFloat(servings) || 1);

    // Get per-serving values if available, otherwise fall back to per-100g
    const servingSize = product.serving_quantity ? parseFloat(product.serving_quantity) : null;
    const hasPerServing = nutriments['energy-kcal_serving'] != null;

    let calories, proteinG, carbsG, fatG;
    if (hasPerServing) {
      calories = Math.round((nutriments['energy-kcal_serving'] || 0) * servingCount);
      proteinG = Math.round((nutriments['proteins_serving'] || 0) * servingCount);
      carbsG = Math.round((nutriments['carbohydrates_serving'] || 0) * servingCount);
      fatG = Math.round((nutriments['fat_serving'] || 0) * servingCount);
    } else {
      // Use per 100g values
      calories = Math.round((nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0) * servingCount);
      proteinG = Math.round((nutriments['proteins_100g'] || nutriments['proteins'] || 0) * servingCount);
      carbsG = Math.round((nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0) * servingCount);
      fatG = Math.round((nutriments['fat_100g'] || nutriments['fat'] || 0) * servingCount);
    }

    const name = product.product_name || product.product_name_en || 'Unknown product';
    const photoUrl = product.image_front_small_url || product.image_url || null;

    const mealTags = autoTags({ calories, proteinG, carbsG, fatG });
    const meal = await prisma.meal.create({
      data: {
        userId: req.userId,
        name,
        calories,
        proteinG,
        carbsG,
        fatG,
        tags: mealTags,
        source: 'barcode',
        consumedAt: new Date(),
      },
    });

    refreshDailyStat(req.userId, meal.consumedAt).catch(() => {});
    res.status(201).json({
      meal,
      product: {
        name,
        brand: product.brands || null,
        servingSize: product.serving_size || null,
        servingQuantity: servingSize,
        imageUrl: photoUrl,
        hasPerServing,
        nutrimentsPer100g: {
          calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
          proteinG: Math.round(nutriments['proteins_100g'] || nutriments['proteins'] || 0),
          carbsG: Math.round(nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0),
          fatG: Math.round(nutriments['fat_100g'] || nutriments['fat'] || 0),
        },
        nutrimentsPerServing: hasPerServing ? {
          calories: Math.round(nutriments['energy-kcal_serving'] || 0),
          proteinG: Math.round(nutriments['proteins_serving'] || 0),
          carbsG: Math.round(nutriments['carbohydrates_serving'] || 0),
          fatG: Math.round(nutriments['fat_serving'] || 0),
        } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.userId };

    if (from || to) {
      where.consumedAt = {};
      if (from) where.consumedAt.gte = new Date(from);
      if (to) where.consumedAt.lte = new Date(to);
    }

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { consumedAt: 'desc' },
    });
    res.json(meals);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    const data = manualMealSchema.parse(req.body);
    const updateData = {
      name: data.name,
      calories: data.calories,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
      consumedAt: data.consumedAt ? new Date(data.consumedAt) : meal.consumedAt,
    };
    if (typeof req.body.isPublic === 'boolean') {
      updateData.isPublic = req.body.isPublic;
    }
    if (typeof req.body.description === 'string') {
      updateData.description = req.body.description || null;
    }
    const updated = await prisma.meal.update({
      where: { id: req.params.id },
      data: updateData,
    });
    refreshDailyStat(req.userId, updated.consumedAt).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const meal = await prisma.meal.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    await prisma.meal.delete({ where: { id: req.params.id } });
    refreshDailyStat(req.userId, meal.consumedAt).catch(() => {});
    res.json({ message: 'Meal deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
