-- AlterTable
ALTER TABLE "RewardRedemption" ADD COLUMN "useApprovalToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_useApprovalToken_key" ON "RewardRedemption"("useApprovalToken");
