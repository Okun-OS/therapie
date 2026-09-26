-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('open', 'filled', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "SubstitutionPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "EscalationStage" AS ENUM ('group', 'location', 'organization', 'springerpool');

-- CreateEnum
CREATE TYPE "CandidateResponseStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "employeeId" TEXT NOT NULL,
    "isSpringer" BOOLEAN NOT NULL DEFAULT false,
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "SubstitutionRequest" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "groupId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "qualification" TEXT,
    "priority" "SubstitutionPriority" NOT NULL DEFAULT 'normal',
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'open',
    "escalationStage" "EscalationStage" NOT NULL DEFAULT 'group',
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledByEmployeeId" TEXT,
    "filledAt" TIMESTAMP(3),

    CONSTRAINT "SubstitutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubstitutionCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "matchReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalationStage" "EscalationStage" NOT NULL,
    "responseStatus" "CandidateResponseStatus" NOT NULL DEFAULT 'pending',
    "notifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubstitutionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubstitutionCandidate_requestId_employeeId_key" ON "SubstitutionCandidate"("requestId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "SubstitutionCandidate" ADD CONSTRAINT "SubstitutionCandidate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SubstitutionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SubstitutionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
