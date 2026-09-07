const prisma = require("../lib/prisma");

const DEFAULT_PAYMENT_STATUS_MESSAGES = [
  {
    provider: "mercado-pago",
    status: "pending",
    title: "Pago pendiente",
    message: "El usuario aun no ha completado el proceso de pago.",
    customerMessage: "Tu pago esta pendiente. Completa el pago en el medio seleccionado para continuar.",
    action: "wait",
  },
  {
    provider: "mercado-pago",
    status: "approved",
    title: "Pago aprobado",
    message: "El pago ha sido aprobado y acreditado con exito.",
    customerMessage: "Pago aprobado. Puedes continuar con el registro.",
    action: "continue",
  },
  {
    provider: "mercado-pago",
    status: "authorized",
    title: "Pago autorizado",
    message: "El pago ha sido autorizado pero aun no se ha capturado.",
    customerMessage: "Tu pago fue autorizado, pero aun no se ha capturado. Espera la confirmacion.",
    action: "wait",
  },
  {
    provider: "mercado-pago",
    status: "in_process",
    title: "Pago en revision",
    message: "El pago esta en proceso de revision.",
    customerMessage: "Mercado Pago esta revisando el pago. Intenta nuevamente en unos minutos.",
    action: "wait",
  },
  {
    provider: "mercado-pago",
    status: "in_mediation",
    title: "Pago en mediacion",
    message: "El usuario ha iniciado una disputa.",
    customerMessage: "El pago esta en mediacion. Revisa tu cuenta de Mercado Pago.",
    action: "contact_support",
  },
  {
    provider: "mercado-pago",
    status: "rejected",
    title: "Pago rechazado",
    message: "El pago fue rechazado. El usuario puede intentar pagar nuevamente.",
    customerMessage: "El pago fue rechazado. Verifica la tarjeta o intenta con otro metodo de pago.",
    action: "retry",
  },
  {
    provider: "mercado-pago",
    status: "canceled",
    title: "Pago cancelado",
    message: "El pago fue cancelado por alguna de las partes o caduco.",
    customerMessage: "El pago fue cancelado o caduco. Intenta generar el pago nuevamente.",
    action: "retry",
  },
  {
    provider: "mercado-pago",
    status: "refunded",
    title: "Pago reembolsado",
    message: "El pago fue reembolsado al usuario.",
    customerMessage: "El pago fue reembolsado. Usa otro pago aprobado para continuar.",
    action: "retry",
  },
  {
    provider: "mercado-pago",
    status: "charged_back",
    title: "Contracargo realizado",
    message: "Se realizo un contracargo en la tarjeta de credito del comprador.",
    customerMessage: "El pago tiene un contracargo. Contacta a soporte o intenta con otro metodo.",
    action: "contact_support",
  },
];

function normalizeRow(row) {
  if (!row) return null;

  return {
    provider: String(row.provider || "mercado-pago"),
    status: String(row.status || ""),
    title: String(row.title || ""),
    message: String(row.message || ""),
    customerMessage: String(row.customerMessage || row.customer_message || row.message || ""),
    action: String(row.action || "retry"),
  };
}

function getDefaultPaymentStatusMessage(provider, status) {
  const normalizedProvider = String(provider || "mercado-pago").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim().toLowerCase();

  return (
    DEFAULT_PAYMENT_STATUS_MESSAGES.find(
      (item) => item.provider === normalizedProvider && item.status === normalizedStatus,
    ) || {
      provider: normalizedProvider,
      status: normalizedStatus || "unknown",
      title: "Estado de pago no reconocido",
      message: "Mercado Pago devolvio un estado no reconocido por el sistema.",
      customerMessage: "No pudimos confirmar el estado del pago. Intenta nuevamente o contacta a soporte.",
      action: "retry",
    }
  );
}

async function ensurePaymentStatusMessagesTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS payment_status_messages (
      id INT NOT NULL AUTO_INCREMENT,
      provider VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL,
      title VARCHAR(120) NOT NULL,
      message VARCHAR(500) NOT NULL,
      customer_message VARCHAR(500) NOT NULL,
      action VARCHAR(40) NOT NULL DEFAULT 'retry',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uq_payment_status_messages_provider_status (provider, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  for (const item of DEFAULT_PAYMENT_STATUS_MESSAGES) {
    await prisma.$executeRaw`
      INSERT INTO payment_status_messages (
        provider,
        status,
        title,
        message,
        customer_message,
        action
      )
      VALUES (
        ${item.provider},
        ${item.status},
        ${item.title},
        ${item.message},
        ${item.customerMessage},
        ${item.action}
      )
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        message = VALUES(message),
        customer_message = VALUES(customer_message),
        action = VALUES(action),
        updated_at = CURRENT_TIMESTAMP(3)
    `;
  }
}

async function getPaymentStatusMessage({ provider = "mercado-pago", status }) {
  const normalizedProvider = String(provider || "mercado-pago").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (!normalizedStatus) {
    return getDefaultPaymentStatusMessage(normalizedProvider, normalizedStatus);
  }

  try {
    await ensurePaymentStatusMessagesTable();
    const rows = await prisma.$queryRaw`
      SELECT
        provider,
        status,
        title,
        message,
        customer_message AS customerMessage,
        action
      FROM payment_status_messages
      WHERE provider = ${normalizedProvider}
        AND status = ${normalizedStatus}
      LIMIT 1
    `;

    return normalizeRow(rows[0]) || getDefaultPaymentStatusMessage(normalizedProvider, normalizedStatus);
  } catch (error) {
    console.error("error al obtener mensaje de estado de pago", error);
    return getDefaultPaymentStatusMessage(normalizedProvider, normalizedStatus);
  }
}

module.exports = {
  DEFAULT_PAYMENT_STATUS_MESSAGES,
  ensurePaymentStatusMessagesTable,
  getDefaultPaymentStatusMessage,
  getPaymentStatusMessage,
};
