-- AlterTable: Calorize Pro subscription state, synced from RevenueCat (src/routes/billing.js)
ALTER TABLE "users" ADD COLUMN "pro_until" TIMESTAMP(3),
ADD COLUMN "pro_product_id" TEXT;
