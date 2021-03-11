-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "created" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_category_to_obscure" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_category_to_obscure_AB_unique" ON "_category_to_obscure"("A", "B");

-- CreateIndex
CREATE INDEX "_category_to_obscure_B_index" ON "_category_to_obscure"("B");

-- AddForeignKey
ALTER TABLE "categories" ADD FOREIGN KEY ("id") REFERENCES "moderators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_category_to_obscure" ADD FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_category_to_obscure" ADD FOREIGN KEY ("B") REFERENCES "obscure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
