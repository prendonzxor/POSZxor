CREATE TABLE `customers` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `full_name` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(180) NULL,
    `notes` VARCHAR(255) NULL,
    `credit_limit` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `credit_balance` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    KEY `idx_customers_tenant` (`tenant_id`),
    KEY `idx_customers_phone` (`tenant_id`, `phone`),
    CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
