-- CreateTable
CREATE TABLE `RateQuote` (
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

    INDEX `RateQuote_carrierId_idx`(`carrierId`),
    INDEX `RateQuote_routeId_idx`(`routeId`),
    INDEX `RateQuote_originPortId_idx`(`originPortId`),
    INDEX `RateQuote_destinationPortId_idx`(`destinationPortId`),
    INDEX `RateQuote_containerType_idx`(`containerType`),
    INDEX `RateQuote_effectiveFrom_idx`(`effectiveFrom`),
    INDEX `RateQuote_validUntil_idx`(`validUntil`),
    INDEX `RateQuote_status_idx`(`status`),
    INDEX `RateQuote_etd_idx`(`etd`),
    INDEX `RateQuote_eta_idx`(`eta`),
    UNIQUE INDEX `RateQuote_carrierId_originPortId_destinationPortId_serviceNa_key`(`carrierId`, `originPortId`, `destinationPortId`, `serviceName`, `containerType`, `effectiveFrom`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLineItem` (
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

    INDEX `RateLineItem_rateQuoteId_idx`(`rateQuoteId`),
    INDEX `RateLineItem_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RateQuote` ADD CONSTRAINT `RateQuote_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `Carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateQuote` ADD CONSTRAINT `RateQuote_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateQuote` ADD CONSTRAINT `RateQuote_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateQuote` ADD CONSTRAINT `RateQuote_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RateLineItem` ADD CONSTRAINT `RateLineItem_rateQuoteId_fkey` FOREIGN KEY (`rateQuoteId`) REFERENCES `RateQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
