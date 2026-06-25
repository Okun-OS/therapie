-- CreateTable
CREATE TABLE "OrganizationOnboarding" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "traegerName" TEXT,
    "rollenmodell" TEXT,
    "unternehmensweiteRegeln" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationOnboarding" (
    "locationId" TEXT NOT NULL,
    "einrichtungsart" TEXT,
    "organisationsstruktur" TEXT,
    "personalstruktur" TEXT,
    "arbeitszeiten" TEXT,
    "dienstplanlogik" TEXT,
    "pausenlogik" TEXT,
    "wiederkehrendeAufgaben" TEXT,
    "individuelleRegeln" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vertretungsregeln" TEXT,
    "urlaubslogik" TEXT,
    "zeiterfassung" TEXT,
    "besonderheiten" TEXT,
    "completedPhases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationOnboarding_pkey" PRIMARY KEY ("locationId")
);

-- CreateTable
CREATE TABLE "SchedulingPeriodNote" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulingPeriodNote_pkey" PRIMARY KEY ("id")
);
