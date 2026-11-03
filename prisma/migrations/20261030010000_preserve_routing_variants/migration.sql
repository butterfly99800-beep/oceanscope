-- Existing rows keep their old uniqueness semantics with an empty routingKey.
-- Official multi-leg variants use an explicit stable routing fingerprint.
ALTER TABLE `sailingschedule`
  ADD COLUMN `routingKey` VARCHAR(64) NOT NULL DEFAULT '',
  DROP INDEX `sailingschedule_carrierId_vesselName_voyageNumber_originPort_key`,
  ADD UNIQUE INDEX `sailingschedule_routing_identity_key` (`carrierId`, `vesselName`, `voyageNumber`, `originPortId`, `destinationPortId`, `etd`, `source`, `routingKey`);
