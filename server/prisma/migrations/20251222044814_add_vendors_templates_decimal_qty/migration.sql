-- CreateEnum
CREATE TYPE "JobCardTemplateCategory" AS ENUM ('WASHING', 'DECOR', 'MECHANICAL', 'DENTING_PAINTING', 'GENERAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VendorPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'VENDOR';
ALTER TYPE "EntityType" ADD VALUE 'VENDOR_PAYMENT';

-- DropForeignKey
ALTER TABLE "InspectionTemplateItem" DROP CONSTRAINT "InspectionTemplateItem_templateId_fkey";

-- DropForeignKey
ALTER TABLE "JobInspection" DROP CONSTRAINT "JobInspection_jobCardId_fkey";

-- DropForeignKey
ALTER TABLE "JobInspectionItem" DROP CONSTRAINT "JobInspectionItem_jobInspectionId_fkey";

-- DropForeignKey
ALTER TABLE "JobLineItem" DROP CONSTRAINT "JobLineItem_jobCardId_fkey";

-- DropForeignKey
ALTER TABLE "JobPayment" DROP CONSTRAINT "JobPayment_jobCardId_fkey";

-- AlterTable
ALTER TABLE "JobCard" ADD COLUMN     "templateUsed" "JobCardTemplateCategory";

-- AlterTable
ALTER TABLE "JobLineItem" ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstNumber" TEXT,
    "totalDue" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentMode" "PaymentMode",
    "invoiceNumber" TEXT,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "VendorPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "relatedExpenseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCardTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "JobCardTemplateCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCardTemplateItem" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "lineType" "JobLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inventoryItemId" INTEGER,

    CONSTRAINT "JobCardTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_relatedExpenseId_key" ON "VendorPayment"("relatedExpenseId");

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_date_idx" ON "VendorPayment"("vendorId", "date");

-- CreateIndex
CREATE INDEX "VendorPayment_status_idx" ON "VendorPayment"("status");

-- CreateIndex
CREATE INDEX "JobCardTemplate_category_idx" ON "JobCardTemplate"("category");

-- CreateIndex
CREATE INDEX "JobCard_status_idx" ON "JobCard"("status");

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_relatedExpenseId_fkey" FOREIGN KEY ("relatedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCardTemplateItem" ADD CONSTRAINT "JobCardTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "JobCardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCardTemplateItem" ADD CONSTRAINT "JobCardTemplateItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLineItem" ADD CONSTRAINT "JobLineItem_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPayment" ADD CONSTRAINT "JobPayment_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspection" ADD CONSTRAINT "JobInspection_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspectionItem" ADD CONSTRAINT "JobInspectionItem_jobInspectionId_fkey" FOREIGN KEY ("jobInspectionId") REFERENCES "JobInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
