-- AlterTable
ALTER TABLE `carrierportmapping` ADD COLUMN `codeType` VARCHAR(40) NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX `CarrierPortMapping_carrierId_portId_key` ON `carrierportmapping`;

-- CreateIndex
CREATE UNIQUE INDEX `CarrierPortMapping_carrierId_portId_codeType_key` ON `carrierportmapping`(`carrierId`, `portId`, `codeType`);

-- CreateIndex
CREATE INDEX `CarrierPortMapping_codeType_idx` ON `carrierportmapping`(`codeType`);

-- AlterTable
ALTER TABLE `sailingschedule` MODIFY `source` ENUM('SEED','MANUAL','COSCO_LIVE_QUERY','OOCL_LIVE_QUERY','CMA_LIVE_QUERY','MAERSK_LIVE_QUERY','MSC_LIVE_QUERY','HAPAG_LIVE_QUERY') NOT NULL DEFAULT 'SEED';
