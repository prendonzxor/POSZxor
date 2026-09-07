CREATE TABLE `inventory_movements` (
    `id` CHAR(36) NOT NULL,
    `tenant_id` CHAR(36) NOT NULL,
    `branch_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `type` ENUM('purchase','sale','adjustment','return','transfer_in','transfer_out') NOT NULL,
    `qty_delta` DECIMAL(12,3) NOT NULL,
    `unit_cost` DECIMAL(10,2) NULL,
    `reference_type` VARCHAR(40) NULL,
    `reference_id` CHAR(36) NULL,
    `note` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    KEY `idx_mov_tenant_branch_time` (`tenant_id`, `branch_id`, `created_at`),
    KEY `idx_mov_product` (`product_id`, `created_at`),
    CONSTRAINT `fk_mov_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
    CONSTRAINT `fk_mov_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
    CONSTRAINT `fk_mov_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
    CONSTRAINT `fk_mov_user` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
