-- Add one-time approval token to RedemptionRequest for deep-link approvals
ALTER TABLE "RedemptionRequest" ADD COLUMN "approvalToken" TEXT;
CREATE UNIQUE INDEX "RedemptionRequest_approvalToken_key" ON "RedemptionRequest"("approvalToken");
