-- AlterTable
ALTER TABLE `bookingtimeline` ADD COLUMN `actorName` VARCHAR(160) NULL,
    ADD COLUMN `actorRole` ENUM('CUSTOMER', 'ADMIN') NULL,
    ADD COLUMN `actorUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `BookingTimeline_actorUserId_idx` ON `BookingTimeline`(`actorUserId`);

-- AddForeignKey
ALTER TABLE `BookingTimeline` ADD CONSTRAINT `BookingTimeline_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
