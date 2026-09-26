-- AlterTable: §71 group-level planning — unit hierarchy + per-unit staffing
ALTER TABLE "PlanningUnit" ADD COLUMN "parentId" TEXT;
ALTER TABLE "PlanningUnit" ADD COLUMN "minStaff" INTEGER NOT NULL DEFAULT 1;
