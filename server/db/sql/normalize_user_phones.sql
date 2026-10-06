-- Runs inside the migration that creates users_phone_unique, BEFORE the index.
-- 1. Store every phone in one format (2547XXXXXXXX / 2541XXXXXXXX) so the same
--    number written differently ("0712…", "+254 712…") counts as a duplicate.
--    Values that are not a valid Kenyan mobile number become NULL; the user is
--    asked for a number again when they next edit their profile.
UPDATE "users" SET "phone" = CASE
  WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0[17][0-9]{8}$' THEN '254' || substr(regexp_replace("phone", '\D', '', 'g'), 2)
  WHEN regexp_replace("phone", '\D', '', 'g') ~ '^[17][0-9]{8}$' THEN '254' || regexp_replace("phone", '\D', '', 'g')
  WHEN regexp_replace("phone", '\D', '', 'g') ~ '^254[17][0-9]{8}$' THEN regexp_replace("phone", '\D', '', 'g')
  ELSE NULL
END
WHERE "phone" IS NOT NULL;
--> statement-breakpoint
-- 2. A number shared by several accounts stays on the oldest account only.
UPDATE "users" u SET "phone" = NULL
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "phone" ORDER BY "created_at") AS rn
  FROM "users" WHERE "phone" IS NOT NULL
) d
WHERE u."id" = d."id" AND d.rn > 1;
--> statement-breakpoint
-- 3. Bank-transfer orders used to start as "Processing" before any money
--    arrived. Unpaid ones go back to "Payment Pending" so they are not shipped.
UPDATE "orders" SET "status" = 'Payment Pending'
WHERE "payment_method" = 'Bank Transfer / RTGS' AND "payment_status" <> 'Paid' AND "status" = 'Processing';
