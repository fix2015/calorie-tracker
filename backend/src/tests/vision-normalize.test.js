/**
 * Unit tests for normalizeVisionResult (photo-scan items + not-food detection).
 * Pure function — no OpenAI or database calls.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeVisionResult } = require('../services/vision');

test('per-item rows are normalized and totals are recomputed from items', () => {
  const r = normalizeVisionResult({
    is_food: true,
    name: 'Chicken with rice',
    calories: 999, // ignored in favour of item sum
    confidence: 0.82,
    items: [
      { name: 'Grilled chicken', grams: 150.4, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
      { name: 'White rice', grams: 180, calories: 234, protein_g: 4.3, carbs_g: 51.2, fat_g: 0.5 },
    ],
  });
  assert.strictEqual(r.name, 'Chicken with rice');
  assert.strictEqual(r.calories, 482);
  assert.strictEqual(r.proteinG, 51);
  assert.strictEqual(r.carbsG, 51);
  assert.strictEqual(r.fatG, 6);
  assert.strictEqual(r.confidence, 0.82);
  assert.strictEqual(r.items.length, 2);
  assert.deepStrictEqual(r.items[0], { name: 'Grilled chicken', grams: 150, calories: 248, proteinG: 46.5, carbsG: 0, fatG: 5.4 });
});

test('legacy single-dish response becomes one item row', () => {
  const r = normalizeVisionResult({ name: 'Pizza', calories: 700.6, protein_g: 30, carbs_g: 80, fat_g: 28, confidence: 2 });
  assert.strictEqual(r.calories, 701);
  assert.strictEqual(r.confidence, 1);
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(r.items[0].name, 'Pizza');
  assert.strictEqual(r.items[0].calories, 701);
});

test('negative / garbage numbers are clamped to 0', () => {
  const r = normalizeVisionResult({ name: 'Soup', items: [{ name: 'Soup', grams: -5, calories: 'abc', protein_g: null }] });
  assert.deepStrictEqual(r.items[0], { name: 'Soup', grams: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
});

test('is_food=false throws NOT_FOOD', () => {
  assert.throws(() => normalizeVisionResult({ is_food: false }), (err) => err.code === 'NOT_FOOD');
});

test('empty response throws a recognition error', () => {
  assert.throws(() => normalizeVisionResult({}), /Could not recognize/);
});
