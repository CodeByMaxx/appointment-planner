ALTER TABLE "Appointment"
ADD COLUMN "cancellationCode" TEXT;

WITH numbered AS (
  SELECT "id", LPAD(ROW_NUMBER() OVER (ORDER BY "id")::TEXT, 12, '0') AS code
  FROM "Appointment"
)
UPDATE "Appointment" a
SET "cancellationCode" = n.code
FROM numbered n
WHERE a."id" = n."id";

ALTER TABLE "Appointment"
ALTER COLUMN "cancellationCode" SET NOT NULL;

CREATE UNIQUE INDEX "Appointment_cancellationCode_key"
ON "Appointment"("cancellationCode");
