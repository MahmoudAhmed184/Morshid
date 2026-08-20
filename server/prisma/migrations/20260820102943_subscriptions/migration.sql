-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PENDING_CANCELLATION', 'CANCELLED');

-- CreateTable
CREATE TABLE "global_pricing_configs" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'default',
    "default_price_per_seat" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "custom_price_per_seat" DOUBLE PRECISION,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_monthly_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "billing_period" VARCHAR(7) NOT NULL,
    "peak_students_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_monthly_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "university_subscriptions_university_id_key" ON "university_subscriptions"("university_id");

-- CreateIndex
CREATE INDEX "idx_university_subscriptions_status" ON "university_subscriptions"("status");

-- CreateIndex
CREATE INDEX "idx_university_monthly_usage_uni" ON "university_monthly_usages"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "university_monthly_usage_uni_period_key" ON "university_monthly_usages"("university_id", "billing_period");

-- AddForeignKey
ALTER TABLE "university_subscriptions" ADD CONSTRAINT "university_subscriptions_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_monthly_usages" ADD CONSTRAINT "university_monthly_usages_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
