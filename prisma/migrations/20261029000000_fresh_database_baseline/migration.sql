-- CreateTable
CREATE TABLE `port` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameZh` VARCHAR(191) NULL,
    `locode` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NULL,
    `region` VARCHAR(191) NOT NULL,
    `aliases` JSON NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `port_locode_key`(`locode`),
    INDEX `port_country_idx`(`country`),
    INDEX `port_region_idx`(`region`),
    INDEX `port_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carrier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameZh` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `carrier_code_key`(`code`),
    INDEX `carrier_country_idx`(`country`),
    INDEX `carrier_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carrierportmapping` (
    `id` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `codeType` VARCHAR(40) NOT NULL DEFAULT '',
    `mappingValue` VARCHAR(180) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `carrierportmapping_carrierId_idx`(`carrierId`),
    INDEX `carrierportmapping_portId_idx`(`portId`),
    INDEX `carrierportmapping_codeType_idx`(`codeType`),
    INDEX `carrierportmapping_mappingValue_idx`(`mappingValue`),
    UNIQUE INDEX `carrierportmapping_carrierId_portId_codeType_key`(`carrierId`, `portId`, `codeType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `originPortId` VARCHAR(191) NOT NULL,
    `destinationPortId` VARCHAR(191) NOT NULL,
    `direct` BOOLEAN NOT NULL DEFAULT false,
    `averageTransitDays` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `route_carrierId_idx`(`carrierId`),
    INDEX `route_originPortId_idx`(`originPortId`),
    INDEX `route_destinationPortId_idx`(`destinationPortId`),
    INDEX `route_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routetransitport` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `routetransitport_portId_idx`(`portId`),
    UNIQUE INDEX `routetransitport_routeId_sequence_key`(`routeId`, `sequence`),
    UNIQUE INDEX `routetransitport_routeId_portId_key`(`routeId`, `portId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sailingschedule` (
    `id` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NULL,
    `serviceName` VARCHAR(191) NULL,
    `routeName` VARCHAR(191) NULL,
    `vesselName` VARCHAR(80) NULL,
    `voyageNumber` VARCHAR(40) NULL,
    `originPortId` VARCHAR(191) NOT NULL,
    `destinationPortId` VARCHAR(191) NOT NULL,
    `etd` DATETIME(3) NOT NULL,
    `eta` DATETIME(3) NOT NULL,
    `etdTimeKnown` BOOLEAN NOT NULL DEFAULT true,
    `etaTimeKnown` BOOLEAN NOT NULL DEFAULT true,
    `transitDays` INTEGER NULL,
    `direct` BOOLEAN NULL,
    `stopCount` INTEGER NULL,
    `frequency` VARCHAR(191) NULL,
    `originTerminal` VARCHAR(191) NULL,
    `destinationTerminal` VARCHAR(191) NULL,
    `cyOpenTime` DATETIME(3) NULL,
    `siCutOffTime` DATETIME(3) NULL,
    `vgmCutOffTime` DATETIME(3) NULL,
    `customsCutOffTime` DATETIME(3) NULL,
    `estimatedBerthingTime` DATETIME(3) NULL,
    `departureReliability` INTEGER NULL,
    `status` ENUM('NORMAL', 'EXPECTED_DELAY', 'DELAYED', 'CUTOFF_SOON', 'CANCELLED') NULL,
    `delayHours` INTEGER NULL,
    `originalEtd` DATETIME(3) NULL,
    `originalEta` DATETIME(3) NULL,
    `lastUpdatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` ENUM('SEED', 'MANUAL', 'COSCO_LIVE_QUERY', 'OOCL_LIVE_QUERY', 'CMA_LIVE_QUERY', 'MAERSK_LIVE_QUERY', 'MSC_LIVE_QUERY', 'HAPAG_LIVE_QUERY') NOT NULL DEFAULT 'SEED',
    `granularity` ENUM('VESSEL', 'SERVICE') NOT NULL DEFAULT 'VESSEL',
    `fetchedAt` DATETIME(3) NULL,
    `rawSourceData` JSON NULL,
    `sourceReference` VARCHAR(160) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sailingschedule_carrierId_idx`(`carrierId`),
    INDEX `sailingschedule_routeId_idx`(`routeId`),
    INDEX `sailingschedule_originPortId_idx`(`originPortId`),
    INDEX `sailingschedule_destinationPortId_idx`(`destinationPortId`),
    INDEX `sailingschedule_etd_idx`(`etd`),
    INDEX `sailingschedule_eta_idx`(`eta`),
    INDEX `sailingschedule_status_idx`(`status`),
    INDEX `sailingschedule_source_idx`(`source`),
    INDEX `sailingschedule_fetchedAt_idx`(`fetchedAt`),
    INDEX `sailingschedule_sourceReference_idx`(`sourceReference`),
    INDEX `sailingschedule_vesselName_idx`(`vesselName`),
    INDEX `sailingschedule_voyageNumber_idx`(`voyageNumber`),
    UNIQUE INDEX `sailingschedule_carrierId_vesselName_voyageNumber_originPort_key`(`carrierId`, `vesselName`, `voyageNumber`, `originPortId`, `destinationPortId`, `etd`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduletransitport` (
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

    INDEX `scheduletransitport_portId_idx`(`portId`),
    UNIQUE INDEX `scheduletransitport_scheduleId_sequence_key`(`scheduleId`, `sequence`),
    UNIQUE INDEX `scheduletransitport_scheduleId_portId_key`(`scheduleId`, `portId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduleroutenode` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `nodeType` ENUM('ORIGIN', 'TRANSIT', 'DESTINATION') NOT NULL,
    `arrivalTime` DATETIME(3) NULL,
    `departureTime` DATETIME(3) NULL,
    `terminal` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `scheduleroutenode_portId_idx`(`portId`),
    UNIQUE INDEX `scheduleroutenode_scheduleId_sequence_key`(`scheduleId`, `sequence`),
    PRIMARY KEY (`id`)
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

    INDEX `schedulefetchjob_createdAt_idx`(`createdAt`),
    INDEX `schedulefetchjob_originPortCode_destinationPortCode_departur_idx`(`originPortCode`, `destinationPortCode`, `departureDate`),
    INDEX `schedulefetchjob_source_idx`(`source`),
    INDEX `schedulefetchjob_status_idx`(`status`),
    INDEX `schedulefetchjob_triggeredByUserId_idx`(`triggeredByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ratequote` (
    `id` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NULL,
    `originPortId` VARCHAR(191) NOT NULL,
    `destinationPortId` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(80) NOT NULL,
    `transportMode` ENUM('FCL', 'LCL', 'AIR') NOT NULL DEFAULT 'FCL',
    `containerType` ENUM('TWENTY_GP', 'FORTY_GP', 'FORTY_HC', 'FORTY_FIVE_HC') NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `baseFreight` DECIMAL(12, 2) NOT NULL,
    `fuelSurcharge` DECIMAL(12, 2) NOT NULL,
    `terminalHandlingCharge` DECIMAL(12, 2) NOT NULL,
    `documentationFee` DECIMAL(12, 2) NOT NULL,
    `bookingFee` DECIMAL(12, 2) NOT NULL,
    `dangerousGoodsSurcharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `otherSurcharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalBasePrice` DECIMAL(12, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `transitDays` INTEGER NOT NULL,
    `direct` BOOLEAN NOT NULL DEFAULT false,
    `stopCount` INTEGER NOT NULL DEFAULT 0,
    `vesselName` VARCHAR(80) NOT NULL,
    `voyageNumber` VARCHAR(40) NOT NULL,
    `etd` DATETIME(3) NOT NULL,
    `eta` DATETIME(3) NOT NULL,
    `cutOffDate` DATETIME(3) NOT NULL,
    `freeDays` INTEGER NOT NULL DEFAULT 7,
    `reliability` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ratequote_carrierId_idx`(`carrierId`),
    INDEX `ratequote_routeId_idx`(`routeId`),
    INDEX `ratequote_originPortId_idx`(`originPortId`),
    INDEX `ratequote_destinationPortId_idx`(`destinationPortId`),
    INDEX `ratequote_containerType_idx`(`containerType`),
    INDEX `ratequote_effectiveFrom_idx`(`effectiveFrom`),
    INDEX `ratequote_validUntil_idx`(`validUntil`),
    INDEX `ratequote_status_idx`(`status`),
    INDEX `ratequote_etd_idx`(`etd`),
    INDEX `ratequote_eta_idx`(`eta`),
    UNIQUE INDEX `ratequote_carrierId_originPortId_destinationPortId_serviceNa_key`(`carrierId`, `originPortId`, `destinationPortId`, `serviceName`, `containerType`, `effectiveFrom`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ratelineitem` (
    `id` VARCHAR(191) NOT NULL,
    `rateQuoteId` VARCHAR(191) NOT NULL,
    `category` ENUM('BASE', 'ORIGIN', 'DESTINATION', 'SURCHARGE', 'OPTIONAL') NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `unit` VARCHAR(40) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ratelineitem_rateQuoteId_idx`(`rateQuoteId`),
    INDEX `ratelineitem_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(160) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `user_role_idx`(`role`),
    INDEX `user_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookingorder` (
    `id` VARCHAR(191) NOT NULL,
    `bookingNumber` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    `userId` VARCHAR(191) NULL,
    `customerName` VARCHAR(120) NULL,
    `customerEmail` VARCHAR(160) NULL,
    `customerPhone` VARCHAR(60) NULL,
    `originPortId` VARCHAR(191) NOT NULL,
    `destinationPortId` VARCHAR(191) NOT NULL,
    `carrierId` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NULL,
    `rateQuoteId` VARCHAR(191) NULL,
    `serviceName` VARCHAR(80) NOT NULL,
    `transportMode` ENUM('FCL', 'LCL', 'AIR') NOT NULL DEFAULT 'FCL',
    `cargoType` VARCHAR(40) NOT NULL,
    `readyDate` DATETIME(3) NOT NULL,
    `vesselName` VARCHAR(80) NOT NULL,
    `voyageNumber` VARCHAR(40) NOT NULL,
    `etd` DATETIME(3) NOT NULL,
    `eta` DATETIME(3) NOT NULL,
    `transitDays` INTEGER NOT NULL,
    `stopCount` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `quoteValidUntil` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    UNIQUE INDEX `bookingorder_bookingNumber_key`(`bookingNumber`),
    INDEX `bookingorder_status_idx`(`status`),
    INDEX `bookingorder_userId_idx`(`userId`),
    INDEX `bookingorder_originPortId_idx`(`originPortId`),
    INDEX `bookingorder_destinationPortId_idx`(`destinationPortId`),
    INDEX `bookingorder_carrierId_idx`(`carrierId`),
    INDEX `bookingorder_routeId_idx`(`routeId`),
    INDEX `bookingorder_rateQuoteId_idx`(`rateQuoteId`),
    INDEX `bookingorder_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookingcontainer` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `containerType` ENUM('TWENTY_GP', 'FORTY_GP', 'FORTY_HC', 'FORTY_FIVE_HC') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bookingcontainer_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookingservice` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bookingservice_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookingcostitem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bookingcostitem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookingtimeline` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `actorName` VARCHAR(160) NULL,
    `actorRole` ENUM('CUSTOMER', 'ADMIN') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bookingtimeline_orderId_idx`(`orderId`),
    INDEX `bookingtimeline_status_idx`(`status`),
    INDEX `bookingtimeline_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `carrierportmapping` ADD CONSTRAINT `carrierportmapping_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carrierportmapping` ADD CONSTRAINT `carrierportmapping_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route` ADD CONSTRAINT `route_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route` ADD CONSTRAINT `route_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route` ADD CONSTRAINT `route_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routetransitport` ADD CONSTRAINT `routetransitport_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routetransitport` ADD CONSTRAINT `routetransitport_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sailingschedule` ADD CONSTRAINT `sailingschedule_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sailingschedule` ADD CONSTRAINT `sailingschedule_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sailingschedule` ADD CONSTRAINT `sailingschedule_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sailingschedule` ADD CONSTRAINT `sailingschedule_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduletransitport` ADD CONSTRAINT `scheduletransitport_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `sailingschedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduletransitport` ADD CONSTRAINT `scheduletransitport_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduleroutenode` ADD CONSTRAINT `scheduleroutenode_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `sailingschedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduleroutenode` ADD CONSTRAINT `scheduleroutenode_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedulefetchjob` ADD CONSTRAINT `schedulefetchjob_triggeredByUserId_fkey` FOREIGN KEY (`triggeredByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratequote` ADD CONSTRAINT `ratequote_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratequote` ADD CONSTRAINT `ratequote_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratequote` ADD CONSTRAINT `ratequote_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratequote` ADD CONSTRAINT `ratequote_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratelineitem` ADD CONSTRAINT `ratelineitem_rateQuoteId_fkey` FOREIGN KEY (`rateQuoteId`) REFERENCES `ratequote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingorder` ADD CONSTRAINT `bookingorder_rateQuoteId_fkey` FOREIGN KEY (`rateQuoteId`) REFERENCES `ratequote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingcontainer` ADD CONSTRAINT `bookingcontainer_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `bookingorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingservice` ADD CONSTRAINT `bookingservice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `bookingorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingcostitem` ADD CONSTRAINT `bookingcostitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `bookingorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingtimeline` ADD CONSTRAINT `bookingtimeline_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `bookingorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookingtimeline` ADD CONSTRAINT `bookingtimeline_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

