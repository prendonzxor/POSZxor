CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `type` ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  `status` ENUM('unread','read','archived') NOT NULL DEFAULT 'unread',
  `metadata` JSON NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_tenant_status_time` (`tenant_id`, `status`, `created_at`),
  KEY `idx_notifications_tenant_time` (`tenant_id`, `created_at`),
  CONSTRAINT `fk_notifications_tenant`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
