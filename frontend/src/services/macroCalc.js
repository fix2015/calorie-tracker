const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calcMacroTargets(user) {
  const weight = user?.weightKg;
  const targetWeight = user?.targetWeightKg;
  const gender = user?.gender;
  const age = user?.age;
  const heightCm = user?.heightCm;
  const activityLevel = user?.activityLevel || 'moderate';
  const goal = user?.goal || 'maintain';
  const dailyCal = user?.dailyCalorieTarget;

  if (!weight || !age || !heightCm) return null;

  // Use daily calorie target if set, otherwise compute via Mifflin-St Jeor
  let calories = dailyCal;
  if (!calories) {
    let bmr;
    if (gender === 'female') {
      bmr = 10 * weight + 6.25 * heightCm - 5 * age - 161;
    } else {
      bmr = 10 * weight + 6.25 * heightCm - 5 * age + 5;
    }
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    calories = Math.round(bmr * multiplier);
    if (goal === 'lose') calories -= 500;
    if (goal === 'gain') calories += 500;
  }

  // Use target weight for protein calc if available, otherwise current weight
  const refWeight = targetWeight || weight;

  // Macro split: protein priority, then fat, remainder as carbs
  let proteinPerKg, fatPct;
  if (goal === 'lose') {
    proteinPerKg = gender === 'female' ? 1.8 : 2.0;
    fatPct = 0.25;
  } else if (goal === 'gain') {
    proteinPerKg = gender === 'female' ? 1.6 : 1.8;
    fatPct = 0.25;
  } else {
    proteinPerKg = gender === 'female' ? 1.4 : 1.6;
    fatPct = 0.28;
  }

  const proteinG = Math.round(refWeight * proteinPerKg);
  const fatG = Math.round((calories * fatPct) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);

  return { proteinG, carbsG, fatG, calories };
}

export const MOTIVATION_QUOTES = [
  "Every healthy meal is a step toward the best version of you.",
  "You don't have to be perfect, just consistent.",
  "Your body is a reflection of your lifestyle — fuel it well.",
  "Small daily improvements lead to stunning results.",
  "Discipline is choosing between what you want now and what you want most.",
  "Progress, not perfection.",
  "The food you eat can be the safest form of medicine.",
  "Strong is what happens when you run out of excuses.",
  "Today's effort is tomorrow's result.",
  "Healthy eating is a form of self-respect.",
  "You are one meal away from being back on track.",
  "Motivation gets you started, habits keep you going.",
];
