-- DropForeignKey
ALTER TABLE "categories"
    DROP CONSTRAINT "categories_id_fkey";

-- AddForeignKey
ALTER TABLE "categories"
    ADD FOREIGN KEY ("author") REFERENCES "moderators" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
