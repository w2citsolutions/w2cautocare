/*
  Warnings:

  - A unique constraint covering the columns `[relatedExpenseId]` on the table `Advance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Advance" ADD COLUMN     "relatedExpenseId" INTEGER;

-- AlterTable
ALTER TABLE "SaleVersion" ADD COLUMN     "receivedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Advance_relatedExpenseId_key" ON "Advance"("relatedExpenseId");

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_relatedExpenseId_fkey" FOREIGN KEY ("relatedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
