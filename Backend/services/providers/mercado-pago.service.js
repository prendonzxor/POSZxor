const crypto = require("crypto");

const MERCADO_PAGO_API_BASE_URL =
  process.env.MERCADO_PAGO_API_BASE_URL || "https://api.mercadopago.com";

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function buildMercadoPagoHeaders() {
  const accessToken = String(
    process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN || "",
  ).trim();

  if (!accessToken) {
    const error = new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
    error.statusCode = 500;
    throw error;
  }
  console.debug("accessToken summary", accessToken);
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function withMercadoPagoDeviceSessionHeader(headers, deviceSessionId) {
  const normalizedDeviceSessionId = normalizeOptionalString(deviceSessionId);

  if (!normalizedDeviceSessionId) {
    return headers;
  }

  return {
    ...headers,
    "X-meli-session-id": normalizedDeviceSessionId,
  };
}

function loadMercadoPagoSdk() {
  try {
    return require("mercadopago");
  } catch {
    const error = new Error(
      "SDK mercadopago no instalado. Agrega la dependencia 'mercadopago' en Backend/package.json e instala dependencias.",
    );
    error.statusCode = 500;
    throw error;
  }
}

function createMercadoPagoSdkClient() {
  const { MercadoPagoConfig } = loadMercadoPagoSdk();
  const accessToken = String(
    process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN || "",
  ).trim();

  if (!accessToken) {
    const error = new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
    error.statusCode = 500;
    throw error;
  }

  return new MercadoPagoConfig({ accessToken });
}

function normalizeFrequencyType(value, fieldName) {
  const normalized = String(value || "").trim().toLowerCase();
  const allowed = ["days", "months"];
  if (!allowed.includes(normalized)) {
    const error = new Error(`${fieldName} invalido. Usa: ${allowed.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function normalizePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} debe ser entero > 0`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function normalizeNullablePositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  return normalizePositiveInt(value, fieldName);
}

function normalizeAmount(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} debe ser numero > 0`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function normalizeMoneyString(value, fieldName) {
  const parsed = normalizeAmount(value, fieldName);
  return parsed.toFixed(2);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function normalizeString(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`${fieldName} es requerido`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function maskValue(value, visibleStart = 6, visibleEnd = 4) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized.length <= visibleStart + visibleEnd) return `${normalized.slice(0, 2)}***`;
  return `${normalized.slice(0, visibleStart)}...${normalized.slice(-visibleEnd)}`;
}

function maskEmail(value) {
  const normalized = String(value || "").trim();
  if (!normalized || !normalized.includes("@")) return normalized || null;
  const [name, domain] = normalized.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function getMercadoPagoAccessTokenSummary() {
  const accessToken = String(
    process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN || "",
  ).trim();

  return {
    configured: Boolean(accessToken),
    prefix: accessToken.includes("-") ? accessToken.split("-")[0] : null,
    masked: maskValue(accessToken),
  };
}

function buildSafePreapprovalPayload(payload = {}) {
  return {
    preapproval_plan_id: maskValue(payload.preapproval_plan_id),
    reason: payload.reason || null,
    external_reference: payload.external_reference || null,
    payer_email: maskEmail(payload.payer_email),
    card_token_id: maskValue(payload.card_token_id),
    auto_recurring: payload.auto_recurring
      ? {
          frequency: payload.auto_recurring.frequency,
          frequency_type: payload.auto_recurring.frequency_type,
          transaction_amount: payload.auto_recurring.transaction_amount,
          currency_id: payload.auto_recurring.currency_id,
          has_start_date: Boolean(payload.auto_recurring.start_date),
          has_end_date: Boolean(payload.auto_recurring.end_date),
        }
      : null,
    back_url: payload.back_url || null,
    status: payload.status || null,
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function buildCurlCommand({ url, headers, payload, maskSensitive = true }) {
  const curlHeaders = Object.entries(headers || {}).map(([key, value]) => {
    const normalizedValue =
      maskSensitive && String(key).toLowerCase() === "authorization"
        ? "Bearer ***"
        : value;
    return `  -H ${shellQuote(`${key}: ${normalizedValue}`)}`;
  });
  const curlPayload = maskSensitive ? buildSafePreapprovalPayload(payload) : payload;

  return [
    "curl -X POST \\",
    `  ${shellQuote(url)} \\`,
    `${curlHeaders.join(" \\\n")} \\`,
    `  -d ${shellQuote(JSON.stringify(curlPayload, null, 2))}`,
  ].join("\n");
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value)
    .map(([key, entry]) => [key, compactObject(entry)])
    .filter(([, entry]) => entry !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function buildOptionalAddress(input = {}) {
  return compactObject({
    zip_code: normalizeOptionalString(firstDefined(input.zip_code, input.zipCode)),
    street_name: normalizeOptionalString(firstDefined(input.street_name, input.streetName)),
    street_number: normalizeOptionalString(firstDefined(input.street_number, input.streetNumber)),
    state: normalizeOptionalString(input.state),
    city: normalizeOptionalString(input.city),
    complement: normalizeOptionalString(input.complement),
  });
}

function buildOptionalIdentification(input = {}) {
  const type = normalizeOptionalString(firstDefined(input.type, input.docType, input.identificationType));
  const number = normalizeOptionalString(firstDefined(input.number, input.docNumber, input.identificationNumber));

  if (!type && !number) {
    return undefined;
  }

  return compactObject({ type, number });
}

function buildOptionalPhone(input = {}) {
  return compactObject({
    area_code: normalizeOptionalString(firstDefined(input.area_code, input.areaCode)),
    number: normalizeOptionalString(input.number),
  });
}

function buildOptionalPayer(input = {}) {
  return compactObject({
    email: normalizeString(input.email, "payer.email"),
    entity_type: normalizeOptionalString(firstDefined(input.entity_type, input.entityType)),
    first_name: normalizeOptionalString(firstDefined(input.first_name, input.firstName)),
    last_name: normalizeOptionalString(firstDefined(input.last_name, input.lastName)),
    identification: buildOptionalIdentification(input.identification || {}),
    phone: buildOptionalPhone(input.phone || {}),
    address: buildOptionalAddress(input.address || {}),
  });
}

function buildOptionalShipment(input = {}) {
  return compactObject({
    address: buildOptionalAddress(input.address || {}),
  });
}

function buildOptionalIntegrationData(input = {}) {
  return compactObject({
    integrator_id: normalizeOptionalString(firstDefined(input.integrator_id, input.integratorId)),
    platform_id: normalizeOptionalString(firstDefined(input.platform_id, input.platformId)),
    sponsor: compactObject({
      id: normalizeOptionalString(input.sponsor?.id),
    }),
  });
}

function buildOptionalOrderConfig(input = {}) {
  return compactObject({
    online: compactObject({
      transaction_security: compactObject({
        validation: normalizeOptionalString(input.online?.transaction_security?.validation),
        liability_shift: normalizeOptionalString(input.online?.transaction_security?.liability_shift),
      }),
    }),
  });
}

function buildOrderItems(itemsInput = []) {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    return undefined;
  }

  return itemsInput.map((item, index) =>
    compactObject({
      title: normalizeString(item.title, `items[${index}].title`),
      unit_price: normalizeMoneyString(firstDefined(item.unit_price, item.unitPrice), `items[${index}].unit_price`),
      quantity: normalizePositiveInt(firstDefined(item.quantity, 1), `items[${index}].quantity`),
      description: normalizeOptionalString(item.description),
      external_code: normalizeOptionalString(firstDefined(item.external_code, item.externalCode)),
      picture_url: normalizeOptionalString(firstDefined(item.picture_url, item.pictureUrl)),
      category_id: normalizeOptionalString(firstDefined(item.category_id, item.categoryId)),
      type: normalizeOptionalString(item.type),
      warranty: normalizeBoolean(item.warranty),
      event_date: normalizeOptionalString(firstDefined(item.event_date, item.eventDate)),
    }),
  );
}

function parseMercadoPagoResponse(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function parseMercadoPagoError(response, fallbackMessage) {
  const text = await response.text();
  const parsedBody = parseMercadoPagoResponse(text);
  const message = parsedBody?.message || parsedBody?.error || fallbackMessage;
  console.warn("[mercado-pago] provider error", {
    status: response.status,
    statusText: response.statusText,
    message,
    details: parsedBody,
  });
  const error = new Error(message);
  error.statusCode = response.status;
  error.details = parsedBody;
  throw error;
}

function buildPreapprovalPlanPayload({ tenantId, data }) {
  const reason = normalizeString(data.reason, "reason");
  const autoRecurringInput = firstDefined(data.autoRecurring, data.auto_recurring) || {};
  const freeTrialInput = firstDefined(autoRecurringInput.freeTrial, autoRecurringInput.free_trial);
  const backUrl =
    normalizeOptionalString(firstDefined(data.backUrl, data.back_url)) ||
    normalizeOptionalString(process.env.MERCADO_PAGO_BACK_URL);

  if (!backUrl) {
    const error = new Error("backUrl es requerido o configura MERCADO_PAGO_BACK_URL");
    error.statusCode = 400;
    throw error;
  }

  const autoRecurring = {
    frequency: normalizePositiveInt(autoRecurringInput.frequency, "autoRecurring.frequency"),
    frequency_type: normalizeFrequencyType(
      firstDefined(autoRecurringInput.frequencyType, autoRecurringInput.frequency_type),
      "autoRecurring.frequencyType",
    ),
    transaction_amount: normalizeAmount(
      firstDefined(autoRecurringInput.transactionAmount, autoRecurringInput.transaction_amount),
      "autoRecurring.transactionAmount",
    ),
    currency_id: normalizeString(
      firstDefined(autoRecurringInput.currencyId, autoRecurringInput.currency_id),
      "autoRecurring.currencyId",
    ).toUpperCase(),
  };

  const repetitions = normalizeNullablePositiveInt(
    autoRecurringInput.repetitions,
    "autoRecurring.repetitions",
  );
  if (repetitions !== undefined) {
    autoRecurring.repetitions = repetitions;
  }

  const billingDay = normalizeNullablePositiveInt(
    firstDefined(autoRecurringInput.billingDay, autoRecurringInput.billing_day),
    "autoRecurring.billingDay",
  );
  if (billingDay !== undefined) {
    autoRecurring.billing_day = billingDay;
  }

  const billingDayProportional = normalizeBoolean(
    firstDefined(autoRecurringInput.billingDayProportional, autoRecurringInput.billing_day_proportional),
  );
  if (billingDayProportional !== undefined) {
    autoRecurring.billing_day_proportional = billingDayProportional;
  }

  if (freeTrialInput) {
    autoRecurring.free_trial = {
      frequency: normalizePositiveInt(freeTrialInput.frequency, "autoRecurring.freeTrial.frequency"),
      frequency_type: normalizeFrequencyType(
        firstDefined(freeTrialInput.frequencyType, freeTrialInput.frequency_type),
        "autoRecurring.freeTrial.frequencyType",
      ),
    };
  }

  const payload = {
    reason,
    auto_recurring: autoRecurring,
    back_url: backUrl,
    external_reference:
      normalizeOptionalString(firstDefined(data.externalReference, data.external_reference)) ||
      `tenant:${tenantId}`,
  };

  const paymentMethodsAllowed = firstDefined(data.paymentMethodsAllowed, data.payment_methods_allowed);
  if (paymentMethodsAllowed && typeof paymentMethodsAllowed === "object") {
    payload.payment_methods_allowed = paymentMethodsAllowed;
  }

  return payload;
}

async function createMercadoPagoPreapprovalPlan({ tenantId, data }) {
  const payload = buildPreapprovalPlanPayload({ tenantId, data });
  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}/preapproval_plan`, {
    method: "POST",
    headers: buildMercadoPagoHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseMercadoPagoError(response, "Mercado Pago rechazo la creacion del preapproval plan");
  }

  const parsedBody = parseMercadoPagoResponse(await response.text());

  return {
    provider: "mercado-pago",
    endpoint: "/preapproval_plan",
    request: payload,
    response: parsedBody,
  };
}

function buildMercadoPagoPreapprovalPayload({ tenantId, data }) {
  const autoRecurringInput = firstDefined(data.autoRecurring, data.auto_recurring) || {};
  const backUrl =
    normalizeOptionalString(firstDefined(data.backUrl, data.back_url)) ||
    normalizeOptionalString(process.env.MERCADO_PAGO_BACK_URL);

  if (!backUrl) {
    const error = new Error("backUrl es requerido o configura MERCADO_PAGO_BACK_URL");
    error.statusCode = 400;
    throw error;
  }

  const autoRecurring = {
    frequency: normalizePositiveInt(autoRecurringInput.frequency, "autoRecurring.frequency"),
    frequency_type: normalizeFrequencyType(
      firstDefined(autoRecurringInput.frequencyType, autoRecurringInput.frequency_type),
      "autoRecurring.frequencyType",
    ),
    transaction_amount: normalizeAmount(
      firstDefined(autoRecurringInput.transactionAmount, autoRecurringInput.transaction_amount),
      "autoRecurring.transactionAmount",
    ),
    currency_id: normalizeString(
      firstDefined(autoRecurringInput.currencyId, autoRecurringInput.currency_id),
      "autoRecurring.currencyId",
    ).toUpperCase(),
  };
  const startDate = normalizeOptionalString(firstDefined(autoRecurringInput.startDate, autoRecurringInput.start_date));
  const endDate = normalizeOptionalString(firstDefined(autoRecurringInput.endDate, autoRecurringInput.end_date));

  if (startDate) {
    autoRecurring.start_date = startDate;
  }
  if (endDate) {
    autoRecurring.end_date = endDate;
  }

  return compactObject({
    preapproval_plan_id: normalizeOptionalString(firstDefined(data.preapproval_plan_id, data.preapprovalPlanId)),
    reason: normalizeString(data.reason, "reason"),
    external_reference:
      normalizeOptionalString(firstDefined(data.external_reference, data.externalReference)) || `tenant:${tenantId}`,
    payer_email: normalizeString(firstDefined(data.payer_email, data.payerEmail), "payer_email"),
    card_token_id: normalizeString(firstDefined(data.card_token_id, data.cardTokenId), "card_token_id"),
    auto_recurring: autoRecurring,
    back_url: backUrl,
    status: normalizeOptionalString(data.status) || "authorized",
  });
}

async function createMercadoPagoPreapproval({ tenantId, data, deviceSessionId }) {
  const payload = buildMercadoPagoPreapprovalPayload({ tenantId, data });
  const url = `${MERCADO_PAGO_API_BASE_URL}/preapproval`;
  const headers = withMercadoPagoDeviceSessionHeader(buildMercadoPagoHeaders(), deviceSessionId);
  console.info("[mercado-pago:preapproval] outbound request", {
    tenantId,
    apiBaseUrl: MERCADO_PAGO_API_BASE_URL,
    endpoint: "/preapproval",
    accessToken: getMercadoPagoAccessTokenSummary(),
    payload: buildSafePreapprovalPayload(payload),
  });
  console.info("[mercado-pago:preapproval] outbound curl", {
    tenantId,
    curl: buildCurlCommand({
      url,
      headers,
      payload,
      maskSensitive: process.env.MERCADO_PAGO_LOG_FULL_CURL !== "true",
    }),
    masked: process.env.MERCADO_PAGO_LOG_FULL_CURL !== "true",
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.info("[mercado-pago:preapproval] outbound response", {
    tenantId,
    endpoint: "/preapproval",
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    await parseMercadoPagoError(response, "Mercado Pago rechazo la creacion del preapproval");
  }

  const parsedBody = parseMercadoPagoResponse(await response.text());
  console.info("[mercado-pago:preapproval] provider success", {
    tenantId,
    preapprovalId: parsedBody?.id || null,
    status: parsedBody?.status || null,
  });

  return {
    provider: "mercado-pago",
    endpoint: "/preapproval",
    request: payload,
    response: parsedBody,
  };
}

function buildMercadoPagoOrderPayload({ tenantId, data }) {
  const payerInput = data.payer || {};
  const transactionsInput = data.transactions || {};
  const paymentsInput = Array.isArray(transactionsInput.payments) ? transactionsInput.payments : [];

  if (paymentsInput.length === 0) {
    const error = new Error("transactions.payments debe incluir al menos un pago");
    error.statusCode = 400;
    throw error;
  }

  const payments = paymentsInput.map((payment, index) => {
    const paymentMethodInput = payment?.payment_method || payment?.paymentMethod || {};
    const amount = normalizeMoneyString(payment?.amount, `transactions.payments[${index}].amount`);
    const token = normalizeString(paymentMethodInput.token, `transactions.payments[${index}].payment_method.token`);
    const id = normalizeString(paymentMethodInput.id, `transactions.payments[${index}].payment_method.id`);
    const type =
      normalizeOptionalString(paymentMethodInput.type) ||
      normalizeOptionalString(paymentMethodInput.payment_type_id) ||
      "credit_card";
    const installments = normalizePositiveInt(
      firstDefined(paymentMethodInput.installments, 1),
      `transactions.payments[${index}].payment_method.installments`,
    );

    return compactObject({
      amount,
      payment_method: {
        id,
        type,
        token,
        installments,
        statement_descriptor: normalizeOptionalString(
          firstDefined(paymentMethodInput.statement_descriptor, paymentMethodInput.statementDescriptor),
        ),
      },
      expiration_time: normalizeOptionalString(firstDefined(payment.expiration_time, payment.expirationTime)),
      date_of_expiration: normalizeOptionalString(firstDefined(payment.date_of_expiration, payment.dateOfExpiration)),
    });
  });

  const totalAmount = normalizeMoneyString(
    firstDefined(data.total_amount, data.totalAmount, payments[0]?.amount),
    "total_amount",
  );

  return compactObject({
    type: normalizeOptionalString(data.type) || "online",
    external_reference:
      normalizeOptionalString(firstDefined(data.external_reference, data.externalReference)) || `tenant:${tenantId}`,
    transactions: {
      payments,
    },
    payer: buildOptionalPayer(payerInput),
    shipment: buildOptionalShipment(data.shipment || {}),
    total_amount: totalAmount,
    capture_mode: normalizeOptionalString(firstDefined(data.capture_mode, data.captureMode)) || "automatic",
    processing_mode: normalizeOptionalString(firstDefined(data.processing_mode, data.processingMode)) || "automatic",
    description: normalizeOptionalString(data.description),
    integration_data: buildOptionalIntegrationData(firstDefined(data.integration_data, data.integrationData) || {}),
    items: buildOrderItems(data.items),
    config: buildOptionalOrderConfig(data.config || {}),
  });
}

async function createMercadoPagoOrder({ tenantId, data, idempotencyKey }) {
  const payload = buildMercadoPagoOrderPayload({ tenantId, data });
  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}/v1/orders`, {
    method: "POST",
    headers: {
      ...buildMercadoPagoHeaders(),
      "X-Idempotency-Key": normalizeOptionalString(idempotencyKey) || crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseMercadoPagoError(response, "Mercado Pago rechazo la creacion de la orden");
  }

  const parsedBody = parseMercadoPagoResponse(await response.text());

  return {
    provider: "mercado-pago",
    endpoint: "/v1/orders",
    request: payload,
    response: parsedBody,
  };
}

function buildMercadoPagoPaymentPayload({ tenantId, data }) {
  const payerInput = data.payer || { email: firstDefined(data.email, data.cardholderEmail) };
  const issuerId = firstDefined(data.issuer_id, data.issuerId, data.issuer);
  const externalReference =
    normalizeOptionalString(firstDefined(data.external_reference, data.externalReference)) ||
    (tenantId ? `tenant:${tenantId}` : "process_payment");
  const payload = {
    transaction_amount: normalizeAmount(
      firstDefined(data.transaction_amount, data.transactionAmount),
      "transaction_amount",
    ),
    token: normalizeString(firstDefined(data.token, data.card_token_id, data.cardTokenId), "card_token_id"),
    description:
      normalizeOptionalString(data.description) ||
      normalizeOptionalString(data.statement_descriptor) ||
      "Pago POS Zxor",
    installments: normalizePositiveInt(firstDefined(data.installments, 1), "installments"),
    payment_method_id: normalizeString(
      firstDefined(data.payment_method_id, data.paymentMethodId),
      "payment_method_id",
    ),
    payer: {
      email: normalizeString(payerInput.email, "payer.email"),
    },
    external_reference: externalReference,
  };

  const identificationInput = payerInput.identification || {};
  const identificationType = normalizeOptionalString(
    firstDefined(identificationInput.type, identificationInput.docType, data.identificationType),
  );
  const identificationNumber = normalizeOptionalString(
    firstDefined(identificationInput.number, identificationInput.docNumber, data.identificationNumber),
  );
  if (identificationType || identificationNumber) {
    payload.payer.identification = compactObject({
      type: identificationType,
      number: identificationNumber,
    });
  }

  if (issuerId !== undefined && issuerId !== null && issuerId !== "") {
    payload.issuer_id = normalizePositiveInt(issuerId, "issuer_id");
  }

  return payload;
}

async function createMercadoPagoPayment({ tenantId, data, idempotencyKey, deviceSessionId }) {
  const { Payment } = loadMercadoPagoSdk();
  const client = createMercadoPagoSdkClient();
  const payment = new Payment(client);
  const payload = buildMercadoPagoPaymentPayload({ tenantId, data });
  const normalizedIdempotencyKey = normalizeOptionalString(idempotencyKey) || crypto.randomUUID();

  let paymentResponse;
  try {
    paymentResponse = await payment.create({
      body: payload,
      requestOptions: {
        idempotencyKey: normalizedIdempotencyKey,
        customHeaders: withMercadoPagoDeviceSessionHeader({}, deviceSessionId),
      },
    });
  } catch (error) {
    const wrappedError = new Error(error?.message || "Mercado Pago rechazo la creacion del pago");
    wrappedError.statusCode = Number(error?.status || error?.statusCode || 500);
    wrappedError.details = error?.cause || error;
    throw wrappedError;
  }

  return {
    provider: "mercado-pago",
    endpoint: "/v1/payments",
    request: payload,
    idempotencyKey: normalizedIdempotencyKey,
    response: paymentResponse,
  };
}

async function getMercadoPagoPaymentMethods() {
  const { PaymentMethods } = loadMercadoPagoSdk();
  const client = createMercadoPagoSdkClient();
  const paymentMethods = new PaymentMethods(client);
  const result = await paymentMethods.get();

  return {
    provider: "mercado-pago",
    resource: "payment-methods",
    result,
  };
}

module.exports = {
  createMercadoPagoOrder,
  createMercadoPagoPayment,
  createMercadoPagoPreapproval,
  createMercadoPagoPreapprovalPlan,
  getMercadoPagoPaymentMethods,
};
