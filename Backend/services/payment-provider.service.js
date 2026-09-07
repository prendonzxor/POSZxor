const {
  createMercadoPagoOrder,
  createMercadoPagoPayment,
  createMercadoPagoPreapproval,
  createMercadoPagoPreapprovalPlan,
  getMercadoPagoPaymentMethods,
} = require("./providers/mercado-pago.service");

async function createProviderPreapproval({ provider, tenantId, data, deviceSessionId }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  if (normalizedProvider === "mercado-pago" || normalizedProvider === "mercadopago") {
    return createMercadoPagoPreapproval({ tenantId, data, deviceSessionId });
  }

  const error = new Error("provider no soportado");
  error.statusCode = 400;
  throw error;
}

async function createProviderPreapprovalPlan({ provider, tenantId, data }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  if (normalizedProvider === "mercado-pago" || normalizedProvider === "mercadopago") {
    return createMercadoPagoPreapprovalPlan({ tenantId, data });
  }

  const error = new Error("provider no soportado");
  error.statusCode = 400;
  throw error;
}

async function createProviderOrder({ provider, tenantId, data, idempotencyKey }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  if (normalizedProvider === "mercado-pago" || normalizedProvider === "mercadopago") {
    return createMercadoPagoOrder({ tenantId, data, idempotencyKey });
  }

  const error = new Error("provider no soportado");
  error.statusCode = 400;
  throw error;
}

async function createProviderPayment({ provider, tenantId, data, idempotencyKey, deviceSessionId }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  if (normalizedProvider === "mercado-pago" || normalizedProvider === "mercadopago") {
    return createMercadoPagoPayment({ tenantId, data, idempotencyKey, deviceSessionId });
  }

  const error = new Error("provider no soportado");
  error.statusCode = 400;
  throw error;
}

async function getProviderPaymentMethods({ provider }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();

  if (normalizedProvider === "mercado-pago" || normalizedProvider === "mercadopago") {
    return getMercadoPagoPaymentMethods();
  }

  const error = new Error("provider no soportado");
  error.statusCode = 400;
  throw error;
}

module.exports = {
  createProviderOrder,
  createProviderPayment,
  createProviderPreapproval,
  createProviderPreapprovalPlan,
  getProviderPaymentMethods,
};
