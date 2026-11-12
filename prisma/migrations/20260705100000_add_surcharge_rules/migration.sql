-- SurchargeRuleSet
CREATE TABLE "SurchargeRuleSet" (
  "id"                  TEXT NOT NULL,
  "customerId"          TEXT NOT NULL,
  "locationId"          TEXT,
  "name"                TEXT NOT NULL DEFAULT 'Zuschlagsregelwerk',
  "defaultHourlyWage"   DOUBLE PRECISION,
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "onboardingMessages"  JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurchargeRuleSet_pkey" PRIMARY KEY ("id")
);

-- SurchargeRule
CREATE TABLE "SurchargeRule" (
  "id"               TEXT NOT NULL,
  "ruleSetId"        TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "type"             TEXT NOT NULL,
  "timeStart"        TEXT,
  "timeEnd"          TEXT,
  "daysOfWeek"       INTEGER[] NOT NULL DEFAULT '{}',
  "includeHolidays"  BOOLEAN NOT NULL DEFAULT false,
  "excludeHolidays"  BOOLEAN NOT NULL DEFAULT false,
  "rateType"         TEXT NOT NULL,
  "rateValue"        DOUBLE PRECISION NOT NULL,
  "priority"         INTEGER NOT NULL DEFAULT 0,
  "roundingMinutes"  INTEGER NOT NULL DEFAULT 0,
  "maxMinutesPerDay" INTEGER,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurchargeRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SurchargeRule"
  ADD CONSTRAINT "SurchargeRule_ruleSetId_fkey"
  FOREIGN KEY ("ruleSetId") REFERENCES "SurchargeRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SurchargeWageConfig
CREATE TABLE "SurchargeWageConfig" (
  "id"         TEXT NOT NULL,
  "ruleSetId"  TEXT NOT NULL,
  "employeeId" TEXT,
  "hourlyWage" DOUBLE PRECISION NOT NULL,
  "validFrom"  TEXT NOT NULL,
  "validTo"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurchargeWageConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SurchargeWageConfig"
  ADD CONSTRAINT "SurchargeWageConfig_ruleSetId_fkey"
  FOREIGN KEY ("ruleSetId") REFERENCES "SurchargeRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
