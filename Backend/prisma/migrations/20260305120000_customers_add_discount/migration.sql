ALTER TABLE `customers`
  ADD COLUMN `discount` DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER `credit_balance`;
