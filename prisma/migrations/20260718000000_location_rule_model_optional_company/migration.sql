-- Make companyModelId optional so LocationRuleModelRecord can be used standalone per location
ALTER TABLE "LocationRuleModelRecord" ALTER COLUMN "companyModelId" DROP NOT NULL;
