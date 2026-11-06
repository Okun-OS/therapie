-- Add requestDeadline to PlanningPolicy
ALTER TABLE "PlanningPolicy" ADD COLUMN "requestDeadline" TIMESTAMP(3);
