const express = require('express');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 24));

    if (!q || q.length < 2) {
      return res.json({ products: [], total: 0, page, pageSize });
    }

    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_terms', q);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page', page);
    url.searchParams.set('page_size', pageSize);
    url.searchParams.set('fields', [
      'code', 'product_name', 'product_name_en', 'brands',
      'image_front_small_url', 'image_url',
      'nutriments', 'serving_size', 'serving_quantity',
      'nutriscore_grade', 'categories_tags',
    ].join(','));

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.json({ products: [], total: 0, page, pageSize });
    }
    const data = await response.json();

    const products = (data.products || [])
      .filter(p => p.product_name || p.product_name_en)
      .map(p => {
        const n = p.nutriments || {};
        return {
          code: p.code,
          name: p.product_name || p.product_name_en,
          brand: p.brands || null,
          imageUrl: p.image_front_small_url || p.image_url || null,
          servingSize: p.serving_size || null,
          nutriscoreGrade: p.nutriscore_grade || null,
          per100g: {
            calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
            protein: Math.round((n['proteins_100g'] || n['proteins'] || 0) * 10) / 10,
            carbs: Math.round((n['carbohydrates_100g'] || n['carbohydrates'] || 0) * 10) / 10,
            fat: Math.round((n['fat_100g'] || n['fat'] || 0) * 10) / 10,
            fiber: Math.round((n['fiber_100g'] || n['fiber'] || 0) * 10) / 10,
            sugar: Math.round((n['sugars_100g'] || n['sugars'] || 0) * 10) / 10,
            sodium: Math.round((n['sodium_100g'] || n['sodium'] || 0) * 1000) / 1000,
            saturatedFat: Math.round((n['saturated-fat_100g'] || n['saturated-fat'] || 0) * 10) / 10,
          },
          perServing: n['energy-kcal_serving'] != null ? {
            calories: Math.round(n['energy-kcal_serving'] || 0),
            protein: Math.round((n['proteins_serving'] || 0) * 10) / 10,
            carbs: Math.round((n['carbohydrates_serving'] || 0) * 10) / 10,
            fat: Math.round((n['fat_serving'] || 0) * 10) / 10,
            fiber: Math.round((n['fiber_serving'] || 0) * 10) / 10,
            sugar: Math.round((n['sugars_serving'] || 0) * 10) / 10,
            sodium: Math.round((n['sodium_serving'] || 0) * 1000) / 1000,
            saturatedFat: Math.round((n['saturated-fat_serving'] || 0) * 10) / 10,
          } : null,
        };
      });

    res.json({
      products,
      total: data.count || 0,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
