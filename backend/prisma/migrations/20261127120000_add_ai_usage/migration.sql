-- CreateTable: daily AI usage per user, backs the photo-scan / voice / analysis caps (src/utils/aiQuota.js)
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "photo_scans" INTEGER NOT NULL DEFAULT 0,
    "voice_seconds" INTEGER NOT NULL DEFAULT 0,
    "analyses" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_user_id_day_key" ON "ai_usage"("user_id", "day");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
