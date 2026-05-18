-- CreateTable
CREATE TABLE IF NOT EXISTS "CashPayment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashPayment_pkey" PRIMARY KEY ("id")
);
