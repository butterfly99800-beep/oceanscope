-- CreateTable
CREATE TABLE `BookingOrder` (
    `id` VARCHAR(191) NOT NULL,
    `bookingNumber` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
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

    UNIQUE INDEX `BookingOrder_bookingNumber_key`(`bookingNumber`),
    INDEX `BookingOrder_status_idx`(`status`),
    INDEX `BookingOrder_originPortId_idx`(`originPortId`),
    INDEX `BookingOrder_destinationPortId_idx`(`destinationPortId`),
    INDEX `BookingOrder_carrierId_idx`(`carrierId`),
    INDEX `BookingOrder_routeId_idx`(`routeId`),
    INDEX `BookingOrder_rateQuoteId_idx`(`rateQuoteId`),
    INDEX `BookingOrder_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingContainer` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `containerType` ENUM('TWENTY_GP', 'FORTY_GP', 'FORTY_HC', 'FORTY_FIVE_HC') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BookingContainer_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingService` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BookingService_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingCostItem` (
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

    INDEX `BookingCostItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingTimeline` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BookingTimeline_orderId_idx`(`orderId`),
    INDEX `BookingTimeline_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookingOrder` ADD CONSTRAINT `BookingOrder_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingOrder` ADD CONSTRAINT `BookingOrder_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingOrder` ADD CONSTRAINT `BookingOrder_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `Carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingOrder` ADD CONSTRAINT `BookingOrder_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingOrder` ADD CONSTRAINT `BookingOrder_rateQuoteId_fkey` FOREIGN KEY (`rateQuoteId`) REFERENCES `RateQuote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingContainer` ADD CONSTRAINT `BookingContainer_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BookingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingService` ADD CONSTRAINT `BookingService_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BookingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingCostItem` ADD CONSTRAINT `BookingCostItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BookingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingTimeline` ADD CONSTRAINT `BookingTimeline_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `BookingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
