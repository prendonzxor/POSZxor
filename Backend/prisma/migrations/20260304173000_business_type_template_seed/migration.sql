CREATE TABLE `business_type_templates` (
  `id` CHAR(36) NOT NULL,
  `key` VARCHAR(50) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `pos_type` ENUM('FERRETERIA','RESTAURANTE','RETAIL','SERVICIOS') NOT NULL DEFAULT 'RETAIL',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_business_type_templates_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `business_type_template_catalogs` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `catalog_key` VARCHAR(100) NOT NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bt_template_catalog_key` (`template_id`, `catalog_key`),
  KEY `idx_bt_template_catalog_enabled` (`template_id`, `is_enabled`),
  CONSTRAINT `fk_bt_template_catalog_template`
    FOREIGN KEY (`template_id`) REFERENCES `business_type_templates` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `business_type_template_categories` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `estatus` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bt_template_category_name` (`template_id`, `name`),
  KEY `idx_bt_template_category_enabled` (`template_id`, `estatus`),
  CONSTRAINT `fk_bt_template_category_template`
    FOREIGN KEY (`template_id`) REFERENCES `business_type_templates` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_business_type_profiles` (
  `tenant_id` CHAR(36) NOT NULL,
  `business_type` VARCHAR(50) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`tenant_id`),
  KEY `idx_tenant_business_type` (`business_type`),
  CONSTRAINT `fk_tenant_business_type_tenant`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `business_type_templates` (`id`, `key`, `label`, `pos_type`, `is_active`, `created_at`, `updated_at`) VALUES
  (UUID(), 'FERRETERIA', 'Ferreteria', 'FERRETERIA', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'TIENDA_ABARROTES', 'Tienda de abarrotes', 'RETAIL', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'FARMACIA', 'Farmacia', 'RETAIL', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'PAPELERIA', 'Papeleria', 'RETAIL', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'RESTAURANTE', 'Restaurante', 'RESTAURANTE', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'SERVICIOS', 'Servicios', 'SERVICIOS', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `business_type_template_catalogs`
  (`id`, `template_id`, `catalog_key`, `is_enabled`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), t.id, c.catalog_key, 1, c.sort_order, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `business_type_templates` t
JOIN (
  SELECT 'FERRETERIA' AS template_key, 'screws' AS catalog_key, 1 AS sort_order
  UNION ALL SELECT 'FERRETERIA', 'nuts', 2
  UNION ALL SELECT 'FERRETERIA', 'washers', 3
  UNION ALL SELECT 'FERRETERIA', 'products', 4
  UNION ALL SELECT 'FERRETERIA', 'categories', 5
  UNION ALL SELECT 'FERRETERIA', 'customers', 6
  UNION ALL SELECT 'FERRETERIA', 'inventory', 7

  UNION ALL SELECT 'TIENDA_ABARROTES', 'products', 1
  UNION ALL SELECT 'TIENDA_ABARROTES', 'categories', 2
  UNION ALL SELECT 'TIENDA_ABARROTES', 'customers', 3
  UNION ALL SELECT 'TIENDA_ABARROTES', 'inventory', 4

  UNION ALL SELECT 'FARMACIA', 'products', 1
  UNION ALL SELECT 'FARMACIA', 'categories', 2
  UNION ALL SELECT 'FARMACIA', 'customers', 3
  UNION ALL SELECT 'FARMACIA', 'inventory', 4

  UNION ALL SELECT 'PAPELERIA', 'products', 1
  UNION ALL SELECT 'PAPELERIA', 'categories', 2
  UNION ALL SELECT 'PAPELERIA', 'customers', 3
  UNION ALL SELECT 'PAPELERIA', 'inventory', 4

  UNION ALL SELECT 'RESTAURANTE', 'menu', 1
  UNION ALL SELECT 'RESTAURANTE', 'tables', 2
  UNION ALL SELECT 'RESTAURANTE', 'customers', 3
  UNION ALL SELECT 'RESTAURANTE', 'inventory', 4

  UNION ALL SELECT 'SERVICIOS', 'services', 1
  UNION ALL SELECT 'SERVICIOS', 'customers', 2
  UNION ALL SELECT 'SERVICIOS', 'appointments', 3
) c ON c.template_key = t.`key`;

INSERT INTO `business_type_template_categories`
  (`id`, `template_id`, `name`, `estatus`, `sort_order`, `created_at`, `updated_at`)
SELECT UUID(), t.id, c.category_name, 1, c.sort_order, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `business_type_templates` t
JOIN (
  SELECT 'FERRETERIA' AS template_key, 'Tornillos' AS category_name, 1 AS sort_order
  UNION ALL SELECT 'FERRETERIA', 'Tuercas', 2
  UNION ALL SELECT 'FERRETERIA', 'Rondanas', 3
  UNION ALL SELECT 'FERRETERIA', 'Herramientas', 4

  UNION ALL SELECT 'TIENDA_ABARROTES', 'Bebidas', 1
  UNION ALL SELECT 'TIENDA_ABARROTES', 'Botanas', 2
  UNION ALL SELECT 'TIENDA_ABARROTES', 'Limpieza', 3
  UNION ALL SELECT 'TIENDA_ABARROTES', 'Despensa', 4

  UNION ALL SELECT 'FARMACIA', 'Medicamentos', 1
  UNION ALL SELECT 'FARMACIA', 'Cuidado personal', 2
  UNION ALL SELECT 'FARMACIA', 'Suplementos', 3
  UNION ALL SELECT 'FARMACIA', 'Primeros auxilios', 4

  UNION ALL SELECT 'PAPELERIA', 'Cuadernos', 1
  UNION ALL SELECT 'PAPELERIA', 'Lapices y plumas', 2
  UNION ALL SELECT 'PAPELERIA', 'Impresion', 3
  UNION ALL SELECT 'PAPELERIA', 'Manualidades', 4

  UNION ALL SELECT 'RESTAURANTE', 'Entradas', 1
  UNION ALL SELECT 'RESTAURANTE', 'Platos fuertes', 2
  UNION ALL SELECT 'RESTAURANTE', 'Bebidas', 3
  UNION ALL SELECT 'RESTAURANTE', 'Postres', 4

  UNION ALL SELECT 'SERVICIOS', 'Consultoria', 1
  UNION ALL SELECT 'SERVICIOS', 'Mantenimiento', 2
  UNION ALL SELECT 'SERVICIOS', 'Instalacion', 3
  UNION ALL SELECT 'SERVICIOS', 'Soporte', 4
) c ON c.template_key = t.`key`;
