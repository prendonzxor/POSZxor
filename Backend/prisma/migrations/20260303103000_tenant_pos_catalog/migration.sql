-- Add tenant runtime configuration fields
ALTER TABLE `tenants`
  ADD COLUMN `pos_type` ENUM('FERRETERIA','RESTAURANTE','RETAIL','SERVICIOS') NOT NULL DEFAULT 'RETAIL',
  ADD COLUMN `catalog_mode` ENUM('STANDARD','VARIANTS','RECIPES') NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN `ui_preset` ENUM('DEFAULT','COMPACT','TOUCH') NOT NULL DEFAULT 'DEFAULT';

-- Tenant catalogs by business type
CREATE TABLE `tenant_catalogs` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `catalog_key` VARCHAR(100) NOT NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_tenant_catalogs_tenant_key`(`tenant_id`, `catalog_key`),
  INDEX `idx_tenant_catalogs_tenant_enabled`(`tenant_id`, `is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill default catalog configuration for existing tenants.
-- Default RETAIL: products, categories, customers, inventory
INSERT INTO `tenant_catalogs` (`id`, `tenant_id`, `catalog_key`, `is_enabled`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), t.`id`, x.`catalog_key`, 1, x.`sort_order`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `tenants` t
INNER JOIN (
  SELECT 'products' AS `catalog_key`, 1 AS `sort_order`
  UNION ALL SELECT 'categories', 2
  UNION ALL SELECT 'customers', 3
  UNION ALL SELECT 'inventory', 4
) x
WHERE t.`pos_type` = 'RETAIL'
ON DUPLICATE KEY UPDATE
  `is_enabled` = VALUES(`is_enabled`),
  `sort_order` = VALUES(`sort_order`);
