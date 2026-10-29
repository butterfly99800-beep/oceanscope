-- AlterTable
ALTER TABLE `sailingschedule` ADD COLUMN `source` ENUM('SEED', 'MANUAL', 'COSCO_LIVE_QUERY') NOT NULL DEFAULT 'SEED';

-- CreateIndex
CREATE INDEX `SailingSchedule_source_idx` ON `SailingSchedule`(`source`);
