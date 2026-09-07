SET @add_qty_reserved_sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory'
      AND COLUMN_NAME = 'qty_reserved'
  ) = 0,
  'ALTER TABLE `inventory` ADD COLUMN `qty_reserved` DECIMAL(12, 3) NOT NULL DEFAULT 0 AFTER `qty_on_hand`',
  'SELECT 1'
);
PREPARE add_qty_reserved_stmt FROM @add_qty_reserved_sql;
EXECUTE add_qty_reserved_stmt;
DEALLOCATE PREPARE add_qty_reserved_stmt;

CREATE TABLE IF NOT EXISTS `layaways` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `status` ENUM('active', 'partially_paid', 'completed', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `deposit_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `balance_due` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `cancelled_at` DATETIME(3) NULL,
  `notes` VARCHAR(255) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_layaways_tenant_status_created` (`tenant_id`, `status`, `created_at`),
  KEY `idx_layaways_customer` (`tenant_id`, `customer_id`),
  KEY `idx_layaways_branch` (`tenant_id`, `branch_id`),
  KEY `idx_layaways_branch_fk` (`branch_id`),
  KEY `idx_layaways_customer_fk` (`customer_id`),
  KEY `idx_layaways_created_by_fk` (`created_by`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `layaway_items` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `layaway_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `qty` DECIMAL(12, 3) NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_layaway_items_layaway` (`tenant_id`, `layaway_id`),
  KEY `idx_layaway_items_product` (`tenant_id`, `product_id`),
  KEY `idx_layaway_items_layaway_fk` (`layaway_id`),
  KEY `idx_layaway_items_product_fk` (`product_id`),
  CONSTRAINT `layaway_items_layaway_id_fkey` FOREIGN KEY (`layaway_id`) REFERENCES `layaways`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
