CREATE TABLE `branches` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    KEY `idx_branches_tenant` (`tenant_id`),
    CONSTRAINT `fk_branches_tenant`
      FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory` (
    `tenant_id` CHAR(36) NOT NULL,
    `branch_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `qty_on_hand` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `reorder_level` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`tenant_id`, `branch_id`, `product_id`),
    CONSTRAINT `fk_inv_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
    CONSTRAINT `fk_inv_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
    CONSTRAINT `fk_inv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
