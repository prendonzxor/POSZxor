ALTER TABLE `stock_validation_sessions`
  DROP INDEX `uq_stock_validation_session_period`,
  ADD INDEX `idx_stock_validation_session_period` (`tenant_id`, `branch_id`, `period_key`, `created_at`);
