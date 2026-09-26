-- CreateTable
CREATE TABLE "LocationPlanningRules" (
    "locationId" TEXT NOT NULL,
    "maxWeeklyHours" INTEGER NOT NULL DEFAULT 40,
    "restHours" INTEGER NOT NULL DEFAULT 11,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 5,
    "fridayLateMax" INTEGER NOT NULL DEFAULT 2,
    "mondayEarlyMax" INTEGER NOT NULL DEFAULT 3,
    "fridayEarlyMax" INTEGER NOT NULL DEFAULT 3,
    "weekendMax" INTEGER NOT NULL DEFAULT 2,
    "considerWishes" BOOLEAN NOT NULL DEFAULT true,
    "balanceHoursAccount" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationPlanningRules_pkey" PRIMARY KEY ("locationId")
);
