ALTER TABLE `branches`
  ADD COLUMN `phone` VARCHAR(30) NULL,
  ADD COLUMN `address_line1` VARCHAR(200) NULL,
  ADD COLUMN `city` VARCHAR(120) NULL,
  ADD COLUMN `state` VARCHAR(120) NULL,
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX `uq_branches_tenant_name` ON `branches`(`tenant_id`, `name`);
