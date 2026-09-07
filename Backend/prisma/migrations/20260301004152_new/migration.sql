/*
  Warnings:

  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `branches` DROP FOREIGN KEY `fk_branches_tenant`;

-- DropForeignKey
ALTER TABLE `inventory` DROP FOREIGN KEY `fk_inv_branch`;

-- DropForeignKey
ALTER TABLE `inventory` DROP FOREIGN KEY `fk_inv_product`;

-- DropForeignKey
ALTER TABLE `inventory` DROP FOREIGN KEY `fk_inv_tenant`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `fk_mov_branch`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `fk_mov_product`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `fk_mov_tenant`;

-- DropForeignKey
ALTER TABLE `inventory_movements` DROP FOREIGN KEY `fk_mov_user`;

-- DropIndex
DROP INDEX `fk_inv_branch` ON `inventory`;

-- DropIndex
DROP INDEX `fk_inv_product` ON `inventory`;

-- DropIndex
DROP INDEX `fk_mov_branch` ON `inventory_movements`;

-- DropIndex
DROP INDEX `fk_mov_user` ON `inventory_movements`;

-- AlterTable
ALTER TABLE `inventory` ALTER COLUMN `updated_at` DROP DEFAULT;

-- DropTable
DROP TABLE IF EXISTS `Customer`;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
