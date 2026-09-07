CREATE TABLE IF NOT EXISTS `card_tokens` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NULL,
  `payment_id` CHAR(36) NULL,
  `provider` VARCHAR(40) NOT NULL DEFAULT 'mercado-pago',
  `card_token` VARCHAR(255) NOT NULL,
  `payer_email` VARCHAR(180) NULL,
  `payment_method_id` VARCHAR(60) NULL,
  `issuer_id` VARCHAR(40) NULL,
  `provider_payment_id` VARCHAR(80) NULL,
  `provider_status` VARCHAR(40) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_card_tokens_tenant` (`tenant_id`),
  KEY `idx_card_tokens_payment` (`payment_id`),
  KEY `idx_card_tokens_provider_payment` (`provider`, `provider_payment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
