/**
 * Seed clearly-labelled sample accounts (isDemo=true) so Explore isn't empty.
 * Sample users are badged in the UI, cannot be followed or messaged, and get no
 * likes, comments, follows, stories or messages.
 *
 * Run inside the backend container:
 *   docker exec -e PEXELS_API_KEY=... <backend> node scripts/seedDemo.js [--users N] [--dry-run]
 *   docker exec <backend> node scripts/seedDemo.js --wipe     # removes all isDemo users (cascades)
 *
 * Idempotent: existing sample users (matched by email) and their meals are left as-is.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { computeDailyCalorieTarget } = require('../src/utils/calories');
const { uploadImage } = require('../src/services/s3');

const prisma = new PrismaClient();

const EMAIL_DOMAIN = 'calorize-demo.sample';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WIPE = args.includes('--wipe');
const usersArg = args.indexOf('--users');
const USER_COUNT = usersArg >= 0 ? parseInt(args[usersArg + 1], 10) : 25;

// first, last, gender, age, heightCm, weightKg, activityLevel, goal, bio
const PEOPLE = [
  ['Amara', 'Okafor', 'female', 29, 168, 64, 'active', 'maintain', 'Runner, weekend baker, trying to eat more greens.'],
  ['Lucas', 'Moreau', 'male', 34, 181, 88, 'moderate', 'lose', 'Dad of two. Cutting back on late-night snacks.'],
  ['Mei', 'Tanaka', 'female', 26, 160, 52, 'light', 'gain', 'Learning to cook and building strength.'],
  ['Diego', 'Ramirez', 'male', 31, 176, 79, 'very_active', 'maintain', 'Climbing three times a week. Fuel matters.'],
  ['Hannah', 'Schmidt', 'female', 38, 172, 74, 'moderate', 'lose', 'Nurse on night shifts, meal prep saves me.'],
  ['Kwame', 'Mensah', 'male', 27, 184, 77, 'active', 'gain', 'Footballer trying to put on lean mass.'],
  ['Sofia', 'Rossi', 'female', 32, 165, 61, 'light', 'maintain', 'Pasta lover keeping portions in check.'],
  ['Arjun', 'Patel', 'male', 41, 174, 86, 'sedentary', 'lose', 'Desk job, new walking habit, mostly vegetarian.'],
  ['Olena', 'Kovalenko', 'female', 30, 170, 66, 'moderate', 'lose', 'Yoga in the mornings, soup in the evenings.'],
  ['Mateusz', 'Nowak', 'male', 36, 183, 92, 'moderate', 'lose', 'Cyclist getting back in shape.'],
  ['Fatima', 'Haddad', 'female', 24, 163, 55, 'active', 'maintain', 'Student, dancer, big fan of breakfast.'],
  ['Ethan', 'Brooks', 'male', 29, 179, 73, 'very_active', 'gain', 'Marathon training block, eating a lot of oats.'],
  ['Lucía', 'Fernández', 'female', 45, 162, 68, 'light', 'lose', 'Gardening and Mediterranean home cooking.'],
  ['Jonas', 'Lindqvist', 'male', 33, 188, 84, 'active', 'maintain', 'Swimmer. Coffee first, then everything else.'],
  ['Aisha', 'Bello', 'female', 35, 167, 72, 'moderate', 'lose', 'Working mum, quick healthy dinners only.'],
  ['Wei', 'Zhang', 'male', 28, 172, 66, 'moderate', 'gain', 'Home gym, rice cooker, high-protein everything.'],
  ['Chloé', 'Dubois', 'female', 27, 169, 58, 'active', 'maintain', 'Tennis on weekends, salads on weekdays.'],
  ['Marcus', 'Johnson', 'male', 39, 185, 97, 'light', 'lose', 'Tracking meals to keep my doctor happy.'],
  ['Ingrid', 'Hansen', 'female', 50, 166, 70, 'moderate', 'maintain', 'Hiker. Porridge is a personality trait.'],
  ['Rafael', 'Costa', 'male', 25, 177, 70, 'very_active', 'gain', 'Surfing and eating everything in sight.'],
  ['Yuki', 'Sato', 'female', 31, 158, 50, 'light', 'maintain', 'Bento box enthusiast.'],
  ['Omar', 'Khalil', 'male', 37, 180, 82, 'moderate', 'lose', 'Trying to swap takeaway for home cooking.'],
  ['Natalia', 'Wiśniewska', 'female', 29, 171, 63, 'active', 'maintain', 'Pilates instructor who loves smoothies.'],
  ['Samuel', 'Adeyemi', 'male', 30, 182, 80, 'active', 'maintain', 'Basketball, meal prep Sundays.'],
  ['Elena', 'Petrova', 'female', 42, 164, 69, 'light', 'lose', 'Small changes, steady progress.'],
  ['Tomás', 'Silva', 'male', 26, 175, 68, 'moderate', 'gain', 'Learning to like breakfast.'],
  ['Grace', 'Kim', 'female', 33, 161, 56, 'moderate', 'maintain', 'Rice bowls and long walks.'],
  ['Henrik', 'Berg', 'male', 47, 186, 90, 'light', 'lose', 'Retired the second dessert.'],
  ['Priya', 'Sharma', 'female', 28, 159, 54, 'active', 'gain', 'Lifting and lentils.'],
  ['Noah', 'Fischer', 'male', 35, 178, 76, 'moderate', 'maintain', 'Commuter cyclist, sourdough fan.'],
];

// name, calories, proteinG, carbsG, fatG, Pexels query
const MEALS = {
  breakfast: [
    ['Greek yogurt with berries and granola', 320, 18, 42, 9, 'yogurt berries granola bowl'],
    ['Oatmeal with banana and peanut butter', 410, 13, 58, 14, 'oatmeal banana breakfast'],
    ['Avocado toast with poached egg', 380, 15, 32, 21, 'avocado toast egg'],
    ['Scrambled eggs with spinach and toast', 350, 21, 26, 17, 'scrambled eggs toast'],
    ['Smoothie bowl with mango and chia', 340, 9, 60, 8, 'smoothie bowl'],
    ['Cottage cheese with peaches', 240, 24, 22, 5, 'healthy breakfast bowl'],
    ['Whole-grain pancakes with blueberries', 450, 12, 72, 12, 'pancakes blueberries'],
    ['Veggie omelette', 300, 20, 8, 21, 'omelette breakfast'],
  ],
  lunch: [
    ['Grilled chicken salad', 420, 38, 18, 21, 'grilled chicken salad'],
    ['Quinoa bowl with chickpeas and feta', 520, 20, 64, 19, 'quinoa bowl'],
    ['Turkey and avocado wrap', 480, 30, 42, 20, 'chicken wrap lunch'],
    ['Lentil soup with rye bread', 410, 22, 60, 8, 'lentil soup'],
    ['Salmon poke bowl', 560, 32, 62, 18, 'poke bowl'],
    ['Caprese sandwich', 470, 21, 48, 21, 'caprese sandwich'],
    ['Tuna Niçoise salad', 450, 33, 22, 25, 'salad lunch'],
    ['Chicken burrito bowl', 610, 40, 68, 18, 'burrito bowl'],
  ],
  dinner: [
    ['Grilled salmon with roasted vegetables', 540, 38, 24, 31, 'grilled salmon dinner'],
    ['Whole-wheat pasta with tomato and basil', 590, 20, 92, 14, 'pasta tomato basil'],
    ['Chicken stir-fry with brown rice', 620, 42, 70, 16, 'chicken stir fry'],
    ['Beef chili with beans', 560, 38, 46, 22, 'chili bowl'],
    ['Baked cod with sweet potato', 480, 36, 48, 12, 'baked fish dinner'],
    ['Vegetable curry with rice', 580, 14, 88, 18, 'vegetable curry'],
    ['Turkey meatballs with zucchini noodles', 450, 36, 20, 24, 'meatballs dinner'],
    ['Shrimp tacos with slaw', 520, 30, 50, 20, 'shrimp tacos'],
  ],
  snack: [
    ['Apple with almond butter', 200, 5, 24, 10, 'apple almond butter'],
    ['Hummus with carrot sticks', 180, 6, 18, 9, 'hummus vegetables'],
    ['Protein smoothie', 260, 25, 28, 5, 'smoothie'],
    ['Handful of mixed nuts', 190, 6, 7, 16, 'mixed nuts'],
    ['Banana', 105, 1, 27, 0, 'banana'],
    ['Dark chocolate and strawberries', 170, 3, 22, 9, 'chocolate strawberries'],
  ],
};

const SLOT_HOURS = { breakfast: [7, 9], lunch: [12, 14], dinner: [18, 20], snack: [15, 17] };

// Deterministic PRNG so re-runs plan the same content.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const int = (r, min, max) => min + Math.floor(r() * (max - min + 1));

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/ś/g, 's').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function planUser(person, index) {
  const [first, last, gender, age, heightCm, weightKg, activityLevel, goal, bio] = person;
  const r = rng(index + 1);
  const profile = { age, gender, heightCm, weightKg, activityLevel, goal };
  const days = int(r, 10, 14);
  const meals = [];

  for (let d = days - 1; d >= 0; d--) {
    const slots = r() < 0.5 ? ['breakfast', 'lunch', 'dinner'] : ['breakfast', 'lunch', 'snack', 'dinner'];
    for (const slot of slots) {
      const [name, calories, proteinG, carbsG, fatG, query] = pick(r, MEALS[slot]);
      const jitter = 0.9 + r() * 0.2; // ±10% portion size
      const [hMin, hMax] = SLOT_HOURS[slot];
      const consumedAt = new Date();
      consumedAt.setDate(consumedAt.getDate() - d);
      consumedAt.setHours(int(r, hMin, hMax), int(r, 0, 59), 0, 0);
      if (consumedAt > new Date()) continue;
      meals.push({
        name,
        calories: Math.round(calories * jitter),
        proteinG: Math.round(proteinG * jitter),
        carbsG: Math.round(carbsG * jitter),
        fatG: Math.round(fatG * jitter),
        consumedAt,
        photoQuery: r() < 0.5 ? query : null,
      });
    }
  }

  return {
    email: `${slug(first)}.${slug(last)}@${EMAIL_DOMAIN}`,
    username: `${slug(first)}_${slug(last)}`.slice(0, 30),
    name: `${first} ${last}`,
    bio,
    profile,
    portraitQuery: gender === 'female' ? 'portrait woman smiling' : 'portrait man smiling',
    meals,
  };
}

// ─── Pexels ───

const photoPools = new Map();
const usedPhotoIds = new Set();

async function pexelsPhoto(query) {
  if (!photoPools.has(query)) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=80`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) throw new Error(`Pexels search "${query}" failed: ${res.status}`);
    const data = await res.json();
    photoPools.set(query, data.photos || []);
  }
  const pool = photoPools.get(query);
  const photo = pool.find(p => !usedPhotoIds.has(p.id)) || pool[0];
  if (!photo) return null;
  usedPhotoIds.add(photo.id);
  return photo;
}

async function storePhoto(photo, opts) {
  const res = await fetch(photo.src.large);
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`);
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.jpg`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  const s3Url = await uploadImage(filePath, opts);
  return s3Url || `/uploads/${filename}`;
}

// ─── Commands ───

async function wipe() {
  const users = await prisma.user.findMany({
    where: { isDemo: true },
    select: { id: true, avatarUrl: true, meals: { select: { photoUrl: true } } },
  });
  const localFiles = users
    .flatMap(u => [u.avatarUrl, ...u.meals.map(m => m.photoUrl)])
    .filter(url => url && url.startsWith('/uploads/'));

  const { count } = await prisma.user.deleteMany({ where: { isDemo: true } });
  for (const url of localFiles) fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => {});
  console.log(`Deleted ${count} sample users (meals cascade), removed ${localFiles.length} local files.`);
}

async function seed() {
  if (!Number.isInteger(USER_COUNT) || USER_COUNT < 1 || USER_COUNT > PEOPLE.length) {
    throw new Error(`--users must be between 1 and ${PEOPLE.length}`);
  }
  if (!PEXELS_API_KEY && !DRY_RUN) throw new Error('PEXELS_API_KEY is not set');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const plans = PEOPLE.slice(0, USER_COUNT).map(planUser);
  let createdUsers = 0;
  let createdMeals = 0;
  let photos = 0;

  for (const plan of plans) {
    const existing = await prisma.user.findUnique({
      where: { email: plan.email },
      select: { id: true, isDemo: true, _count: { select: { meals: true } } },
    });
    if (existing && !existing.isDemo) throw new Error(`${plan.email} exists but is not a sample user`);
    if (existing?._count.meals) {
      console.log(`skip ${plan.username} (already seeded)`);
      continue;
    }

    const photoMeals = plan.meals.filter(m => m.photoQuery).length;
    if (DRY_RUN) {
      console.log(`[dry-run] ${existing ? 'reuse' : 'create'} ${plan.username}: ${plan.meals.length} meals, ${photoMeals} with photos`);
      createdUsers += existing ? 0 : 1;
      createdMeals += plan.meals.length;
      photos += photoMeals + 1;
      continue;
    }

    let userId = existing?.id;
    if (!userId) {
      const portrait = await pexelsPhoto(plan.portraitQuery);
      const avatarUrl = portrait ? await storePhoto(portrait, { maxWidth: 256, maxHeight: 256, cover: true }) : null;
      const user = await prisma.user.create({
        data: {
          email: plan.email,
          passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10),
          name: plan.name,
          username: plan.username,
          bio: plan.bio,
          avatarUrl,
          isPublic: true,
          isDemo: true,
          ...plan.profile,
          weightUpdatedAt: new Date(),
          dailyCalorieTarget: computeDailyCalorieTarget(plan.profile),
        },
      });
      userId = user.id;
      createdUsers++;
      if (avatarUrl) photos++;
    }

    for (const meal of plan.meals) {
      const { photoQuery, ...data } = meal;
      let photoUrl = null;
      let description = null;
      if (photoQuery) {
        const photo = await pexelsPhoto(photoQuery);
        if (photo) {
          photoUrl = await storePhoto(photo);
          description = `Photo: ${photo.photographer} / Pexels`;
          photos++;
        }
      }
      await prisma.meal.create({
        data: { ...data, userId, photoUrl, description, isPublic: true, source: 'manual', createdAt: data.consumedAt },
      });
      createdMeals++;
    }
    console.log(`seeded ${plan.username}`);
  }

  console.log(`${DRY_RUN ? '[dry-run] would create' : 'Created'} ${createdUsers} users, ${createdMeals} meals, ${photos} photos.`);
}

(WIPE ? wipe() : seed())
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
