/**
 * Compare photo-scan cost and accuracy between image detail levels.
 *   node scripts/scan-cost-eval.js <photo.jpg> [more photos...]
 * Needs OPENAI_API_KEY (reads backend/.env). Each photo is scanned once per detail level;
 * prints tokens, cost and the calorie estimate side by side. Costs about 1p per photo.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { analyzePhoto } = require('../src/services/vision');

const DETAILS = ['high', 'low'];
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/scan-cost-eval.js <photo> [...]');
  process.exit(1);
}

(async () => {
  const totals = Object.fromEntries(DETAILS.map((d) => [d, { usd: 0, n: 0 }]));
  const rows = [];
  for (const file of files) {
    const row = { file: path.basename(file).slice(0, 18) };
    for (const detail of DETAILS) {
      let usage;
      try {
        const r = await analyzePhoto(file, 75, '', 'en', { detail, onUsage: (u) => { usage = u; } });
        row[detail] = `${r.calories} kcal ${r.name.slice(0, 22)}`;
      } catch (e) {
        row[detail] = e.code === 'NOT_FOOD' ? 'not food' : `error: ${e.message.slice(0, 30)}`;
      }
      if (usage) {
        totals[detail].usd += usage.costUsd;
        totals[detail].n += 1;
        row[`${detail} $`] = usage.costUsd.toFixed(4);
      }
    }
    rows.push(row);
  }
  console.table(rows);
  for (const d of DETAILS) {
    const t = totals[d];
    if (t.n) console.log(`${d}: avg $${(t.usd / t.n).toFixed(4)} per scan over ${t.n} photos`);
  }
})();
