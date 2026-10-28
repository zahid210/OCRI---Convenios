-- 1. Eliminar dependencias que ya no aplican (conservando únicamente las canónicas: VRI, VRAC, CEPRE, VRAD, CEID, OAJ)
DELETE FROM `dependencias` WHERE `code` NOT IN ('VRI', 'VRAC', 'CEPRE', 'VRAD', 'CEID', 'OAJ');

-- 2. Eliminar índice sobre is_active
DROP INDEX `dependencias_is_active_idx` ON `dependencias`;

-- 3. Eliminar columnas innecesarias de dependencias
ALTER TABLE `dependencias`
    DROP COLUMN `kind`,
    DROP COLUMN `email`,
    DROP COLUMN `is_default_opinion`,
    DROP COLUMN `sort_order`,
    DROP COLUMN `is_active`;
