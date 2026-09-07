const crypto = require("crypto");
const prisma = require("../lib/prisma");

async function ensureCardTokensTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS card_tokens (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NULL,
      payment_id CHAR(36) NULL,
      provider VARCHAR(40) NOT NULL DEFAULT 'mercado-pago',
      card_token VARCHAR(255) NOT NULL,
      payer_email VARCHAR(180) NULL,
      payment_method_id VARCHAR(60) NULL,
      issuer_id VARCHAR(40) NULL,
      provider_payment_id VARCHAR(80) NULL,
      provider_status VARCHAR(40) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_card_tokens_tenant (tenant_id),
      KEY idx_card_tokens_payment (payment_id),
      KEY idx_card_tokens_provider_payment (provider, provider_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

async function createCardToken({
  tenantId = null,
  paymentId = null,
  provider = "mercado-pago",
  cardToken,
  payerEmail = null,
  paymentMethodId = null,
  issuerId = null,
}) {
  const normalizedToken = normalizeNullableString(cardToken);
  if (!normalizedToken) {
    return null;
  }

  await ensureCardTokensTable();

  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO card_tokens (
      id,
      tenant_id,
      payment_id,
      provider,
      card_token,
      payer_email,
      payment_method_id,
      issuer_id
    )
    VALUES (
      ${id},
      ${normalizeNullableString(tenantId)},
      ${normalizeNullableString(paymentId)},
      ${provider},
      ${normalizedToken},
      ${normalizeNullableString(payerEmail)},
      ${normalizeNullableString(paymentMethodId)},
      ${normalizeNullableString(issuerId)}
    )
  `;

  return { id };
}

async function updateCardTokenPaymentResult(id, {
  providerPaymentId = null,
  providerStatus = null,
}) {
  if (!id) return null;

  await ensureCardTokensTable();

  await prisma.$executeRaw`
    UPDATE card_tokens
    SET
      provider_payment_id = ${normalizeNullableString(providerPaymentId)},
      provider_status = ${normalizeNullableString(providerStatus)},
      updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ${id}
  `;

  return { id };
}

module.exports = {
  createCardToken,
  ensureCardTokensTable,
  updateCardTokenPaymentResult,
};
