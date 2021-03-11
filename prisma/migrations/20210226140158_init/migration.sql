-- CreateEnum
CREATE TYPE "staging_status" AS ENUM ('waiting', 'accepted', 'declined', 'request_changes', 'synonym');

-- CreateTable
CREATE TABLE "moderators"
(
    "id"          SERIAL  NOT NULL,
    "user_id"     INTEGER NOT NULL,
    "promoted_by" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obscure"
(
    "id"        SERIAL NOT NULL,
    "term"      TEXT   NOT NULL,
    "value"     TEXT   NOT NULL,
    "author"    TEXT   NOT NULL,
    "submitted" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "synonyms"  TEXT[],

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staging"
(
    "id"          SERIAL       NOT NULL,
    "status"      "staging_status"      DEFAULT E'waiting',
    "created"     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated"     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "term"        TEXT         NOT NULL,
    "value"       TEXT         NOT NULL,
    "author"      TEXT         NOT NULL,
    "reviewed_by" INTEGER,
    "accepted_as" INTEGER,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moderators.user_id_unique" ON "moderators" ("user_id");

-- AddForeignKey
ALTER TABLE "staging"
    ADD FOREIGN KEY ("accepted_as") REFERENCES "obscure" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging"
    ADD FOREIGN KEY ("reviewed_by") REFERENCES "moderators" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
