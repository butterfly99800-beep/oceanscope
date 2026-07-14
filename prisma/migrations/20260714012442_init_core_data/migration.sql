-- CreateTable
CREATE TABLE `Port` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameZh` VARCHAR(191) NULL,
    `locode` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NULL,
    `region` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Port_locode_key`(`locode`),
    INDEX `Port_country_idx`(`country`),
    INDEX `Port_region_idx`(`region`),
    INDEX `Port_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Carrier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameZh` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Carrier_code_key`(`code`),
    INDEX `Carrier_country_idx`(`country`),
    INDEX `Carrier_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Route` (
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

    INDEX `Route_carrierId_idx`(`carrierId`),
    INDEX `Route_originPortId_idx`(`originPortId`),
    INDEX `Route_destinationPortId_idx`(`destinationPortId`),
    INDEX `Route_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RouteTransitPort` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `portId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RouteTransitPort_portId_idx`(`portId`),
    UNIQUE INDEX `RouteTransitPort_routeId_sequence_key`(`routeId`, `sequence`),
    UNIQUE INDEX `RouteTransitPort_routeId_portId_key`(`routeId`, `portId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Route` ADD CONSTRAINT `Route_carrierId_fkey` FOREIGN KEY (`carrierId`) REFERENCES `Carrier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Route` ADD CONSTRAINT `Route_originPortId_fkey` FOREIGN KEY (`originPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Route` ADD CONSTRAINT `Route_destinationPortId_fkey` FOREIGN KEY (`destinationPortId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RouteTransitPort` ADD CONSTRAINT `RouteTransitPort_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RouteTransitPort` ADD CONSTRAINT `RouteTransitPort_portId_fkey` FOREIGN KEY (`portId`) REFERENCES `Port`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
