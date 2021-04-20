/*
  Warnings:

  - You are about to drop the column `user_id` on the `moderators` table. All the data in the column will be lost.
  - You are about to drop the column `author` on the `obscure` table. All the data in the column will be lost.
  - You are about to drop the column `submitted` on the `obscure` table. All the data in the column will be lost.
  - Changed the type of `author` on the `staging` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `author` on the `telemetry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "categories"
    DROP CONSTRAINT "categories_author_fkey";

-- DropForeignKey
ALTER TABLE "staging"
    DROP CONSTRAINT "staging_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "telemetry"
    DROP CONSTRAINT "telemetry_moderated_by_fkey";

-- DropIndex
DROP INDEX "moderators.user_id_unique";

-- AlterTable
ALTER TABLE "moderators"
    DROP COLUMN "user_id",
    ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "moderators_id_seq";

-- AlterTable
ALTER TABLE "obscure"
    DROP COLUMN "author",
    DROP COLUMN "submitted";

-- AlterTable
ALTER TABLE "staging"
    DROP COLUMN "author",
    ADD COLUMN "author" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "telemetry"
    DROP COLUMN "author",
    ADD COLUMN "author" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "users"
(
    "id"                SERIAL NOT NULL,
    "telegram_id"       INTEGER,
    "telegram_username" TEXT,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users.telegram_id_unique" ON "users" ("telegram_id");

-- AddForeignKey
ALTER TABLE "categories"
    ADD FOREIGN KEY ("id") REFERENCES "moderators" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderators"
    ADD FOREIGN KEY ("id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging"
    ADD FOREIGN KEY ("author") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging"
    ADD FOREIGN KEY ("reviewed_by") REFERENCES "moderators" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry"
    ADD FOREIGN KEY ("author") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry"
    ADD FOREIGN KEY ("moderated_by") REFERENCES "moderators" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
