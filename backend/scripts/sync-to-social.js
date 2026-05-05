/**
 * One-time script: sync social data from main DB to social microservice.
 * Run inside the backend container:
 *   docker exec infra-backend-1 node scripts/sync-to-social.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SOCIAL_URL = process.env.SERVICE_SOCIAL_URL || 'http://service-social:3024';
const API_KEY = process.env.SERVICE_API_KEY || '';

async function post(path, body) {
  const res = await fetch(`${SOCIAL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Key': API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${path} failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function syncFollows() {
  const follows = await prisma.follow.findMany();
  console.log(`Syncing ${follows.length} follows...`);
  let ok = 0, skip = 0;
  for (const f of follows) {
    try {
      await post('/follows/toggle', { followerId: f.followerId, followingId: f.followingId });
      ok++;
    } catch (e) {
      console.error(`  follow ${f.id}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  Follows: ${ok} synced, ${skip} skipped`);
}

async function syncLikes() {
  const likes = await prisma.like.findMany();
  console.log(`Syncing ${likes.length} likes...`);
  let ok = 0, skip = 0;
  for (const l of likes) {
    try {
      await post('/likes/toggle', { userId: l.userId, contentId: l.mealId });
      ok++;
    } catch (e) {
      console.error(`  like ${l.id}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  Likes: ${ok} synced, ${skip} skipped`);
}

async function syncComments() {
  const comments = await prisma.comment.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Syncing ${comments.length} comments...`);
  let ok = 0, skip = 0;
  for (const c of comments) {
    try {
      await post('/comments', { userId: c.userId, contentId: c.mealId, text: c.text });
      ok++;
    } catch (e) {
      console.error(`  comment ${c.id}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  Comments: ${ok} synced, ${skip} skipped`);
}

async function syncBlocks() {
  const blocks = await prisma.blockedUser.findMany();
  console.log(`Syncing ${blocks.length} blocks...`);
  let ok = 0, skip = 0;
  for (const b of blocks) {
    try {
      await post('/blocks/toggle', { blockerId: b.blockerId, blockedId: b.blockedId });
      ok++;
    } catch (e) {
      console.error(`  block ${b.id}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  Blocks: ${ok} synced, ${skip} skipped`);
}

async function syncSaves() {
  const saves = await prisma.savedMeal.findMany();
  console.log(`Syncing ${saves.length} saves...`);
  let ok = 0, skip = 0;
  for (const s of saves) {
    try {
      await post('/saves/toggle', { userId: s.userId, contentId: s.mealId });
      ok++;
    } catch (e) {
      console.error(`  save ${s.id}: ${e.message}`);
      skip++;
    }
  }
  console.log(`  Saves: ${ok} synced, ${skip} skipped`);
}

async function main() {
  console.log(`Syncing to social service at ${SOCIAL_URL}...`);
  await syncFollows();
  await syncLikes();
  await syncComments();
  await syncBlocks();
  await syncSaves();
  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
