-- CreateTable
CREATE TABLE `SailingSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `routeName` VARCHAR(191) NOT NULL,
    `vesselName` VARCHAR(80) NOT NULL,
    `voyageNumber` VARCHAR(40) NOT NULL,
    `originPortId` VARCHAR(191) NOT NULL,
    `destinationPortId` VARCHAR(191) NOT NULL,
    `etd` DATETIME(3) NOT NULL,
    `eta` DATETIME(3) NOT NULL,
    `transitDays` INTEGER NOT NULL,
    `direct` BOOLEAN NOT NULL DEFAULT false,
    `stopCount` INTEGER NOT NULL DEFAULT 0,
    `frequency` VARCHAR(191) NOT NULL,
    `originTerminal` VARCHAR(191) NOT NULL,
    `destinationTerminal` VARCHAR(191) NOT NULL,
    `cyOpenTime` DATETIME(3) NOT NULL,
    `siCutOffTime` DATETIME(3) NOT NULL,
    `vgmCutOffTime` DATETIME(3) NOT NULL,
    `customsCutOffTime` DATETIME(3) NOT NULL,
    `estimatedBerthingTime` DATETIME(3) NOT NULL,
    `departureReliability` INTEGER NOT NULL,
    `status` ENUM('NORMAL', 'EXPECTED_DELAY', 'DELAYED', 'CUTOFF_SOON', 'CANCELLED') NOT NULL DEFAULT 'NORMAL',
    `delayHours` INTEGER NOT NULL DEFAULT 0,
    `originalEtd` DATETIME(3) NULL,
    `originalEta` DATETIME(3) NULL,
    `lastUpdatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SailingSchedule_carrierId_idx`(`carrierId`),
    INDEX `SailingSchedule_routeId_idx`(`routeId`),
    INDEX `SailingSchedule_originPortId_idx`(`originPortId`),
    INDEX `SailingSchedule_destinationPortId_idx`(`destinationPortId`),
    INDEX `SailingSchedule_etd_idx`(`etd`),
    INDEX `SailingSchedule_eta_idx`(`eta`),
    INDEX `SailingSchedule_status_idx`(`status`),
    INDEX `SailingSchedule_vesselName_idx`(`vesselName`),
    INDEX `SailingSchedule_voyageNumber_idx`(`voyageNumber`),
    UNIQUE INDEX `SailingSchedule_carrierId_vesselName_voyageNumber_originPort_key`(`carrierId`, `vesselName`, `voyageNumber`, `originPortId`, `destinationPortId`, `etd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleTransitPort` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `arrivalTime` DATETIME(3) NOT NULL,
    `departureTime` DATETIME(3) NOT NULL,
    `waitingHours` INTEGER NOT NULL,
    `vesselName` VARCHAR(80) NULL,
    `voyageNumber` VARCHAR(40) NULL,
    `terminal` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleTransitPort_portId_idx`(`portId`),
    UNIQUE INDEX `ScheduleTransitPort_scheduleId_sequence_key`(`scheduleId`, `sequence`),
    UNIQUE INDEX `ScheduleTransitPort_scheduleId_portId_key`(`scheduleId`, `portId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleRouteNode` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `nodeType` ENUM('ORIGIN', 'TRANSIT', 'DESTINATION') NOT NULL,
    `arrivalTime` DATETIME(3) NULL,
    `departureTime` DATETIME(3) NULL,
    `terminal` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ScheduleRouteNode_portId_idx`(`portId`),
    UNIQUE INDEX `ScheduleRouteNode_scheduleId_sequence_key`(`scheduleId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SailingSchedule` ADD CONSTRAINT `SailingSchedule_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `Carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SailingSchedule` ADD CONSTRAINT `SailingSchedule_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SailingSchedule` ADD CONSTRAINT `SailingSchedule_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SailingSchedule` ADD CONSTRAINT `SailingSchedule_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleTransitPort` ADD CONSTRAINT `ScheduleTransitPort_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `SailingSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleTransitPort` ADD CONSTRAINT `ScheduleTransitPort_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleRouteNode` ADD CONSTRAINT `ScheduleRouteNode_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `SailingSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleRouteNode` ADD CONSTRAINT `ScheduleRouteNode_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
