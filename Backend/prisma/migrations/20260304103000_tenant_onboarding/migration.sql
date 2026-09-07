ALTER TABLE `tenants`
  ADD COLUMN `onboarding_step` INT NOT NULL DEFAULT 1,
  ADD COLUMN `onboarding_completed` TINYINT(1) NOT NULL DEFAULT 0;
