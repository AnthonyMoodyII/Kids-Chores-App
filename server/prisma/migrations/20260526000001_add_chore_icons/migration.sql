-- Add icon field to ChoreTemplate, Chore, and DailyChoreSelection
ALTER TABLE "ChoreTemplate" ADD COLUMN "icon" TEXT;
ALTER TABLE "Chore" ADD COLUMN "icon" TEXT;
ALTER TABLE "DailyChoreSelection" ADD COLUMN "icon" TEXT;
