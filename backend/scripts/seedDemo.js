/**
 * Seed clearly-labelled sample accounts (isDemo=true) so Explore isn't empty.
 * Sample users are badged in the UI, cannot be followed or messaged, and get no
 * likes, comments, follows, stories or messages.
 *
 * Run inside the backend container:
 *   docker exec -e PEXELS_API_KEY=... <backend> node scripts/seedDemo.js [--users N] [--dry-run]
 *   docker exec <backend> node scripts/seedDemo.js --wipe     # removes all isDemo users (cascades)
 *   Re-run later for a "live" feed: more users + a new photo page, e.g. --users 40 --photo-page 3
 *
 * Idempotent: existing sample users (matched by email) are reused and only missing planned meals are added.
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
// Pexels results page to draw photos from. Use a different page on a re-run so photos aren't repeated.
const pageArg = args.indexOf('--photo-page');
const PHOTO_PAGE = pageArg >= 0 ? parseInt(args[pageArg + 1], 10) : 1;

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
  // second wave (added 2026-10-17)
  ['Priya', 'Nair', 'female', 28, 159, 54, 'active', 'maintain', 'Spice cupboard bigger than my wardrobe.'],
  ['Liam', "O'Connor", 'male', 35, 182, 89, 'moderate', 'lose', 'Swapped the pint for a protein shake (mostly).'],
  ['Zara', 'Ahmed', 'female', 31, 166, 63, 'moderate', 'maintain', 'Brunch is the most important meal of the day.'],
  ['Mateo', 'García', 'male', 29, 178, 75, 'very_active', 'gain', 'CrossFit, tortillas, repeat.'],
  ['Emma', 'Larsen', 'female', 37, 170, 69, 'light', 'lose', 'Two kids, one dog, zero time. Batch cooking.'],
  ['Nikolai', 'Ivanov', 'male', 44, 184, 95, 'sedentary', 'lose', 'Software engineer learning to cook vegetables.'],
  ['Amélie', 'Laurent', 'female', 24, 163, 53, 'active', 'gain', 'Climbing gym regular, always hungry.'],
  ['Kenji', 'Watanabe', 'male', 32, 171, 67, 'moderate', 'maintain', 'Ramen critic, part-time runner.'],
  ['Leila', 'Mansour', 'female', 40, 165, 71, 'moderate', 'lose', 'Mezze over everything.'],
  ['Oskar', 'Wójcik', 'male', 27, 186, 82, 'active', 'gain', 'Rower. Breakfast is three breakfasts.'],
  ['Hana', 'Novák', 'female', 34, 168, 60, 'light', 'maintain', 'Plant-based since 2021, still learning.'],
  ['Daniel', 'Cohen', 'male', 38, 177, 84, 'moderate', 'lose', 'Weekend griller, weekday salad guy.'],
  ['Isabella', 'Martins', 'female', 26, 162, 57, 'very_active', 'maintain', 'Beach volleyball and açaí bowls.'],
  ['Viktor', 'Horvat', 'male', 49, 180, 88, 'light', 'lose', 'Doctor said walk more. I walk to the market.'],
  ['Maya', 'Goldberg', 'female', 30, 167, 62, 'moderate', 'maintain', 'Sourdough starter is my roommate.'],
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
    ['Shakshuka with crusty bread', 430, 20, 38, 21, 'shakshuka'],
    ['Overnight oats with apple and cinnamon', 360, 12, 58, 9, 'overnight oats'],
    ['Breakfast burrito with black beans', 520, 26, 58, 19, 'breakfast burrito'],
    ['Ricotta toast with honey and figs', 340, 13, 44, 12, 'toast figs ricotta'],
    ['Chia pudding with kiwi', 290, 9, 34, 13, 'chia pudding'],
    ['Japanese breakfast: rice, miso, grilled fish', 480, 30, 62, 11, 'japanese breakfast'],
    ['Bircher muesli with yogurt', 380, 14, 56, 11, 'muesli bowl'],
    ['Egg and spinach breakfast wrap', 400, 24, 36, 17, 'egg wrap'],
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
    ['Falafel bowl with tahini', 590, 19, 70, 26, 'falafel bowl'],
    ['Chicken pho', 450, 32, 58, 8, 'pho soup'],
    ['Mediterranean couscous salad', 480, 15, 66, 17, 'couscous salad'],
    ['Bibimbap with tofu', 560, 22, 78, 17, 'bibimbap'],
    ['Greek salad with grilled halloumi', 510, 22, 18, 38, 'greek salad'],
    ['Sushi bento box', 530, 24, 82, 10, 'sushi bento'],
    ['Minestrone with parmesan', 360, 15, 48, 11, 'minestrone soup'],
    ['Steak and arugula sandwich', 620, 40, 52, 26, 'steak sandwich'],
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
    ['Chicken tikka masala with basmati', 680, 42, 74, 22, 'chicken tikka masala'],
    ['Mushroom risotto', 610, 15, 88, 20, 'mushroom risotto'],
    ['Teriyaki salmon with greens', 560, 38, 40, 24, 'teriyaki salmon'],
    ['Stuffed bell peppers', 470, 26, 44, 19, 'stuffed peppers'],
    ['Thai green curry with chicken', 620, 36, 58, 26, 'thai green curry'],
    ['Lamb kofta with tabbouleh', 640, 36, 40, 36, 'kofta'],
    ['Homemade margherita pizza', 720, 28, 92, 24, 'margherita pizza'],
    ['Pork and veggie dumplings', 540, 26, 62, 20, 'dumplings'],
  ],
  snack: [
    ['Apple with almond butter', 200, 5, 24, 10, 'apple almond butter'],
    ['Hummus with carrot sticks', 180, 6, 18, 9, 'hummus vegetables'],
    ['Protein smoothie', 260, 25, 28, 5, 'smoothie'],
    ['Handful of mixed nuts', 190, 6, 7, 16, 'mixed nuts'],
    ['Banana', 105, 1, 27, 0, 'banana'],
    ['Dark chocolate and strawberries', 170, 3, 22, 9, 'chocolate strawberries'],
    ['Edamame with sea salt', 190, 17, 14, 8, 'edamame'],
    ['Rice cakes with avocado', 210, 4, 24, 11, 'rice cakes avocado'],
    ['Frozen yogurt bark', 160, 8, 22, 4, 'yogurt bark'],
    ['Energy balls with dates and oats', 230, 6, 32, 9, 'energy balls'],
    ['Cheese and grapes', 220, 10, 18, 12, 'cheese grapes'],
    ['Popcorn', 150, 4, 28, 3, 'popcorn bowl'],
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
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=80&page=${PHOTO_PAGE}`;
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
      select: { id: true, isDemo: true, meals: { select: { name: true, consumedAt: true } } },
    });
    if (existing && !existing.isDemo) throw new Error(`${plan.email} exists but is not a sample user`);

    // Resume: only create planned meals that aren't there yet (same name + time).
    const have = new Set((existing?.meals || []).map(m => `${m.name}|${m.consumedAt.getTime()}`));
    const missing = plan.meals.filter(m => !have.has(`${m.name}|${m.consumedAt.getTime()}`));
    if (existing && missing.length === 0) {
      console.log(`skip ${plan.username} (already seeded)`);
      continue;
    }

    const photoMeals = missing.filter(m => m.photoQuery).length;
    if (DRY_RUN) {
      console.log(`[dry-run] ${existing ? 'resume' : 'create'} ${plan.username}: ${missing.length} meals, ${photoMeals} with photos`);
      createdUsers += existing ? 0 : 1;
      createdMeals += missing.length;
      photos += photoMeals + (existing ? 0 : 1);
      continue;
    }

    let userId = existing?.id;
    if (!userId) {
      const portrait = await pexelsPhoto(plan.portraitQuery);
      const avatarUrl = portrait
        ? await storePhoto(portrait, { maxWidth: 256, maxHeight: 256, cover: true }).catch(() => null)
        : null;
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

    for (const meal of missing) {
      const { photoQuery, ...data } = meal;
      let photoUrl = null;
      let description = null;
      if (photoQuery) {
        const photo = await pexelsPhoto(photoQuery);
        if (photo) {
          try {
            photoUrl = await storePhoto(photo);
            description = `Photo: ${photo.photographer} / Pexels`;
            photos++;
          } catch (err) {
            console.warn(`  no photo for "${data.name}": ${err.message}`);
          }
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
