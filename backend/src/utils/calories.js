/**
 * Mifflin-St Jeor equation for BMR, then multiply by activity factor and adjust for goal.
 */
function computeDailyCalorieTarget({ age, gender, heightCm, weightKg, activityLevel, goal }) {
  if (!age || !gender || !heightCm || !weightKg || !activityLevel || !goal) return null;

  let bmr;
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const activityFactors = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  let tdee = bmr * (activityFactors[activityLevel] || 1.2);

  if (goal === 'lose') tdee -= 500;
  if (goal === 'gain') tdee += 300;

  return Math.round(tdee);
}

module.exports = { computeDailyCalorieTarget };
