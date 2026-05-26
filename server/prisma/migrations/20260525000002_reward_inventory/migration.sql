-- Add usedAt to RewardRedemption.
-- null = reward is in the kid's inventory (approved but not yet enjoyed)
-- non-null = reward has been used/enjoyed
ALTER TABLE "RewardRedemption" ADD COLUMN "usedAt" TIMESTAMP(3);
