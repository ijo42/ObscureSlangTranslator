-- AlterTable
ALTER TABLE "moderators" ADD COLUMN     "promoted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "joined" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_activity" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
