const crypto = require("crypto");
const prisma = require("../lib/prisma");

const PAYMENT_LOG_STATUS = {
  CREATED: 0,
  SENT_OR_WAITING: 1,
  RECEIVED: 2,
  NOT_APPROVED: 3,
  APPROVED: 4,
};

function maskSensitivePaymentData(value) {
  if (Array.isArray(value)) {
    return value.map(maskSensitivePaymentData);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === "token" || normalizedKey.includes("card_token")) {
        return [key, entry ? "***masked***" : entry];
      }

      return [key, maskSensitivePaymentData(entry)];
    }),
  );
}

function toJsonValue(value) {
  return JSON.stringify(value ?? null);
}

function normalizePaymentLogRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    provider: String(row.provider || ""),
    endpoint: String(row.endpoint || ""),
    idempotencyKey: row.idempotencyKey ? String(row.idempotencyKey) : null,
    providerPaymentId: row.providerPaymentId ? String(row.providerPaymentId) : null,
    providerStatus: row.providerStatus ? String(row.providerStatus) : null,
    providerStatusDetail: row.providerStatusDetail ? String(row.providerStatusDetail) : null,
    status: Number(row.status || 0),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function ensurePaymentLogsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NULL,
      provider VARCHAR(40) NOT NULL,
      endpoint VARCHAR(120) NOT NULL,
      idempotency_key VARCHAR(120) NULL,
      provider_payment_id VARCHAR(80) NULL,
      provider_status VARCHAR(40) NULL,
      provider_status_detail VARCHAR(120) NULL,
      status TINYINT NOT NULL DEFAULT 0,
      request_payload JSON NULL,
      response_payload JSON NULL,
      error_payload JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_payments_tenant (tenant_id),
      KEY idx_payments_provider_payment (provider, provider_payment_id),
      KEY idx_payments_status (status),
      KEY idx_payments_idempotency (idempotency_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
}

async function createPaymentLog({
  tenantId = null,
  provider = "mercado-pago",
  endpoint = "/v1/payments",
  idempotencyKey = null,
  requestPayload = null,
}) {
  await ensurePaymentLogsTable();

  const id = crypto.randomUUID();
  const safeRequestPayload = maskSensitivePaymentData(requestPayload);

  await prisma.$executeRaw`
    INSERT INTO payments (
      id,
      tenant_id,
      provider,
      endpoint,
      idempotency_key,
      status,
      request_payload
    )
    VALUES (
      ${id},
      ${tenantId},
      ${provider},
      ${endpoint},
      ${idempotencyKey},
      ${PAYMENT_LOG_STATUS.CREATED},
      ${toJsonValue(safeRequestPayload)}
    )
  `;

  return {
    id,
    status: PAYMENT_LOG_STATUS.CREATED,
  };
}

async function updatePaymentLog(id, {
  status,
  responsePayload = undefined,
  errorPayload = undefined,
  providerPaymentId = undefined,
  providerStatus = undefined,
  providerStatusDetail = undefined,
}) {
  await ensurePaymentLogsTable();

  await prisma.$executeRaw`
    UPDATE payments
    SET
      status = ${status},
      response_payload = IF(${responsePayload === undefined}, response_payload, ${toJsonValue(responsePayload)}),
      error_payload = IF(${errorPayload === undefined}, error_payload, ${toJsonValue(errorPayload)}),
      provider_payment_id = IF(${providerPaymentId === undefined}, provider_payment_id, ${providerPaymentId ?? null}),
      provider_status = IF(${providerStatus === undefined}, provider_status, ${providerStatus ?? null}),
      provider_status_detail = IF(${providerStatusDetail === undefined}, provider_status_detail, ${providerStatusDetail ?? null}),
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ${id}
  `;

  return {
    id,
    status,
  };
}

module.exports = {
  PAYMENT_LOG_STATUS,
  createPaymentLog,
  ensurePaymentLogsTable,
  maskSensitivePaymentData,
  normalizePaymentLogRow,
  updatePaymentLog,
};
