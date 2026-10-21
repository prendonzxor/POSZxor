CREATE TABLE `stock_validation_reports` (
  `id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `snapshot` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_validation_report_session` (`session_id`),
  KEY `idx_stock_validation_reports_tenant` (`tenant_id`, `created_at`),
  CONSTRAINT `fk_stock_validation_report_session` FOREIGN KEY (`session_id`) REFERENCES `stock_validation_sessions` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
