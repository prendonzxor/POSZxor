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
const { createMercadoPagoOrder } = require("../services/providers/mercado-pago.service");

const router = express.Router();

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
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

function getFirstOrderPayment(order) {
  const payments = order?.transactions?.payments;
  if (Array.isArray(payments) && payments.length > 0) {
    return payments[0];
  }

  return null;
}

function getRequestCardToken(data) {
  return data?.transactions?.payments?.[0]?.payment_method?.token || data?.token;
}

function getRequestPaymentMethodId(data) {
  return data?.transactions?.payments?.[0]?.payment_method?.id || data?.payment_method_id || data?.paymentMethodId;
}

function getRequestIssuerId(data) {
  return data?.transactions?.payments?.[0]?.payment_method?.issuer_id || data?.issuer_id || data?.issuerId || data?.issuer;
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
      endpoint: "/v1/orders",
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
      cardToken: getRequestCardToken(req.body || {}),
      payerEmail: req.body?.payer?.email || req.body?.email || req.body?.cardholderEmail,
      paymentMethodId: getRequestPaymentMethodId(req.body || {}),
      issuerId: getRequestIssuerId(req.body || {}),
    });

    const result = await createMercadoPagoOrder({
      tenantId,
      data: req.body || {},
      idempotencyKey,
    });
    const orderPayment = getFirstOrderPayment(result.response);
    const providerPaymentId = orderPayment?.id ? String(orderPayment.id) : result.response?.id ? String(result.response.id) : null;
    const providerStatus = orderPayment?.status
      ? String(orderPayment.status)
      : result.response?.status
        ? String(result.response.status)
        : null;
    const providerStatusDetail = orderPayment?.status_detail ? String(orderPayment.status_detail) : null;
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
      message: statusMessage.customerMessage,
      statusMessage,
      paymentLog: {
        id: paymentLog.id,
        status: paymentLogStatus,
      },
      cardToken: cardTokenRecord
        ? {
            id: cardTokenRecord.id,
            tenantId,
          }
        : null,
      provider: result.provider,
      endpoint: result.endpoint,
      request: result.request,
      order: result.response,
      payment: {
        ...(orderPayment || {}),
        id: providerPaymentId || orderPayment?.id,
        status: providerStatus,
        status_detail: providerStatusDetail,
        payment_method_id: getRequestPaymentMethodId(req.body || {}),
      },
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
        console.error("error al actualizar bitacora de orden de pago", logError);
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
        message: error.message,
        paymentLog: paymentLog
          ? {
              id: paymentLog.id,
              status: PAYMENT_LOG_STATUS.SENT_OR_WAITING,
            }
          : null,
        details: error.details || null,
      });
    }

    return res.status(500).json({
      message: "error al crear orden de pago",
      paymentLog: paymentLog
        ? {
            id: paymentLog.id,
            status: PAYMENT_LOG_STATUS.SENT_OR_WAITING,
          }
        : null,
      error: error.message,
      details: error.details || null,
    });
  }
});

module.exports = router;
