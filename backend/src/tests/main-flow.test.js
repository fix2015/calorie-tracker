/**
 * Main flow integration tests — covers the critical user journey:
 *   Register → Login → Add meal → List meals → Reports → Like → Follow → Product search
 *
 * Uses Node.js built-in test runner. Requires a running PostgreSQL instance.
 * Run: NODE_ENV=test node --test src/tests/main-flow.test.js
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const app = require('../index');

const PORT = 0; // random port
let server;
let baseUrl;

// Test user data
const TEST_EMAIL = `test_${crypto.randomUUID().slice(0, 8)}@example.com`;
const TEST_EMAIL_2 = `test_${crypto.randomUUID().slice(0, 8)}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
let accessToken;
let refreshTokenValue;
let userId;
let accessToken2;
let userId2;
let username2;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${baseUrl}/api${path}`, {
    ...opts,
    headers,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

before(async () => {
  server = app.listen(0);
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  // Cleanup test users
  const prisma = require('../utils/prisma');
  await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });
  await prisma.$disconnect();
  server.close();
});

// ─── Health Check ───

describe('Health', () => {
  test('GET /api/health returns ok', async () => {
    const { status, data } = await api('/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(data.status, 'ok');
  });
});

// ─── Auth Flow ───

describe('Auth', () => {
  test('POST /auth/register creates a new user', async () => {
    const { status, data } = await api('/auth/register', {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Test User',
        age: 25,
        gender: 'male',
        heightCm: 180,
        weightKg: 80,
        targetWeightKg: 75,
        activityLevel: 'moderate',
        goal: 'lose',
      },
    });

    assert.strictEqual(status, 201);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.ok(data.user.id);
    assert.strictEqual(data.user.email, TEST_EMAIL);
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken;
    userId = data.user.id;
  });

  test('POST /auth/register rejects duplicate email', async () => {
    const { status } = await api('/auth/register', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Dup' },
    });
    assert.strictEqual(status, 409);
  });

  test('POST /auth/register rejects invalid data', async () => {
    const { status } = await api('/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: '123', name: '' },
    });
    assert.strictEqual(status, 400);
  });

  test('POST /auth/login with valid credentials', async () => {
    const { status, data } = await api('/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    assert.strictEqual(status, 200);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken;
  });

  test('POST /auth/login rejects wrong password', async () => {
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'WrongPass123' },
    });
    assert.strictEqual(status, 401);
  });

  test('POST /auth/refresh rotates tokens', async () => {
    const { status, data } = await api('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: refreshTokenValue },
    });

    assert.strictEqual(status, 200);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken;
  });

  test('GET /auth/me returns current user', async () => {
    const { status, data } = await api('/auth/me', { token: accessToken });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.id, userId);
    assert.strictEqual(data.email, TEST_EMAIL);
    assert.ok(data.dailyCalorieTarget > 0);
  });

  test('GET /auth/me rejects without token', async () => {
    const { status } = await api('/auth/me');
    assert.strictEqual(status, 401);
  });
});

// ─── Meals ───

let mealId;

describe('Meals', () => {
  test('POST /meals/manual creates a meal', async () => {
    const { status, data } = await api('/meals/manual', {
      method: 'POST',
      token: accessToken,
      body: {
        name: 'Grilled Chicken Salad',
        calories: 450,
        proteinG: 35,
        carbsG: 20,
        fatG: 15,
      },
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(data.name, 'Grilled Chicken Salad');
    assert.strictEqual(data.calories, 450);
    assert.strictEqual(data.proteinG, 35);
    assert.strictEqual(data.carbsG, 20);
    assert.strictEqual(data.fatG, 15);
    assert.strictEqual(data.source, 'manual');
    assert.ok(data.tags.includes('High protein'));
    mealId = data.id;
  });

  test('POST /meals/manual rejects invalid data', async () => {
    const { status } = await api('/meals/manual', {
      method: 'POST',
      token: accessToken,
      body: { name: '', calories: -5, proteinG: 0, carbsG: 0, fatG: 0 },
    });
    assert.strictEqual(status, 400);
  });

  test('POST /meals/manual rejects without auth', async () => {
    const { status, data } = await api('/meals/manual', {
      method: 'POST',
      body: { name: 'Test', calories: 100, proteinG: 10, carbsG: 10, fatG: 5 },
    });
    assert.strictEqual(status, 401);
    assert.ok(data.error);
  });

  test('GET /meals lists meals', async () => {
    const { status, data } = await api('/meals', { token: accessToken });

    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
    assert.ok(data.some(m => m.id === mealId));
  });

  test('PATCH /meals/:id updates a meal', async () => {
    const { status, data } = await api(`/meals/${mealId}`, {
      method: 'PATCH',
      token: accessToken,
      body: {
        name: 'Updated Chicken Salad',
        calories: 500,
        proteinG: 35,
        carbsG: 20,
        fatG: 15,
      },
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.name, 'Updated Chicken Salad');
    assert.strictEqual(data.calories, 500);
  });

  test('POST /meals/manual creates second meal for reports', async () => {
    const { status } = await api('/meals/manual', {
      method: 'POST',
      token: accessToken,
      body: { name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 8 },
    });
    assert.strictEqual(status, 201);
  });
});

// ─── Reports ───

describe('Reports', () => {
  test('GET /reports/daily returns daily stats', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { status, data } = await api(`/reports/daily?date=${today}`, {
      token: accessToken,
    });

    assert.strictEqual(status, 200);
    assert.ok(data.totals);
    assert.ok(data.totals.calories >= 750); // 500 + 300 from both meals
    assert.ok(data.meals.length >= 2);
  });

  test('GET /reports/weekly returns weekly stats', async () => {
    const { status, data } = await api('/reports/weekly?offset=0', {
      token: accessToken,
    });

    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.days));
  });
});

// ─── Social: Second User, Like, Follow ───

describe('Social', () => {
  test('Register second user', async () => {
    const { status, data } = await api('/auth/register', {
      method: 'POST',
      body: {
        email: TEST_EMAIL_2,
        password: TEST_PASSWORD,
        name: 'Test User Two',
        age: 30,
        gender: 'female',
        heightCm: 165,
        weightKg: 60,
        goal: 'maintain',
      },
    });
    assert.strictEqual(status, 201);
    accessToken2 = data.accessToken;
    userId2 = data.user.id;
  });

  test('Get second user username', async () => {
    const { status, data } = await api('/auth/me', { token: accessToken2 });
    assert.strictEqual(status, 200);
    username2 = data.username;
    assert.ok(username2);
  });

  test('Make first user meal public', async () => {
    const { status } = await api(`/meals/${mealId}`, {
      method: 'PATCH',
      token: accessToken,
      body: {
        name: 'Updated Chicken Salad',
        calories: 500,
        proteinG: 35,
        carbsG: 20,
        fatG: 15,
        isPublic: true,
      },
    });
    assert.strictEqual(status, 200);
  });

  test('POST /public/meals/:mealId/like toggles like on', async () => {
    const { status, data } = await api(`/public/meals/${mealId}/like`, {
      method: 'POST',
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.liked, true);
    assert.strictEqual(data.likesCount, 1);
  });

  test('POST /public/meals/:mealId/like toggles like off', async () => {
    const { status, data } = await api(`/public/meals/${mealId}/like`, {
      method: 'POST',
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.liked, false);
    assert.strictEqual(data.likesCount, 0);
  });

  test('POST /public/meals/:mealId/like toggles like back on', async () => {
    const { status, data } = await api(`/public/meals/${mealId}/like`, {
      method: 'POST',
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.liked, true);
  });

  test('POST /public/meals/:mealId/save toggles save', async () => {
    const { status, data } = await api(`/public/meals/${mealId}/save`, {
      method: 'POST',
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.saved, true);
  });

  test('GET /public/saved lists saved meals', async () => {
    const { status, data } = await api('/public/saved', { token: accessToken2 });
    assert.strictEqual(status, 200);
    assert.ok(data.meals.length >= 1);
  });

  test('POST /public/u/:username/follow toggles follow on', async () => {
    // User 2 follows user 1 — need user 1 username
    const me = await api('/auth/me', { token: accessToken });
    const username1 = me.data.username;

    const { status, data } = await api(`/public/u/${username1}/follow`, {
      method: 'POST',
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.following, true);
  });

  test('POST /public/meals/:mealId/comments adds comment', async () => {
    const { status, data } = await api(`/public/meals/${mealId}/comments`, {
      method: 'POST',
      token: accessToken2,
      body: { text: 'Looks delicious!' },
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(data.text, 'Looks delicious!');
    assert.ok(data.id);
  });

  test('GET /public/meals/:mealId returns meal with engagement', async () => {
    const { status, data } = await api(`/public/meals/${mealId}`, {
      token: accessToken2,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.isLiked, true);
    assert.strictEqual(data.isSaved, true);
    assert.ok(data.comments.length >= 1);
  });
});

// ─── Product Search ───

describe('Product Search', () => {
  test('GET /products/search returns results for valid query', async () => {
    const { status, data } = await api('/products/search?q=coca+cola');

    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.products));
    // Open Food Facts API may be slow/unavailable — only validate structure if results returned
    if (data.products.length > 0) {
      const product = data.products[0];
      assert.ok(product.name);
      assert.ok(product.per100g);
      assert.ok(typeof product.per100g.calories === 'number');
      assert.ok(typeof product.per100g.protein === 'number');
      assert.ok(typeof product.per100g.carbs === 'number');
      assert.ok(typeof product.per100g.fat === 'number');
    }
  });

  test('GET /products/search returns empty for short query', async () => {
    const { status, data } = await api('/products/search?q=a');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.products.length, 0);
  });

  test('GET /products/search returns empty for empty query', async () => {
    const { status, data } = await api('/products/search?q=');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.products.length, 0);
  });
});

// ─── Profile ───

describe('Profile', () => {
  test('PATCH /users/me updates profile', async () => {
    const { status, data } = await api('/users/me', {
      method: 'PATCH',
      token: accessToken,
      body: { name: 'Updated Test User', bio: 'Testing bio' },
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(data.name, 'Updated Test User');
    assert.strictEqual(data.bio, 'Testing bio');
  });
});

// ─── Meal Deletion ───

describe('Meal Deletion', () => {
  test('DELETE /meals/:id deletes a meal', async () => {
    const { status } = await api(`/meals/${mealId}`, {
      method: 'DELETE',
      token: accessToken,
    });
    assert.strictEqual(status, 200);
  });

  test('DELETE /meals/:id returns 404 for deleted meal', async () => {
    const { status } = await api(`/meals/${mealId}`, {
      method: 'DELETE',
      token: accessToken,
    });
    assert.strictEqual(status, 404);
  });
});

// ─── Logout ───

describe('Logout', () => {
  test('POST /auth/logout invalidates session', async () => {
    const { status } = await api('/auth/logout', {
      method: 'POST',
      token: accessToken,
    });
    assert.strictEqual(status, 200);
  });

  test('POST /auth/refresh fails after logout', async () => {
    const { status } = await api('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: refreshTokenValue },
    });
    assert.strictEqual(status, 401);
  });
});
