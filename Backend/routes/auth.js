const express = require("express");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { buildSessionToken } = require("../lib/session-token");
const {
  ALLOWED_PLAN_CODES,
  ALLOWED_PAYMENT_METHOD_STATUS,
  DEFAULTS_BY_PLAN,
  DEFAULT_TRIAL_DAYS,
  ensureTenantSubscriptionTable,
} = require("../services/tenant-subscription.service");
const { createProviderPreapproval } = require("../services/payment-provider.service");

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;
const PHONE_MIN_LENGTH = 8;
const RESET_TOKEN_MINUTES = 30;
const RESET_CODE_DIGITS = 6;
const DEFAULT_POS_TYPE = "RETAIL";
const ALLOWED_POS_TYPES = new Set(["FERRETERIA", "RESTAURANTE", "RETAIL", "SERVICIOS"]);

function getDefaultBusinessTypeForPosType(posType) {
  const normalizedPosType = String(posType || DEFAULT_POS_TYPE).toUpperCase();
  if (normalizedPosType === "FERRETERIA") return "FERRETERIA";
  if (normalizedPosType === "RESTAURANTE") return "RESTAURANTE";
  if (normalizedPosType === "SERVICIOS") return "SERVICIOS";
  return "TIENDA_ABARROTES";
}

function getDefaultCatalogsForPosType(posType) {
  const normalizedPosType = String(posType || DEFAULT_POS_TYPE).toUpperCase();

  if (normalizedPosType === "FERRETERIA") {
    return [
      { catalogKey: "screws", sortOrder: 1 },
      { catalogKey: "nuts", sortOrder: 2 },
      { catalogKey: "washers", sortOrder: 3 },
      { catalogKey: "products", sortOrder: 4 },
      { catalogKey: "categories", sortOrder: 5 },
      { catalogKey: "customers", sortOrder: 6 },
      { catalogKey: "inventory", sortOrder: 7 },
    ];
  }

  if (normalizedPosType === "RESTAURANTE") {
    return [
      { catalogKey: "menu", sortOrder: 1 },
      { catalogKey: "tables", sortOrder: 2 },
      { catalogKey: "customers", sortOrder: 3 },
      { catalogKey: "inventory", sortOrder: 4 },
    ];
  }

  if (normalizedPosType === "SERVICIOS") {
    return [
      { catalogKey: "services", sortOrder: 1 },
      { catalogKey: "customers", sortOrder: 2 },
      { catalogKey: "appointments", sortOrder: 3 },
    ];
  }

  return [
    { catalogKey: "products", sortOrder: 1 },
    { catalogKey: "categories", sortOrder: 2 },
    { catalogKey: "customers", sortOrder: 3 },
    { catalogKey: "inventory", sortOrder: 4 },
  ];
}

function isTenantSchemaCompatibilityError(message) {
  return (
    message.includes("Unknown argument `posType`") ||
    message.includes("Unknown argument `catalogMode`") ||
    message.includes("Unknown argument `uiPreset`") ||
    message.includes("Argument `name` is missing")
  );
}

function normalizePhone(phoneNumber) {
  return String(phoneNumber || "").trim().replace(/[\s()-]/g, "");
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedValue) {
  const [salt, storedHash] = String(storedValue || "").split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const incomingHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const incomingBuffer = Buffer.from(incomingHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (incomingBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, storedBuffer);
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetCodeHash(phoneNumber, code) {
  return hashResetToken(`${phoneNumber}:${code}`);
}

function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(RESET_CODE_DIGITS, "0");
}

function getMercadoPagoDeviceSessionId(req) {
  return normalizeOptionalString(req.headers["x-meli-session-id"] || req.body?.deviceSessionId);
}

router.post("/signup/preapproval", async (req, res) => {
  try {
    const result = await createProviderPreapproval({
      provider: "mercado-pago",
      tenantId: null,
      data: req.body || {},
      deviceSessionId: getMercadoPagoDeviceSessionId(req),
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
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user with phoneNumber and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignUpRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: user created
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Phone number already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/signup", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const email = normalizeOptionalString(req.body?.email);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    const posType = String(req.body?.posType || DEFAULT_POS_TYPE).trim().toUpperCase();
    const legalName = String(req.body?.fullName || "").trim();
    const planCode = String(req.body?.planCode || "FREE").trim().toUpperCase();
    const paymentProvider = normalizeOptionalString(req.body?.paymentProvider);
    const paymentMethodToken = normalizeOptionalString(req.body?.paymentMethodToken);
    const paymentCustomerRef = normalizeOptionalString(req.body?.paymentCustomerRef);
    const paymentMethodBrand = normalizeOptionalString(req.body?.paymentMethodBrand);
    const paymentMethodStatus = normalizeOptionalString(req.body?.paymentMethodStatus);

    if (!fullName || !phoneNumber || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "fullName, phoneNumber, password y confirmPassword son requeridos" });
    }

    if (!legalName) {
      return res.status(400).json({ message: "legalName es requerido" });
    }

    if (phoneNumber.length < PHONE_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `phoneNumber debe tener al menos ${PHONE_MIN_LENGTH} caracteres` });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `password debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "password y confirmPassword deben coincidir" });
    }

    if (!ALLOWED_POS_TYPES.has(posType)) {
      return res.status(400).json({
        message: `posType invalido. Usa uno de: ${Array.from(ALLOWED_POS_TYPES).join(", ")}`,
      });
    }

    if (!ALLOWED_PLAN_CODES.includes(planCode)) {
      return res.status(400).json({
        message: `planCode invalido. Usa uno de: ${ALLOWED_PLAN_CODES.join(", ")}`,
      });
    }

    if (planCode !== "FREE" && !paymentMethodToken) {
      return res.status(400).json({
        message: "paymentMethodToken es requerido para planes de pago",
      });
    }

    const normalizedPaymentProvider = String(paymentProvider || "mercado-pago").trim().toLowerCase();
    const isSupportedPaymentProvider =
      normalizedPaymentProvider === "mercado-pago" ||
      normalizedPaymentProvider === "mercadopago";
    if (planCode !== "FREE" && !isSupportedPaymentProvider) {
      return res.status(400).json({
        message: "paymentProvider invalido. Usa mercado-pago",
      });
    }

    if (paymentMethodStatus && !ALLOWED_PAYMENT_METHOD_STATUS.includes(paymentMethodStatus.toLowerCase())) {
      return res.status(400).json({
        message: `paymentMethodStatus invalido. Usa: ${ALLOWED_PAYMENT_METHOD_STATUS.join(", ")}`,
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingUser) {
      return res.status(409).json({ message: "phoneNumber ya esta registrado" });
    }

    await ensureTenantSubscriptionTable();

    const user = await prisma.$transaction(async (tx) => {
      const defaultCatalogs = getDefaultCatalogsForPosType(posType);
      const tenantCreateAttempts = [
        {
          legalName,
          posType,
          catalogMode: "STANDARD",
          uiPreset: "DEFAULT",
          commercialName: null,
          rfc: null,
          phone: null,
          email,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          postalCode: null,
        },
        {
          legalName,
          commercialName: null,
          rfc: null,
          phone: null,
          email,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          postalCode: null,
        },
        {
          name: legalName,
          posType,
          catalogMode: "STANDARD",
          uiPreset: "DEFAULT",
        },
        {
          name: legalName,
        },
      ];

      let tenant = null;
      let lastTenantError = null;

      for (const data of tenantCreateAttempts) {
        try {
          tenant = await tx.tenant.create({ data });
          break;
        } catch (tenantError) {
          const message = String(tenantError?.message || "");
          lastTenantError = tenantError;
          if (!isTenantSchemaCompatibilityError(message)) {
            throw tenantError;
          }
        }
      }

      if (!tenant) {
        throw lastTenantError || new Error("no se pudo crear el tenant");
      }

      if (tx.tenantCatalog?.createMany && defaultCatalogs.length > 0) {
        try {
          await tx.tenantCatalog.createMany({
            data: defaultCatalogs.map((catalog) => ({
              tenantId: tenant.id,
              catalogKey: catalog.catalogKey,
              isEnabled: true,
              sortOrder: catalog.sortOrder,
            })),
            skipDuplicates: true,
          });
        } catch (catalogError) {
          const message = String(catalogError?.message || "");
          const isCompatibilityError =
            message.includes("tenant_catalogs") ||
            message.includes("Unknown arg") ||
            message.includes("Unknown field");

          if (!isCompatibilityError) {
            throw catalogError;
          }
        }
      }

      const defaultBusinessType = getDefaultBusinessTypeForPosType(posType);
      if (tx.tenantBusinessTypeProfile?.upsert) {
        await tx.tenantBusinessTypeProfile.upsert({
          where: { tenantId: tenant.id },
          update: { businessType: defaultBusinessType },
          create: {
            tenantId: tenant.id,
            businessType: defaultBusinessType,
          },
        });
      } else {
        try {
          await tx.$executeRaw`
            INSERT INTO tenant_business_type_profiles (tenant_id, business_type, created_at, updated_at)
            VALUES (${tenant.id}, ${defaultBusinessType}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
            ON DUPLICATE KEY UPDATE
              business_type = VALUES(business_type),
              updated_at = CURRENT_TIMESTAMP(3)
          `;
        } catch (profileError) {
          const message = String(profileError?.message || "");
          const isCompatibilityError =
            message.includes("tenant_business_type_profiles") ||
            message.includes("doesn't exist") ||
            message.includes("Unknown column");

          if (!isCompatibilityError) {
            throw profileError;
          }
        }
      }

      if (tx.role?.createMany) {
        await tx.role.createMany({
          data: [
            { tenantId: tenant.id, name: "Administrador" },
            { tenantId: tenant.id, name: "Supervisor" },
            { tenantId: tenant.id, name: "Cajero" },
            { tenantId: tenant.id, name: "Inventario" },
          ],
          skipDuplicates: true,
        });
      } else {
        await tx.$executeRaw`
          INSERT IGNORE INTO roles (id, tenant_id, name, created_at)
          VALUES
            (UUID(), ${tenant.id}, 'Administrador', CURRENT_TIMESTAMP(3)),
            (UUID(), ${tenant.id}, 'Supervisor', CURRENT_TIMESTAMP(3)),
            (UUID(), ${tenant.id}, 'Cajero', CURRENT_TIMESTAMP(3)),
            (UUID(), ${tenant.id}, 'Inventario', CURRENT_TIMESTAMP(3))
        `;
      }

      const createdUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          fullName,
          phoneNumber,
          passwordHash: hashPassword(password),
        },
        select: {
          id: true,
          tenantId: true,
          fullName: true,
          phoneNumber: true,
          createdAt: true,
        },
      });

      // Always relate created user with Administrador role for this tenant.
      await tx.$executeRaw`
        INSERT INTO user_roles (id, user_id, role_id, created_at)
        SELECT UUID(), ${createdUser.id}, r.id, CURRENT_TIMESTAMP(3)
        FROM roles r
        WHERE r.tenant_id = ${createdUser.tenantId}
          AND r.name = 'Administrador'
        ON DUPLICATE KEY UPDATE role_id = role_id
      `;

      const planDefaults = DEFAULTS_BY_PLAN[planCode];
      await tx.$executeRaw`
        INSERT INTO tenant_subscriptions (
          id,
          tenant_id,
          plan_code,
          status,
          trial_ends_at,
          auto_renew,
          payment_provider,
          payment_customer_ref,
          payment_method_token,
          payment_method_brand,
          payment_method_status,
          limits_users,
          limits_branches,
          limits_products,
          limits_orders_per_month,
          limits_customers
        ) VALUES (
          UUID(),
          ${createdUser.tenantId},
          ${planCode},
          'trialing',
          DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 15 DAY),
          ${planCode === "FREE" ? 0 : 1},
          ${planCode === "FREE" ? null : normalizedPaymentProvider === "mercadopago" ? "mercado-pago" : normalizedPaymentProvider},
          ${planCode === "FREE" ? null : paymentCustomerRef},
          ${planCode === "FREE" ? null : paymentMethodToken},
          ${planCode === "FREE" ? null : paymentMethodBrand},
          ${planCode === "FREE" ? null : paymentMethodStatus ? paymentMethodStatus.toLowerCase() : "pending"},
          ${planDefaults.limitsUsers},
          ${planDefaults.limitsBranches},
          ${planDefaults.limitsProducts},
          ${planDefaults.limitsOrdersPerMonth},
          ${planDefaults.limitsCustomers}
        )
      `;

      return createdUser;
    });

    return res.status(201).json({
      message: `usuario creado. prueba de ${DEFAULT_TRIAL_DAYS} dias iniciada`,
      user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "rfc ya esta registrado para otro tenant" });
    }

    return res.status(500).json({ message: "error al registrar usuario", error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Sign in using phoneNumber and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignInRequest'
 *     responses:
 *       200:
 *         description: Signin successful
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/signin", async (req, res) => {
  try {
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const password = String(req.body?.password || "");

    if (!phoneNumber || !password) {
      return res.status(400).json({ message: "phoneNumber y password son requeridos" });
    }

    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "credenciales invalidas" });
    }

    return res.status(200).json({
      message: "inicio de sesion exitoso",
      sessionToken: buildSessionToken(user.id, user.tenantId),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "error al iniciar sesion", error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/recovery-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Generate a password reset code by phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecoveryPasswordRequest'
 *     responses:
 *       200:
 *         description: Recovery request accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecoveryPasswordResponse'
 *             examples:
 *               production:
 *                 summary: Production response
 *                 value:
 *                   message: Si el phoneNumber existe, se enviara un codigo de recuperacion
 *               development:
 *                 summary: Development response with code
 *                 value:
 *                   message: Si el phoneNumber existe, se enviara un codigo de recuperacion
 *                   expiresAt: "2026-05-09T18:30:00.000Z"
 *                   recoveryCode: "493821"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/recovery-password", async (req, res) => {
  try {
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    if (!phoneNumber) {
      return res.status(400).json({ message: "phoneNumber es requerido" });
    }

    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      return res
        .status(200)
        .json({ message: "Si el phoneNumber existe, se enviara un codigo de recuperacion" });
    }

    const resetCode = generateResetCode();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          tokenHash: buildResetCodeHash(phoneNumber, resetCode),
          userId: user.id,
          expiresAt,
        },
      }),
    ]);

    const response = {
      message: "Si el phoneNumber existe, se enviara un codigo de recuperacion",
      expiresAt,
    };

    if (process.env.NODE_ENV !== "production") {
      response.recoveryCode = resetCode;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: "error en recuperacion de contrasena", error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password using a valid reset code or token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResetPasswordResponse'
 *             example:
 *               message: contrasena restablecida exitosamente
 *       400:
 *         description: Invalid request, code, or token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const code = String(req.body?.code || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if ((!token && (!phoneNumber || !code)) || !newPassword) {
      return res.status(400).json({ message: "token o phoneNumber/code y newPassword son requeridos" });
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `newPassword debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });
    }

    const tokenHash = token ? hashResetToken(token) : buildResetCodeHash(phoneNumber, code);
    const resetEntry = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetEntry ||
      resetEntry.usedAt ||
      resetEntry.expiresAt < new Date() ||
      (!token && resetEntry.user.phoneNumber !== phoneNumber)
    ) {
      return res.status(400).json({ message: "codigo invalido o expirado" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetEntry.userId },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetEntry.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.status(200).json({ message: "contrasena restablecida exitosamente" });
  } catch (error) {
    return res.status(500).json({ message: "error al restablecer contrasena", error: error.message });
  }
});

module.exports = router;
