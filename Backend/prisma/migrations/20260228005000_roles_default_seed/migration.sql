-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_roles_tenant`(`tenant_id`),
    UNIQUE INDEX `uq_roles_tenant_name`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `roles`
  ADD CONSTRAINT `fk_roles_tenant`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Seed default roles for every existing tenant
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `created_at`)
SELECT
  UUID(),
  t.`id`,
  defaults.`name`,
  CURRENT_TIMESTAMP(3)
FROM `tenants` t
CROSS JOIN (
  SELECT 'Administrador' AS `name`
  UNION ALL SELECT 'Supervisor'
  UNION ALL SELECT 'Cajero'
  UNION ALL SELECT 'Inventario'
) defaults
LEFT JOIN `roles` r
  ON r.`tenant_id` = t.`id`
 AND r.`name` = defaults.`name`
WHERE r.`id` IS NULL;
