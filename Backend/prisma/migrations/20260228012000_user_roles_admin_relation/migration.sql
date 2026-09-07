-- CreateTable
CREATE TABLE `user_roles` (
    `id` CHAR(36) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_roles_user`(`user_id`),
    INDEX `idx_user_roles_role`(`role_id`),
    UNIQUE INDEX `uq_user_roles_user_role`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_user`
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_role`
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
  ON DELETE CASCADE ON UPDATE RESTRICT;

-- Backfill: relate existing users with Administrador role for their tenant
INSERT INTO `user_roles` (`id`, `user_id`, `role_id`, `created_at`)
SELECT
  UUID(),
  u.`id`,
  r.`id`,
  CURRENT_TIMESTAMP(3)
FROM `User` u
INNER JOIN `roles` r
  ON r.`tenant_id` = u.`tenant_id`
 AND r.`name` = 'Administrador'
LEFT JOIN `user_roles` ur
  ON ur.`user_id` = u.`id`
 AND ur.`role_id` = r.`id`
WHERE ur.`id` IS NULL;
