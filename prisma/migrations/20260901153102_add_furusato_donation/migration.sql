-- CreateTable
CREATE TABLE `FurusatoDonation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `donatedAt` DATETIME(3) NOT NULL,
    `municipality` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `returnItem` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `portalSite` VARCHAR(191) NULL,
    `oneStopStatus` VARCHAR(191) NOT NULL DEFAULT 'notApplied',
    `certificateStatus` VARCHAR(191) NOT NULL DEFAULT 'notReceived',
    `memo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `FurusatoDonation_userId_year_idx`(`userId`, `year`),
    INDEX `FurusatoDonation_userId_donatedAt_idx`(`userId`, `donatedAt`),
    INDEX `FurusatoDonation_userId_deletedAt_idx`(`userId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FurusatoDonation` ADD CONSTRAINT `FurusatoDonation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

