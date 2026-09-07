CREATE TABLE IF NOT EXISTS `payment_status_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(40) NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `customer_message` VARCHAR(500) NOT NULL,
  `action` VARCHAR(40) NOT NULL DEFAULT 'retry',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_status_messages_provider_status` (`provider`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `payment_status_messages` (`provider`, `status`, `title`, `message`, `customer_message`, `action`) VALUES
('mercado-pago', 'pending', 'Pago pendiente', 'El usuario aun no ha completado el proceso de pago.', 'Tu pago esta pendiente. Completa el pago en el medio seleccionado para continuar.', 'wait'),
('mercado-pago', 'approved', 'Pago aprobado', 'El pago ha sido aprobado y acreditado con exito.', 'Pago aprobado. Puedes continuar con el registro.', 'continue'),
('mercado-pago', 'authorized', 'Pago autorizado', 'El pago ha sido autorizado pero aun no se ha capturado.', 'Tu pago fue autorizado, pero aun no se ha capturado. Espera la confirmacion.', 'wait'),
('mercado-pago', 'in_process', 'Pago en revision', 'El pago esta en proceso de revision.', 'Mercado Pago esta revisando el pago. Intenta nuevamente en unos minutos.', 'wait'),
('mercado-pago', 'in_mediation', 'Pago en mediacion', 'El usuario ha iniciado una disputa.', 'El pago esta en mediacion. Revisa tu cuenta de Mercado Pago.', 'contact_support'),
('mercado-pago', 'rejected', 'Pago rechazado', 'El pago fue rechazado. El usuario puede intentar pagar nuevamente.', 'El pago fue rechazado. Verifica la tarjeta o intenta con otro metodo de pago.', 'retry'),
('mercado-pago', 'canceled', 'Pago cancelado', 'El pago fue cancelado por alguna de las partes o caduco.', 'El pago fue cancelado o caduco. Intenta generar el pago nuevamente.', 'retry'),
('mercado-pago', 'refunded', 'Pago reembolsado', 'El pago fue reembolsado al usuario.', 'El pago fue reembolsado. Usa otro pago aprobado para continuar.', 'retry'),
('mercado-pago', 'charged_back', 'Contracargo realizado', 'Se realizo un contracargo en la tarjeta de credito del comprador.', 'El pago tiene un contracargo. Contacta a soporte o intenta con otro metodo.', 'contact_support')
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `message` = VALUES(`message`),
  `customer_message` = VALUES(`customer_message`),
  `action` = VALUES(`action`),
  `updated_at` = CURRENT_TIMESTAMP(3);
