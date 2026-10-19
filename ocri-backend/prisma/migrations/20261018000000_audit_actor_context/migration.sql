-- Contexto del actor en el registro de auditoría (hallazgo B2-9).
-- Permite rastrear el origen de los intentos de login/logout (IP y cliente).
ALTER TABLE `audit_logs`
  ADD COLUMN `ip` VARCHAR(45) NULL,
  ADD COLUMN `user_agent` VARCHAR(255) NULL;
