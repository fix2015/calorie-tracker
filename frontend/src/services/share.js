function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function buildMealShareText(meal) {
  const lines = [
    `${meal.name} — ${meal.calories} kcal`,
    '',
    `Protein: ${Math.round(meal.proteinG)}g`,
    `Carbs: ${Math.round(meal.carbsG)}g`,
    `Fat: ${Math.round(meal.fatG)}g`,
    '',
    `Logged at ${formatTime(meal.consumedAt)}`,
  ];
  if (meal.source === 'photo_ai') {
    lines.push('(AI-scanned from photo)');
  }
  lines.push('', 'Tracked with Calorie Tracker');
  return lines.join('\n');
}

export function buildDailySummaryShareText(totals, mealsList, target) {
  const date = new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  const remaining = Math.max(0, target - totals.calories);
  const pct = target > 0 ? Math.round((totals.calories / target) * 100) : 0;

  const lines = [
    `My nutrition for ${date}`,
    '',
    `Calories: ${totals.calories} / ${target} kcal (${pct}%)`,
    `Protein: ${Math.round(totals.proteinG)}g`,
    `Carbs: ${Math.round(totals.carbsG)}g`,
    `Fat: ${Math.round(totals.fatG)}g`,
  ];

  if (remaining > 0) {
    lines.push(`${remaining} kcal remaining`);
  } else if (totals.calories > target) {
    lines.push(`${totals.calories - target} kcal over target`);
  } else {
    lines.push('Target reached!');
  }

  if (mealsList.length > 0) {
    lines.push('', `Meals (${mealsList.length}):`);
    for (const m of mealsList) {
      lines.push(`  - ${m.name}: ${m.calories} kcal`);
    }
  }

  lines.push('', 'Tracked with Calorie Tracker');
  return lines.join('\n');
}

export async function shareText(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title || 'Calorie Tracker', text });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return false;
  }
}
