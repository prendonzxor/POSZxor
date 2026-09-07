const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  createCardToken,
  updateCardTokenPaymentResult,
} = require("../services/card-token.service");
const {
  PAYMENT_LOG_STATUS,
  createPaymentLog,
  updatePaymentLog,
} = require("../services/payment-log.service");
const { getPaymentStatusMessage } = require("../services/payment-status-message.service");
const { createMercadoPagoPayment } = require("../services/providers/mercado-pago.service");

const router = express.Router();

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function getMercadoPagoDeviceSessionId(req) {
  return normalizeNullableString(req.headers["x-meli-session-id"] || req.body?.deviceSessionId);
}

async function resolveOptionalTenantId(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (token) {
    const session = parseSessionToken(token);
    if (session?.tenantId) {
      return String(session.tenantId).trim();
    }

    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { tenantId: true },
      });

      if (user?.tenantId) {
        return String(user.tenantId).trim();
      }
    }
  }

  const bodyTenantId = normalizeNullableString(req.body?.tenantId);
  if (!bodyTenantId) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: bodyTenantId },
    select: { id: true },
  });

  return tenant?.id || null;
}

router.post("/", async (req, res) => {
  let paymentLog = null;
  let cardTokenRecord = null;

  try {
    const idempotencyKey = String(req.headers["x-idempotency-key"] || "").trim() || undefined;
    const tenantId = await resolveOptionalTenantId(req);
    paymentLog = await createPaymentLog({
      tenantId,
      provider: "mercado-pago",
      endpoint: "/v1/payments",
      idempotencyKey,
      requestPayload: req.body || {},
    });

    await updatePaymentLog(paymentLog.id, {
      status: PAYMENT_LOG_STATUS.SENT_OR_WAITING,
    });

    cardTokenRecord = await createCardToken({
      tenantId,
      paymentId: paymentLog.id,
      provider: "mercado-pago",
      cardToken: req.body?.card_token_id || req.body?.cardTokenId || req.body?.token,
      payerEmail: req.body?.payer?.email || req.body?.email || req.body?.cardholderEmail,
      paymentMethodId: req.body?.payment_method_id || req.body?.paymentMethodId,
      issuerId: req.body?.issuer_id || req.body?.issuerId || req.body?.issuer,
    });

    const result = await createMercadoPagoPayment({
      tenantId,
      data: req.body || {},
      idempotencyKey,
      deviceSessionId: getMercadoPagoDeviceSessionId(req),
    });
    const providerPaymentId = result.response?.id ? String(result.response.id) : null;
    const providerStatus = result.response?.status ? String(result.response.status) : null;
    const providerStatusDetail = result.response?.status_detail ? String(result.response.status_detail) : null;
    const paymentLogStatus =
      providerStatus && providerStatus.toLowerCase() === "approved"
        ? PAYMENT_LOG_STATUS.APPROVED
        : PAYMENT_LOG_STATUS.NOT_APPROVED;
    const statusMessage = await getPaymentStatusMessage({
      provider: "mercado-pago",
      status: providerStatus,
    });

    await updatePaymentLog(paymentLog.id, {
      status: paymentLogStatus,
      responsePayload: result.response,
      providerPaymentId,
      providerStatus,
      providerStatusDetail,
    });
    await updateCardTokenPaymentResult(cardTokenRecord?.id, {
      providerPaymentId,
      providerStatus,
    });

    return res.status(201).json({
      code: providerStatus,
      message: statusMessage.customerMessage,
      detail: providerStatusDetail,
    });
  } catch (error) {
    if (paymentLog?.id) {
      try {
        await updatePaymentLog(paymentLog.id, {
          status: PAYMENT_LOG_STATUS.SENT_OR_WAITING,
          errorPayload: {
            message: error.message,
            details: error.details || null,
            statusCode: error?.statusCode || null,
          },
        });
      } catch (logError) {
        console.error("error al actualizar bitacora de pago", logError);
      }
    }
    if (cardTokenRecord?.id) {
      try {
        await updateCardTokenPaymentResult(cardTokenRecord.id, {
          providerStatus: "error",
        });
      } catch (cardTokenError) {
        console.error("error al actualizar token de tarjeta", cardTokenError);
      }
    }

    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        code: statusCode,
        message: error.message,
        detail: error.details || null,
      });
    }

    return res.status(500).json({
      code: 500,
      message: "error al crear pago",
      detail: error.message || error.details || null,
    });
  }
});

module.exports = router;
