-- CreateTable
CREATE TABLE "WorkflowLearning" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "customerId" TEXT,
    "locationId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "structuredData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowLearning_pkey" PRIMARY KEY ("id")
);
