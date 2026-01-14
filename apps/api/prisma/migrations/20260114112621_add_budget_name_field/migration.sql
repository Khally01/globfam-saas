-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Main Budget';

-- DropIndex
DROP INDEX "Budget_userId_month_key";

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_month_name_key" ON "Budget"("userId", "month", "name");
