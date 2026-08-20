ALTER TABLE "global_pricing_configs"
ADD COLUMN "next_price_per_seat" DOUBLE PRECISION,
ADD COLUMN "next_price_effective_at" TIMESTAMPTZ(6);

ALTER TABLE "university_subscriptions"
ADD COLUMN "next_custom_price_per_seat" DOUBLE PRECISION,
ADD COLUMN "next_custom_price_effective_at" TIMESTAMPTZ(6);
