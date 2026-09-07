-- Expand tenants table to the new structure
ALTER TABLE `tenants`
  ADD COLUMN `legal_name` VARCHAR(180) NULL,
  ADD COLUMN `commercial_name` VARCHAR(180) NULL,
  ADD COLUMN `rfc` VARCHAR(13) NULL,
  ADD COLUMN `phone` VARCHAR(30) NULL,
  ADD COLUMN `email` VARCHAR(180) NULL,
  ADD COLUMN `country` VARCHAR(2) NOT NULL DEFAULT 'MX',
  ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN `address_line1` VARCHAR(200) NULL,
  ADD COLUMN `address_line2` VARCHAR(200) NULL,
  ADD COLUMN `city` VARCHAR(120) NULL,
  ADD COLUMN `state` VARCHAR(120) NULL,
  ADD COLUMN `postal_code` VARCHAR(15) NULL,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;

UPDATE `tenants`
SET `legal_name` = COALESCE(`legal_name`, `name`);

ALTER TABLE `tenants`
  MODIFY `legal_name` VARCHAR(180) NOT NULL;

ALTER TABLE `tenants`
  DROP COLUMN `name`;

CREATE UNIQUE INDEX `uq_tenants_rfc` ON `tenants`(`rfc`);
CREATE INDEX `idx_tenants_active` ON `tenants`(`is_active`);

-- Add tenant_id to existing users and backfill with generated tenant rows
ALTER TABLE `User`
  ADD COLUMN `tenant_id` CHAR(36) NULL;

UPDATE `User`
SET `tenant_id` = UUID()
WHERE `tenant_id` IS NULL;

INSERT INTO `tenants` (
  `id`,
  `legal_name`,
  `commercial_name`,
  `rfc`,
  `phone`,
  `email`,
  `country`,
  `timezone`,
  `address_line1`,
  `address_line2`,
  `city`,
  `state`,
  `postal_code`,
  `created_at`,
  `updated_at`,
  `is_active`
)
SELECT
  u.`tenant_id`,
  CONCAT('Tenant usuario ', u.`id`),
  NULL,
  NULL,
  u.`phoneNumber`,
  NULL,
  'MX',
  'America/Mexico_City',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3),
  1
FROM `User` u
LEFT JOIN `tenants` t ON t.`id` = u.`tenant_id`
WHERE t.`id` IS NULL;

ALTER TABLE `User`
  MODIFY `tenant_id` CHAR(36) NOT NULL;

CREATE INDEX `idx_users_tenant` ON `User`(`tenant_id`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
