-- Preserve schedules whose official final-destination ETA is not published.
-- This relaxes a constraint; it does not delete or rewrite existing values.
ALTER TABLE `sailingschedule` MODIFY `eta` DATETIME(3) NULL;
