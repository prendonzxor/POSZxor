ALTER TABLE `orders`
  ADD COLUMN `num_order` VARCHAR(20) NULL AFTER `id`;

CREATE UNIQUE INDEX `uq_orders_tenant_num_order` ON `orders` (`tenant_id`, `num_order`);
