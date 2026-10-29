-- DropForeignKey
ALTER TABLE `sailingschedule` DROP FOREIGN KEY `SailingSchedule_carrierId_fkey`;

-- DropIndex
DROP INDEX `SailingSchedule_carrierId_vesselName_voyageNumber_originPort_key` ON `sailingschedule`;

-- AlterTable
ALTER TABLE `port` ADD COLUMN `aliases` JSON NULL;

-- AlterTable
ALTER TABLE `sailingschedule` ADD COLUMN `fetchedAt` DATETIME(3) NULL,
    ADD COLUMN `rawSourceData` JSON NULL,
    ADD COLUMN `sourceReference` VARCHAR(160) NULL,
    MODIFY `source` enum('SEED','MANUAL','COSCO_LIVE_QUERY','OOCL_LIVE_QUERY','CMA_LIVE_QUERY') NOT NULL DEFAULT 'SEED';

-- CreateTable
CREATE TABLE `carrierportmapping` (
    `id` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `mappingValue` VARCHAR(180) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarrierPortMapping_carrierId_idx`(`carrierId` ASC),
    UNIQUE INDEX `CarrierPortMapping_carrierId_portId_key`(`carrierId` ASC, `portId` ASC),
    INDEX `CarrierPortMapping_mappingValue_idx`(`mappingValue` ASC),
    INDEX `CarrierPortMapping_portId_idx`(`portId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedulefetchjob` (
    `id` VARCHAR(191) NOT NULL,
    `source` ENUM('COSCO') NOT NULL DEFAULT 'COSCO',
    `originPortCode` VARCHAR(10) NOT NULL,
    `destinationPortCode` VARCHAR(10) NOT NULL,
    `departureDate` DATETIME(3) NOT NULL,
    `rangeDays` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
    `resultCount` INTEGER NOT NULL DEFAULT 0,
    `insertedCount` INTEGER NOT NULL DEFAULT 0,
    `updatedCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `errorCode` VARCHAR(80) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `durationMs` INTEGER NULL,
    `triggeredByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `ScheduleFetchJob_createdAt_idx`(`createdAt` ASC),
    INDEX `ScheduleFetchJob_originPortCode_destinationPortCode_departur_idx`(`originPortCode` ASC, `destinationPortCode` ASC, `departureDate` ASC),
    INDEX `ScheduleFetchJob_source_idx`(`source` ASC),
    INDEX `ScheduleFetchJob_status_idx`(`status` ASC),
    INDEX `ScheduleFetchJob_triggeredByUserId_idx`(`triggeredByUserId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `SailingSchedule_carrierId_vesselName_voyageNumber_originPort_key` ON `sailingschedule`(`carrierId` ASC, `vesselName` ASC, `voyageNumber` ASC, `originPortId` ASC, `destinationPortId` ASC, `etd` ASC, `source` ASC);

-- CreateIndex
CREATE INDEX `SailingSchedule_fetchedAt_idx` ON `sailingschedule`(`fetchedAt` ASC);

-- CreateIndex
CREATE INDEX `SailingSchedule_sourceReference_idx` ON `sailingschedule`(`sourceReference` ASC);

-- AddForeignKey
ALTER TABLE `carrierportmapping` ADD CONSTRAINT `CarrierPortMapping_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carrierportmapping` ADD CONSTRAINT `CarrierPortMapping_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routetransitport` ADD CONSTRAINT `RouteTransitPort_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedulefetchjob` ADD CONSTRAINT `ScheduleFetchJob_triggeredByUserId_fkey` FOREIGN KEY (`triggeredByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
