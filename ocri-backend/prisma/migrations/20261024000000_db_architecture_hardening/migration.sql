-- =============================================================================
-- Migración de endurecimiento arquitectónico de Base de Datos (BD-1 a BD-7)
-- =============================================================================

-- 1. Backfill de marcas de tiempo NULL existentes y sincronización de vigencia (BD-3, BD-5)
UPDATE `users` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `agreement_types` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `dependencias` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `agreement_responsables` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `institutions` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `agreements` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `documents` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `opinion_requests` SET `created_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP(0)), `updated_at` = COALESCE(`updated_at`, `created_at`, CURRENT_TIMESTAMP(0)) WHERE `created_at` IS NULL OR `updated_at` IS NULL;
UPDATE `app_config` SET `updated_at` = COALESCE(`updated_at`, CURRENT_TIMESTAMP(0)) WHERE `updated_at` IS NULL;

UPDATE `agreements` SET `validity_status` = 'VENCIDO' WHERE `validity_status` = 'VIGENTE' AND `end_date` IS NOT NULL AND `end_date` < CURDATE();

-- 2. Eliminación de claves foráneas previas con ON DELETE NO ACTION en columnas anulables (BD-1)
-- DropForeignKey
ALTER TABLE `deliverable_observations` DROP FOREIGN KEY `deliverable_observations_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_document_type_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_uploaded_by_id_fkey`;

-- 3. Eliminación de índice redundante cubierto por UNIQUE(user_id, key) (BD-7)
-- DropIndex
DROP INDEX `notification_acknowledgements_user_id_idx` ON `notification_acknowledgements`;

-- 4. Valores por defecto CURRENT_TIMESTAMP(0) en columnas de auditoría (BD-2, BD-3)
-- AlterTable
ALTER TABLE `agreement_responsables` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `agreement_types` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `agreements` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `app_config` MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `audit_logs` MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `dependencias` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `documents` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `institutions` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `opinion_requests` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `users` MODIFY `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0);

-- 5. Nuevos índices de unicidad y rendimiento (BD-4, BD-7)
-- CreateIndex
CREATE UNIQUE INDEX `agreement_types_name_key` ON `agreement_types`(`name`);

-- CreateIndex
CREATE INDEX `agreements_stage_idx` ON `agreements`(`stage`);

-- CreateIndex
CREATE INDEX `process_events_opinion_request_id_idx` ON `process_events`(`opinion_request_id`);

-- 6. Claves foráneas con políticas ON DELETE SET NULL / CASCADE coherentes (BD-1)
-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `process_events` ADD CONSTRAINT `process_events_opinion_request_id_fkey` FOREIGN KEY (`opinion_request_id`) REFERENCES `opinion_requests`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `deliverable_observations` ADD CONSTRAINT `deliverable_observations_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification_acknowledgements` ADD CONSTRAINT `notification_acknowledgements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- 7. Estandarización de índices de audit_logs frente a schema.prisma (BD-2)
-- RedefineIndex
CREATE INDEX `audit_logs_action_created_at_idx` ON `audit_logs`(`action`, `created_at`);
DROP INDEX IF EXISTS `idx_audit_action_created` ON `audit_logs`;

-- RedefineIndex
CREATE INDEX `audit_logs_actor_email_idx` ON `audit_logs`(`actor_email`);
DROP INDEX IF EXISTS `idx_audit_actor_email` ON `audit_logs`;

-- RedefineIndex
CREATE INDEX `audit_logs_actor_user_id_created_at_idx` ON `audit_logs`(`actor_user_id`, `created_at`);
DROP INDEX IF EXISTS `idx_audit_actor_user_created` ON `audit_logs`;
