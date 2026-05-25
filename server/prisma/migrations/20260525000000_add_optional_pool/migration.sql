-- AlterTable: add maxPerDay and isInPool to ChoreTemplate
ALTER TABLE "ChoreTemplate" ADD COLUMN "maxPerDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChoreTemplate" ADD COLUMN "isInPool" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: DailyChoreSelection
CREATE TABLE "DailyChoreSelection" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "baseValue" DOUBLE PRECISION NOT NULL,
    "maxPerDay" INTEGER NOT NULL DEFAULT 1,
    "day" TEXT NOT NULL,
    "weekOf" TEXT NOT NULL,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChoreSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint prevents duplicate daily picks
CREATE UNIQUE INDEX "DailyChoreSelection_childId_templateId_day_weekOf_key"
    ON "DailyChoreSelection"("childId", "templateId", "day", "weekOf");
