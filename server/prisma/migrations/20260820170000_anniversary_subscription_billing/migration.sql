-- Extend subscription state for anniversary billing and payment suspension.
ALTER TABLE "university_subscriptions"
ADD COLUMN "cancellation_effective_at" TIMESTAMPTZ(6),
ADD COLUMN "activated_at" TIMESTAMPTZ(6),
ADD COLUMN "billing_suspended_at" TIMESTAMPTZ(6);

UPDATE "university_subscriptions"
SET "activated_at" = "created_at"
WHERE "activated_at" IS NULL;

ALTER TABLE "university_subscriptions"
ALTER COLUMN "activated_at" SET NOT NULL,
ALTER COLUMN "activated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "university_monthly_usages"
ALTER COLUMN "billing_period" TYPE VARCHAR(21),
ADD COLUMN "billing_period_start" TIMESTAMPTZ(6),
ADD COLUMN "billing_period_end" TIMESTAMPTZ(6),
ADD COLUMN "price_per_seat" DOUBLE PRECISION,
ADD COLUMN "currency" VARCHAR(10);

-- Existing calendar-month usage remains billable and becomes an explicit
-- closed interval. New rows use anniversary date-range keys.
UPDATE "university_monthly_usages" usage
SET "billing_period_start" = (usage."billing_period" || '-01')::date,
    "billing_period_end" = ((usage."billing_period" || '-01')::date + INTERVAL '1 month'),
    "price_per_seat" = COALESCE(subscription."custom_price_per_seat", pricing."default_price_per_seat", 10.0),
    "currency" = COALESCE(pricing."currency", 'USD')
FROM "universities" university
LEFT JOIN "university_subscriptions" subscription ON subscription."university_id" = university."id"
LEFT JOIN "global_pricing_configs" pricing ON pricing."id" = 'default'
WHERE usage."university_id" = university."id";

ALTER TABLE "university_monthly_usages"
ALTER COLUMN "billing_period_start" SET NOT NULL,
ALTER COLUMN "billing_period_end" SET NOT NULL,
ALTER COLUMN "price_per_seat" SET NOT NULL,
ALTER COLUMN "currency" SET NOT NULL;

CREATE TYPE "subscription_invoice_status" AS ENUM ('DUE', 'PAID');

CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "billing_period_start" TIMESTAMPTZ(6) NOT NULL,
    "billing_period_end" TIMESTAMPTZ(6) NOT NULL,
    "peak_seats" INTEGER NOT NULL,
    "price_per_seat" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "status" "subscription_invoice_status" NOT NULL DEFAULT 'DUE',
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "grace_period_end" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_invoices_uni_period_key"
ON "subscription_invoices"("university_id", "billing_period_start");

CREATE INDEX "idx_subscription_invoices_status_grace"
ON "subscription_invoices"("status", "grace_period_end");

ALTER TABLE "subscription_invoices"
ADD CONSTRAINT "subscription_invoices_subscription_id_fkey"
FOREIGN KEY ("subscription_id") REFERENCES "university_subscriptions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_invoices"
ADD CONSTRAINT "subscription_invoices_university_id_fkey"
FOREIGN KEY ("university_id") REFERENCES "universities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Capture peak active students at the same database boundary as seat changes.
CREATE FUNCTION record_university_peak_students() RETURNS trigger AS $$
DECLARE
    target_university UUID;
    anchor_at TIMESTAMPTZ;
    period_start TIMESTAMPTZ;
    period_end TIMESTAMPTZ;
    period_key VARCHAR(21);
    active_count INTEGER;
    seat_price DOUBLE PRECISION;
    billing_currency VARCHAR(10);
    month_offset INTEGER := 0;
BEGIN
    target_university := COALESCE(NEW.university_id, OLD.university_id);
    IF target_university IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT subscription.activated_at,
           COALESCE(subscription.custom_price_per_seat, pricing.default_price_per_seat, 10.0),
           COALESCE(pricing.currency, 'USD')
    INTO anchor_at, seat_price, billing_currency
    FROM university_subscriptions subscription
    LEFT JOIN global_pricing_configs pricing ON pricing.id = 'default'
    WHERE subscription.university_id = target_university;

    IF anchor_at IS NULL THEN
        RETURN NULL;
    END IF;

    period_start := anchor_at;
    period_end := anchor_at + INTERVAL '1 month';
    WHILE period_end <= CURRENT_TIMESTAMP LOOP
        month_offset := month_offset + 1;
        period_start := anchor_at + make_interval(months => month_offset);
        period_end := anchor_at + make_interval(months => month_offset + 1);
    END LOOP;

    SELECT COUNT(*)::INTEGER
    INTO active_count
    FROM users
    WHERE university_id = target_university
      AND role = 'STUDENT'::user_role
      AND status = 'ACTIVE'::user_status;

    period_key := to_char(period_start AT TIME ZONE 'UTC', 'YYYY-MM-DD') || '_' ||
                  to_char(period_end AT TIME ZONE 'UTC', 'YYYY-MM-DD');

    INSERT INTO university_monthly_usages (
        university_id, billing_period, billing_period_start, billing_period_end,
        peak_students_count, price_per_seat, currency
    ) VALUES (
        target_university, period_key, period_start, period_end,
        active_count, seat_price, billing_currency
    )
    ON CONFLICT (university_id, billing_period) DO UPDATE
    SET peak_students_count = GREATEST(
            university_monthly_usages.peak_students_count,
            EXCLUDED.peak_students_count
        ),
        updated_at = CURRENT_TIMESTAMP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_record_university_peak_students
AFTER INSERT OR UPDATE OF university_id, role, status OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION record_university_peak_students();
