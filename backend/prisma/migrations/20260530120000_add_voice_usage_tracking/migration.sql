-- AlterTable
ALTER TABLE "users" ADD COLUMN "voice_seconds_used" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "voice_seconds_reset_at" TIMESTAMP(3);
