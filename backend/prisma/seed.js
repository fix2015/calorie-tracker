const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { computeDailyCalorieTarget } = require('../src/utils/calories');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const profile = {
    age: 28,
    gender: 'male',
    heightCm: 178,
    weightKg: 80,
    activityLevel: 'moderate',
    goal: 'lose',
  };

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
      ...profile,
      weightUpdatedAt: new Date(),
      dailyCalorieTarget: computeDailyCalorieTarget(profile),
    },
  });

  // Add sample meals for today
  const today = new Date();
  const meals = [
    { name: 'Oatmeal with banana', calories: 350, proteinG: 12, carbsG: 58, fatG: 8, hours: -8 },
    { name: 'Grilled chicken salad', calories: 480, proteinG: 42, carbsG: 18, fatG: 24, hours: -4 },
    { name: 'Apple', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, hours: -2 },
  ];

  for (const m of meals) {
    const consumedAt = new Date(today.getTime() + m.hours * 60 * 60 * 1000);
    await prisma.meal.create({
      data: {
        userId: user.id,
        name: m.name,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        source: 'manual',
        consumedAt,
      },
    });
  }

  console.log('Seeded demo user: demo@example.com / demo1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
