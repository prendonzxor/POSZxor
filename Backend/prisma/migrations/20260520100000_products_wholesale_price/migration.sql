ALTER TABLE `products`
  ADD COLUMN `wholesale_price` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `price`;

UPDATE `products`
SET `wholesale_price` = `price`;
