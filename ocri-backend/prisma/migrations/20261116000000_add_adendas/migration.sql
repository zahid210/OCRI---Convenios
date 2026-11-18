-- CreateTable
CREATE TABLE `adendas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `correlative` INTEGER NOT NULL,
    `type` ENUM('ADENDA_PRORROGA', 'ADENDA_MODIFICACION') NOT NULL,
    `status` ENUM('EN_OPINIONES', 'REGISTRADA', 'CANCELADA') NOT NULL DEFAULT 'EN_OPINIONES',
    `description` TEXT NULL,
    `resolution_number` VARCHAR(255) NULL,
    `previous_end_date` DATE NULL,
    `new_end_date` DATE NULL,
    `requires_work_plan` BOOLEAN NOT NULL DEFAULT false,
    `requested_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `registered_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `adendas_agreement_id_status_idx`(`agreement_id`, `status`),
    UNIQUE INDEX `adendas_agreement_id_correlative_key`(`agreement_id`, `correlative`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `adenda_id` BIGINT UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `documents_adenda_id_idx` ON `documents`(`adenda_id`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_adenda_id_fkey` FOREIGN KEY (`adenda_id`) REFERENCES `adendas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- DropIndex
DROP INDEX `opinion_requests_agreement_id_dependencia_id_stage_key` ON `opinion_requests`;

-- AlterTable
ALTER TABLE `opinion_requests` ADD COLUMN `adenda_id` BIGINT UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `opinion_requests_adenda_id_idx` ON `opinion_requests`(`adenda_id`);

-- CreateIndex
CREATE INDEX `opinion_requests_agreement_id_dependencia_id_stage_idx` ON `opinion_requests`(`agreement_id`, `dependencia_id`, `stage`);

-- CreateIndex
CREATE UNIQUE INDEX `opinion_requests_adenda_id_dependencia_id_key` ON `opinion_requests`(`adenda_id`, `dependencia_id`);

-- AddForeignKey
ALTER TABLE `opinion_requests` ADD CONSTRAINT `opinion_requests_adenda_id_fkey` FOREIGN KEY (`adenda_id`) REFERENCES `adendas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `adendas` ADD CONSTRAINT `adendas_agreement_id_fkey` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
