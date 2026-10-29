-- Carrier responses do not guarantee these fields. Missing values must remain
-- NULL rather than being replaced with application-generated placeholders.
ALTER TABLE `sailingschedule`
  ADD COLUMN `etdTimeKnown` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `etaTimeKnown` BOOLEAN NOT NULL DEFAULT true,
  MODIFY `serviceName` VARCHAR(191) NULL,
  MODIFY `routeName` VARCHAR(191) NULL,
  MODIFY `vesselName` VARCHAR(80) NULL,
  MODIFY `voyageNumber` VARCHAR(40) NULL,
  MODIFY `transitDays` INTEGER NULL,
  MODIFY `direct` BOOLEAN NULL,
  MODIFY `stopCount` INTEGER NULL,
  MODIFY `frequency` VARCHAR(191) NULL,
  MODIFY `originTerminal` VARCHAR(191) NULL,
  MODIFY `destinationTerminal` VARCHAR(191) NULL,
  MODIFY `cyOpenTime` DATETIME(3) NULL,
  MODIFY `siCutOffTime` DATETIME(3) NULL,
  MODIFY `vgmCutOffTime` DATETIME(3) NULL,
  MODIFY `customsCutOffTime` DATETIME(3) NULL,
  MODIFY `estimatedBerthingTime` DATETIME(3) NULL,
  MODIFY `departureReliability` INTEGER NULL,
  MODIFY `status` ENUM('NORMAL', 'EXPECTED_DELAY', 'DELAYED', 'CUTOFF_SOON', 'CANCELLED') NULL,
  MODIFY `delayHours` INTEGER NULL;
