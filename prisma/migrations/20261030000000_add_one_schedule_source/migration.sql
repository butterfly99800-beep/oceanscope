-- Append ONE without changing existing enum positions or historical migration checksums.
ALTER TABLE `sailingschedule` MODIFY `source` ENUM('SEED', 'MANUAL', 'COSCO_LIVE_QUERY', 'OOCL_LIVE_QUERY', 'CMA_LIVE_QUERY', 'MAERSK_LIVE_QUERY', 'MSC_LIVE_QUERY', 'HAPAG_LIVE_QUERY', 'ONE_LIVE_QUERY') NOT NULL DEFAULT 'SEED';
