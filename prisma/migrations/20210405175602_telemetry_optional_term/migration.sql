-- AlterTable
ALTER TABLE "telemetry"
    ADD COLUMN "origin_message" TEXT,
    ALTER COLUMN "requested_term_id" DROP NOT NULL;
