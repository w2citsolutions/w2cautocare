-- CreateEnum
CREATE TYPE "InspectionTemplateKind" AS ENUM ('GENERAL_SERVICE', 'AC_SERVICE', 'BRAKE_JOB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ARRIVAL', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionItemStatus" AS ENUM ('OK', 'NOT_OK', 'NA', 'ATTENTION');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PHOTO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('ARRIVAL_DAMAGE', 'BEFORE_REPAIR', 'AFTER_REPAIR', 'INSURANCE_DOC', 'RC_COPY', 'OTHER_DOC');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('NEXT_SERVICE', 'INSURANCE_EXPIRY', 'PUC_EXPIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'WHATSAPP', 'CALL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'ATTACHMENT';
ALTER TYPE "EntityType" ADD VALUE 'INSPECTION_TEMPLATE';
ALTER TYPE "EntityType" ADD VALUE 'JOB_INSPECTION';
ALTER TYPE "EntityType" ADD VALUE 'REMINDER';

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InspectionTemplateKind" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInspection" (
    "id" SERIAL NOT NULL,
    "jobCardId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "name" TEXT,
    "type" "InspectionType",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInspectionItem" (
    "id" SERIAL NOT NULL,
    "jobInspectionId" INTEGER NOT NULL,
    "templateItemId" INTEGER,
    "label" TEXT NOT NULL,
    "status" "InspectionItemStatus" NOT NULL DEFAULT 'OK',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobInspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "category" "AttachmentCategory",
    "url" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "vehicleId" INTEGER,
    "jobCardId" INTEGER,
    "jobInspectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "type" "ReminderType" NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'SMS',
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "odometerDue" INTEGER,
    "message" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_vehicleId_dueDate_idx" ON "Reminder"("vehicleId", "dueDate");

-- CreateIndex
CREATE INDEX "Reminder_status_dueDate_idx" ON "Reminder"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspection" ADD CONSTRAINT "JobInspection_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspection" ADD CONSTRAINT "JobInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspectionItem" ADD CONSTRAINT "JobInspectionItem_jobInspectionId_fkey" FOREIGN KEY ("jobInspectionId") REFERENCES "JobInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInspectionItem" ADD CONSTRAINT "JobInspectionItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "InspectionTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_jobInspectionId_fkey" FOREIGN KEY ("jobInspectionId") REFERENCES "JobInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
