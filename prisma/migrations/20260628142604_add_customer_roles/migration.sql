-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
