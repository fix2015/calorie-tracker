import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

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
  lines.push('', 'Tracked with Calorie Tracker', getAppUrl());
  return lines.join('\n');
}

function getAppUrl() {
  return publicUrl('/');
}

// The native app runs at capacitor://localhost, so links point at the public site instead.
export function publicUrl(path) {
  const origin = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_BASE || 'https://calories.probooking.app') : window.location.origin;
  const base = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
  return origin + base + path;
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

  lines.push('', 'Tracked with Calorie Tracker', getAppUrl());
  return lines.join('\n');
}

// The photo is fetched ahead (when a meal opens): awaiting a download inside the tap handler uses up the
// user gesture, and the browser then refuses navigator.share.
const imageFiles = new Map();

async function fetchImageFile(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `meal.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

export function prepareShareImage(imageUrl) {
  if (!imageUrl || Capacitor.isNativePlatform() || !navigator.share || imageFiles.has(imageUrl)) return;
  imageFiles.set(imageUrl, null);
  fetchImageFile(imageUrl).then((file) => imageFiles.set(imageUrl, file));
}

export async function shareText(text, title, imageUrl) {
  const url = getAppUrl();
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title: title || 'Calorize', text, dialogTitle: title });
      return true;
    } catch (e) {
      if (/cancel/i.test(e?.message || '')) return false;
    }
  } else if (navigator.share) {
    const file = imageUrl ? imageFiles.get(imageUrl) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      // Share image + text together — include text in body so Telegram/WhatsApp show it as caption
      try {
        await navigator.share({ files: [file], text: text + '\n' + url });
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }

    // No image or image share not supported — share text + url
    try {
      await navigator.share({ title: title || 'Calorie Tracker', text, url });
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
