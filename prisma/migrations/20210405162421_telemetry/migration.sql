-- CreateTable
CREATE TABLE "telemetry"
(
    "id"                SERIAL       NOT NULL,
    "requested_term_id" INTEGER      NOT NULL,
    "author"            TEXT         NOT NULL,
    "is_useful"         BOOLEAN,
    "created"           TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderated_at"      TIMESTAMP(6),
    "moderated_by"      INTEGER,

    PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "telemetry"
    ADD FOREIGN KEY ("moderated_by") REFERENCES "moderators" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry"
    ADD FOREIGN KEY ("requested_term_id") REFERENCES "obscure" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
