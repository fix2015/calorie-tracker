-- Add followers_only to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "followers_only" BOOLEAN NOT NULL DEFAULT false;

-- Add tags to meals
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';

-- Add unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateTable WeightLog
CREATE TABLE IF NOT EXISTS "weight_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable DailyStat
CREATE TABLE IF NOT EXISTS "daily_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "calories" INTEGER NOT NULL DEFAULT 0,
    "protein_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat_g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable SavedMeal
CREATE TABLE IF NOT EXISTS "saved_meals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meal_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_meals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "weight_logs_user_id_created_at_idx" ON "weight_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_stats_user_id_date_key" ON "daily_stats"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saved_meals_user_id_meal_id_key" ON "saved_meals"("user_id", "meal_id");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_user_id_fkey') THEN
    ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_stats_user_id_fkey') THEN
    ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_meals_user_id_fkey') THEN
    ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_meals_meal_id_fkey') THEN
    ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
