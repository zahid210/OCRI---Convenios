-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'viewer', 'asistente', 'procesador') NOT NULL DEFAULT 'viewer',
    `token_version` INTEGER NOT NULL DEFAULT 0,
    `password_changed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `users_email_unique`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `institutions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `country` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL DEFAULT 'Publica',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `institutions_country_index`(`country`),
    INDEX `institutions_name_index`(`name`),
    INDEX `institutions_type_index`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreement_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dependencias` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `kind` ENUM('RECTORADO', 'OCRI', 'UNIDAD_ORGANICA') NOT NULL,
    `email` VARCHAR(255) NULL,
    `is_default_opinion` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `dependencias_code_key`(`code`),
    INDEX `dependencias_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `direction` ENUM('ENTRADA', 'SALIDA', 'INTERNO') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `document_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tramite_code` VARCHAR(30) NOT NULL,
    `title` VARCHAR(510) NOT NULL,
    `name` VARCHAR(500) NULL,
    `applicant_name` VARCHAR(255) NULL,
    `applicant_email` VARCHAR(255) NULL,
    `applicant_unit` VARCHAR(255) NULL,
    `rectorate_oficio_number` VARCHAR(80) NULL,
    `institution_id` BIGINT UNSIGNED NOT NULL,
    `agreement_type_id` BIGINT UNSIGNED NOT NULL,
    `resolution_number` VARCHAR(255) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `drive_link` VARCHAR(500) NULL,
    `process_status` ENUM('RECEPCIONADA', 'OPINIONES_EN_CURSO', 'OPINIONES_COMPLETAS', 'EXPEDIENTE_TECNICO_LISTO', 'ENVIADO_A_RECTORADO', 'NO_SUSCRITO', 'SUSCRITO', 'REGISTRADO', 'PUBLICADO', 'EN_SEGUIMIENTO', 'SEGUIMIENTO_CONCLUIDO') NOT NULL DEFAULT 'RECEPCIONADA',
    `validity_status` ENUM('PENDIENTE', 'VIGENTE', 'SUSPENDIDO', 'RESCINDIDO', 'VENCIDO') NOT NULL DEFAULT 'PENDIENTE',
    `stage` ENUM('ETAPA_1_PROPUESTA', 'ETAPA_2_REGISTRO', 'ETAPA_3_SEGUIMIENTO') NOT NULL DEFAULT 'ETAPA_1_PROPUESTA',
    `rectorate_decision` ENUM('APPROVED', 'REJECTED') NULL,
    `rectorate_decision_at` TIMESTAMP(0) NULL,
    `notified_solicitante_at` TIMESTAMP(0) NULL,
    `published_at` TIMESTAMP(0) NULL,
    `registered_at` TIMESTAMP(0) NULL,
    `monitoring_concluded_at` TIMESTAMP(0) NULL,
    `observations` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `agreements_tramite_code_key`(`tramite_code`),
    UNIQUE INDEX `agreements_resolution_number_unique`(`resolution_number`),
    INDEX `agreements_agreement_type_id_foreign`(`agreement_type_id`),
    INDEX `agreements_end_date_index`(`end_date`),
    INDEX `agreements_institution_id_foreign`(`institution_id`),
    INDEX `agreements_start_date_index`(`start_date`),
    INDEX `agreements_process_status_idx`(`process_status`),
    INDEX `agreements_validity_status_idx`(`validity_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreement_responsables` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `role` VARCHAR(150) NULL,
    `side` ENUM('UNCP', 'CONTRAPARTE') NOT NULL DEFAULT 'UNCP',
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `agreement_responsables_agreement_id_idx`(`agreement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NULL,
    `extension` VARCHAR(10) NULL,
    `document_type_id` BIGINT UNSIGNED NULL,
    `direction` ENUM('ENTRADA', 'SALIDA', 'INTERNO') NULL,
    `stage` ENUM('ETAPA_1_PROPUESTA', 'ETAPA_2_REGISTRO', 'ETAPA_3_SEGUIMIENTO') NULL,
    `opinion_request_id` BIGINT UNSIGNED NULL,
    `deliverable_id` BIGINT UNSIGNED NULL,
    `uploaded_by_id` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `documents_agreement_id_foreign`(`agreement_id`),
    INDEX `documents_document_type_id_idx`(`document_type_id`),
    INDEX `documents_opinion_request_id_idx`(`opinion_request_id`),
    INDEX `documents_deliverable_id_idx`(`deliverable_id`),
    INDEX `documents_agreement_id_stage_idx`(`agreement_id`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opinion_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `dependencia_id` BIGINT UNSIGNED NOT NULL,
    `stage` ENUM('ETAPA_1_PROPUESTA', 'ETAPA_2_REGISTRO', 'ETAPA_3_SEGUIMIENTO') NOT NULL DEFAULT 'ETAPA_1_PROPUESTA',
    `status` ENUM('GENERADA', 'ENVIADA', 'RESPONDIDA', 'VALIDADA', 'OBSERVADA', 'CANCELADA') NOT NULL DEFAULT 'GENERADA',
    `oficio_number` VARCHAR(80) NULL,
    `directed_to` VARCHAR(255) NULL,
    `sent_via` VARCHAR(20) NULL,
    `adesa_number` VARCHAR(80) NULL,
    `sent_at` TIMESTAMP(0) NULL,
    `due_at` DATE NULL,
    `response_date` DATE NULL,
    `validated_at` TIMESTAMP(0) NULL,
    `observations` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `opinion_requests_agreement_id_idx`(`agreement_id`),
    INDEX `opinion_requests_response_date_idx`(`response_date`),
    INDEX `opinion_requests_status_due_at_idx`(`status`, `due_at`),
    INDEX `opinion_requests_dependencia_id_idx`(`dependencia_id`),
    UNIQUE INDEX `opinion_requests_agreement_id_dependencia_id_stage_key`(`agreement_id`, `dependencia_id`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `opinion_request_id` BIGINT UNSIGNED NULL,
    `stage` ENUM('ETAPA_1_PROPUESTA', 'ETAPA_2_REGISTRO', 'ETAPA_3_SEGUIMIENTO') NULL,
    `event_type` VARCHAR(60) NOT NULL,
    `description` VARCHAR(500) NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `from_value` VARCHAR(60) NULL,
    `to_value` VARCHAR(60) NULL,
    `occurred_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `metadata` JSON NULL,

    INDEX `process_events_agreement_id_occurred_at_idx`(`agreement_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `entity` VARCHAR(60) NOT NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(20) NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `actor_email` VARCHAR(255) NULL,
    `actor_role` VARCHAR(30) NULL,
    `description` VARCHAR(500) NULL,
    `changes` JSON NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverables` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agreement_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('PLAN_DE_TRABAJO', 'INFORME_SEMESTRAL', 'INFORME_FINAL') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` ENUM('SOLICITADO', 'ACEPTADO', 'RECIBIDO', 'OBSERVADO', 'REGISTRADO') NOT NULL DEFAULT 'SOLICITADO',
    `period` VARCHAR(50) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `requested_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `submitted_at` TIMESTAMP(0) NULL,
    `registered_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `deliverables_agreement_id_idx`(`agreement_id`),
    INDEX `deliverables_agreement_id_type_idx`(`agreement_id`, `type`),
    INDEX `deliverables_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverable_observations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `deliverable_id` BIGINT UNSIGNED NOT NULL,
    `comment` TEXT NOT NULL,
    `created_by_id` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `deliverable_observations_deliverable_id_idx`(`deliverable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_config` (
    `key` VARCHAR(80) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `updated_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_acknowledgements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `read_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `notification_acknowledgements_user_id_idx`(`user_id`),
    UNIQUE INDEX `notification_acknowledgements_user_id_key_key`(`user_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agreements` ADD CONSTRAINT `agreements_institution_id_foreign` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `agreements` ADD CONSTRAINT `agreements_agreement_type_id_foreign` FOREIGN KEY (`agreement_type_id`) REFERENCES `agreement_types`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `agreement_responsables` ADD CONSTRAINT `agreement_responsables_agreement_id_foreign` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_agreement_id_foreign` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_opinion_request_id_fkey` FOREIGN KEY (`opinion_request_id`) REFERENCES `opinion_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `opinion_requests` ADD CONSTRAINT `opinion_requests_agreement_id_fkey` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `opinion_requests` ADD CONSTRAINT `opinion_requests_dependencia_id_fkey` FOREIGN KEY (`dependencia_id`) REFERENCES `dependencias`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `process_events` ADD CONSTRAINT `process_events_agreement_id_fkey` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_agreement_id_fkey` FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `deliverable_observations` ADD CONSTRAINT `deliverable_observations_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `deliverable_observations` ADD CONSTRAINT `deliverable_observations_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

