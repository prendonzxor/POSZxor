-- status: 0 created, 1 sent/waiting, 2 received, 3 not approved, 4 approved
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NULL,
  `provider` VARCHAR(40) NOT NULL,
  `endpoint` VARCHAR(120) NOT NULL,
  `idempotency_key` VARCHAR(120) NULL,
  `provider_payment_id` VARCHAR(80) NULL,
  `provider_status` VARCHAR(40) NULL,
  `provider_status_detail` VARCHAR(120) NULL,
  `status` TINYINT NOT NULL DEFAULT 0,
  `request_payload` JSON NULL,
  `response_payload` JSON NULL,
  `error_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payments_tenant` (`tenant_id`),
  KEY `idx_payments_provider_payment` (`provider`, `provider_payment_id`),
  KEY `idx_payments_status` (`status`),
  KEY `idx_payments_idempotency` (`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
