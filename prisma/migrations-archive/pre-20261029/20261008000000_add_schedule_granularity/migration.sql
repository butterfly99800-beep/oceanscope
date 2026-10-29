-- AlterTable: add ScheduleGranularity column (VESSEL default, SERVICE for CMA service-level results)
ALTER TABLE `sailingschedule` ADD COLUMN `granularity` ENUM('VESSEL','SERVICE') NOT NULL DEFAULT 'VESSEL';
