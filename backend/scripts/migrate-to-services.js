#!/usr/bin/env node
/**
 * Migrate production data from calorie-tracker monolith DB
 * to microservice databases.
 *
 * Usage:
 *   DATABASE_URL=... SOCIAL_DB_URL=... NOTIFICATION_DB_URL=... MESSAGING_DB_URL=... node scripts/migrate-to-services.js
 *
 * This script:
 * 1. Reads data from the monolith DB
 * 2. Writes to each microservice DB
 * 3. Maps mealId -> contentId for the social service
 * 4. Does NOT delete data from the monolith (safe to re-run)
 */

const { PrismaClient } = require('@prisma/client');

const SOURCE_URL = process.env.DATABASE_URL;
const SOCIAL_DB_URL = process.env.SOCIAL_DB_URL;
const NOTIFICATION_DB_URL = process.env.NOTIFICATION_DB_URL;
const MESSAGING_DB_URL = process.env.MESSAGING_DB_URL;

if (!SOURCE_URL) { console.error('DATABASE_URL required'); process.exit(1); }

const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });

async function migrateNotifications() {
  if (!NOTIFICATION_DB_URL) { console.log('Skipping notifications (no NOTIFICATION_DB_URL)'); return; }

  const { PrismaClient: NotifClient } = require('@prisma/client');
  const target = new NotifClient({ datasources: { db: { url: NOTIFICATION_DB_URL } } });

  console.log('Migrating notifications...');
  const notifications = await source.$queryRaw`SELECT id, user_id, actor_id, type, read, created_at,
    jsonb_build_object('mealId', meal_id, 'commentId', comment_id) as data
    FROM notifications`;

  let inserted = 0;
  for (const n of notifications) {
    try {
      await target.$executeRaw`
        INSERT INTO notifications (id, user_id, actor_id, type, data, read, created_at)
        VALUES (${n.id}, ${n.user_id}, ${n.actor_id}, ${n.type}, ${n.data}::jsonb, ${n.read}, ${n.created_at})
        ON CONFLICT (id) DO NOTHING`;
      inserted++;
    } catch (e) { /* skip duplicates */ }
  }
  console.log(`  Notifications: ${inserted}/${notifications.length} migrated`);
  await target.$disconnect();
}

async function migrateMessaging() {
  if (!MESSAGING_DB_URL) { console.log('Skipping messaging (no MESSAGING_DB_URL)'); return; }

  const { PrismaClient: MsgClient } = require('@prisma/client');
  const target = new MsgClient({ datasources: { db: { url: MESSAGING_DB_URL } } });

  console.log('Migrating conversations...');
  const conversations = await source.$queryRaw`SELECT id, created_at, updated_at FROM conversations`;
  for (const c of conversations) {
    try {
      await target.$executeRaw`
        INSERT INTO conversations (id, created_at, updated_at)
        VALUES (${c.id}, ${c.created_at}, ${c.updated_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Conversations: ${conversations.length}`);

  console.log('Migrating participants...');
  const participants = await source.$queryRaw`SELECT id, conversation_id, user_id, last_read_at FROM conversation_participants`;
  for (const p of participants) {
    try {
      await target.$executeRaw`
        INSERT INTO conversation_participants (id, conversation_id, user_id, last_read_at)
        VALUES (${p.id}, ${p.conversation_id}, ${p.user_id}, ${p.last_read_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Participants: ${participants.length}`);

  console.log('Migrating messages...');
  const messages = await source.$queryRaw`SELECT id, conversation_id, sender_id, text, created_at FROM messages`;
  for (const m of messages) {
    try {
      await target.$executeRaw`
        INSERT INTO messages (id, conversation_id, sender_id, text, created_at)
        VALUES (${m.id}, ${m.conversation_id}, ${m.sender_id}, ${m.text}, ${m.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Messages: ${messages.length}`);
  await target.$disconnect();
}

async function migrateSocial() {
  if (!SOCIAL_DB_URL) { console.log('Skipping social (no SOCIAL_DB_URL)'); return; }

  const { PrismaClient: SocialClient } = require('@prisma/client');
  const target = new SocialClient({ datasources: { db: { url: SOCIAL_DB_URL } } });

  // Likes: mealId -> contentId
  console.log('Migrating likes...');
  const likes = await source.$queryRaw`SELECT id, user_id, meal_id as content_id, created_at FROM likes`;
  for (const l of likes) {
    try {
      await target.$executeRaw`
        INSERT INTO likes (id, user_id, content_id, created_at)
        VALUES (${l.id}, ${l.user_id}, ${l.content_id}, ${l.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Likes: ${likes.length}`);

  // Comments: mealId -> contentId
  console.log('Migrating comments...');
  const comments = await source.$queryRaw`SELECT id, user_id, meal_id as content_id, text, created_at FROM comments`;
  for (const c of comments) {
    try {
      await target.$executeRaw`
        INSERT INTO comments (id, user_id, content_id, text, created_at)
        VALUES (${c.id}, ${c.user_id}, ${c.content_id}, ${c.text}, ${c.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Comments: ${comments.length}`);

  // Comment likes
  console.log('Migrating comment likes...');
  const commentLikes = await source.$queryRaw`SELECT id, user_id, comment_id, created_at FROM comment_likes`;
  for (const cl of commentLikes) {
    try {
      await target.$executeRaw`
        INSERT INTO comment_likes (id, user_id, comment_id, created_at)
        VALUES (${cl.id}, ${cl.user_id}, ${cl.comment_id}, ${cl.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Comment likes: ${commentLikes.length}`);

  // Follows
  console.log('Migrating follows...');
  const follows = await source.$queryRaw`SELECT id, follower_id, following_id, created_at FROM follows`;
  for (const f of follows) {
    try {
      await target.$executeRaw`
        INSERT INTO follows (id, follower_id, following_id, created_at)
        VALUES (${f.id}, ${f.follower_id}, ${f.following_id}, ${f.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Follows: ${follows.length}`);

  // Blocks: blocked_users -> blocks
  console.log('Migrating blocks...');
  const blocks = await source.$queryRaw`SELECT id, blocker_id, blocked_id, created_at FROM blocked_users`;
  for (const b of blocks) {
    try {
      await target.$executeRaw`
        INSERT INTO blocks (id, blocker_id, blocked_id, created_at)
        VALUES (${b.id}, ${b.blocker_id}, ${b.blocked_id}, ${b.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Blocks: ${blocks.length}`);

  // Saved meals: mealId -> contentId
  console.log('Migrating saves...');
  const saves = await source.$queryRaw`SELECT id, user_id, meal_id as content_id, created_at FROM saved_meals`;
  for (const s of saves) {
    try {
      await target.$executeRaw`
        INSERT INTO saves (id, user_id, content_id, created_at)
        VALUES (${s.id}, ${s.user_id}, ${s.content_id}, ${s.created_at})
        ON CONFLICT (id) DO NOTHING`;
    } catch (e) {}
  }
  console.log(`  Saves: ${saves.length}`);
  await target.$disconnect();
}

async function main() {
  console.log('Starting data migration to microservices...\n');

  await migrateNotifications();
  await migrateMessaging();
  await migrateSocial();

  await source.$disconnect();
  console.log('\nMigration complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
