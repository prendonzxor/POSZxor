const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const { getTenantById, updateTenantById } = require("../services/tenant.service");
const {
  ALLOWED_PLAN_CODES,
  ALLOWED_STATUS,
  ALLOWED_PAYMENT_METHOD_STATUS,
  getTenantSubscriptionByTenantId,
  updateTenantSubscriptionByTenantId,
} = require("../services/tenant-subscription.service");
const {
  createProviderOrder,
  createProviderPayment,
  createProviderPreapproval,
  createProviderPreapprovalPlan,
  getProviderPaymentMethods,
} = require("../services/payment-provider.service");

const router = express.Router();

function createRequestLogId(prefix = "req") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function buildPreapprovalDebugPayload(body = {}) {
  const autoRecurring = body.auto_recurring || body.autoRecurring || {};
  return {
    preapprovalPlanId: maskValue(body.preapproval_plan_id || body.preapprovalPlanId),
    reason: body.reason || null,
    externalReference: body.external_reference || body.externalReference || null,
    payerEmail: maskEmail(body.payer_email || body.payerEmail),
    cardTokenId: maskValue(body.card_token_id || body.cardTokenId),
    autoRecurring: {
      frequency: autoRecurring.frequency,
      frequencyType: autoRecurring.frequency_type || autoRecurring.frequencyType,
      transactionAmount: autoRecurring.transaction_amount || autoRecurring.transactionAmount,
      currencyId: autoRecurring.currency_id || autoRecurring.currencyId,
      hasStartDate: Boolean(autoRecurring.start_date || autoRecurring.startDate),
      hasEndDate: Boolean(autoRecurring.end_date || autoRecurring.endDate),
    },
    backUrl: body.back_url || body.backUrl || null,
    status: body.status || null,
  };
}

function normalizeNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function getMercadoPagoDeviceSessionId(req) {
  return normalizeNullableString(req.headers["x-meli-session-id"] || req.body?.deviceSessionId);
}

function normalizeBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function normalizeNullableDate(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return Number.NaN;
  }
  return parsed.toISOString();
}

function normalizeNullableNonNegativeInt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return Number.NaN;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return parsed;
}

async function resolveTenantIdFromToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return { error: "token de autorizacion requerido" };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { error: "token invalido o expirado" };
  }

  if (session.tenantId) {
    return { tenantId: String(session.tenantId).trim() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { error: "usuario autenticado no encontrado" };
  }

  return { tenantId: String(user.tenantId).trim() };
}

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantUpdateRequest:
 *       type: object
 *       properties:
 *         legalName:
 *           type: string
 *         commercialName:
 *           type: string
 *           nullable: true
 *         rfc:
 *           type: string
 *           nullable: true
 *         phone:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         addressLine1:
 *           type: string
 *           nullable: true
 *         addressLine2:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         state:
 *           type: string
 *           nullable: true
 *         postalCode:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *           nullable: true
 *         timezone:
 *           type: string
 *           nullable: true
 *         posType:
 *           type: string
 *           nullable: true
 *         catalogMode:
 *           type: string
 *           nullable: true
 *         uiPreset:
 *           type: string
 *           nullable: true
 *         onboardingStep:
 *           type: integer
 *           nullable: true
 *         onboardingCompleted:
 *           type: boolean
 *           nullable: true
 *     TenantSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         tenant:
 *           type: object
 *     TenantSubscriptionResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         status:
 *           type: string
 *           enum: [trialing, trial_ended, active, past_due, suspended, canceled]
 *           nullable: true
 *         subscription:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             tenantId:
 *               type: string
 *             planCode:
 *               type: string
 *               enum: [FREE, STARTER, PRO, ENTERPRISE]
 *             status:
 *               type: string
 *               enum: [trialing, trial_ended, active, past_due, suspended, canceled]
 *             trialEndsAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             currentPeriodStart:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             currentPeriodEnd:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             autoRenew:
 *               type: boolean
 *             paymentProvider:
 *               type: string
 *               nullable: true
 *             paymentCustomerRef:
 *               type: string
 *               nullable: true
 *             paymentMethodToken:
 *               type: string
 *               nullable: true
 *             paymentMethodBrand:
 *               type: string
 *               nullable: true
 *             paymentMethodLast4:
 *               type: string
 *               nullable: true
 *             paymentMethodStatus:
 *               type: string
 *               enum: [pending, ready, expired, revoked]
 *               nullable: true
 *             limitsUsers:
 *               type: integer
 *             limitsBranches:
 *               type: integer
 *             limitsProducts:
 *               type: integer
 *             limitsOrdersPerMonth:
 *               type: integer
 *             limitsCustomers:
 *               type: integer
 *             createdAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             updatedAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *     TenantSubscriptionUpdateRequest:
 *       type: object
 *       properties:
 *         planCode:
 *           type: string
 *           enum: [FREE, STARTER, PRO, ENTERPRISE]
 *         status:
 *           type: string
 *           enum: [trialing, trial_ended, active, past_due, suspended, canceled]
 *         trialEndsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         currentPeriodStart:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         currentPeriodEnd:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         autoRenew:
 *           type: boolean
 *         paymentProvider:
 *           type: string
 *           nullable: true
 *         paymentCustomerRef:
 *           type: string
 *           nullable: true
 *         paymentMethodToken:
 *           type: string
 *           nullable: true
 *         paymentMethodBrand:
 *           type: string
 *           nullable: true
 *         paymentMethodLast4:
 *           type: string
 *           nullable: true
 *         paymentMethodStatus:
 *           type: string
 *           enum: [pending, ready, expired, revoked]
 *           nullable: true
 *         limitsUsers:
 *           type: integer
 *           minimum: 0
 *         limitsBranches:
 *           type: integer
 *           minimum: 0
 *         limitsProducts:
 *           type: integer
 *           minimum: 0
 *         limitsOrdersPerMonth:
 *           type: integer
 *           minimum: 0
 *         limitsCustomers:
 *           type: integer
 *           minimum: 0
 */

/**
 * @swagger
 * /api/tenants/me:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Obtener tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant obtenido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantSingleResponse'
 *       401:
 *         description: Token invalido o faltante
 *       404:
 *         description: Tenant no encontrado
 *   put:
 *     tags:
 *       - Tenants
 *     summary: Actualizar tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantUpdateRequest'
 *     responses:
 *       200:
 *         description: Tenant actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantSingleResponse'
 *       400:
 *         description: Error de validacion
 *       401:
 *         description: Token invalido o faltante
 *       404:
 *         description: Tenant no encontrado
 */
router.get("/me", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenant = await getTenantById(authContext.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "tenant no encontrado" });
    }

    return res.status(200).json({
      message: "tenant obtenido",
      tenant,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener tenant", error: error.message });
  }
});

router.put("/me", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const body = req.body || {};
    const data = {
      legalName: body.legalName !== undefined ? String(body.legalName || "").trim() : undefined,
      commercialName: normalizeNullableString(body.commercialName),
      rfc: normalizeNullableString(body.rfc),
      phone: normalizeNullableString(body.phone),
      email: normalizeNullableString(body.email),
      addressLine1: normalizeNullableString(body.addressLine1),
      addressLine2: normalizeNullableString(body.addressLine2),
      city: normalizeNullableString(body.city),
      state: normalizeNullableString(body.state),
      postalCode: normalizeNullableString(body.postalCode),
      country: normalizeNullableString(body.country),
      timezone: normalizeNullableString(body.timezone),
      posType: normalizeNullableString(body.posType),
      catalogMode: normalizeNullableString(body.catalogMode),
      uiPreset: normalizeNullableString(body.uiPreset),
      onboardingStep:
        body.onboardingStep === undefined || body.onboardingStep === null || body.onboardingStep === ""
          ? undefined
          : Number(body.onboardingStep),
      onboardingCompleted: normalizeBoolean(body.onboardingCompleted),
    };

    if (data.legalName !== undefined && !data.legalName) {
      return res.status(400).json({ message: "legalName no puede ser vacio" });
    }

    if (data.onboardingStep !== undefined && !Number.isInteger(data.onboardingStep)) {
      return res.status(400).json({ message: "onboardingStep debe ser numero entero" });
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "debes enviar al menos un campo para actualizar" });
    }

    const tenant = await updateTenantById({
      tenantId: authContext.tenantId,
      data: updateData,
    });

    return res.status(200).json({
      message: "tenant actualizado",
      tenant,
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "tenant no encontrado" });
    }
    return res.status(500).json({ message: "error al actualizar tenant", error: error.message });
  }
});

/**
 * @swagger
 * /api/tenants/subscription:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Obtener suscripcion del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Suscripcion obtenida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantSubscriptionResponse'
 *       401:
 *         description: Token invalido o faltante
 *   put:
 *     tags:
 *       - Tenants
 *     summary: Actualizar suscripcion del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantSubscriptionUpdateRequest'
 *     responses:
 *       200:
 *         description: Suscripcion actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantSubscriptionResponse'
 *       400:
 *         description: Error de validacion
 *       401:
 *         description: Token invalido o faltante
 */
router.get("/subscription", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const subscription = await getTenantSubscriptionByTenantId(authContext.tenantId);
    return res.status(200).json({
      message: "suscripcion obtenida",
      status: subscription?.status || null,
      subscription,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener suscripcion", error: error.message });
  }
});

router.put("/subscription", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const body = req.body || {};
    const data = {
      planCode: body.planCode !== undefined ? String(body.planCode || "").trim().toUpperCase() : undefined,
      status: body.status !== undefined ? String(body.status || "").trim().toLowerCase() : undefined,
      trialEndsAt: normalizeNullableDate(body.trialEndsAt),
      currentPeriodStart: normalizeNullableDate(body.currentPeriodStart),
      currentPeriodEnd: normalizeNullableDate(body.currentPeriodEnd),
      autoRenew: normalizeBoolean(body.autoRenew),
      paymentProvider: normalizeNullableString(body.paymentProvider),
      paymentCustomerRef: normalizeNullableString(body.paymentCustomerRef),
      paymentMethodToken: normalizeNullableString(body.paymentMethodToken),
      paymentMethodBrand: normalizeNullableString(body.paymentMethodBrand),
      paymentMethodLast4: normalizeNullableString(body.paymentMethodLast4),
      paymentMethodStatus:
        body.paymentMethodStatus === undefined
          ? undefined
          : normalizeNullableString(body.paymentMethodStatus)?.toLowerCase() ?? null,
      limitsUsers: normalizeNullableNonNegativeInt(body.limitsUsers),
      limitsBranches: normalizeNullableNonNegativeInt(body.limitsBranches),
      limitsProducts: normalizeNullableNonNegativeInt(body.limitsProducts),
      limitsOrdersPerMonth: normalizeNullableNonNegativeInt(body.limitsOrdersPerMonth),
      limitsCustomers: normalizeNullableNonNegativeInt(body.limitsCustomers),
    };

    if (data.planCode !== undefined && !data.planCode) {
      return res.status(400).json({ message: "planCode no puede ser vacio" });
    }
    if (data.planCode !== undefined && !ALLOWED_PLAN_CODES.includes(data.planCode)) {
      return res.status(400).json({ message: `planCode invalido. Usa: ${ALLOWED_PLAN_CODES.join(", ")}` });
    }

    if (data.status !== undefined && !data.status) {
      return res.status(400).json({ message: "status no puede ser vacio" });
    }
    if (data.status !== undefined && !ALLOWED_STATUS.includes(data.status)) {
      return res.status(400).json({ message: `status invalido. Usa: ${ALLOWED_STATUS.join(", ")}` });
    }

    if (
      data.paymentMethodStatus !== undefined &&
      data.paymentMethodStatus !== null &&
      !ALLOWED_PAYMENT_METHOD_STATUS.includes(data.paymentMethodStatus)
    ) {
      return res.status(400).json({
        message: `paymentMethodStatus invalido. Usa: ${ALLOWED_PAYMENT_METHOD_STATUS.join(", ")}`,
      });
    }

    const invalidDateField = ["trialEndsAt", "currentPeriodStart", "currentPeriodEnd"].find((field) => {
      const value = data[field];
      return typeof value === "number" && Number.isNaN(value);
    });
    if (invalidDateField) {
      return res.status(400).json({ message: `${invalidDateField} debe ser fecha valida` });
    }

    const invalidLimitField = [
      "limitsUsers",
      "limitsBranches",
      "limitsProducts",
      "limitsOrdersPerMonth",
      "limitsCustomers",
    ].find((field) => {
      const value = data[field];
      return typeof value === "number" && Number.isNaN(value);
    });
    if (invalidLimitField) {
      return res.status(400).json({ message: `${invalidLimitField} debe ser entero >= 0` });
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "debes enviar al menos un campo para actualizar" });
    }

    const subscription = await updateTenantSubscriptionByTenantId({
      tenantId: authContext.tenantId,
      data: updateData,
    });

    return res.status(200).json({
      message: "suscripcion actualizada",
      subscription,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "error al actualizar suscripcion", error: error.message });
  }
});

/**
 * @swagger
 * /api/tenants/subscription/providers/mercado-pago/preapproval-plan:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Crear preapproval plan en Mercado Pago
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - autoRecurring
 *             properties:
 *               reason:
 *                 type: string
 *               autoRecurring:
 *                 type: object
 *                 required:
 *                   - frequency
 *                   - frequencyType
 *                   - transactionAmount
 *                   - currencyId
 *                 properties:
 *                   frequency:
 *                     type: integer
 *                   frequencyType:
 *                     type: string
 *                     enum: [days, months]
 *                   repetitions:
 *                     type: integer
 *                   billingDay:
 *                     type: integer
 *                   billingDayProportional:
 *                     type: boolean
 *                   transactionAmount:
 *                     type: number
 *                   currencyId:
 *                     type: string
 *                   freeTrial:
 *                     type: object
 *                     properties:
 *                       frequency:
 *                         type: integer
 *                       frequencyType:
 *                         type: string
 *                         enum: [days, months]
 *               paymentMethodsAllowed:
 *                 type: object
 *               backUrl:
 *                 type: string
 *               externalReference:
 *                 type: string
 *     responses:
 *       201:
 *         description: Plan creado en Mercado Pago
 *       400:
 *         description: Error de validacion
 *       401:
 *         description: Token invalido o faltante
 */
router.post("/subscription/providers/mercado-pago/preapproval-plan", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const result = await createProviderPreapprovalPlan({
      provider: "mercado-pago",
      tenantId: authContext.tenantId,
      data: req.body || {},
    });

    return res.status(201).json({
      message: "preapproval plan creado",
      provider: result.provider,
      endpoint: result.endpoint,
      request: result.request,
      preapprovalPlan: result.response,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      const isProviderNotFound = statusCode === 404 && error.details;
      return res.status(isProviderNotFound ? 400 : statusCode).json({
        message: isProviderNotFound
          ? "Mercado Pago rechazo el preapproval. Verifica que el token de tarjeta, access token y public key pertenezcan a la misma aplicacion."
          : error.message,
        providerStatusCode: isProviderNotFound ? statusCode : undefined,
        details: error.details || null,
      });
    }

    return res.status(500).json({
      message: "error al crear preapproval plan",
      error: error.message,
      details: error.details || null,
    });
  }
});

/**
 * @swagger
 * /api/tenants/subscription/providers/mercado-pago/preapproval:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Crear preapproval de suscripcion en Mercado Pago
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MercadoPagoPreapprovalRequest'
 *           examples:
 *             monthlySubscription:
 *               summary: Suscripcion mensual autorizada
 *               value:
 *                 preapproval_plan_id: "08ecc78864db4d278ac90ee733f7ae99"
 *                 reason: "Suscripcion Zxor POS Basico"
 *                 external_reference: "subscription:BASIC"
 *                 payer_email: "cliente@example.com"
 *                 card_token_id: "e3ed6f098462036dd2cbabe314b9de2a"
 *                 auto_recurring:
 *                   frequency: 1
 *                   frequency_type: "months"
 *                   transaction_amount: 199
 *                   currency_id: "MXN"
 *                 back_url: "https://poszxor.com/subscription-checkout"
 *                 status: "authorized"
 *             mercadoPagoExample:
 *               summary: Ejemplo compatible con Mercado Pago
 *               value:
 *                 preapproval_plan_id: "2c938084726fca480172750000000000"
 *                 reason: "Yoga classes"
 *                 external_reference: "YG-1234"
 *                 payer_email: "test@testuser.com"
 *                 card_token_id: "e3ed6f098462036dd2cbabe314b9de2a"
 *                 auto_recurring:
 *                   frequency: 1
 *                   frequency_type: "months"
 *                   start_date: "2020-06-02T13:07:14.260Z"
 *                   end_date: "2022-07-20T15:59:52.581Z"
 *                   transaction_amount: 10
 *                   currency_id: "ARS"
 *                 back_url: "https://www.mercadopago.com.ar"
 *                 status: "authorized"
 *     responses:
 *       201:
 *         description: Preapproval creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoPreapprovalResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoProviderErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Error devuelto por Mercado Pago, por ejemplo token de tarjeta invalido o credenciales no coincidentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoProviderErrorResponse'
 */
router.post("/subscription/providers/mercado-pago/preapproval", async (req, res) => {
  const requestLogId = createRequestLogId("mp_preapproval");
  try {
    console.info("[mercado-pago:preapproval] request received", {
      requestLogId,
      path: req.originalUrl,
      method: req.method,
      body: buildPreapprovalDebugPayload(req.body || {}),
    });

    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      console.warn("[mercado-pago:preapproval] auth failed", {
        requestLogId,
        message: authContext.error,
      });
      return res.status(401).json({ message: authContext.error });
    }

    console.info("[mercado-pago:preapproval] auth resolved", {
      requestLogId,
      tenantId: authContext.tenantId,
    });

    const result = await createProviderPreapproval({
      provider: "mercado-pago",
      tenantId: authContext.tenantId,
      data: req.body || {},
      deviceSessionId: getMercadoPagoDeviceSessionId(req),
    });

    console.info("[mercado-pago:preapproval] created", {
      requestLogId,
      provider: result.provider,
      endpoint: result.endpoint,
      preapprovalId: result.response?.id || null,
      preapprovalStatus: result.response?.status || null,
    });

    return res.status(201).json({
      message: "preapproval creado",
      provider: result.provider,
      endpoint: result.endpoint,
      request: result.request,
      preapproval: result.response,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    console.warn("[mercado-pago:preapproval] failed", {
      requestLogId,
      statusCode,
      message: error.message,
      providerDetails: error.details || null,
    });

    if (statusCode >= 400 && statusCode < 500) {
      const isProviderNotFound = statusCode === 404 && error.details;
      return res.status(isProviderNotFound ? 400 : statusCode).json({
        message: isProviderNotFound
          ? "Mercado Pago rechazo el preapproval. Verifica que el token de tarjeta, access token y public key pertenezcan a la misma aplicacion."
          : error.message,
        providerStatusCode: isProviderNotFound ? statusCode : undefined,
        details: error.details || null,
      });
    }

    return res.status(500).json({
      message: "error al crear preapproval",
      error: error.message,
      details: error.details || null,
    });
  }
});

/**
 * @swagger
 * /api/tenants/subscription/providers/mercado-pago/orders:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Crear orden de pago en Mercado Pago
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Idempotency-Key
 *         schema:
 *           type: string
 *         required: false
 *         description: Clave unica para evitar duplicar cargos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payer
 *               - transactions
 *             properties:
 *               type:
 *                 type: string
 *               processing_mode:
 *                 type: string
 *               total_amount:
 *                 type: string
 *               external_reference:
 *                 type: string
 *               payer:
 *                 type: object
 *                 required:
 *                   - email
 *                 properties:
 *                   email:
 *                     type: string
 *               transactions:
 *                 type: object
 *                 properties:
 *                   payments:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: string
 *                         payment_method:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             type:
 *                               type: string
 *                             token:
 *                               type: string
 *                             installments:
 *                               type: integer
 *     responses:
 *       201:
 *         description: Orden creada
 *       400:
 *         description: Error de validacion
 *       401:
 *         description: Token invalido o faltante
 */
router.post("/subscription/providers/mercado-pago/orders", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const idempotencyKey = String(req.headers["x-idempotency-key"] || "").trim() || undefined;
    const result = await createProviderOrder({
      provider: "mercado-pago",
      tenantId: authContext.tenantId,
      data: req.body || {},
      idempotencyKey,
    });

    return res.status(201).json({
      message: "orden creada",
      provider: result.provider,
      endpoint: result.endpoint,
      request: result.request,
      order: result.response,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        message: error.message,
        details: error.details || null,
      });
    }

    return res.status(500).json({
      message: "error al crear orden",
      error: error.message,
      details: error.details || null,
    });
  }
});

/**
 * @swagger
 * /api/tenants/subscription/providers/mercado-pago/payments:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Crear pago directo en Mercado Pago
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Idempotency-Key
 *         schema:
 *           type: string
 *         required: false
 *         description: Clave unica para evitar duplicar cargos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction_amount
 *               - token
 *               - payment_method_id
 *               - payer
 *             properties:
 *               transaction_amount:
 *                 type: number
 *               token:
 *                 type: string
 *               description:
 *                 type: string
 *               installments:
 *                 type: integer
 *               payment_method_id:
 *                 type: string
 *               issuer_id:
 *                 type: integer
 *               external_reference:
 *                 type: string
 *               payer:
 *                 type: object
 *                 required:
 *                   - email
 *                 properties:
 *                   email:
 *                     type: string
 *     responses:
 *       201:
 *         description: Pago creado
 *       400:
 *         description: Error de validacion
 *       401:
 *         description: Token invalido o faltante
 */
router.post("/subscription/providers/mercado-pago/payments", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const idempotencyKey = String(req.headers["x-idempotency-key"] || "").trim() || undefined;
    const result = await createProviderPayment({
      provider: "mercado-pago",
      tenantId: authContext.tenantId,
      data: req.body || {},
      idempotencyKey,
      deviceSessionId: getMercadoPagoDeviceSessionId(req),
    });

    return res.status(201).json({
      message: "pago creado",
      detail: result.response?.status_detail || null,
      status: result.response?.status || null,
      id: result.response?.id || null,
      provider: result.provider,
      endpoint: result.endpoint,
      request: result.request,
      payment: result.response,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        error_message: error.message,
        message: error.message,
        details: error.details || null,
      });
    }

    return res.status(500).json({
      error_message: error.message || "error al crear pago",
      message: "error al crear pago",
      error: error.message,
      details: error.details || null,
    });
  }
});

/**
 * @swagger
 * /api/tenants/subscription/providers/mercado-pago/payment-methods:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Obtener metodos de pago disponibles desde Mercado Pago SDK
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metodos de pago obtenidos
 *       401:
 *         description: Token invalido o faltante
 */
router.get("/subscription/providers/mercado-pago/payment-methods", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const result = await getProviderPaymentMethods({
      provider: "mercado-pago",
    });

    return res.status(200).json({
      message: "metodos de pago obtenidos",
      provider: result.provider,
      resource: result.resource,
      paymentMethods: result.result,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ message: error.message });
    }

    return res.status(500).json({
      message: "error al obtener metodos de pago",
      error: error.message,
    });
  }
});

module.exports = router;
